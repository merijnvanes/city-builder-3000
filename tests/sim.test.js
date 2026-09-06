// Simulation tests: terrain, lots, placement, utilities, growth, economy, saves.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, evaluate, serialize, deserialize, setPolicy, disaster, refresh, inspectTile, TOOLS, BUILDINGS } from "../src/sim/index.js";
import { generateTerrain } from "../src/sim/terrain.js";
import { findLot, assignLot, capacityOf, isAnchor, anchorOf } from "../src/sim/lots.js";
import { computeDemand } from "../src/sim/growth.js";
import { computeMetrics } from "../src/sim/metrics.js";
import { sourceEfficiency } from "../src/sim/utilities.js";

const at = (c, x, y) => c.tiles[y * c.size + x];
// Flat maps keep lot and footprint tests independent of the hills.
const blank = (seed = 7) => createCity({ seed, starter: false, hills: 0 });
const put = (c, x, y, tool, options) => place(c, x, y, tool, { ...options, deferRefresh: true });

// Lay a simple powered, watered district and return the city.
function district(seed = 7, density = 1) {
  const c = blank(seed);
  for (let x = 10; x <= 30; x++) { put(c, x, 20, "road"); put(c, x, 26, "road"); }
  for (let y = 14; y <= 32; y++) { put(c, 16, y, "road"); put(c, 24, y, "road"); }
  put(c, 4, 14, "coal");
  for (let x = 8; x <= 15; x++) put(c, x, 15, "powerline");
  for (let y = 16; y <= 21; y++) put(c, 15, y, "powerline");
  for (let y = 21; y <= 25; y++) for (let x = 17; x <= 23; x++) put(c, x, y, "residential", { density });
  for (let y = 21; y <= 25; y++) for (let x = 25; x <= 29; x++) put(c, x, y, "commercial", { density });
  for (let y = 27; y <= 31; y++) for (let x = 17; x <= 23; x++) put(c, x, y, "industrial", { density });
  put(c, 12, 21, "watertower"); put(c, 13, 21, "watertower");
  for (let x = 12; x <= 29; x++) put(c, x, 22, "pipe");
  for (let x = 12; x <= 15; x++) put(c, x, 21, "powerline");
  refresh(c);
  return c;
}

describe("terrain", () => {
  test("is deterministic and has land, water and forests", () => {
    const a = generateTerrain(64, 5), b = generateTerrain(64, 5);
    assert.deepEqual(a.terrain, b.terrain);
    assert.ok(a.terrain.filter((t) => t === "water").length > 100);
    assert.ok(a.terrain.filter((t) => t === "grass").length > 2000);
    assert.ok(a.trees.some((t) => t === 3));
  });
  test("every layout generates", () => {
    for (const layout of ["river", "coast", "lakes", "delta", "plains"]) {
      const g = generateTerrain(64, 3, layout);
      assert.equal(g.layout, layout);
      assert.equal(g.terrain.length, 4096);
    }
  });
});

describe("city creation", () => {
  test("blank city has the requested size and starting money", () => {
    const c = blank();
    assert.equal(c.size, 64);
    assert.equal(c.tiles.length, 4096);
    assert.equal(c.money, 50000);
    assert.equal(getStats(c).population, 0);
  });
  test("starter town is powered, watered, populated and solvent", () => {
    for (const seed of [42, 43, 44, 45]) {
      const c = createCity(seed, true);
      const s = getStats(c);
      assert.ok(s.population > 8000, `seed ${seed} population ${s.population}`);
      assert.ok(s.power >= 95, `seed ${seed} power ${s.power}`);
      assert.ok(s.water >= 95, `seed ${seed} water ${s.water}`);
      assert.ok(s.balance > 0, `seed ${seed} balance ${s.balance}`);
      assert.equal(c.money, 50000);
    }
  });
  test("starter town survives twenty years untouched", () => {
    const c = createCity(44, true);
    for (let i = 0; i < 240; i++) tick(c);
    const s = getStats(c);
    assert.ok(s.population > 10000, `population ${s.population}`);
    assert.ok(c.money > 50000, `money ${c.money}`);
    assert.equal(c.history.length, 240);
  });
  test("custom size and layout", () => {
    const c = createCity({ seed: 9, size: 32, layout: "coast", starter: false });
    assert.equal(c.size, 32);
    assert.equal(c.layout, "coast");
  });
});

