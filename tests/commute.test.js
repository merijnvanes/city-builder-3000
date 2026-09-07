// How far Sims will travel, and what that does to where a city grows.
//
// The manual, City Planning Advisor: "Sims don't like to travel too far. A
// Residential or Commercial zone won't develop if it's beyond a reasonable
// commute distance from other zones. But an Industrial zone on the outskirts
// of town could develop into a farm. Transportation is the key; Sims may move
// in, but if the commute becomes tiresome they'll move right back out."
//
// And the Transportation Advisor: "Sims aren't willing to drive as far if
// traffic is bad. That means that you are forced to make a tiny congested city
// with no real hope for expansion... When mass transit is introduced, Sims
// tend to get their cars off the road. Fewer cars means less traffic and less
// traffic means Sims are willing to travel further."
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, place, tick, refresh, getStats, inspectTile } from "../src/sim.js";
import { tripRange, MAX_TRIP, MIN_TRIP, PATIENCE, GRIDLOCK } from "../src/sim/traffic.js";
import { connected, commuteAppeal } from "../src/sim/growth.js";

const at = (c, x, y) => c.tiles[y * c.size + x];
const put = (c, x, y, tool, o) => { c.money = 50_000_000; return place(c, x, y, tool, o); };
// A map with no water anywhere near the corridor these tests build in.
const plains = () => createCity({ seed: 12, starter: false, layout: "plains", hills: 0, startYear: 2000, size: 64 });

// One long street west to east: a works at the west end, power and water all
// along it, and a block of housing wherever the test asks for one.
function corridor(homeX, { road = [2, 60] } = {}) {
  const c = plains();
  for (let x = road[0]; x <= road[1]; x++) put(c, x, 30, "road");
  put(c, 3, 25, "coal");
  for (let x = 2; x <= 60; x++) { put(c, x, 29, "powerline"); put(c, x, 29, "pipe"); }
  for (let x = 6; x <= 58; x += 8) {
    put(c, x, 26, "watertower");
    for (const y of [27, 28]) { put(c, x, y, "powerline"); put(c, x, y, "pipe"); }
  }
  for (let y = 31; y <= 34; y++) for (let x = 8; x <= 20; x++) put(c, x, y, "industrial", { density: 2 });
  if (homeX != null) for (let y = 31; y <= 33; y++) for (let x = homeX; x < homeX + 6; x++) put(c, x, y, "residential", { density: 2 });
  refresh(c);
  return c;
}

const population = (c) => getStats(c).population;
const years = (c, n) => { for (let i = 0; i < n * 12; i++) tick(c); };

describe("how far a Sim will drive", () => {
  test("a quiet city loses nothing", () => {
    for (const traffic of [0, 10, 20, PATIENCE]) assert.equal(tripRange(traffic), MAX_TRIP, `traffic ${traffic}`);
  });

  test("a jammed one shrinks in on itself", () => {
    assert.equal(tripRange(GRIDLOCK), MIN_TRIP);
    assert.equal(tripRange(200), MIN_TRIP, "and no further");
    assert.ok(tripRange(55) < MAX_TRIP && tripRange(55) > MIN_TRIP, "and slides in between");
  });

  test("the range falls as the roads fill", () => {
    let last = MAX_TRIP + 1;
    for (let v = 0; v <= 100; v += 5) {
      const r = tripRange(v);
      assert.ok(r <= last, `range should never rise: ${v}`);
      last = r;
    }
  });
});

