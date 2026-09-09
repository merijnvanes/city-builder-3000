import { connectionOffers } from '../src/sim/neighbor-links.js';
// Neighbour connections, deals, external jobs and passenger rail. Port zones
// have their own file: tests/ports.test.js.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, setPolicy, serialize, deserialize, refresh, disaster, connectNeighbor } from "../src/sim/index.js";
import { detectConnections, dealAvailable, signDeal, offerTerms, DEALS, cancelPenalty } from "../src/sim/neighbors.js";
import { findLot, assignLot } from "../src/sim/lots.js";
import { computeDemand } from "../src/sim/growth.js";
import { computeMetrics } from "../src/sim/metrics.js";

const plains = () => createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
const at = (c, x, y) => c.tiles[y * c.size + x];
// District fixtures explicitly purchase any transport endpoint they build.
const put = (c, x, y, tool, o) => {
  const result=place(c,x,y,tool,{...o,deferRefresh:true});
  if(result.ok && ['road','rail','highway'].includes(tool)) for(const link of connectionOffers(c,[{x,y}])) connectNeighbor(c,link);
  return result;
};
// Contracts now arrive as offers from a neighbouring mayor; these tests are
// about how one is billed once it is signed, so they sign at list terms.
const sign = (c, resource, side, kind) => {
  const r = signDeal(c, resource, side, kind, DEALS[resource][kind]);
  if (r.ok) refresh(c);
  return r;
};