describe("lots", () => {
  test("high density zone forms 3x3 lots, low density 1x1", () => {
    const c = blank();
    for (let y = 5; y < 8; y++) for (let x = 5; x < 8; x++) put(c, x, y, "residential", { density: 3 });
    const lot = findLot(c, at(c, 6, 6));
    assert.deepEqual(lot, { x: 5, y: 5, w: 3, h: 3 });
    put(c, 10, 10, "residential", { density: 1 });
    assert.deepEqual(findLot(c, at(c, 10, 10)), { x: 10, y: 10, w: 1, h: 1 });
  });
  test("lots never cross zone types, densities or water", () => {
    const c = blank();
    for (let y = 5; y < 8; y++) for (let x = 5; x < 8; x++) put(c, x, y, "residential", { density: 3 });
    put(c, 7, 7, "commercial", { density: 3 });
    const lot = findLot(c, at(c, 5, 5));
    assert.ok(lot.w < 3 || lot.h < 3);
  });
  test("capacity scales with tiles, density and level", () => {
    const c = blank();
    for (let y = 5; y < 8; y++) for (let x = 5; x < 8; x++) put(c, x, y, "residential", { density: 3 });
    const a = assignLot(c, findLot(c, at(c, 5, 5)), 4, 0.5);
    assert.equal(capacityOf(a), 320 * 9);
    a.level = 2;
    assert.equal(capacityOf(a), 320 * 9 / 2);
    a.abandoned = true;
    assert.equal(capacityOf(a), 0);
  });
});

describe("placement", () => {
  test("rejects unknown tools, prototype names and out-of-bounds", () => {
    const c = blank();
    for (const tool of ["laser", "constructor", "__proto__", "toString"]) assert.equal(place(c, 1, 1, tool).ok, false);
    assert.equal(place(c, -1, 0, "road").ok, false);
    assert.equal(place(c, 64, 0, "road").ok, false);
  });
  test("zones cost by density and rezoning undeveloped land is allowed", () => {
    const c = blank();
    const money = c.money;
    assert.equal(place(c, 5, 5, "residential", { density: 3 }).ok, true);
    assert.equal(money - c.money, 50);
    assert.equal(at(c, 5, 5).density, 3);
    assert.equal(place(c, 5, 5, "commercial", { density: 1 }).ok, true);
    assert.equal(at(c, 5, 5).type, "commercial");
    assert.equal(place(c, 5, 5, "commercial", { density: 1 }).noop, true);
  });
  test("multi-tile buildings occupy their footprint and refuse blocked sites", () => {
    const c = blank();
    const land = c.tiles.find((t) => t.terrain === "grass" && t.x > 5 && t.y > 5 && [0, 1, 2].every((dx) => [0, 1, 2].every((dy) => at(c, t.x + dx, t.y + dy).terrain !== "water")));
    const r = place(c, land.x, land.y, "police");
    assert.equal(r.ok, true);
    assert.equal(r.cost, BUILDINGS.police.cost);
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
      const t = at(c, land.x + dx, land.y + dy);
      assert.equal(t.type, "police");
      assert.deepEqual(t.lot, { x: land.x, y: land.y, w: 3, h: 3 });
    }
    assert.ok(isAnchor(at(c, land.x, land.y)));
    assert.equal(place(c, land.x + 1, land.y + 1, "fire").ok, false);
    assert.equal(place(c, land.x + 2, land.y + 2, "road").ok, false);
  });
  test("bulldozing a building clears the whole footprint and keeps zoning", () => {
    const c = blank();
    for (let y = 5; y < 8; y++) for (let x = 5; x < 8; x++) put(c, x, y, "residential", { density: 3 });
    assignLot(c, findLot(c, at(c, 5, 5)), 2, 0.5);
    const ev = evaluate(c, 6, 6, "bulldoze");
    assert.equal(ev.tiles.length, 9);
    assert.equal(place(c, 6, 6, "bulldoze").ok, true);
    for (let y = 5; y < 8; y++) for (let x = 5; x < 8; x++) {
      assert.equal(at(c, x, y).lot, null);
      assert.equal(at(c, x, y).type, "residential");
    }
    assert.equal(place(c, 6, 6, "bulldoze").ok, true);
    assert.equal(at(c, 6, 6).type, "empty");
    assert.equal(place(c, 6, 6, "bulldoze").ok, false);
  });
  test("roads and rail bridge water at a premium, pipes and subways do not", () => {
    const c = blank();
    const w = c.tiles.find((t) => t.terrain === "water");
    assert.equal(evaluate(c, w.x, w.y, "road").cost, BUILDINGS.road.cost * 5);
    assert.equal(evaluate(c, w.x, w.y, "rail").cost, BUILDINGS.rail.cost * 5);
    assert.equal(evaluate(c, w.x, w.y, "pipe").ok, false);
    assert.equal(evaluate(c, w.x, w.y, "subway").ok, false);
    assert.equal(evaluate(c, w.x, w.y, "powerline").ok, false);
    assert.equal(place(c, w.x, w.y, "rail").ok, true);
    assert.equal(evaluate(c, w.x, w.y, "powerline").ok, true);
  });
  test("insufficient funds leaves the city untouched", () => {
    const c = blank();
    c.money = 10;
    const before = serialize(c);
    assert.equal(place(c, 5, 5, "coal").ok, false);
    assert.equal(serialize(c), before);
  });
  test("trees clear when built over and can be planted", () => {
    const c = blank();
    const t = c.tiles.find((t) => t.trees > 0 && t.terrain === "grass");
    assert.equal(place(c, t.x, t.y, "road").ok, true);
    assert.equal(t.trees, 0);
    const g = c.tiles.find((t) => t.trees === 0 && t.terrain === "grass" && t.type === "empty");
    assert.equal(place(c, g.x, g.y, "tree").ok, true);
    assert.equal(g.trees, 1);
  });
});

