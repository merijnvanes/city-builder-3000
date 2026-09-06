// Civic 3000 – simulation unit tests. Missing/broken imports must fail CI.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as sim from "../src/sim.js";

// ── TOOLS array ──────────────────────────────────────────────────────────────

test("TOOLS has all required ids", (t) => {
  const REQUIRED = [
    "inspect",
    "road",
    "residential",
    "commercial",
    "industrial",
    "park",
    "power",
    "water",
    "police",
    "fire",
    "bulldoze",
  ];
  assert.ok(Array.isArray(sim.TOOLS), "TOOLS is not an array");
  for (const id of REQUIRED) {
    assert.ok(
      sim.TOOLS.some((tool) => tool.id === id),
      `TOOLS missing id: "${id}"`,
    );
  }
});

test("each TOOL entry has label, cost, description", (t) => {
  for (const tool of sim.TOOLS) {
    assert.equal(typeof tool.label, "string", `${tool.id}: label not string`);
    assert.equal(typeof tool.cost, "number", `${tool.id}: cost not number`);
    assert.equal(
      typeof tool.description,
      "string",
      `${tool.id}: description not string`,
    );
  }
});

// ── createCity structure ──────────────────────────────────────────────────────

test("createCity returns required city structure", (t) => {
  const city = sim.createCity(42, false);
  assert.equal(city.size, 40, "size !== 40");
  assert.equal(city.tiles.length, 40 * 40, "tiles length wrong");
  assert.equal(city.money, 50000, "starting money wrong");
  assert.equal(city.month, 0, "month not 0");
  assert.equal(city.tax, 9, "tax not 9");
  assert.equal(city.revision, 0, "revision not 0");
  assert.ok(Array.isArray(city.history), "history not array");
  assert.deepEqual(Object.keys(city.demand).sort(), [
    "commercial",
    "industrial",
    "residential",
  ]);
});

test("each tile has required fields with correct types", (t) => {
  const city = sim.createCity(42, false);
  for (let i = 0; i < city.tiles.length; i += 100) {
    // spot-check every 100th
    const tile = city.tiles[i];
    const y = Math.floor(i / 40),
      x = i % 40;
    assert.equal(tile.x, x, `tile[${i}].x mismatch`);
    assert.equal(tile.y, y, `tile[${i}].y mismatch`);
    assert.ok(
      ["grass", "water", "sand"].includes(tile.terrain),
      `bad terrain: ${tile.terrain}`,
    );
    assert.equal(typeof tile.type, "string", `tile.type not string`);
    assert.equal(typeof tile.level, "number", `tile.level not number`);
    assert.ok(
      tile.level >= 0 && tile.level <= 4,
      `level out of range: ${tile.level}`,
    );
    assert.equal(typeof tile.variant, "number", `tile.variant not number`);
    assert.ok(
      tile.variant >= 0 && tile.variant <= 1,
      `variant out of 0-1: ${tile.variant}`,
    );
    assert.equal(typeof tile.powered, "boolean", `tile.powered not boolean`);
    assert.equal(typeof tile.watered, "boolean", `tile.watered not boolean`);
    assert.equal(
      typeof tile.roadAccess,
      "boolean",
      `tile.roadAccess not boolean`,
    );
  }
});

// ── createCity determinism ────────────────────────────────────────────────────

test("same seed produces identical terrain layout", (t) => {
  const a = sim.createCity(42, false);
  const b = sim.createCity(42, false);
  const terrainA = a.tiles.map((tile) => tile.terrain).join(",");
  const terrainB = b.tiles.map((tile) => tile.terrain).join(",");
  assert.equal(terrainA, terrainB, "terrain differs between identical seeds");
  assert.equal(a.seed, b.seed, "seed not stored on city");
});

test("same seed, starter vs blank, share identical terrain", (t) => {
  // terrain should be independent of starter flag
  const blank = sim.createCity(42, false);
  const starter = sim.createCity(42, true);
  const terrainBlank = blank.tiles.map((tile) => tile.terrain).join(",");
  const terrainStarter = starter.tiles.map((tile) => tile.terrain).join(",");
  assert.equal(
    terrainBlank,
    terrainStarter,
    "starter flag changed terrain layout",
  );
});

