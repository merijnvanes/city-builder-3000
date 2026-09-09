// Highways and on-ramps. The manual, page 68: "Highways may be built over
// roads, but if you want your Sims to be able to get from one to the other,
// the intersection requires an on-ramp. On-Ramps allow your Sims to get on
// and off highways."
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, evaluate, refresh, serialize, deserialize } from "../src/sim.js";
import { findLot, assignLot } from "../src/sim/lots.js";
import { TECH_YEAR, ACCESS_TYPES, ROAD_TYPES } from "../src/sim/catalog.js";
import { rampAxis } from "../src/sim/highways.js";

const at = (c, x, y) => c.tiles[y * c.size + x];
const plains = () => createCity({ seed: 5, starter: false, layout: "plains", startYear: 2000 });
const put = (c, x, y, tool, o) => { c.money = 5_000_000; return place(c, x, y, tool, o); };

// Homes in the northwest, jobs in the southeast, joined only by the given corridor.
function corridor(ramps) {
  const c = plains();
  for (let x = 2; x <= 8; x++) put(c, x, 20, "road");
  for (let x = 9; x <= 46; x++) put(c, x, 20, "highway");
  for (let x = 47; x <= 52; x++) put(c, x, 20, "road");
  if (ramps) { put(c, 8, 20, "onramp"); put(c, 47, 20, "onramp"); }
  put(c, 2, 10, "coal");
  for (let x = 6; x <= 8; x++) put(c, x, 12, "powerline");
  for (let y = 13; y <= 20; y++) put(c, 8, y, "powerline");
  for (let x = 9; x <= 52; x++) put(c, x, 19, "powerline");
  for (let y = 21; y <= 23; y++) for (let x = 3; x <= 8; x++) put(c, x, y, "residential", { density: 1 });
  for (let y = 21; y <= 23; y++) for (let x = 47; x <= 52; x++) put(c, x, y, "industrial", { density: 1 });
  refresh(c);
  for (const t of c.tiles) if (["residential", "industrial"].includes(t.type) && !t.lot) { const lot = findLot(c, t); if (lot) assignLot(c, lot, 2, 0.5); }
  refresh(c); tick(c);
  return c;
}

describe("on-ramps join streets to highways", () => {
  test("without a ramp, nobody can get on or off", () => {
    assert.equal(getStats(corridor(false)).employed, 0);
  });

  test("with ramps at both ends the corridor carries commuters", () => {
    assert.ok(getStats(corridor(true)).employed > 0);
  });

  test("a ramp needs the highway at its head and a road at its foot", () => {
    const c = plains();
    for (let x = 10; x <= 20; x++) put(c, x, 10, "highway");
    assert.match(evaluate(c, 10, 12, "onramp").message, /highway on one side and a road on the opposite side/);
    // Beside the highway but with no street beyond the far side.
    assert.equal(evaluate(c, 10, 11, "onramp").ok, false);
    put(c, 10, 12, "road");
    // Between the two, it fits, and it climbs toward the highway.
    assert.equal(evaluate(c, 10, 11, "onramp").ok, true);
    put(c, 10, 11, "onramp");
    assert.deepEqual(rampAxis(c, at(c, 10, 11)), { dx: 0, dy: -1 });
    // A street beside the ramp, rather than at its foot, is not enough.
    put(c, 12, 11, "road");
    assert.equal(evaluate(c, 13, 11, "onramp").ok, false);
    // A ramp cannot sit in the middle of a highway either.
    assert.equal(evaluate(c, 15, 10, "onramp").ok, false);
  });

  test("traffic uses a ramp only along its axis", () => {
    // Homes reach the highway through a ramp at its foot; a street that
    // merely touches the ramp's side never gets onto the deck.
    const c = plains();
    for (let x = 9; x <= 46; x++) put(c, x, 20, "highway");
    put(c, 2, 10, "coal");
    for (let x = 6; x <= 8; x++) put(c, x, 12, "powerline");
    for (let y = 13; y <= 19; y++) put(c, 8, y, "powerline");
    for (let x = 9; x <= 52; x++) put(c, x, 19, "powerline");
    for (let x = 47; x <= 52; x++) put(c, x, 20, "road");
    put(c, 47, 20, "onramp");
    for (let y = 21; y <= 23; y++) for (let x = 47; x <= 52; x++) put(c, x, y, "industrial", { density: 1 });
    // The western ramp's foot faces west, but the street arrives at its side.
    // Homes stay more than three tiles from the ramp and its foot, so the only
    // way onto the network is that side street.
    put(c, 8, 20, "road"); put(c, 7, 20, "road");
    put(c, 8, 20, "onramp");
    for (let y = 21; y <= 24; y++) put(c, 8, y, "road");
    for (let y = 24; y <= 25; y++) for (let x = 2; x <= 6; x++) put(c, x, y, "residential", { density: 1 });
    refresh(c);
    for (const t of c.tiles) if (["residential", "industrial"].includes(t.type) && !t.lot) { const lot = findLot(c, t); if (lot) assignLot(c, lot, 2, 0.5); }
    refresh(c); tick(c);
    assert.equal(getStats(c).employed, 0, "the side street cannot join the ramp");
    for (let x = 2; x <= 7; x++) put(c, x, 21, "road");
    refresh(c); tick(c);
    assert.ok(getStats(c).employed > 0, "a street reaching the foot can");
  });

  test("it can be laid straight over the road it replaces", () => {
    const c = plains();
    for (let x = 10; x <= 20; x++) put(c, x, 10, "highway");
    for (let y = 11; y <= 16; y++) put(c, 12, y, "road");
    assert.equal(put(c, 12, 11, "onramp").ok, true);
    assert.equal(at(c, 12, 11).type, "onramp");
  });

  test("it is not available before highways are invented", () => {
    assert.equal(TECH_YEAR.onramp, TECH_YEAR.highway);
    const early = createCity({ seed: 5, starter: false, layout: "plains", startYear: 1900 });
    early.money = 500000;
    assert.equal(evaluate(early, 10, 10, "onramp").ok, false);
  });
});