describe("utilities", () => {
  test("power jumps a single road but not open land; lines bridge gaps", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false });
    put(c, 4, 4, "coal");
    for (let x = 8; x <= 9; x++) put(c, x, 5, "powerline");
    put(c, 10, 5, "residential", { density: 1 });
    put(c, 11, 5, "road");
    put(c, 12, 5, "residential", { density: 1 });
    put(c, 14, 5, "residential", { density: 1 });
    refresh(c);
    assert.equal(at(c, 10, 5).powered, true);
    assert.equal(at(c, 12, 5).powered, true, "across a road");
    assert.equal(at(c, 14, 5).powered, false, "across open land");
    assert.equal(at(c, 9, 5).powered, true);
    place(c, 13, 5, "powerline");
    assert.equal(at(c, 14, 5).powered, true);
  });
  test("plant capacity limits how many lots are powered", () => {
    const c = district(7, 3);
    for (const t of c.tiles) if (t.type === "residential" && !t.lot) { const lot = findLot(c, t); if (lot) assignLot(c, lot, 4, 0.5); }
    refresh(c);
    const s = getStats(c);
    assert.ok(s.utilities.power.demand > 0);
    put(c, 4, 14, "bulldoze");
    put(c, 4, 14, "wind");
    refresh(c);
    const weak = getStats(c);
    assert.ok(weak.power < s.power, `${weak.power} < ${s.power}`);
    assert.ok(weak.utilities.power.supply < weak.utilities.power.demand);
  });
  test("water reaches tiles near powered pipes only", () => {
    const c = district();
    assert.equal(at(c, 20, 23).watered, true);
    assert.equal(at(c, 20, 31).watered, false, "nine tiles from the pipe");
    for (const t of c.tiles) if (t.type === "watertower") { put(c, t.x, t.y, "bulldoze"); }
    refresh(c);
    assert.equal(at(c, 20, 23).watered, false);
  });
  test("pumps near water outperform inland pumps", () => {
    const c = blank();
    const shore = c.tiles.find((t) => t.terrain !== "water" && t.type === "empty" && t.x > 2 && t.y > 2 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(c, t.x + dx, t.y + dy)?.terrain === "water"));
    put(c, shore.x, shore.y, "waterpump");
    assert.equal(sourceEfficiency(c, at(c, shore.x, shore.y)), 1);
    const inland = c.tiles.find((t) => t.terrain === "grass" && t.type === "empty" && t.x > 20 && ![[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([dx, dy]) => at(c, t.x + dx, t.y + dy)?.terrain === "water"));
    put(c, inland.x, inland.y, "waterpump");
    assert.equal(sourceEfficiency(c, at(c, inland.x, inland.y)), 0.3);
  });
});

