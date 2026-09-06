// v2-simulation.test.js — tests for new simulation mechanics
import { test } from "node:test";
import assert from "node:assert/strict";
import * as sim from "../src/sim.js";

// ── TOOLS v2 ─────────────────────────────────────────────────
test("TOOLS has all v2 tool ids", () => {
  const required = ["powerline", "pipe", "school", "hospital", "landfill", "bus", "rail"];
  for (const id of required) {
    assert.ok(sim.TOOLS.some((t) => t.id === id), `TOOLS missing: ${id}`);
  }
});

test("each TOOL has a group property", () => {
  for (const t of sim.TOOLS) {
    assert.equal(typeof t.group, "string", `${t.id} missing group`);
    assert.ok(t.group.length > 0, `${t.id} group is empty`);
  }
});

test("zone tools are in group 'zone'", () => {
  for (const id of ["residential", "commercial", "industrial"]) {
    const t = sim.TOOLS.find((t) => t.id === id);
    assert.equal(t.group, "zone", `${id} should be in group 'zone'`);
  }
});

// ── density placement ─────────────────────────────────────────
test("zone placement cost scales with density", () => {
  const city = sim.createCity(1, false);
  const t1 = city.tiles.find((t) => t.terrain === "grass" && t.type === "empty" && t.x === 2 && t.y === 2);
  if (!t1) return; // skip if no suitable tile

  const before = city.money;
  const r = sim.place(city, t1.x, t1.y, "residential", { density: 2 });
  assert.ok(r.ok, `place failed: ${r.message}`);
  const expected = 100 * 2; // base * density
  assert.equal(city.money, before - expected, `cost should be base*density`);
});

test("density stored on zone tile after placement", () => {
  const city = sim.createCity(1, false);
  const t1 = city.tiles.find((t) => t.terrain === "grass" && t.type === "empty");
  if (!t1) return;
  sim.place(city, t1.x, t1.y, "residential", { density: 3 });
  const placed = city.tiles.find((t) => t.type === "residential");
  assert.ok(placed, "no residential tile found");
  assert.equal(placed.density, 3, "density not set correctly");
});

test("same zone same density is noop (ok:true, no charge)", () => {
  const city = sim.createCity(1, false);
  const grass = city.tiles.find((t) => t.terrain === "grass" && t.type === "empty");
  if (!grass) return;
  sim.place(city, grass.x, grass.y, "residential", { density: 1 });
  const moneyBefore = city.money;
  const r = sim.place(city, grass.x, grass.y, "residential", { density: 1 });
  assert.ok(r.ok, "noop should return ok:true");
  assert.equal(city.money, moneyBefore, "noop should not charge");
});

test("same zone different density preserves existing development", () => {
  const city = sim.createCity(1, false);
  const grass = city.tiles.find((t) => t.terrain === "grass" && t.type === "empty");
  if (!grass) return;
  sim.place(city, grass.x, grass.y, "residential", { density: 1 });
  const t = city.tiles.find((ti) => ti.type === "residential");
  t.level = 1; // simulate some growth
  const before = city.money;
  const r = sim.place(city, grass.x, grass.y, "residential", { density: 2 });
  assert.ok(r.ok, `rezone failed: ${r.message}`);
  assert.equal(t.density, 2, "density should update");
  assert.equal(t.level, 1, "rezoning should preserve development within the density cap");
  assert.ok(city.money < before, "rezone should cost money");
});

// ── density level caps ────────────────────────────────────────
test("density=1 zone cannot grow beyond level 1", () => {
  const city = sim.createCity(1, false);
  const grass = city.tiles.find((t) => t.terrain === "grass" && t.type === "empty");
  if (!grass) return;
  sim.place(city, grass.x, grass.y, "residential", { density: 1 });
  const t = city.tiles.find((ti) => ti.type === "residential");
  // Force grow beyond cap
  t.level = 2;
  // After next infrastructure update via tick, level should be capped
  // We check the MAX_LEVEL_FOR_DENSITY indirectly through many ticks
  // Just verify density=1 cap is enforced: manual level 2 won't go higher
  for (let i = 0; i < 12; i++) sim.tick(city);
  assert.ok(t.level <= 1, `density=1 zone grew beyond level 1: ${t.level}`);
});