describe("a ramp behaves like a street", () => {
  test("it gives lots road access, and a bare highway does not", () => {
    assert.equal(ACCESS_TYPES.has("onramp"), true);
    assert.equal(ACCESS_TYPES.has("highway"), false);
    const c = plains();
    for (let x = 10; x <= 20; x++) put(c, x, 10, "highway");
    put(c, 12, 11, "road"); put(c, 12, 12, "road");
    put(c, 12, 11, "onramp");
    put(c, 13, 12, "residential", { density: 1 });
    refresh(c);
    assert.equal(at(c, 13, 12).roadAccess, true);

    const bare = plains();
    for (let x = 10; x <= 20; x++) put(bare, x, 10, "highway");
    put(bare, 11, 12, "residential", { density: 1 });
    refresh(bare);
    assert.equal(at(bare, 11, 12).roadAccess, false);
  });

  test("power jumps across it, as it does across any street", () => {
    assert.equal(ROAD_TYPES.has("onramp"), true);
  });

  test("ramps survive a save", () => {
    const c = corridor(true);
    const d = deserialize(serialize(c));
    assert.equal(at(d, 8, 20).type, "onramp");
    assert.equal(getStats(d).employed, getStats(c).employed);
    tick(c); tick(d);
    assert.equal(serialize(d), serialize(c));
  });
});