describe("growth", () => {
  test("a new town has positive demand and develops within a year", () => {
    const c = district();
    const d = computeDemand(c, computeMetrics(c));
    assert.ok(d.residential > 50, `residential ${d.residential}`);
    assert.ok(d.industrial > 20, `industrial ${d.industrial}`);
    for (let i = 0; i < 12; i++) tick(c);
    const s = getStats(c);
    assert.ok(s.population > 300, `population ${s.population}`);
    assert.ok(s.jobs > 100, `jobs ${s.jobs}`);
  });
  test("demand is deterministic for a seed", () => {
    const a = district(3), b = district(3);
    for (let i = 0; i < 24; i++) { tick(a); tick(b); }
    assert.equal(serialize(a), serialize(b));
  });
  test("losing power drains a district into abandonment", () => {
    const c = district();
    for (let i = 0; i < 24; i++) tick(c);
    const before = getStats(c).population;
    assert.ok(before > 0);
    put(c, 4, 14, "bulldoze");
    refresh(c);
    for (let i = 0; i < 24; i++) tick(c);
    const s = getStats(c);
    assert.ok(s.population < before * 0.5, `${s.population} < ${before}`);
    assert.ok(s.abandonedLots > 0 || s.population === 0);
  });
  test("negative demand under punishing taxes stalls growth", () => {
    const c = district();
    setPolicy(c, "tax.residential", 20);
    const d = computeDemand(c, computeMetrics(c));
    const low = district();
    assert.ok(d.residential < computeDemand(low, computeMetrics(low)).residential);
  });
  test("medium density needs water to develop", () => {
    const c = district(7, 2);
    for (const t of c.tiles) if (t.type === "watertower") put(c, t.x, t.y, "bulldoze");
    refresh(c);
    for (let i = 0; i < 24; i++) tick(c);
    assert.equal(getStats(c).population, 0);
  });
});

describe("economy", () => {
  test("budget splits income and expenses by department", () => {
    const c = createCity(44, true);
    const s = getStats(c);
    assert.ok(s.budget.income.residential > 0);
    assert.ok(s.budget.expenses.police > 0);
    assert.ok(s.budget.expenses.transport > 0);
    assert.equal(s.balance, s.income - s.expenses);
  });
  test("funding scales department cost and coverage", () => {
    const c = createCity(44, true);
    const full = getStats(c);
    setPolicy(c, "funding.police", 50);
    const half = getStats(c);
    assert.ok(half.budget.expenses.police < full.budget.expenses.police);
    assert.ok(half.crime >= full.crime);
  });
  test("loans add money and monthly payments, and can be repaid", () => {
    const c = blank();
    assert.equal(setPolicy(c, "loan", 10000).ok, true);
    assert.equal(c.money, 60000);
    assert.ok(c.debt > 10000);
    assert.ok(getStats(c).loanPayment > 0);
    tick(c);
    const afterTick = c.debt;
    assert.ok(afterTick < 11600);
    assert.equal(setPolicy(c, "repayLoan", true).ok, true);
    assert.equal(c.debt, 0);
    assert.equal(setPolicy(c, "loan", 200000).ok, false);
  });
  test("ordinances toggle and cost per resident", () => {
    const c = createCity(44, true);
    const before = getStats(c).expenses;
    assert.equal(setPolicy(c, "ordinance.cleanAir", true).ok, true);
    const s = getStats(c);
    assert.ok(s.expenses > before);
    assert.equal(s.ordinances.cleanAir, true);
    assert.equal(setPolicy(c, "ordinance.bogus", true).ok, false);
  });
  test("tax and funding bounds are enforced", () => {
    const c = blank();
    assert.equal(setPolicy(c, "tax.residential", 25).ok, false);
    assert.equal(setPolicy(c, "tax.residential", 12).ok, true);
    assert.equal(setPolicy(c, "funding.fire", 150).ok, false);
    assert.equal(setPolicy(c, "funding.bogus", 50).ok, false);
  });
});