describe("a zone beyond a reasonable commute", () => {
  test("housing on its own with no work in range never develops", () => {
    // A street of houses off in a corner, joined to nothing.
    const c = corridor(null);
    for (let x = 44; x <= 56; x++) put(c, x, 56, "road");
    for (let x = 44; x <= 56; x++) { put(c, x, 55, "powerline"); put(c, x, 55, "pipe"); }
    put(c, 50, 52, "watertower");
    for (const y of [53, 54]) { put(c, 50, y, "powerline"); put(c, 50, y, "pipe"); }
    for (let x = 46; x <= 54; x++) put(c, x, 51, "powerline");
    for (let y = 31; y <= 50; y++) put(c, 46, y, "powerline");
    for (let y = 57; y <= 59; y++) for (let x = 46; x <= 54; x++) put(c, x, y, "residential", { density: 2 });
    refresh(c);
    // The rule only has something to say once there is work somewhere, so let
    // the works open first.
    years(c, 3);
    const seed = at(c, 46, 57);
    assert.equal(seed.powered, true, "the block has power");
    assert.equal(seed.roadAccess, true, "and a street");
    assert.equal(connected(seed), false, "but nothing to commute to");
    years(c, 15);
    const built = c.tiles.filter((t) => t.type === "residential" && t.y >= 57 && t.lot).length;
    assert.equal(built, 0, "nothing should have been built out there");
  });

  test("and the query card says so", () => {
    const c = corridor(null);
    for (let x = 44; x <= 56; x++) put(c, x, 56, "road");
    for (let y = 57; y <= 59; y++) for (let x = 46; x <= 54; x++) put(c, x, y, "residential", { density: 2 });
    refresh(c);
    years(c, 3);
    assert.match(inspectTile(c, 46, 57).details.join(" | "), /No work within a reasonable commute/);
  });

  test("but industry on the outskirts is exempt", () => {
    // "But an Industrial zone on the outskirts of town could develop into a
    // farm." Its reach is never held against it.
    const c = corridor(null);
    for (let x = 44; x <= 56; x++) put(c, x, 56, "road");
    for (let y = 57; y <= 59; y++) for (let x = 46; x <= 54; x++) put(c, x, y, "industrial", { density: 1 });
    refresh(c);
    years(c, 3);
    assert.equal(connected(at(c, 46, 57)), true);
  });
});

describe("a longer trip is a worse address", () => {
  test("appeal falls with distance and bottoms out", () => {
    assert.ok(commuteAppeal({ reach: 0 }) > commuteAppeal({ reach: 30 }));
    assert.ok(commuteAppeal({ reach: 30 }) > commuteAppeal({ reach: 70 }));
    assert.equal(commuteAppeal({ reach: -1 }), 0, "out of range is worth nothing");
  });

  // Homes and works in the same places both times, so nothing differs but the
  // length of the trip between them: one city has a straight street, the other
  // sends the same commute the long way round.
  function detour(long) {
    const c = plains();
    put(c, 3, 25, "coal");
    for (let x = 2; x <= 60; x++) { put(c, x, 29, "powerline"); put(c, x, 29, "pipe"); }
    for (let x = 6; x <= 58; x += 4) {
      put(c, x, 26, "watertower");
      for (const y of [27, 28]) { put(c, x, y, "powerline"); put(c, x, y, "pipe"); }
    }
    for (let x = 8; x <= 16; x++) put(c, x, 30, "road");
    for (let x = 28; x <= 36; x++) put(c, x, 30, "road");
    if (long) {
      // North, across, and back down: the same two ends, twice as far.
      for (let y = 24; y <= 30; y++) { put(c, 16, y, "road"); put(c, 28, y, "road"); }
      for (let x = 16; x <= 28; x++) put(c, x, 24, "road");
    } else {
      for (let x = 16; x <= 28; x++) put(c, x, 30, "road");
    }
    for (let y = 31; y <= 34; y++) for (let x = 8; x <= 14; x++) put(c, x, y, "industrial", { density: 2 });
    for (let y = 31; y <= 33; y++) for (let x = 30; x <= 35; x++) put(c, x, y, "residential", { density: 2 });
    refresh(c);
    return c;
  }

  test("the same block grows slower when the trip is longer", () => {
    const direct = detour(false), roundabout = detour(true);
    years(direct, 6); years(roundabout, 6);
    const near = at(direct, 30, 31).reach, far = at(roundabout, 30, 31).reach;
    assert.ok(far > near * 1.3, `the long way really is longer: ${far} vs ${near}`);
    // Within range, distance changes the pace rather than the outcome, so the
    // gap is real but not dramatic: about 14% after six years on this map.
    assert.ok(population(direct) > population(roundabout) * 1.08,
      `six years in, the direct route should be ahead: ${population(direct)} vs ${population(roundabout)}`);
  });

  test("given long enough, both fill up", () => {
    // Distance changes when a block builds out, not whether it can.
    const far = corridor(50);
    years(far, 25);
    assert.ok(population(far) > 1000, `the far block still gets there eventually: ${population(far)}`);
  });
});