test("density=3 zone level never exceeds 4", () => {
  const city = sim.createCity(5, false);
  const grass = city.tiles.find((t) => t.terrain === "grass" && t.type === "empty");
  if (!grass) return;
  sim.place(city, grass.x, grass.y, "residential", { density: 3 });
  // Force level beyond cap
  grass.level = 5;
  // After tick growth logic, level should stay capped
  sim.tick(city);
  assert.ok(grass.level <= 4, `density=3 level ${grass.level} exceeds cap 4`);
});

// ── powerline / pipe overlay ──────────────────────────────────
test("powerline tool sets tile.powerline=true without changing tile.type", () => {
  const city = sim.createCity(1, false);
  const road = city.tiles.find((t) => t.type === "empty" && t.terrain === "grass");
  if (!road) return;
  // Place road first
  sim.place(city, road.x, road.y, "road");
  const before = city.tiles.find((t) => t.x === road.x && t.y === road.y);
  assert.equal(before.type, "road");
  const moneyBefore = city.money;
  const r = sim.place(city, road.x, road.y, "powerline");
  assert.ok(r.ok, `powerline failed: ${r.message}`);
  assert.equal(before.type, "road", "road type should be preserved");
  assert.equal(before.powerline, true, "powerline should be true");
  assert.ok(city.money < moneyBefore, "powerline should cost money");
});

test("powerline placement on same tile is noop", () => {
  const city = sim.createCity(1, false);
  const t = city.tiles.find((ti) => ti.terrain === "grass" && ti.type === "empty");
  if (!t) return;
  sim.place(city, t.x, t.y, "powerline");
  const before = city.money;
  const r = sim.place(city, t.x, t.y, "powerline");
  assert.ok(r.ok, "repeat powerline should return ok");
  assert.equal(city.money, before, "repeat powerline should not charge");
});

test("pipe tool sets tile.pipe=true", () => {
  const city = sim.createCity(1, false);
  const t = city.tiles.find((ti) => ti.terrain === "grass" && ti.type === "empty");
  if (!t) return;
  const r = sim.place(city, t.x, t.y, "pipe");
  assert.ok(r.ok, `pipe failed: ${r.message}`);
  assert.equal(t.pipe, true, "tile.pipe should be true");
  assert.equal(t.type, "empty", "tile.type should stay empty");
});

test("powerline cannot be placed on water terrain (non-bridge)", () => {
  const city = sim.createCity(42, false);
  const waterTile = city.tiles.find((t) => t.terrain === "water" && t.type === "empty");
  if (!waterTile) return;
  const r = sim.place(city, waterTile.x, waterTile.y, "powerline");
  assert.equal(r.ok, false, "powerline on water should fail");
});

test("powerline can be placed on road bridge over water", () => {
  const city = sim.createCity(42, false);
  const waterTile = city.tiles.find((t) => t.terrain === "water" && t.type === "empty");
  if (!waterTile) return;
  // Build road bridge first
  const br = sim.place(city, waterTile.x, waterTile.y, "road");
  assert.ok(br.ok, "road bridge should succeed");
  const r = sim.place(city, waterTile.x, waterTile.y, "powerline");
  assert.ok(r.ok, `powerline on bridge should succeed: ${r.message}`);
});

// ── setPolicy ─────────────────────────────────────────────────
test("setPolicy tax.residential changes tax rate", () => {
  const city = sim.createCity(42, true);
  const r = sim.setPolicy(city, "tax.residential", 12);
  assert.ok(r.ok, `setPolicy failed: ${r.message}`);
  const stats = sim.getStats(city);
  assert.equal(stats.taxes.residential, 12);
});

test("setPolicy tax out of range fails", () => {
  const city = sim.createCity(42, false);
  assert.equal(sim.setPolicy(city, "tax.residential", 0).ok, false);
  assert.equal(sim.setPolicy(city, "tax.commercial", 26).ok, false);
});