describe("saves", () => {
  test("round trip preserves the city", () => {
    const c = createCity(44, true);
    for (let i = 0; i < 6; i++) tick(c);
    const raw = serialize(c);
    const d = deserialize(raw);
    assert.equal(d.month, c.month);
    assert.equal(getStats(d).population, getStats(c).population);
    assert.equal(serialize(d), raw);
    for (let i = 0; i < 6; i++) { tick(c); tick(d); }
    assert.equal(serialize(d), serialize(c));
  });
  test("corrupt and tampered saves are rejected", () => {
    const c = createCity(44, true);
    const raw = JSON.parse(serialize(c));
    assert.throws(() => deserialize("nope"));
    for (const mutate of [
      (d) => (d.version = 2), (d) => (d.size = 10), (d) => d.tiles.pop(), (d) => (d.money = "lots"),
      (d) => (d.taxes.residential = 99), (d) => (d.tiles[0][0] = 9), (d) => (d.tiles[0][8] = 7),
      (d) => (d.types[0] = "castle"), (d) => (d.loans = [{ amount: 1 }]), (d) => (d.name = "x".repeat(60)),
    ]) {
      const bad = structuredClone(raw); mutate(bad);
      assert.throws(() => deserialize(JSON.stringify(bad)));
    }
  });
  test("lot consistency is validated", () => {
    const c = blank();
    for (let y = 5; y < 8; y++) for (let x = 5; x < 8; x++) put(c, x, y, "residential", { density: 3 });
    assignLot(c, findLot(c, at(c, 5, 5)), 2, 0.5);
    const raw = JSON.parse(serialize(c));
    raw.tiles[5 * 64 + 6][4] = 7; // point one tile at a different anchor
    assert.throws(() => deserialize(JSON.stringify(raw)));
  });
});

describe("disasters and inspection", () => {
  test("fire damages buildings over time", () => {
    const c = createCity(44, true);
    const before = getStats(c).population;
    let burning = 0;
    for (let i = 0; i < 5; i++) { disaster(c, "fire"); }
    burning = c.tiles.filter((t) => t.fire > 0).length;
    assert.ok(burning > 0);
    for (let i = 0; i < 6; i++) tick(c);
    assert.ok(c.tiles.filter((t) => t.fire > 0).length < burning + 40);
    assert.ok(getStats(c).population <= before + 2000);
  });
  test("every disaster runs without throwing", () => {
    const c = createCity(44, true);
    for (const id of ["fire", "earthquake", "tornado", "flood", "riot", "toxic", "ufo", "volcano"]) assert.equal(typeof disaster(c, id), "string");
    assert.ok(c.tiles.some((t) => t.elev >= 5), "the volcano raised a cone");
    assert.doesNotThrow(() => deserialize(serialize(c)));
    for (let i = 0; i < 3; i++) tick(c);
    assert.ok(Number.isFinite(getStats(c).population));
  });
  test("inspect describes zones, buildings and land", () => {
    const c = createCity(44, true);
    const anchor = c.tiles.find((t) => isAnchor(t) && t.type === "residential" && t.level > 0);
    const info = inspectTile(c, anchor.x, anchor.y);
    assert.match(info.description, /residential/i);
    assert.match(info.title, /^[A-Z][a-z]+ /, "developed lots get a name");
    assert.ok(info.details.some((d) => /Residents/.test(d)));
    const plant = c.tiles.find((t) => t.type === "coal" || t.type === "gas");
    assert.match(inspectTile(c, plant.x, plant.y).title, /Coal|Gas/);
    assert.equal(inspectTile(c, -1, 0).title, "Out of bounds");
  });
  test("tools cover every catalog building", () => {
    const ids = new Set(TOOLS.map((t) => t.id));
    for (const id of Object.keys(BUILDINGS)) assert.ok(ids.has(id), id);
    assert.ok(ids.has("bulldoze") && ids.has("inspect"));
  });
});
