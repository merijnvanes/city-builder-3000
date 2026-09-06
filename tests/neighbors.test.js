// Neighbour connections, deals, external jobs, passenger rail, airport/seaport.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, setPolicy, serialize, deserialize, refresh } from "../src/sim/index.js";
import { detectConnections, DEALS } from "../src/sim/neighbors.js";
import { findLot, assignLot } from "../src/sim/lots.js";
import { computeDemand } from "../src/sim/growth.js";
import { computeMetrics } from "../src/sim/metrics.js";

const plains = () => createCity({ seed: 7, layout: "plains", starter: false });
const at = (c, x, y) => c.tiles[y * c.size + x];
const put = (c, x, y, tool, o) => place(c, x, y, tool, { ...o, deferRefresh: true });

// Powered, watered district with a road running to the west edge.
function district(c) {
  for (let x = 0; x <= 30; x++) put(c, x, 20, "road");
  for (let y = 14; y <= 26; y++) put(c, 16, y, "road");
  put(c, 4, 14, "coal");
  for (let x = 8; x <= 15; x++) put(c, x, 15, "powerline");
  for (let y = 16; y <= 21; y++) put(c, 15, y, "powerline");
  for (let y = 21; y <= 25; y++) for (let x = 17; x <= 23; x++) put(c, x, y, "residential", { density: 2 });
  put(c, 12, 21, "watertower"); put(c, 13, 21, "watertower");
  for (let x = 12; x <= 25; x++) put(c, x, 22, "pipe");
  for (let x = 12; x <= 15; x++) put(c, x, 21, "powerline");
  refresh(c);
  return c;
}

describe("connections", () => {
  test("roads, rails, lines and pipes at the edge connect to neighbours", () => {
    const c = plains();
    put(c, 0, 10, "road"); put(c, 63, 10, "rail"); put(c, 10, 0, "powerline"); put(c, 10, 63, "pipe");
    refresh(c);
    const n = detectConnections(c);
    assert.equal(n.west.road, 1); assert.equal(n.east.rail, 1); assert.equal(n.north.power, 1); assert.equal(n.south.water, 1);
    assert.equal(n.north.road, 0);
    assert.ok(n.north.name && n.north.name !== n.east.name);
    const s = getStats(c);
    assert.equal(s.neighbors.length, 4);
    assert.equal(s.neighbors.find((x) => x.side === "north").deals.power, true);
    assert.equal(s.neighbors.find((x) => x.side === "north").deals.water, false);
  });
  test("a road to the edge adds outside jobs and trade demand", () => {
    const c = district(plains());
    for (const t of c.tiles) if (t.type === "residential" && !t.lot) { const lot = findLot(c, t); if (lot) assignLot(c, lot, 3, 0.5); }
    refresh(c);
    const cut = district(plains());
    for (const t of cut.tiles) if (t.type === "residential" && !t.lot) { const lot = findLot(cut, t); if (lot) assignLot(cut, lot, 3, 0.5); }
    put(cut, 0, 20, "bulldoze"); refresh(cut);
    tick(c); tick(cut);
    const a = getStats(c), b = getStats(cut);
    assert.ok(a.externalJobs > 0);
    assert.equal(b.externalJobs, 0);
    assert.ok(a.unemployment < b.unemployment, `${a.unemployment} < ${b.unemployment}`);
    assert.ok(a.tradeConnections === 1 && b.tradeConnections === 0);
    // Trade raises the wanted job count: with equal existing jobs, demand is at least as high.
    const da = computeDemand(c, computeMetrics(c)), db = computeDemand(cut, computeMetrics(cut));
    assert.ok(da.industrial >= db.industrial && da.commercial >= db.commercial);
  });
});

describe("deals", () => {
  test("buying power needs a line to that edge and adds supply", () => {
    const c = district(plains());
    assert.equal(setPolicy(c, "deal", { resource: "power", side: "north", kind: "buy" }).ok, false);
    for (let y = 0; y <= 14; y++) put(c, 4, y, "powerline");
    refresh(c);
    const before = getStats(c).utilities.power.supply;
    assert.equal(setPolicy(c, "deal", { resource: "power", side: "north", kind: "buy" }).ok, true);
    const s = getStats(c);
    assert.equal(s.utilities.power.supply, before + DEALS.power.buy.amount);
    assert.equal(s.budget.expenses.neighbors, DEALS.power.buy.price);
    assert.equal(setPolicy(c, "cancelDeal", "power").ok, true);
    assert.equal(getStats(c).utilities.power.supply, before);
  });
  test("selling power earns while the plant has surplus, and the deal dies with its line", () => {
    const c = district(plains());
    for (let y = 0; y <= 14; y++) put(c, 4, y, "powerline");
    refresh(c);
    assert.equal(setPolicy(c, "deal", { resource: "power", side: "north", kind: "sell" }).ok, true);
    let s = getStats(c);
    assert.equal(s.budget.income.neighbors, DEALS.power.sell.price);
    assert.equal(s.deals.power.met, true);
    put(c, 4, 0, "bulldoze"); refresh(c);
    tick(c);
    assert.equal(c.deals.power, undefined);
    assert.ok(c.news.some((n) => /cancelled the power deal/.test(n)));
  });
  test("garbage export adds capacity; garbage import pays", () => {
    const c = district(plains());
    assert.equal(setPolicy(c, "deal", { resource: "garbage", side: "west", kind: "sell" }).ok, true);
    assert.equal(getStats(c).garbageCapacity, 500);
    assert.equal(getStats(c).budget.expenses.neighbors, DEALS.garbage.sell.price);
    setPolicy(c, "deal", { resource: "garbage", side: "west", kind: "buy" });
    assert.equal(getStats(c).budget.income.neighbors, DEALS.garbage.buy.price);
    assert.ok(getStats(c).garbageProduced >= 600);
    const d = deserialize(serialize(c));
    assert.deepEqual(d.deals, c.deals);
  });
});

