import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createCity, tick, place, disaster, serialize, deserialize, refresh } from '../src/sim/index.js';
import { policeUnits, unitsAvailable } from '../src/sim/fire.js';
import { triggerDisaster, advanceEffects, randomDisaster, fireRiskOf } from '../src/sim/disasters.js';
import { assignLot } from '../src/sim/lots.js';

function site() {
  const c = createCity({ size: 32, seed: 7, starter: false, layout: 'plains', hills: 0 });
  for (const t of c.tiles) { t.terrain = 'grass'; t.trees = 0; t.elev = 0; }
  const t = c.tiles[16 * c.size + 16];
  t.type = 'residential'; t.density = 1;
  assignLot(c, { x: 16, y: 16, w: 1, h: 1 }, 4, 0.1);
  return c;
}

test('volcano clears the cone and preserves rock and elevation through saves', () => {
  const c = site();
  const center = c.tiles[16 * c.size + 16];
  center.pipe = center.powerline = center.subway = true;
  triggerDisaster(c, 'volcano', () => 0.5);
  assert.equal(center.type, 'empty');
  assert.equal(center.lot, null);
  assert.equal(center.elev, 6);
  assert.equal(center.terrain, 'rock');
  assert.ok(!center.pipe && !center.powerline && !center.subway);
  const restored = deserialize(serialize(c));
  assert.deepEqual(restored.tiles.map(t => [t.terrain, t.elev]), c.tiles.map(t => [t.terrain, t.elev]));
  assert.equal(restored.effects.find(e => e.type === 'lava').ttl, 6);
});

test('toxic cloud pollution survives reload and clears when the cloud expires', () => {
  const c = site();
  triggerDisaster(c, 'toxic', () => 0);
  refresh(c);
  const center = c.tiles[16 * c.size + 16];
  assert.ok(center.abandoned, 'homes are evacuated');
  assert.ok(center.pollution > 60, 'cloud creates substantial pollution');
  const restored = deserialize(serialize(c));
  assert.equal(restored.tiles[16 * c.size + 16].pollution, center.pollution);
  for (let i = 0; i < 3; i++) advanceEffects(restored);
  refresh(restored);
  assert.equal(restored.effects.length, 0);
  assert.equal(restored.tiles[16 * c.size + 16].pollution, 0);
});

test('saucer paths and flood duration survive saves without animation flags', () => {
  const c = site();
  triggerDisaster(c, 'ufo', () => 0.5);
  c.tiles[0].flooded = 2;
  c.effects.push({ type: 'earthquake', x: 16, y: 16, ttl: 1, shown: true });
  const restored = deserialize(serialize(c));
  assert.deepEqual(restored.effects[0].path, c.effects[0].path);
  assert.equal(restored.effects[1].shown, undefined);
  assert.equal(restored.tiles[0].flooded, 2);
  advanceEffects(restored);
  assert.equal(restored.tiles[0].flooded, 1);
});

test('legacy saves load without effects, and malformed effects are rejected', () => {
  const raw = JSON.parse(serialize(site()));
  delete raw.effects;
  for (const tile of raw.tiles) tile.pop();
  assert.deepEqual(deserialize(JSON.stringify(raw)).effects, []);
  for (const effect of [
    { type: 'ufo', path: [], ttl: 2 },
    { type: 'ufo', path: [{ x: -1, y: 5 }], ttl: 2 },
    { type: 'lava', x: 5, y: 5, radius: 100000, ttl: 6 },
    { type: 'toxic', x: 5, y: 5, ttl: -1 },
  ]) {
    raw.effects = [effect];
    assert.throws(() => deserialize(JSON.stringify(raw)), /disaster effects/);
  }
});

test('volcano slopes remain gentle where a cone meets existing hills', () => {
  const c = site();
  for (const t of c.tiles) t.elev = Math.max(0, 5 - Math.floor(Math.abs(t.x - 16) / 2));
  triggerDisaster(c, 'volcano', () => 0.5);
  for (const t of c.tiles) for (const [dx, dy] of [[1, 0], [0, 1]]) {
    if (t.x + dx >= c.size || t.y + dy >= c.size) continue;
    const neighbor = c.tiles[(t.y + dy) * c.size + t.x + dx];
    assert.ok(Math.abs(t.elev - neighbor.elev) <= 1, 'adjacent terrain differs by at most one level');
  }
});

