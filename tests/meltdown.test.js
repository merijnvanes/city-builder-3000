// Radiation and the early warning siren.
//
// "The only time Sims won't return is when an area has been contaminated by
// radiation from a nuclear explosion. Too dangerous." And: "If you can get
// your Sims off the streets and inside before a disaster strikes, the damage
// from the disaster will be much less... If you activate the siren when no
// emergency is imminent, Sims will start to doubt you."
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, disaster, setPolicy, serialize, deserialize, DISASTERS } from "../src/sim.js";
import { shelter, sirenSounding, ALERT_MONTHS, MAX_SHELTER } from "../src/sim/siren.js";
import { FALLOUT_RADIUS } from "../src/sim/power.js";

const at = (c, x, y) => c.tiles[y * c.size + x];

// A starter town whose plant has been swapped for a reactor.
function nuclearTown(seed = 21) {
  const c = createCity(seed, true);
  c.money = 500_000;
  const plant = c.tiles.find((t) => t.lot?.x === t.x && t.lot?.y === t.y && t.type === "gas");
  assert.ok(plant, "the starter town should have a plant to replace");
  place(c, plant.x, plant.y, "bulldoze");
  assert.equal(place(c, plant.x, plant.y, "nuclear").ok, true);
  return { c, x: plant.x, y: plant.y };
}

describe("a meltdown poisons the ground for good", () => {
  test("it contaminates a district and says so", () => {
    const { c } = nuclearTown();
    const message = disaster(c, "meltdown");
    assert.match(message, /MELTDOWN/);
    assert.match(message, /contaminated for good/);
    assert.ok(c.tiles.filter((t) => t.radiation).length > 10);
  });

  test("the fallout stays inside its radius", () => {
    const { c, x, y } = nuclearTown();
    disaster(c, "meltdown");
    for (const t of c.tiles) {
      if (!t.radiation) continue;
      assert.ok(Math.max(Math.abs(t.x - x), Math.abs(t.y - y)) <= FALLOUT_RADIUS, `(${t.x},${t.y}) is outside the fallout`);
    }
  });

  test("nothing rebuilds on it, however long the city runs", () => {
    const { c } = nuclearTown();
    disaster(c, "meltdown");
    const poisoned = c.tiles.filter((t) => t.radiation);
    for (let i = 0; i < 12 * 25; i++) tick(c);
    for (const t of poisoned) assert.equal(!!t.lot && !!t.level, false, `(${t.x},${t.y}) redeveloped on contaminated ground`);
    assert.equal(c.tiles.filter((t) => t.radiation).length, poisoned.length, "fallout should never fade");
  });

  test("it destroys land value and the neighbourhood's mood", () => {
    const { c } = nuclearTown();
    const before = c.tiles.filter((t) => t.radiation === false).slice();
    void before;
    disaster(c, "meltdown");
    tick(c);
    for (const t of c.tiles) {
      if (!t.radiation) continue;
      assert.ok(t.landValue <= 3, `(${t.x},${t.y}) land value ${t.landValue}`);
      assert.ok(t.aura < 30, `(${t.x},${t.y}) aura ${t.aura}`);
    }
  });

  test("radiation survives a save and a tampered flag is rejected", () => {
    const { c } = nuclearTown();
    disaster(c, "meltdown");
    const d = deserialize(serialize(c));
    assert.equal(d.tiles.filter((t) => t.radiation).length, c.tiles.filter((t) => t.radiation).length);
    tick(c); tick(d);
    assert.equal(serialize(d), serialize(c));

    const bad = JSON.parse(serialize(c));
    bad.tiles[0][24] = 5;
    assert.throws(() => deserialize(JSON.stringify(bad)), /bad radiation/);
  });

  test("a city with no reactor cannot have one melt down", () => {
    const c = createCity(21, true);
    assert.match(disaster(c, "meltdown"), /no nuclear plant/);
  });

  test("it is offered alongside the other disasters", () => {
    assert.ok(DISASTERS.meltdown);
  });
});

describe("the early warning siren", () => {
  test("sounding it puts Sims under cover for a few months", () => {
    const c = createCity(21, true);
    assert.equal(shelter(c), 0);
    assert.equal(setPolicy(c, "siren", true).ok, true);
    assert.equal(sirenSounding(c), true);
    assert.equal(shelter(c), MAX_SHELTER);
    for (let i = 0; i < ALERT_MONTHS; i++) tick(c);
    assert.equal(sirenSounding(c), false);
  });

  test("it cannot be sounded twice at once", () => {
    const c = createCity(21, true);
    setPolicy(c, "siren", true);
    assert.equal(setPolicy(c, "siren", true).ok, false);
  });

  test("a warning under cover means far less damage", () => {
    // An earthquake rolls once per tile whether or not the siren is sounding,
    // so the two runs start from the same random stream and the only
    // difference measured is the shelter itself.
    const damage = (warn) => {
      let total = 0;
      for (const seed of [11, 17, 23, 31, 37, 41, 43, 47]) {
        const c = createCity(seed, true);
        if (warn) setPolicy(c, "siren", true);
        const before = getStats(c).population;
        disaster(c, "earthquake");
        total += Math.max(0, before - getStats(c).population);
      }
      return total;
    };
    const exposed = damage(false), sheltered = damage(true);
    assert.ok(exposed > 0, "earthquakes should do some damage");
    assert.ok(sheltered < exposed * 0.75, `sheltered ${sheltered} vs exposed ${exposed}`);
  });

  test("crying wolf costs the mayor credibility", () => {
    const c = createCity(21, true);
    assert.equal(getStats(c).siren.trust, 1);
    setPolicy(c, "siren", true);
    for (let i = 0; i < ALERT_MONTHS + 1; i++) tick(c);
    assert.ok(getStats(c).siren.trust < 1, "a false alarm should cost trust");
    assert.ok(c.news.some((n) => /all clear/.test(n)));

    for (let round = 0; round < 5; round++) {
      setPolicy(c, "siren", true);
      for (let i = 0; i < ALERT_MONTHS + 1; i++) tick(c);
    }
    const trust = getStats(c).siren.trust;
    assert.ok(trust < 0.3, `trust should be spent: ${trust}`);
    assert.ok(trust > 0, "but never quite zero");
  });

  test("a doubted siren shelters fewer people", () => {
    const c = createCity(21, true);
    for (let round = 0; round < 4; round++) {
      setPolicy(c, "siren", true);
      for (let i = 0; i < ALERT_MONTHS + 1; i++) tick(c);
    }
    setPolicy(c, "siren", true);
    assert.ok(shelter(c) < MAX_SHELTER * 0.5, `a doubted warning should barely help: ${shelter(c)}`);
  });

  test("siren state survives a save", () => {
    const c = createCity(21, true);
    setPolicy(c, "siren", true);
    tick(c);
    const d = deserialize(serialize(c));
    assert.equal(sirenSounding(d), sirenSounding(c));
    assert.equal(d.siren.trust, c.siren.trust);
    tick(c); tick(d);
    assert.equal(serialize(d), serialize(c));
  });
});