test("setPolicy funding.police changes funding", () => {
  const city = sim.createCity(42, true);
  const r = sim.setPolicy(city, "funding.police", 50);
  assert.ok(r.ok, `setPolicy failed: ${r.message}`);
  const stats = sim.getStats(city);
  assert.equal(stats.funding.police, 50);
});

test("setPolicy ordinance.cleanAir enables ordinance", () => {
  const city = sim.createCity(42, false);
  const r = sim.setPolicy(city, "ordinance.cleanAir", true);
  assert.ok(r.ok, `setPolicy failed: ${r.message}`);
  const stats = sim.getStats(city);
  assert.ok(stats.ordinances.cleanAir, "cleanAir should be enabled");
});

test("setPolicy loan adds money and debt", () => {
  const city = sim.createCity(42, false);
  const moneyBefore = city.money;
  const r = sim.setPolicy(city, "loan", 10000);
  assert.ok(r.ok, `loan failed: ${r.message}`);
  assert.equal(city.money, moneyBefore + 10000);
  assert.equal(city.debt, 10000);
});

test("setPolicy repayLoan reduces debt and money", () => {
  const city = sim.createCity(42, false);
  sim.setPolicy(city, "loan", 10000);
  const moneyBefore = city.money;
  const debtBefore = city.debt;
  const r = sim.setPolicy(city, "repayLoan", 5000);
  assert.ok(r.ok, `repayLoan failed: ${r.message}`);
  assert.equal(city.debt, debtBefore - 5000);
  assert.equal(city.money, moneyBefore - 5000);
});

test("setPolicy repayLoan with no debt fails", () => {
  const city = sim.createCity(42, false);
  assert.equal(city.debt, 0);
  const r = sim.setPolicy(city, "repayLoan", 500);
  assert.equal(r.ok, false);
});

// ── extended getStats fields ──────────────────────────────────
test("getStats returns all v2 fields", () => {
  const city = sim.createCity(42, true);
  const stats = sim.getStats(city);
  const v2Fields = [
    "unemployment", "pollution", "crime", "health", "education",
    "garbage", "traffic", "debt", "loanPayment", "taxes", "funding",
    "ordinances", "advisors", "news",
  ];
  for (const f of v2Fields) {
    assert.ok(f in stats, `getStats missing v2 field: ${f}`);
  }
});

test("stats unemployment is 0..100", () => {
  const city = sim.createCity(42, true);
  sim.tick(city);
  const stats = sim.getStats(city);
  assert.ok(stats.unemployment >= 0 && stats.unemployment <= 100,
    `unemployment out of range: ${stats.unemployment}`);
});

test("stats health and education are 0..100", () => {
  const city = sim.createCity(42, true);
  const stats = sim.getStats(city);
  assert.ok(stats.health >= 0 && stats.health <= 100, `health: ${stats.health}`);
  assert.ok(stats.education >= 0 && stats.education <= 100, `education: ${stats.education}`);
});

test("stats advisors is array of {name,role,mood,message}", () => {
  const city = sim.createCity(42, true);
  const stats = sim.getStats(city);
  assert.ok(Array.isArray(stats.advisors), "advisors should be array");
  assert.ok(stats.advisors.length > 0, "should have at least one advisor");
  for (const a of stats.advisors) {
    assert.equal(typeof a.name, "string");
    assert.equal(typeof a.role, "string");
    assert.ok(["good","warning","bad"].includes(a.mood), `bad mood: ${a.mood}`);
    assert.equal(typeof a.message, "string");
  }
});

test("stats debt reflects city.debt", () => {
  const city = sim.createCity(42, false);
  sim.setPolicy(city, "loan", 20000);
  const stats = sim.getStats(city);
  assert.equal(stats.debt, 20000);
});

test("stats taxes reflects current tax rates", () => {
  const city = sim.createCity(42, false);
  sim.setPolicy(city, "tax.residential", 15);
  const stats = sim.getStats(city);
  assert.equal(stats.taxes.residential, 15);
  assert.equal(typeof stats.taxes.commercial, "number");
  assert.equal(typeof stats.taxes.industrial, "number");
});

