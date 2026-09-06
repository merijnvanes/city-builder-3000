// construction.test.js — plan, apply and undo.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, BUILDINGS } from "../src/sim/index.js";
import { planConstruction, applyConstruction, createUndoManager, anchorFor } from "../src/construction.js";

const blank = () => createCity({ seed: 1, starter: false, hills: 0 });
const at = (c, x, y) => c.tiles[y * c.size + x];
const grassRect = (c, w, h) => c.tiles.find((t) => t.x > 4 && t.y > 4 && t.x + w < c.size - 4 && t.y + h < c.size - 4 &&
  Array.from({ length: h }, (_, dy) => Array.from({ length: w }, (_, dx) => at(c, t.x + dx, t.y + dy).terrain === "grass").every(Boolean)).every(Boolean));

describe("planConstruction validation", () => {
  test("rejects bad city, tool, density and coordinates", () => {
    const c = blank();
    assert.equal(planConstruction(null, { x: 0, y: 0 }, { x: 0, y: 0 }, "road").valid, false);
    assert.equal(planConstruction(c, { x: 0, y: 0 }, { x: 0, y: 0 }, "laser").valid, false);
    assert.equal(planConstruction(c, { x: 0, y: 0 }, { x: 0, y: 0 }, "constructor").valid, false);
    assert.equal(planConstruction(c, { x: 0, y: 0 }, { x: 0, y: 0 }, "residential", { density: 4 }).valid, false);
    assert.equal(planConstruction(c, { x: 0.5, y: 0 }, { x: 0, y: 0 }, "road").valid, false);
    assert.equal(planConstruction(c, null, { x: 0, y: 0 }, "road").valid, false);
    assert.equal(planConstruction(c, { x: -5, y: -5 }, { x: 2, y: 2 }, "residential").tiles.some((t) => !t.valid), true);
  });
  test("does not mutate the city", () => {
    const c = blank();
    const before = JSON.stringify(c.tiles.map((t) => [t.type, t.density]));
    planConstruction(c, { x: 5, y: 5 }, { x: 12, y: 12 }, "commercial", { density: 2 });
    planConstruction(c, { x: 5, y: 5 }, { x: 12, y: 12 }, "road");
    assert.equal(JSON.stringify(c.tiles.map((t) => [t.type, t.density])), before);
  });
});

describe("plan shapes", () => {
  test("zones fill a rectangle and cost by density", () => {
    const c = blank();
    const g = grassRect(c, 4, 3);
    const plan = planConstruction(c, { x: g.x, y: g.y }, { x: g.x + 3, y: g.y + 2 }, "residential", { density: 2 });
    assert.equal(plan.tiles.length, 12);
    assert.equal(plan.count, 12);
    assert.equal(plan.cost, 12 * 25);
    assert.equal(plan.valid, true);
  });
  test("roads follow an L path, dominant axis first", () => {
    const c = blank();
    const plan = planConstruction(c, { x: 5, y: 5 }, { x: 10, y: 7 }, "road");
    assert.deepEqual(plan.tiles.slice(0, 6).map((t) => t.y), [5, 5, 5, 5, 5, 5]);
    assert.deepEqual(plan.tiles.slice(6).map((t) => [t.x, t.y]), [[10, 6], [10, 7]]);
    const tall = planConstruction(c, { x: 5, y: 5 }, { x: 7, y: 12 }, "road");
    assert.equal(tall.tiles[0].x, 5);
    assert.equal(tall.tiles[7].x, 5);
    assert.equal(tall.tiles[tall.tiles.length - 1].x, 7);
  });
  test("footprint buildings centre on the cursor and show every tile", () => {
    const c = blank();
    const g = grassRect(c, 5, 5);
    const cursor = { x: g.x + 2, y: g.y + 2 };
    assert.deepEqual(anchorFor("police", cursor.x, cursor.y), { x: g.x + 1, y: g.y + 1 });
    const plan = planConstruction(c, cursor, cursor, "police");
    assert.equal(plan.tiles.length, 9);
    assert.equal(plan.count, 1);
    assert.equal(plan.cost, BUILDINGS.police.cost);
    at(c, g.x + 1, g.y + 1).type = "road";
    const blocked = planConstruction(c, cursor, cursor, "police");
    assert.equal(blocked.valid, false);
    assert.equal(blocked.tiles.length, 9);
    assert.ok(blocked.tiles.every((t) => !t.valid));
  });
  test("existing roads in a path are no-ops, occupied tiles are blocked", () => {
    const c = blank();
    at(c, 7, 5).type = "road";
    at(c, 8, 5).type = "commercial"; at(c, 8, 5).density = 1;
    const plan = planConstruction(c, { x: 5, y: 5 }, { x: 9, y: 5 }, "road");
    assert.equal(plan.tiles.find((t) => t.x === 7).noop, true);
    assert.equal(plan.tiles.find((t) => t.x === 8).valid, false);
    assert.equal(plan.count, 3);
    assert.match(plan.message, /blocked/);
  });
  test("bulldozing a lot counts once and prices the whole building", () => {
    const c = blank();
    const g = grassRect(c, 4, 4);
    applyConstruction(c, planConstruction(c, { x: g.x + 1, y: g.y + 1 }, { x: g.x + 1, y: g.y + 1 }, "fire"));
    const plan = planConstruction(c, { x: g.x, y: g.y }, { x: g.x + 2, y: g.y + 2 }, "bulldoze");
    assert.equal(plan.count, 1);
    assert.equal(plan.tiles.length, 9);
    assert.equal(plan.cost, 5 * 9 + Math.round(BUILDINGS.fire.cost * 0.05));
  });
});