// Powered, watered district with a road running to the northwest edge.
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
    assert.equal(n.northwest.road, 1); assert.equal(n.southeast.rail, 1); assert.equal(n.northeast.power, 1); assert.equal(n.southwest.water, 1);
    assert.equal(n.northeast.road, 0);
    assert.ok(n.northeast.name && n.northeast.name !== n.southeast.name);
    const s = getStats(c);
    assert.equal(s.neighbors.length, 4);
    assert.equal(s.neighbors.find((x) => x.side === "northeast").deals.power, true);
    assert.equal(s.neighbors.find((x) => x.side === "northeast").deals.water, false);
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
  test("buying power supplies the deficit, and only up to the contracted cap", () => {
    const c = district(plains());
    assert.equal(sign(c, "power", "northeast", "buy").ok, false);
    for (let y = 0; y <= 14; y++) put(c, 4, y, "powerline");
    refresh(c);
    const before = getStats(c).utilities.power;
    assert.equal(sign(c, "power", "northeast", "buy").ok, true);
    const s = getStats(c);
    // The town already generates enough, so there is no deficit to cover.
    const deficit = Math.max(0, before.demand - before.supply);
    assert.equal(s.utilities.power.supply, before.supply + Math.min(deficit, DEALS.power.buy.cap));
    // "If you didn't need any during the month, you still have to pay a
    // minimum fee."
    assert.equal(s.budget.expenses.neighbors, DEALS.power.buy.minimum);
  });

  test("a city short of power buys what it is short of, and pays for it", () => {
    // A consumer wired to the northeast edge with no plant of its own.
    const c = plains();
    put(c, 20, 10, "police");
    for (let i = -1; i <= 3; i++) put(c, 20 + i, 13, "road");
    for (let y = 0; y <= 9; y++) put(c, 21, y, "powerline");
    refresh(c);
    const before = getStats(c).utilities.power;
    assert.equal(before.supply, 0);
    assert.ok(before.demand > 0, "the station should be asking for power");

    sign(c, "power", "northeast", "buy");
    const s = getStats(c);
    assert.equal(s.utilities.power.supply, before.demand, "the neighbour covers exactly the deficit");
    assert.equal(s.utilities.power.deal.amount, before.demand);
    assert.equal(at(c, 20, 10).powered, true, "and the station runs on it");
    // Too small a draw to beat the standing charge, so the minimum applies.
    assert.equal(s.budget.expenses.neighbors, Math.max(DEALS.power.buy.minimum, Math.round(before.demand * DEALS.power.buy.rate)));
  });

  test("it will not buy more than the contracted cap", () => {
    const c = plains();
    // Far more draw than any one contract covers.
    for (let i = 0; i < 40; i++) { put(c, 4 + (i % 10) * 4, 20 + Math.floor(i / 10) * 4, "hospital"); }
    for (let y = 0; y <= 20; y++) put(c, 3, y, "powerline");
    for (let x = 3; x <= 45; x++) put(c, x, 19, "powerline");
    refresh(c);
    sign(c, "power", "northeast", "buy");
    const s = getStats(c);
    assert.ok(s.utilities.power.deal.amount <= DEALS.power.buy.cap);
  });

  test("selling power pays the contracted amount while the city can deliver", () => {
    const c = district(plains());
    for (let y = 0; y <= 14; y++) put(c, 4, y, "powerline");
    refresh(c);
    assert.equal(sign(c, "power", "northeast", "sell").ok, true);
    const s = getStats(c);
    assert.equal(s.budget.income.neighbors, Math.round(DEALS.power.sell.cap * DEALS.power.sell.rate));
    assert.equal(s.deals.power.met, true);
  });

  test("losing the connection ends the deal and charges the penalty", () => {
    const c = district(plains());
    for (let y = 0; y <= 14; y++) put(c, 4, y, "powerline");
    refresh(c);
    sign(c, "power", "northeast", "sell");
    const before = c.money;
    put(c, 4, 0, "bulldoze"); refresh(c);
    tick(c);
    assert.equal(c.deals.power, undefined);
    assert.ok(c.news.some((n) => /cancelled the power deal/.test(n)));
    assert.ok(before - c.money >= cancelPenalty(DEALS.power.sell), "the penalty should have been charged");
  });

  test("walking away from a deal costs a large penalty", () => {
    const c = district(plains());
    for (let y = 0; y <= 14; y++) put(c, 4, y, "powerline");
    refresh(c);
    sign(c, "power", "northeast", "buy");
    const penalty = cancelPenalty(DEALS.power.buy);
    assert.ok(penalty > 0);
    const before = c.money;
    assert.equal(setPolicy(c, "cancelDeal", "power").ok, true);
    assert.equal(Math.round(before - c.money), penalty);
    assert.equal(c.deals.power, undefined);
  });

  test("a city that cannot afford the penalty is held to its contract", () => {
    const c = district(plains());
    for (let y = 0; y <= 14; y++) put(c, 4, y, "powerline");
    refresh(c);
    sign(c, "power", "northeast", "buy");
    c.money = 1;
    const result = setPolicy(c, "cancelDeal", "power");
    assert.equal(result.ok, false);
    assert.match(result.message, /cannot pay/);
    assert.ok(c.deals.power, "the deal should still stand");
  });

  test("exporting garbage takes what the tips cannot, and bills for it", () => {
    const c = district(plains());
    assert.equal(sign(c, "garbage", "northwest", "sell").ok, true);
    const s = getStats(c);
    assert.equal(s.garbageCapacity >= DEALS.garbage.sell.cap, true);
    // Nothing to export yet, so only the standing charge.
    assert.equal(s.budget.expenses.neighbors, DEALS.garbage.sell.minimum);
  });

  test("importing garbage pays, and adds to what the city must dispose of", () => {
    const c = district(plains());
    sign(c, "garbage", "northwest", "buy");
    const s = getStats(c);
    assert.equal(s.budget.income.neighbors, Math.round(DEALS.garbage.buy.cap * DEALS.garbage.buy.rate));
    assert.ok(s.garbageProduced >= DEALS.garbage.buy.cap);
    const d = deserialize(serialize(c));
    assert.deepEqual(d.deals, c.deals);
  });
});

