// Elevation: generation, lots, building sites, terraform tools, saves.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, place, evaluate, serialize, deserialize, BUILDINGS } from "../src/sim/index.js";
import { generateTerrain, relaxHeights, MAX_ELEVATION } from "../src/sim/terrain.js";
import { findLot } from "../src/sim/lots.js";

const at = (c, x, y) => c.tiles[y * c.size + x];
const put = (c, x, y, tool, o) => place(c, x, y, tool, { ...o, deferRefresh: true });

describe("elevation", () => {
  test("generated hills stay within bounds and slopes are single steps", () => {
    for (const layout of ["river", "coast", "lakes", "plains"]) {
      const g = generateTerrain(64, 11, layout);
      const h = g.heights;
      assert.ok(h.every((v) => v >= 0 && v <= MAX_ELEVATION));
      assert.ok(h.some((v) => v > 0), `${layout} has hills`);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 63; x++) assert.ok(Math.abs(h[y * 64 + x] - h[y * 64 + x + 1]) <= 1);
      for (let y = 0; y < 63; y++) for (let x = 0; x < 64; x++) assert.ok(Math.abs(h[y * 64 + x] - h[(y + 1) * 64 + x]) <= 1);
      for (let i = 0; i < h.length; i++) if (g.terrain[i] === "water") assert.equal(h[i], 0);
    }
    assert.ok(generateTerrain(64, 11, "river", 0).heights.every((v) => v === 0), "hills 0 is flat");
  });
  test("relaxHeights lowers peaks to one step per tile", () => {
    const h = new Uint8Array(9);
    h[4] = 5;
    relaxHeights(h, 3, null);
    assert.ok(h[4] <= 1);
  });
  test("lots never span different heights", () => {
    const c = createCity({ seed: 7, starter: false, hills: 0 });
    for (let y = 5; y < 8; y++) for (let x = 5; x < 8; x++) put(c, x, y, "residential", { density: 3 });
    at(c, 7, 7).elev = 1;
    const lot = findLot(c, at(c, 5, 5));
    assert.ok(lot.w < 3 || lot.h < 3);
  });
  test("buildings level a gentle site for a fee and refuse steep ones", () => {
    const c = createCity({ seed: 7, starter: false, hills: 0 });
    for (let y = 10; y < 13; y++) for (let x = 10; x < 13; x++) at(c, x, y).elev = 2;
    at(c, 11, 11).elev = 3; at(c, 12, 12).elev = 1;
    const ev = evaluate(c, 10, 10, "police");
    assert.equal(ev.ok, true);
    assert.equal(ev.cost, BUILDINGS.police.cost + 20);
    assert.equal(place(c, 10, 10, "police").ok, true);
    for (let y = 10; y < 13; y++) for (let x = 10; x < 13; x++) assert.equal(at(c, x, y).elev, 2);
    at(c, 21, 21).elev = 3; at(c, 20, 20).elev = 1;
    for (let y = 20; y < 23; y++) for (let x = 20; x < 23; x++) if (!(x === 21 && y === 21) && !(x === 20 && y === 20)) at(c, x, y).elev = 2;
    at(c, 20, 20).elev = 0;
    assert.equal(evaluate(c, 20, 20, "fire").ok, false);
  });
  test("raise, lower and level drag neighbours along and charge per tile", () => {
    const c = createCity({ seed: 7, starter: false, hills: 0 });
    let money = c.money;
    assert.equal(place(c, 30, 30, "raise").ok, true);
    assert.equal(at(c, 30, 30).elev, 1);
    assert.equal(money - c.money, BUILDINGS.raise.cost);
    money = c.money;
    const ev = evaluate(c, 30, 30, "raise");
    assert.equal(ev.tiles.length, 5, "the four neighbours come up to one");
    assert.equal(place(c, 30, 30, "raise").ok, true);
    assert.equal(at(c, 30, 30).elev, 2);
    assert.equal(at(c, 31, 30).elev, 1);
    assert.equal(money - c.money, BUILDINGS.raise.cost * 5);
    assert.equal(place(c, 30, 30, "lower").ok, true);
    assert.equal(at(c, 30, 30).elev, 1);
    assert.equal(place(c, 31, 30, "level", { elev: 0 }).ok, true);
    assert.equal(at(c, 31, 30).elev, 0);
    assert.equal(place(c, 31, 30, "lower").ok, true, "pits can extend below sea level");
    assert.equal(at(c, 31, 30).elev, -1);
    put(c, 40, 40, "road");
    assert.equal(place(c, 40, 40, "raise").ok, false, "built tiles stay put");
    assert.equal(place(c, 41, 40, "raise").ok, true);
    assert.equal(place(c, 41, 40, "raise").ok, false, "would drag the road tile");
  });
  test("elevation survives a save and land value rises with height", () => {
    const c = createCity({ seed: 9, starter: false });
    const d = deserialize(serialize(c));
    assert.deepEqual(d.tiles.map((t) => t.elev), c.tiles.map((t) => t.elev));
    const flat = createCity({ seed: 9, starter: false, hills: 0 });
    const high = c.tiles.find((t) => t.elev >= 3 && t.terrain === "grass");
    if (high) assert.ok(high.landValue >= at(flat, high.x, high.y).landValue);
  });
});