test("different seeds produce different variant values", (t) => {
  const a = sim.createCity(1, false);
  const b = sim.createCity(9999, false);
  const varA = a.tiles.map((tile) => tile.variant).join(",");
  const varB = b.tiles.map((tile) => tile.variant).join(",");
  // Collision across all 1600 tiles is astronomically unlikely
  assert.notEqual(varA, varB, "different seeds produced identical variants");
});

// ── terrain ───────────────────────────────────────────────────────────────────

test("river zone (x 28-32) contains water tiles", (t) => {
  const city = sim.createCity(42, false);
  const waterInRiver = city.tiles.filter(
    (tile) => tile.x >= 28 && tile.x <= 32 && tile.terrain === "water",
  );
  assert.ok(
    waterInRiver.length > 0,
    "No water tiles found in x=28..32 river zone",
  );
});

test("all terrain values are valid", (t) => {
  const city = sim.createCity(42, false);
  const valid = new Set(["grass", "water", "sand"]);
  for (const tile of city.tiles) {
    assert.ok(
      valid.has(tile.terrain),
      `invalid terrain "${tile.terrain}" at (${tile.x},${tile.y})`,
    );
  }
});

// ── starter city ──────────────────────────────────────────────────────────────

test("starter city has roads pre-placed", (t) => {
  const city = sim.createCity(42, true);
  const roads = city.tiles.filter((tile) => tile.type === "road");
  assert.ok(roads.length > 0, "Starter city has no roads");
});

test("starter city has zoned tiles (residential/commercial/industrial)", (t) => {
  const city = sim.createCity(42, true);
  const zones = city.tiles.filter((tile) =>
    ["residential", "commercial", "industrial"].includes(tile.type),
  );
  assert.ok(zones.length > 0, "Starter city has no zoned tiles");
});

test("starter city has power and water coverage", (t) => {
  const city = sim.createCity(42, true);
  const powered = city.tiles.filter((tile) => tile.powered);
  const watered = city.tiles.filter((tile) => tile.watered);
  assert.ok(powered.length > 0, "Starter city has no powered tiles");
  assert.ok(watered.length > 0, "Starter city has no watered tiles");
});

test("starter city zones have level > 0", (t) => {
  const city = sim.createCity(42, true);
  const builtZones = city.tiles.filter(
    (tile) =>
      ["residential", "commercial", "industrial"].includes(tile.type) &&
      tile.level > 0,
  );
  assert.ok(builtZones.length > 0, "Starter city has no zones at level > 0");
});

// ── place – bounds ────────────────────────────────────────────────────────────

test("place at x=-1 returns {ok:false}", (t) => {
  const city = sim.createCity(42, false);
  const r = sim.place(city, -1, 5, "residential");
  assert.equal(r.ok, false, "Expected ok:false for x=-1");
  assert.equal(typeof r.message, "string", "Expected message string");
});

test("place at y=-1 returns {ok:false}", (t) => {
  const city = sim.createCity(42, false);
  const r = sim.place(city, 5, -1, "residential");
  assert.equal(r.ok, false, "Expected ok:false for y=-1");
});

test("place at x=40 returns {ok:false}", (t) => {
  const city = sim.createCity(42, false);
  const r = sim.place(city, 40, 5, "residential");
  assert.equal(r.ok, false, "Expected ok:false for x=40 (out of bounds)");
});

test("place at y=40 returns {ok:false}", (t) => {
  const city = sim.createCity(42, false);
  const r = sim.place(city, 5, 40, "road");
  assert.equal(r.ok, false, "Expected ok:false for y=40 (out of bounds)");
});

// ── place – water / bridge ────────────────────────────────────────────────────

test("road on water tile succeeds (bridge)", (t) => {
  const city = sim.createCity(42, false);
  const waterTile = city.tiles.find((tile) => tile.terrain === "water");
  if (!waterTile) {
    t.skip("No water tile found in city");
    return;
  }
  const r = sim.place(city, waterTile.x, waterTile.y, "road");
  assert.equal(
    r.ok,
    true,
    `Road on water (${waterTile.x},${waterTile.y}) returned ok:false — "${r.message}"`,
  );
});

