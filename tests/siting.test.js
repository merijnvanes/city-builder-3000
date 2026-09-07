// Buildings that only work where they belong. The manual: "Bus stops must be
// placed along the side of roads to be effective." "Once the track is laid,
// you must place Train Stations on tiles that touch the track."
//
// Seaports follow the same idea but are zones, so their berth rule lives in
// tests/ports.test.js.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, place, refresh, inspectTile } from "../src/sim.js";
import { besideWhatItNeeds, sitingNote } from "../src/sim/siting.js";

const at = (c, x, y) => c.tiles[y * c.size + x];
const put = (c, x, y, tool, o) => { c.money = 5_000_000; return place(c, x, y, tool, o); };
const plains = () => createCity({ seed: 5, starter: false, layout: "plains", startYear: 2000 });

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
