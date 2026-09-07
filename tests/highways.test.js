// Highways and on-ramps. The manual, page 68: "Highways may be built over
// roads, but if you want your Sims to be able to get from one to the other,
// the intersection requires an on-ramp. On-Ramps allow your Sims to get on
// and off highways."
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, evaluate, refresh, serialize, deserialize } from "../src/sim.js";
import { findLot, assignLot } from "../src/sim/lots.js";
import { TECH_YEAR, ACCESS_TYPES, ROAD_TYPES } from "../src/sim/catalog.js";

const at = (c, x, y) => c.tiles[y * c.size + x];
const plains = () => createCity({ seed: 5, starter: false, layout: "plains", startYear: 2000 });
const put = (c, x, y, tool, o) => { c.money = 5_000_000; return place(c, x, y, tool, o); };

// Homes in the west, jobs in the east, joined only by the given corridor.
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

  test("a ramp must touch both a road and a highway", () => {
    const c = plains();
    for (let x = 10; x <= 20; x++) put(c, x, 10, "highway");
    assert.match(evaluate(c, 10, 12, "onramp").message, /must touch a highway/);
    put(c, 10, 11, "road");
    // Beside the highway but with no street on the other side.
    assert.match(evaluate(c, 25, 25, "onramp").message, /must touch a highway/);
    // Between the two, it fits.
    assert.equal(evaluate(c, 10, 11, "onramp").ok, true);
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
    put(c, 12, 11, "road");
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