test("residential on water tile returns {ok:false}", (t) => {
  const city = sim.createCity(42, false);
  const waterTile = city.tiles.find((tile) => tile.terrain === "water");
  if (!waterTile) {
    t.skip("No water tile found");
    return;
  }
  const r = sim.place(city, waterTile.x, waterTile.y, "residential");
  assert.equal(
    r.ok,
    false,
    `Expected residential on water to fail, but got ok:true`,
  );
});

// ── place – finances ──────────────────────────────────────────────────────────

test("successful placement deducts tool cost from city.money", (t) => {
  const city = sim.createCity(42, false);
  const grassTile = city.tiles.find(
    (tile) => tile.terrain === "grass" && tile.type === "empty",
  );
  if (!grassTile) {
    t.skip("No grass tile available");
    return;
  }
  const toolDef = sim.TOOLS.find((tool) => tool.id === "residential");
  const moneyBefore = city.money;
  const r = sim.place(city, grassTile.x, grassTile.y, "residential");
  if (!r.ok) {
    t.skip(`Could not place residential: ${r.message}`);
    return;
  }
  assert.equal(
    city.money,
    moneyBefore - toolDef.cost,
    `Expected money to drop by ${toolDef.cost}, actual: ${moneyBefore} → ${city.money}`,
  );
});

test("place returns {ok:false} when city.money is 0", (t) => {
  const city = sim.createCity(42, false);
  city.money = 0;
  const grassTile = city.tiles.find(
    (tile) => tile.terrain === "grass" && tile.type === "empty",
  );
  if (!grassTile) {
    t.skip("No grass tile");
    return;
  }
  const r = sim.place(city, grassTile.x, grassTile.y, "residential");
  assert.equal(r.ok, false, "Should not allow placement with 0 money");
  assert.ok(r.message.length > 0, "Expected a non-empty error message");
});

test("money unchanged after failed placement", (t) => {
  const city = sim.createCity(42, false);
  city.money = 0;
  const moneyBefore = city.money;
  const grassTile = city.tiles.find(
    (tile) => tile.terrain === "grass" && tile.type === "empty",
  );
  if (!grassTile) {
    t.skip("No grass tile");
    return;
  }
  sim.place(city, grassTile.x, grassTile.y, "residential");
  assert.equal(
    city.money,
    moneyBefore,
    "Failed placement should not change money",
  );
});

// ── tick ──────────────────────────────────────────────────────────────────────

test("tick increments city.month by 1", (t) => {
  const city = sim.createCity(42, false);
  assert.equal(city.month, 0);
  sim.tick(city);
  assert.equal(city.month, 1);
  sim.tick(city);
  assert.equal(city.month, 2);
});

test("tick increments city.revision", (t) => {
  const city = sim.createCity(42, false);
  assert.equal(city.revision, 0);
  sim.tick(city);
  assert.equal(city.revision, 1);
  sim.tick(city);
  assert.equal(city.revision, 2);
});

test("tick on empty city keeps population non-negative", (t) => {
  const city = sim.createCity(42, false);
  for (let i = 0; i < 24; i++) sim.tick(city);
  assert.ok(
    city.population >= 0,
    `population went negative: ${city.population}`,
  );
});

test("tick on starter city keeps population non-negative", (t) => {
  const city = sim.createCity(42, true);
  for (let i = 0; i < 12; i++) sim.tick(city);
  assert.ok(
    city.population >= 0,
    `population went negative: ${city.population}`,
  );
});

// ── growth: serviced zones vs unserviced ──────────────────────────────────────

test("zones with road/power/water grow more than unserviced zones after 24 ticks", (t) => {
  // City A: one residential zone, no services
  const cityA = sim.createCity(7, false);
  const grassA = cityA.tiles.find(
    (tile) =>
      tile.terrain === "grass" &&
      tile.type === "empty" &&
      tile.x < 20 &&
      tile.y < 20,
  );
  if (!grassA) {
    t.skip("No suitable grass tile for city A");
    return;
  }
  sim.place(cityA, grassA.x, grassA.y, "residential");
  for (let i = 0; i < 24; i++) sim.tick(cityA);

  // City B: residential zone with adjacent road, power, water
  const cityB = sim.createCity(7, false);
  const cx = 5,
    cy = 5; // well within grass zone
  sim.place(cityB, cx, cy, "residential");
  sim.place(cityB, cx - 1, cy, "road");
  sim.place(cityB, cx + 1, cy, "road");
  sim.place(cityB, cx, cy - 1, "road");
  sim.place(cityB, cx, cy + 1, "power");
  sim.place(cityB, cx + 1, cy + 1, "water");
  for (let i = 0; i < 24; i++) sim.tick(cityB);

  assert.ok(
    cityB.population >= cityA.population,
    `Serviced city pop (${cityB.population}) should be >= unserviced (${cityA.population})`,
  );
});