test('ineligible disasters do not transfer their probability to a saucer', () => {
  const c = site(), stats = { population: 1000, dryShare: 0, pollution: 0, crime: 0 };
  const fireRisk = fireRiskOf(stats);
  assert.equal(randomDisaster(c, stats, () => fireRisk + 0.002), null, 'no water means no flood');
  assert.equal(randomDisaster(c, stats, () => fireRisk + 0.0025), null, 'clean air means no toxic leak');
  assert.equal(c.effects?.length || 0, 0);
  assert.match(randomDisaster(c, stats, () => fireRisk + 0.003), /saucer/);
});

test('toxic waste dumps qualify as sources for toxic leaks', () => {
  const c = site(), dump = c.tiles[20 * c.size + 20];
  dump.type = 'toxicdump';
  assignLot(c, { x: 20, y: 20, w: 1, h: 1 }, 1, 0.1);
  triggerDisaster(c, 'toxic', () => 0);
  assert.equal(c.effects[0].x, 20);
  assert.equal(c.effects[0].y, 20);
});

describe("a riot runs until the police break it up", () => {
  // "Fires and riots are the only disasters where you can make a difference by
  // dispatching fire and police units. It doesn't matter how many police
  // officers you send to an earthquake or alien attack, it won't make any
  // difference once the disaster hits."
  const town = () => {
    const c = createCity(21, true);
    // Trouble needs somewhere to start, so make the town miserable.
    for (const t of c.tiles) if (t.lot && t.type === "residential") t.crime = 80;
    return c;
  };
  const riots = (c) => (c.effects || []).filter((e) => e.type === "riot");

  test("it leaves a riot standing, not just a scatter of fires", () => {
    const c = town();
    disaster(c, "riot");
    assert.equal(riots(c).length, 1);
    assert.ok(riots(c)[0].ttl > 1, "and it is still going next month");
  });

  test("and sets fresh fires every month it lasts", () => {
    const c = town();
    disaster(c, "riot");
    for (const t of c.tiles) t.fire = 0;
    tick(c);
    assert.ok(c.tiles.some((t) => t.fire > 0), "the riot should still be burning things");
    assert.ok(c.news.some((n) => /sets \d+ more fires/.test(n)));
  });

  test("a police unit sent to it ends it", () => {
    const c = town();
    disaster(c, "riot");
    const e = riots(c)[0];
    c.money = 5_000_000;
    const before = policeUnits(c);
    assert.ok(before > 1, "the sample town has precincts");
    assert.equal(place(c, e.x, e.y, "patrol").ok, true);
    assert.equal(e.ttl, 1, "it is over at the end of this month");
    assert.equal(unitsAvailable(c), before - 1);
  });

  test("but only within reach of it", () => {
    const c = town();
    disaster(c, "riot");
    const e = riots(c)[0];
    const far = { x: (e.x + 30) % c.size, y: (e.y + 30) % c.size };
    const r = place(c, far.x, far.y, "patrol");
    assert.equal(r.ok, false);
    assert.match(r.message, /No riot within/);
  });

  test("and only as many units as there are precincts, plus one", () => {
    const c = town();
    c.money = 5_000_000;
    const units = policeUnits(c);
    for (let i = 0; i < units; i++) {
      disaster(c, "riot");
      const e = riots(c).find((x) => x.ttl > 1);
      if (!e) break;
      assert.equal(place(c, e.x, e.y, "patrol").ok, true, `unit ${i + 1}`);
    }
    assert.equal(unitsAvailable(c), 0);
    disaster(c, "riot");
    const e = riots(c).find((x) => x.ttl > 1);
    if (e) assert.match(place(c, e.x, e.y, "patrol").message, /already out this month/);
  });

  test("the units come back next month, and a save cannot refill them", () => {
    const c = town();
    disaster(c, "riot");
    const e = riots(c)[0];
    c.money = 5_000_000;
    place(c, e.x, e.y, "patrol");
    assert.equal(deserialize(serialize(c)).patrolled, 1);
    tick(c);
    assert.equal(unitsAvailable(c), policeUnits(c));
  });

  test("a riot survives a save", () => {
    const c = town();
    disaster(c, "riot");
    const back = deserialize(serialize(c));
    assert.deepEqual(back.effects.filter((e) => e.type === "riot"), riots(c));
  });
});