describe("transport buildings", () => {
  test("rail carries commuters between stations", () => {
    const c = plains();
    // Homes on the northwest, jobs on the southeast, linked only by rail between two stations.
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
  test("highways carry commuters further and faster than streets", () => {
    const build = (kind, ramps = true) => {
      const c = plains();
      // Homes at the northwest end, jobs 45 tiles southeast: too far for streets, fine by highway.
      for (let x = 2; x <= 8; x++) put(c, x, 20, "road");
      for (let x = 9; x <= 46; x++) put(c, x, 20, kind);
      for (let x = 47; x <= 52; x++) put(c, x, 20, "road");
      // "Highways may be built over roads, but if you want your Sims to be
      // able to get from one to the other, the intersection requires an
      // on-ramp." Without these two, nobody reaches the far end.
      if (kind === "highway" && ramps) { put(c, 8, 20, "onramp"); put(c, 47, 20, "onramp"); }
      put(c, 2, 10, "coal"); for (let x = 6; x <= 8; x++) put(c, x, 12, "powerline"); for (let y = 13; y <= 20; y++) put(c, 8, y, "powerline");
      for (let y = 21; y <= 23; y++) for (let x = 3; x <= 8; x++) put(c, x, y, "residential", { density: 1 });
      for (let x = 9; x <= 52; x++) put(c, x, 19, "powerline");
      for (let y = 21; y <= 23; y++) for (let x = 47; x <= 52; x++) put(c, x, y, "industrial", { density: 1 });
      refresh(c);
      for (const t of c.tiles) if (["residential", "industrial"].includes(t.type) && !t.lot) { const lot = findLot(c, t); if (lot) assignLot(c, lot, 2, 0.5); }
      refresh(c); tick(c);
      return getStats(c);
    };
    const street = build("road"), highway = build("highway");
    assert.ok(highway.employed > street.employed, `${highway.employed} > ${street.employed}`);
    // Take the ramps away and the highway is just a wall the traffic cannot join.
    assert.equal(build("highway", false).employed, 0, "a highway with no ramps should carry nobody off it");
    const c = plains();
    put(c, 10, 10, "highway"); put(c, 11, 12, "residential", { density: 1 }); refresh(c);
    assert.equal(at(c, 11, 12).roadAccess, false, "highways give no lot access");
  });
  test("subways carry commuters between subway stations under the city", () => {
    const c = plains();
    for (let x = 2; x <= 8; x++) put(c, x, 20, "road");
    for (let x = 47; x <= 52; x++) put(c, x, 20, "road");
    assert.equal(put(c, 9, 20, "substation").ok, true);
    assert.equal(put(c, 46, 20, "substation").ok, true);
    for (let x = 10; x <= 45; x++) assert.equal(put(c, x, 20, "subway").ok, true);
    put(c, 2, 10, "coal"); for (let x = 6; x <= 8; x++) put(c, x, 12, "powerline"); for (let y = 13; y <= 20; y++) put(c, 8, y, "powerline");
    for (let y = 21; y <= 23; y++) for (let x = 3; x <= 8; x++) put(c, x, y, "residential", { density: 1 });
    for (let x = 9; x <= 52; x++) put(c, x, 19, "powerline");
    for (let y = 21; y <= 23; y++) for (let x = 47; x <= 52; x++) put(c, x, y, "industrial", { density: 1 });
    refresh(c);
    for (const t of c.tiles) if (["residential", "industrial"].includes(t.type) && !t.lot) { const lot = findLot(c, t); if (lot) assignLot(c, lot, 2, 0.5); }
    refresh(c); tick(c);
    assert.ok(getStats(c).employed > 0, "workers ride the subway");
    assert.ok(c._traffic.subwayRiders > 0);
    // A subway can run under a road, and a bulldozed empty tile drops its tunnel.
    assert.equal(put(c, 5, 20, "subway").ok, true);
    put(c, 30, 20, "bulldoze"); refresh(c);
    assert.equal(at(c, 30, 20).subway, false);
    const d = deserialize(serialize(c));
    assert.equal(at(d, 20, 20).subway, true);
  });
  test("a fire crew puts out a burning lot for a fee", () => {
    const c = createCity(44, true);
    let burning;
    for (let i = 0; i < 6 && !burning; i++) { disaster(c, "fire"); burning = c.tiles.find((t) => t.fire > 0); }
    assert.ok(burning, "something burns");
    assert.equal(place(c, 5, 5, "dispatch").ok, false);
    const money = c.money;
    assert.equal(place(c, burning.x, burning.y, "dispatch").ok, true);
    assert.equal(burning.fire, 0);
    assert.equal(money - c.money, 300);
  });
  test("a seaport is a connection to every neighbour, an airport is not", () => {
    // "Seaports and airports are considered connections to all neighbors",
    // but garbage travels by "road, highway, rail, or seaport connection".
    const c = plains();
    c.money = 5_000_000;
    assert.equal(dealAvailable(detectConnections(c), "garbage", "northeast"), false);
    for (let x = 0; x <= 10; x++) put(c, x, 20, "rail");
    assert.equal(dealAvailable(detectConnections(c), "garbage", "northwest"), true, "rail counts too");
    assert.equal(dealAvailable(detectConnections(c), "garbage", "northeast"), false, "but only on its own side");
  });
});