// ── getStats ──────────────────────────────────────────────────────────────────

test("getStats returns all required fields", (t) => {
  const city = sim.createCity(42, true);
  const stats = sim.getStats(city);
  for (const key of [
    "population",
    "money",
    "happiness",
    "income",
    "expenses",
    "balance",
    "power",
    "water",
    "jobs",
    "demand",
    "date",
    "advice",
  ]) {
    assert.ok(key in stats, `getStats missing field: "${key}"`);
  }
  for (const key of ["residential", "commercial", "industrial"]) {
    assert.ok(key in stats.demand, `stats.demand missing: "${key}"`);
  }
  assert.equal(typeof stats.date, "string", "stats.date not string");
  assert.equal(typeof stats.advice, "string", "stats.advice not string");
});

test("getStats power and water are in range 0-100", (t) => {
  const city = sim.createCity(42, true);
  const stats = sim.getStats(city);
  assert.ok(
    stats.power >= 0 && stats.power <= 100,
    `power out of 0-100: ${stats.power}`,
  );
  assert.ok(
    stats.water >= 0 && stats.water <= 100,
    `water out of 0-100: ${stats.water}`,
  );
});

test("getStats balance equals income minus expenses", (t) => {
  const city = sim.createCity(42, true);
  const stats = sim.getStats(city);
  assert.equal(
    stats.balance,
    stats.income - stats.expenses,
    `balance (${stats.balance}) !== income (${stats.income}) - expenses (${stats.expenses})`,
  );
});

test("getStats money matches city.money", (t) => {
  const city = sim.createCity(42, false);
  const stats = sim.getStats(city);
  assert.equal(
    stats.money,
    city.money,
    "getStats.money differs from city.money",
  );
});

// ── monthly economics ─────────────────────────────────────────────────────────

test("higher tax rate produces higher income (same city, same ticks)", (t) => {
  const cityLow = sim.createCity(42, true);
  cityLow.tax = 1;
  sim.tick(cityLow);
  const statsLow = sim.getStats(cityLow);

  const cityHigh = sim.createCity(42, true);
  cityHigh.tax = 20;
  sim.tick(cityHigh);
  const statsHigh = sim.getStats(cityHigh);

  assert.ok(
    statsHigh.income >= statsLow.income,
    `High-tax income (${statsHigh.income}) < low-tax income (${statsLow.income})`,
  );
});

test("income and expenses are non-negative", (t) => {
  const city = sim.createCity(42, true);
  for (let i = 0; i < 6; i++) sim.tick(city);
  const stats = sim.getStats(city);
  assert.ok(stats.income >= 0, `income negative: ${stats.income}`);
  assert.ok(stats.expenses >= 0, `expenses negative: ${stats.expenses}`);
});

// ── inspectTile ───────────────────────────────────────────────────────────────

test("inspectTile returns {title, description, details}", (t) => {
  const city = sim.createCity(42, false);
  const info = sim.inspectTile(city, 0, 0);
  assert.equal(typeof info.title, "string", "title not string");
  assert.equal(typeof info.description, "string", "description not string");
  assert.ok(Array.isArray(info.details), "details not array");
  for (const d of info.details) {
    assert.equal(
      typeof d,
      "string",
      `details element not string: ${JSON.stringify(d)}`,
    );
  }
});

