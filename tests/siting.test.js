// Buildings that only work where they belong. The manual: "Bus stops must be
// placed along the side of roads to be effective." "Once the track is laid,
// you must place Train Stations on tiles that touch the track." And of
// seaports: "They must be located along a shoreline to do anything, but if you
// want to see real results, build one on a seacoast."
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, refresh, inspectTile } from "../src/sim.js";
import { besideWhatItNeeds, sitingFactor, onSalt, sitingNote } from "../src/sim/siting.js";

const at = (c, x, y) => c.tiles[y * c.size + x];
const put = (c, x, y, tool, o) => { c.money = 5_000_000; return place(c, x, y, tool, o); };
const plains = () => createCity({ seed: 5, starter: false, layout: "plains", startYear: 2000 });
const coast = () => createCity({ seed: 5, starter: false, layout: "coast", startYear: 2000 });
const river = () => createCity({ seed: 5, starter: false, layout: "river", startYear: 2000 });

const coverage = (c, kind) => c.tiles.reduce((a, t) => a + (t.svc?.[kind] || 0), 0);

describe("bus stops beside roads", () => {
  test("a stop in a field covers nothing", () => {
    const c = plains();
    put(c, 20, 20, "bus");
    for (let y = 0; y <= 19; y++) put(c, 20, y, "powerline");
    refresh(c);
    assert.equal(besideWhatItNeeds(c, at(c, 20, 20)), false);
    assert.equal(coverage(c, "bus"), 0);
  });

  test("the same stop on a street covers its neighbourhood", () => {
    const c = plains();
    put(c, 20, 20, "bus");
    for (let x = 15; x <= 25; x++) put(c, x, 21, "road");
    for (let y = 0; y <= 19; y++) put(c, 20, y, "powerline");
    refresh(c);
    assert.equal(besideWhatItNeeds(c, at(c, 20, 20)), true);
    assert.ok(coverage(c, "bus") > 0);
  });

  test("and the query card says which it is", () => {
    const c = plains();
    put(c, 20, 20, "bus");
    refresh(c);
    assert.match(inspectTile(c, 20, 20).details.join(" | "), /Not beside a road/);
    for (let x = 15; x <= 25; x++) put(c, x, 21, "road");
    refresh(c);
    assert.equal(sitingNote(c, at(c, 20, 20)), null);
  });
});

describe("stations on the track", () => {
  test("a rail station with no track beside it is not an interchange", () => {
    const c = plains();
    put(c, 20, 20, "railstation");
    for (let x = 18; x <= 24; x++) put(c, x, 22, "road");
    for (let y = 0; y <= 19; y++) put(c, 20, y, "powerline");
    refresh(c);
    assert.equal(besideWhatItNeeds(c, at(c, 20, 20)), false);
    assert.equal(coverage(c, "rail"), 0);
  });

  test("lay track against it and it works", () => {
    const c = plains();
    put(c, 20, 20, "railstation");
    for (let x = 10; x <= 30; x++) put(c, x, 22, "rail");
    for (let y = 0; y <= 19; y++) put(c, 20, y, "powerline");
    refresh(c);
    assert.equal(besideWhatItNeeds(c, at(c, 20, 20)), true);
    assert.ok(coverage(c, "rail") > 0);
  });

  test("a subway station needs a line beneath it", () => {
    const c = plains();
    put(c, 20, 20, "substation");
    for (let y = 0; y <= 19; y++) put(c, 20, y, "powerline");
    refresh(c);
    assert.equal(besideWhatItNeeds(c, at(c, 20, 20)), false);
    for (let x = 21; x <= 30; x++) put(c, x, 20, "subway");
    refresh(c);
    assert.equal(besideWhatItNeeds(c, at(c, 20, 20)), true);
  });
});

describe("a seaport wants a seacoast", () => {
  // The first dry spot with the right kind of water within reach.
  function berth(city, salt) {
    for (const t of city.tiles) {
      if (t.terrain === "water" || t.type !== "empty") continue;
      if (t.x < 2 || t.y < 2 || t.x + 5 >= city.size || t.y + 5 >= city.size) continue;
      let clear = true;
      for (let dy = 0; dy < 4 && clear; dy++) for (let dx = 0; dx < 4; dx++) {
        const n = at(city, t.x + dx, t.y + dy);
        if (!n || n.terrain === "water" || n.type !== "empty") { clear = false; break; }
      }
      if (!clear) continue;
      if (place(city, t.x, t.y, "seaport").ok) return onSalt(city, at(city, t.x, t.y)) === salt ? t : (place(city, t.x, t.y, "bulldoze"), null);
    }
    return null;
  }

  test("a berth on the sea carries more trade than one on a river", () => {
    const sea = coast();
    sea.money = 5_000_000;
    const seaBerth = berth(sea, true);
    assert.ok(seaBerth, "the coast map should offer a sea berth");
    assert.equal(sitingFactor(sea, at(sea, seaBerth.x, seaBerth.y)), 1);

    const inland = river();
    inland.money = 5_000_000;
    const riverBerth = berth(inland, false);
    assert.ok(riverBerth, "the river map should offer an inland berth");
    const factor = sitingFactor(inland, at(inland, riverBerth.x, riverBerth.y));
    assert.ok(factor > 0 && factor < 1, `an inland port should work, but not as well: ${factor}`);
  });

  test("the inland berth says so when queried", () => {
    const inland = river();
    inland.money = 5_000_000;
    const spot = berth(inland, false);
    assert.match(inspectTile(inland, spot.x, spot.y).details.join(" | "), /seacoast berth/);
  });

  test("a sea berth brings more industrial demand than an inland one", () => {
    const measure = (city, salt) => {
      city.money = 5_000_000;
      const spot = berth(city, salt);
      assert.ok(spot, "no berth found");
      for (let i = -1; i <= 4; i++) { place(city, spot.x + i, spot.y + 4, "road"); place(city, spot.x + i, spot.y - 1, "powerline"); }
      refresh(city);
      return getStats(city).demandBonus.industrial || 0;
    };
    assert.ok(measure(coast(), true) > measure(river(), false));
  });
});