describe("a highway built over a street", () => {
  // "Highways may be built over roads, but if you want your Sims to be able to
  // get from one to the other, the intersection requires an on-ramp."
  const town = () => createCity({ seed: 12, starter: false, layout: "plains", hills: 0, startYear: 2000 });

  test("the highway goes over and the street stays underneath", () => {
    const c = town();
    for (let y = 10; y <= 50; y++) put(c, 30, y, "road");
    const r = put(c, 30, 30, "highway");
    assert.equal(r.ok, true);
    assert.match(r.message, /Viaduct over the road/);
    const t = at(c, 30, 30);
    assert.equal(t.type, "highway");
    assert.equal(t.under, 1);
  });

  test("it costs more than laying one on open ground", () => {
    const c = town();
    for (let y = 10; y <= 50; y++) put(c, 30, y, "road");
    const bare = evaluate(c, 31, 20, "highway").cost;
    assert.ok(evaluate(c, 30, 30, "highway").cost > bare);
  });

  test("a second deck cannot go on the same tile", () => {
    const c = town();
    for (let y = 10; y <= 50; y++) put(c, 30, y, "road");
    put(c, 30, 30, "highway");
    assert.equal(evaluate(c, 30, 30, "highway").noop, true);
  });

  test("bulldozing the deck leaves the street it crossed", () => {
    const c = town();
    for (let y = 10; y <= 50; y++) put(c, 30, y, "road");
    put(c, 30, 30, "highway");
    put(c, 30, 30, "bulldoze");
    assert.equal(at(c, 30, 30).type, "road");
    assert.equal(at(c, 30, 30).under, 0);
  });

  test("the street below still serves the lots beside it", () => {
    const c = town();
    for (let y = 10; y <= 50; y++) put(c, 30, y, "road");
    put(c, 30, 30, "highway");
    refresh(c);
    assert.equal(at(c, 31, 30).roadAccess, true);
    assert.equal(at(c, 29, 30).roadAccess, true);
  });

  test("rail may be crossed too, and the track stays track", () => {
    const c = town();
    for (let y = 10; y <= 50; y++) put(c, 30, y, "rail");
    assert.equal(put(c, 30, 30, "highway").ok, true);
    assert.equal(at(c, 30, 30).under, 2);
    put(c, 30, 30, "bulldoze");
    assert.equal(at(c, 30, 30).type, "rail");
  });

  test("it survives a save and a tampered viaduct is rejected", () => {
    const c = town();
    for (let y = 10; y <= 50; y++) put(c, 30, y, "road");
    put(c, 30, 30, "highway");
    refresh(c);
    const back = deserialize(serialize(c));
    assert.equal(at(back, 30, 30).under, 1);
    assert.equal(serialize(back), serialize(c));

    const bad = JSON.parse(serialize(c));
    bad.tiles[30 * c.size + 30][25] = 3;
    assert.throws(() => deserialize(JSON.stringify(bad)), /bad viaduct/);

    // And a viaduct with no highway over it is nonsense.
    const orphan = JSON.parse(serialize(c));
    const road = orphan.tiles.findIndex((row, i) => i !== 30 * c.size + 30 && orphan.types[row[2]] === "road");
    orphan.tiles[road][25] = 1;
    assert.throws(() => deserialize(JSON.stringify(orphan)), /viaduct without a highway/);
  });

  // The whole point: a street the highway crosses is not severed.
  function corridor(cross) {
    const c = town();
    for (let y = 10; y <= 50; y++) if (cross || y !== 30) put(c, y === 30 ? 30 : 30, y, "road");
    for (let x = 10; x <= 50; x++) if (x !== 30) put(c, x, 30, "highway");
    put(c, 30, 30, "highway");
    put(c, 24, 12, "coal");
    for (let x = 28; x <= 29; x++) for (let y = 12; y <= 48; y++) put(c, x, y, "powerline");
    for (let y = 12; y <= 48; y++) put(c, 29, y, "pipe");
    for (const y of [20, 40]) { put(c, 28, y, "watertower"); put(c, 28, y, "pipe"); }
    for (let y = 12; y <= 20; y++) for (let x = 31; x <= 33; x++) put(c, x, y, "residential", { density: 2 });
    for (let y = 40; y <= 48; y++) for (let x = 31; x <= 33; x++) put(c, x, y, "industrial", { density: 2 });
    refresh(c);
    for (let i = 0; i < 12 * 12; i++) tick(c);
    return getStats(c);
  }

  test("commuters keep using the street the highway crosses", () => {
    const through = corridor(true), severed = corridor(false);
    assert.ok(through.population > 1000, `the viaduct keeps the neighbourhood alive: ${through.population}`);
    assert.ok(through.employed > 0, `and its workers reach the works: ${through.employed}`);
    assert.equal(severed.population, 0, "cutting the street with a highway kills it");
  });

  test("but they still cannot drive up onto the deck without a ramp", () => {
    const c = town();
    // A dead-end street that only meets the highway at a viaduct.
    for (let y = 28; y <= 32; y++) put(c, 30, y, "road");
    for (let x = 10; x <= 50; x++) put(c, x, 30, "highway");
    assert.equal(at(c, 30, 30).under, 1);
    refresh(c);
    // The street under the deck reaches only its own five tiles; the highway
    // above goes right across the map and never picks anyone up.
    const s = getStats(c);
    assert.equal(s.employed, 0, "nobody is going anywhere on a five-tile street");
  });
});