// ── loan affects monthly budget ───────────────────────────────
test("loan payment reduces debt each tick", () => {
  const city = sim.createCity(42, false);
  sim.setPolicy(city, "loan", 10000);
  const debtBefore = city.debt;
  sim.tick(city);
  assert.ok(city.debt < debtBefore, `debt should decrease after tick: ${city.debt} vs ${debtBefore}`);
});

test("loan payment appears in expenses", () => {
  const city = sim.createCity(42, false);
  const statsNoloan = sim.getStats(city);
  sim.setPolicy(city, "loan", 10000);
  const statsLoan = sim.getStats(city);
  assert.ok(statsLoan.expenses > statsNoloan.expenses, "expenses should increase with loan");
  assert.ok(statsLoan.loanPayment > 0, "loanPayment should be > 0");
});

// ── history bounds ────────────────────────────────────────────
test("history grows with ticks up to 240", () => {
  const city = sim.createCity(42, false);
  for (let i = 0; i < 50; i++) sim.tick(city);
  assert.equal(city.history.length, 50);
  for (let i = 0; i < 200; i++) sim.tick(city);
  // should be capped at 240
  assert.ok(city.history.length <= 240, `history.length ${city.history.length} exceeds 240`);
});

// ── rail placement ────────────────────────────────────────────
test("rail can be placed on grass but not water", () => {
  const city = sim.createCity(42, false);
  const grass = city.tiles.find((t) => t.terrain === "grass" && t.type === "empty");
  if (!grass) return;
  const r = sim.place(city, grass.x, grass.y, "rail");
  assert.ok(r.ok, `rail on grass should succeed: ${r.message}`);
  assert.equal(city.tiles.find((t) => t.type === "rail"), grass);

  const water = city.tiles.find((t) => t.terrain === "water" && t.type === "empty");
  if (!water) return;
  const r2 = sim.place(city, water.x, water.y, "rail");
  assert.equal(r2.ok, false, "rail on water should fail");
});

// ── civic buildings ───────────────────────────────────────────
test("school, hospital, landfill, bus can be placed on grass", () => {
  const city = sim.createCity(1, false);
  let idx = 0;
  for (const id of ["school", "hospital", "landfill", "bus"]) {
    const grass = city.tiles.filter((t) => t.terrain === "grass" && t.type === "empty")[idx++];
    if (!grass) continue;
    const r = sim.place(city, grass.x, grass.y, id);
    assert.ok(r.ok, `${id} placement failed: ${r.message}`);
    assert.equal(grass.type, id, `tile.type should be ${id}`);
  }
});

test("school placement improves education stats", () => {
  const city = sim.createCity(42, true);
  const statsWithout = sim.getStats(city);

  // Place a school near residential zones
  const grass = city.tiles.find((t) => t.terrain === "grass" && t.type === "empty" && t.x < 15);
  if (!grass) return;
  sim.place(city, grass.x, grass.y, "school");
  const statsWith = sim.getStats(city);
  assert.ok(statsWith.education >= statsWithout.education,
    `education should not decrease after school: ${statsWith.education} vs ${statsWithout.education}`);
});

// ── bulldoze clears powerline/pipe ────────────────────────────
test("bulldoze clears powerline overlay", () => {
  const city = sim.createCity(1, false);
  const t = city.tiles.find((ti) => ti.terrain === "grass" && ti.type === "empty");
  if (!t) return;
  sim.place(city, t.x, t.y, "powerline");
  assert.ok(t.powerline);
  sim.place(city, t.x, t.y, "bulldoze");
  assert.equal(t.powerline, false, "bulldoze should clear powerline");
});

// ── serialize/deserialize migration ──────────────────────────
test("old save without taxes field migrates via city.tax", () => {
  const city = sim.createCity(42, false);
  const raw = JSON.parse(sim.serialize(city));
  // Simulate old save: remove taxes field
  delete raw.taxes;
  const restored = sim.deserialize(JSON.stringify(raw));
  const stats = sim.getStats(restored);
  assert.equal(stats.taxes.residential, 9);
  assert.equal(stats.taxes.commercial, 9);
});