test("inspectTile on road tile mentions road in output", (t) => {
  const city = sim.createCity(42, false);
  const grassTile = city.tiles.find(
    (tile) => tile.terrain === "grass" && tile.type === "empty",
  );
  if (!grassTile) {
    t.skip("No grass tile");
    return;
  }
  const r = sim.place(city, grassTile.x, grassTile.y, "road");
  if (!r.ok) {
    t.skip(`place road failed: ${r.message}`);
    return;
  }
  const info = sim.inspectTile(city, grassTile.x, grassTile.y);
  const text = [info.title, info.description, ...info.details]
    .join(" ")
    .toLowerCase();
  assert.ok(
    text.includes("road"),
    `Expected "road" in inspect output. Got: "${text}"`,
  );
});

test("inspectTile on water tile mentions water or river", (t) => {
  const city = sim.createCity(42, false);
  const waterTile = city.tiles.find((tile) => tile.terrain === "water");
  if (!waterTile) {
    t.skip("No water tile");
    return;
  }
  const info = sim.inspectTile(city, waterTile.x, waterTile.y);
  const text = [info.title, info.description, ...info.details]
    .join(" ")
    .toLowerCase();
  assert.ok(
    text.includes("water") || text.includes("river"),
    `Expected water/river in inspect output. Got: "${text}"`,
  );
});

// ── serialize / deserialize ───────────────────────────────────────────────────

test("serialize returns a non-empty string", (t) => {
  const city = sim.createCity(42, true);
  const str = sim.serialize(city);
  assert.equal(typeof str, "string", "serialize did not return string");
  assert.ok(str.length > 0, "serialize returned empty string");
});

test("serialize output is valid JSON", (t) => {
  const city = sim.createCity(42, false);
  const str = sim.serialize(city);
  assert.doesNotThrow(
    () => JSON.parse(str),
    "serialize output is not valid JSON",
  );
});

test("deserialize(serialize(city)) preserves key fields", (t) => {
  const city = sim.createCity(42, true);
  sim.tick(city);
  const str = sim.serialize(city);
  const restored = sim.deserialize(str);

  assert.equal(restored.money, city.money, "money mismatch after roundtrip");
  assert.equal(restored.month, city.month, "month mismatch after roundtrip");
  assert.equal(restored.size, city.size, "size mismatch after roundtrip");
  assert.equal(restored.seed, city.seed, "seed mismatch after roundtrip");
  assert.equal(
    restored.revision,
    city.revision,
    "revision mismatch after roundtrip",
  );
  assert.equal(restored.tax, city.tax, "tax mismatch after roundtrip");
  assert.equal(
    restored.tiles.length,
    city.tiles.length,
    "tiles length mismatch after roundtrip",
  );
});

test("deserialize(serialize(city)) preserves tile terrain and type", (t) => {
  const city = sim.createCity(42, true);
  sim.tick(city);
  const restored = sim.deserialize(sim.serialize(city));
  for (let i = 0; i < city.tiles.length; i += 50) {
    // spot-check every 50th tile
    const orig = city.tiles[i],
      rest = restored.tiles[i];
    assert.equal(rest.terrain, orig.terrain, `tile[${i}] terrain mismatch`);
    assert.equal(rest.type, orig.type, `tile[${i}] type mismatch`);
    assert.equal(rest.level, orig.level, `tile[${i}] level mismatch`);
  }
});

test("deserialize throws on completely invalid input", (t) => {
  const { deserialize } = sim;
  assert.throws(
    () => deserialize("not json at all ###"),
    "Should throw on non-JSON string",
  );
  assert.throws(() => deserialize(""), "Should throw on empty string");
});

test("deserialize throws on JSON missing required fields", (t) => {
  const { deserialize } = sim;
  // Empty object is valid JSON but missing all required city fields
  assert.throws(
    () => deserialize("{}"),
    "Should throw on JSON object missing required city fields",
  );
  // Has size but no tiles
  assert.throws(
    () => deserialize(JSON.stringify({ size: 40, money: 50000 })),
    "Should throw on city object missing tiles array",
  );
});

test("deserialize throws on truncated/corrupt tile array", (t) => {
  const city = sim.createCity(42, false);
  const serialized = JSON.parse(sim.serialize(city));
  serialized.tiles = serialized.tiles.slice(0, 10); // truncate tiles
  assert.throws(
    () => sim.deserialize(JSON.stringify(serialized)),
    "Should throw when tiles array has wrong length",
  );
});