describe("transport buildings", () => {
  test("rail carries commuters between stations", () => {
    const c = plains();
    // Homes on the west, jobs on the east, linked only by rail between two stations.
    for (let x = 2; x <= 8; x++) put(c, x, 20, "road");
    for (let x = 41; x <= 46; x++) put(c, x, 20, "road");
    assert.equal(put(c, 9, 19, "railstation").ok, true);
    assert.equal(put(c, 39, 19, "railstation").ok, true);
    for (let x = 11; x <= 38; x++) put(c, x, 20, "rail");
    put(c, 2, 10, "coal"); for (let x = 6; x <= 8; x++) put(c, x, 12, "powerline"); for (let y = 13; y <= 18; y++) put(c, 8, y, "powerline");
    for (let y = 21; y <= 23; y++) for (let x = 3; x <= 8; x++) put(c, x, y, "residential", { density: 1 });
    for (let x = 9; x <= 46; x++) put(c, x, 18, "powerline");
    for (let y = 21; y <= 23; y++) for (let x = 40; x <= 45; x++) put(c, x, y, "industrial", { density: 1 });
    refresh(c);
    for (const t of c.tiles) if (["residential", "industrial"].includes(t.type) && !t.lot) { const lot = findLot(c, t); if (lot) assignLot(c, lot, 2, 0.5); }
    refresh(c);
    tick(c);
    const s = getStats(c);
    assert.ok(s.employed > 0, "workers reach jobs by rail");
    assert.ok(c._traffic.railRiders > 0);
    put(c, 39, 19, "bulldoze"); refresh(c); tick(c);
    assert.equal(getStats(c).employed, 0, "no station, no rail commute");
  });
  test("seaport needs water and boosts industrial demand; airport is unique", () => {
    const c = createCity({ seed: 5, layout: "river", starter: false });
    const inland = c.tiles.find((t) => t.terrain === "grass" && t.x > 4 && t.x < 20 && t.y > 4 && t.y < 20 && [0, 1, 2, 3].every((dx) => [0, 1, 2, 3].every((dy) => at(c, t.x + dx, t.y + dy).terrain === "grass")));
    assert.equal(place(c, inland.x, inland.y, "seaport").ok, false);
    const shore = c.tiles.find((t) => t.terrain !== "water" && t.type === "empty" && t.x > 4 && t.x < c.size - 6 && t.y > 4 && t.y < c.size - 6 &&
      [0, 1, 2, 3].every((dx) => [0, 1, 2, 3].every((dy) => at(c, t.x + dx, t.y + dy).terrain !== "water")) &&
      [[-1, 0], [4, 0], [0, -1], [0, 4], [-2, 0], [5, 0], [0, -2], [0, 5]].some(([dx, dy]) => at(c, t.x + dx, t.y + dy)?.terrain === "water"));
    assert.ok(shore, "shore site");
    const before = computeDemand(c, computeMetrics(c)).industrial;
    assert.equal(place(c, shore.x, shore.y, "seaport").ok, true);
    assert.ok(computeDemand(c, computeMetrics(c)).industrial > before);
    const site = c.tiles.find((t) => t.x > 20 && t.x < 40 && t.y > 4 && t.y < 20 && [...Array(6)].every((_, dx) => [...Array(5)].every((_, dy) => at(c, t.x + dx, t.y + dy).terrain === "grass" && at(c, t.x + dx, t.y + dy).type === "empty")));
    assert.equal(place(c, site.x, site.y, "airport").ok, true);
    const site2 = c.tiles.find((t) => t.x > 4 && t.x < 20 && t.y > 30 && t.y < 50 && [...Array(6)].every((_, dx) => [...Array(5)].every((_, dy) => at(c, t.x + dx, t.y + dy).terrain === "grass" && at(c, t.x + dx, t.y + dy).type === "empty")));
    assert.equal(place(c, site2.x, site2.y, "airport").ok, false);
  });
});