test("old save road tiles get powerline/pipe after migration", () => {
  const city = sim.createCity(42, false);
  // Place a road
  const grass = city.tiles.find((t) => t.terrain === "grass" && t.type === "empty");
  if (!grass) return;
  sim.place(city, grass.x, grass.y, "road");

  // Serialize but strip powerline/pipe from tiles (simulate old save)
  const raw = JSON.parse(sim.serialize(city));
  for (const t of raw.tiles) {
    delete t.powerline;
    delete t.pipe;
  }
  const restored = sim.deserialize(JSON.stringify(raw));
  const roadTile = restored.tiles.find((t) => t.type === "road");
  assert.ok(roadTile, "road tile should exist");
  assert.equal(roadTile.powerline, true, "migrated road should have powerline=true");
  assert.equal(roadTile.pipe, true, "migrated road should have pipe=true");
});

// ── density=1 grows without water ────────────────────────────
test("density=1 zone grows with power and road but no water", () => {
  const city = sim.createCity(99, false);
  // Build minimal setup: residential + road + power, NO water
  const cx = 5, cy = 5;
  sim.place(city, cx, cy, "residential", { density: 1 });
  sim.place(city, cx - 1, cy, "road");
  sim.place(city, cx + 1, cy, "road");
  sim.place(city, cx, cy - 1, "road");
  sim.place(city, cx, cy + 1, "power");
  // No water tower

  for (let i = 0; i < 48; i++) sim.tick(city);
  const zone = city.tiles[cy * 40 + cx];
  assert.ok(zone.level >= 1, `density=1 zone should grow without water, level=${zone.level}`);
});

test("density=2 zone does not grow without water", () => {
  const city = sim.createCity(99, false);
  const cx = 15, cy = 5;
  sim.place(city, cx, cy, "residential", { density: 2 });
  sim.place(city, cx - 1, cy, "road");
  sim.place(city, cx + 1, cy, "road");
  sim.place(city, cx, cy - 1, "road");
  sim.place(city, cx, cy + 1, "power");
  // No water tower
  for (let i = 0; i < 48; i++) sim.tick(city);
  const zone = city.tiles[cy * 40 + cx];
  assert.equal(zone.level, 0, `density=2 zone should not grow without water, level=${zone.level}`);
});

// ── pollution / crime overlays ────────────────────────────────
test("industrial zones produce pollution tracked in stats", () => {
  const city = sim.createCity(42, true); // starter has industrial zones
  sim.tick(city);
  const stats = sim.getStats(city);
  assert.ok(stats.pollution >= 0 && stats.pollution <= 100,
    `pollution out of range: ${stats.pollution}`);
  // Starter has industrial, so tile-level pollution should exist
  const hasPollutedTile = city.tiles.some((t) => (t.pollution || 0) > 0);
  assert.ok(hasPollutedTile, "industrial zones should create pollution on tiles");
});

test("cleanAir ordinance reduces pollution", () => {
  const city = sim.createCity(42, true); // starter has industrial zones
  sim.tick(city);
  const statsBefore = sim.getStats(city);

  sim.setPolicy(city, "ordinance.cleanAir", true);
  sim.tick(city);
  const statsAfter = sim.getStats(city);

  assert.ok(statsAfter.pollution <= statsBefore.pollution,
    `cleanAir should reduce pollution: ${statsAfter.pollution} vs ${statsBefore.pollution}`);
});

// ── funding affects services ──────────────────────────────────
test("lower police funding increases crime", () => {
  const city = sim.createCity(42, true);
  sim.tick(city);
  const crimeAt100 = sim.getStats(city).crime;

  sim.setPolicy(city, "funding.police", 0);
  sim.tick(city);
  const crimeAt0 = sim.getStats(city).crime;

  assert.ok(crimeAt0 >= crimeAt100,
    `lower police funding should not decrease crime: ${crimeAt0} vs ${crimeAt100}`);
});

// ── city name ─────────────────────────────────────────────────
test("createCity gives city a name", () => {
  const city = sim.createCity(42, false);
  assert.equal(typeof city.name, "string");
  assert.ok(city.name.length > 0);
});

test("name preserved through serialize/deserialize", () => {
  const city = sim.createCity(42, false);
  city.name = "Testville";
  const restored = sim.deserialize(sim.serialize(city));
  assert.equal(restored.name, "Testville");
});