describe("applyConstruction", () => {
  test("charges exactly the plan cost and builds every tile", () => {
    const c = blank();
    const g = grassRect(c, 5, 3);
    const plan = planConstruction(c, { x: g.x, y: g.y }, { x: g.x + 4, y: g.y + 2 }, "industrial", { density: 3 });
    const before = c.money;
    const r = applyConstruction(c, plan);
    assert.equal(r.ok, true);
    assert.equal(r.changed, 15);
    assert.equal(before - c.money, plan.cost);
    assert.equal(r.cost, plan.cost);
    for (const t of plan.tiles) { assert.equal(at(c, t.x, t.y).type, "industrial"); assert.equal(at(c, t.x, t.y).density, 3); }
  });
  test("insufficient funds changes nothing", () => {
    const c = blank();
    c.money = 100;
    const plan = planConstruction(c, { x: 5, y: 5 }, { x: 14, y: 14 }, "commercial");
    const r = applyConstruction(c, plan);
    assert.equal(r.ok, false);
    assert.equal(c.money, 100);
    assert.ok(c.tiles.every((t) => t.type !== "commercial"));
  });
  test("stale plans are re-evaluated against the live city", () => {
    const c = blank();
    const plan = planConstruction(c, { x: 5, y: 5 }, { x: 9, y: 5 }, "road");
    at(c, 7, 5).type = "commercial"; at(c, 7, 5).density = 1;
    const r = applyConstruction(c, plan);
    assert.equal(r.ok, true);
    assert.equal(r.changed, 4);
    assert.equal(at(c, 7, 5).type, "commercial");
  });
  test("malformed plans are refused", () => {
    const c = blank();
    assert.equal(applyConstruction(c, null).ok, false);
    assert.equal(applyConstruction(c, { tool: "road", tiles: "x", density: 1 }).ok, false);
    assert.equal(applyConstruction(c, { tool: "road", tiles: [], density: 9 }).ok, false);
    assert.equal(applyConstruction(c, { tool: "nope", tiles: [], density: 1 }).ok, false);
  });
  test("a footprint building is placed once at its anchor", () => {
    const c = blank();
    const g = grassRect(c, 6, 6);
    const cursor = { x: g.x + 2, y: g.y + 2 };
    const r = applyConstruction(c, planConstruction(c, cursor, cursor, "coal"));
    assert.equal(r.ok, true);
    assert.equal(c.tiles.filter((t) => t.type === "coal").length, 16);
    assert.equal(c.tiles.filter((t) => t.type === "coal" && t.lot.x === t.x && t.lot.y === t.y).length, 1);
  });
  test("refreshes derived state after building", () => {
    const c = blank();
    const g = grassRect(c, 8, 6);
    applyConstruction(c, planConstruction(c, { x: g.x + 1, y: g.y + 1 }, { x: g.x + 1, y: g.y + 1 }, "coal"));
    applyConstruction(c, planConstruction(c, { x: g.x + 5, y: g.y }, { x: g.x + 5, y: g.y + 5 }, "road"));
    applyConstruction(c, planConstruction(c, { x: g.x + 4, y: g.y + 1 }, { x: g.x + 4, y: g.y + 4 }, "residential"));
    assert.equal(at(c, g.x + 4, g.y + 2).powered, true);
    assert.equal(at(c, g.x + 4, g.y + 2).roadAccess, true);
  });
});

describe("undo", () => {
  test("restores tiles, money and derived state", () => {
    const c = blank();
    const undo = createUndoManager(5);
    const money = c.money, revision = c.revision;
    undo.record(c);
    applyConstruction(c, planConstruction(c, { x: 5, y: 5 }, { x: 12, y: 5 }, "road"));
    assert.notEqual(c.money, money);
    assert.equal(undo.undo(c), true);
    assert.equal(c.money, money);
    assert.equal(at(c, 8, 5).type, "empty");
    assert.ok(c.revision > revision);
    assert.equal(undo.undo(c), false);
  });
  test("keeps only the latest snapshots", () => {
    const c = blank();
    const undo = createUndoManager(2);
    for (let i = 0; i < 4; i++) undo.record(c);
    assert.equal(undo.size, 2);
    undo.clear();
    assert.equal(undo.size, 0);
  });
});
