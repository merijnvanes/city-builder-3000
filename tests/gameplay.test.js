import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCity,
  tick,
  place,
  getStats,
  serialize,
  deserialize,
  TOOLS,
} from "../src/sim.js";

const newCity = () => createCity(42, false);
const findGrass = (c) =>
  c.tiles.find((t) => t.terrain === "grass" && t.type === "empty");
const patched = (city, p) =>
  JSON.stringify({ ...JSON.parse(serialize(city)), ...p });
const patchedTile = (city, i, p) => {
  const d = JSON.parse(serialize(city));
  Object.assign(d.tiles[i], p);
  return JSON.stringify(d);
};

// ── New zone state before ticks ──────────────────────────────────

test("fresh residential zone starts at level 0", () => {
  const c = newCity(),
    g = findGrass(c);
  place(c, g.x, g.y, "residential");
  assert.equal(c.tiles.find((t) => t.type === "residential").level, 0);
});

test("fresh residential zone has zero jobs before tick", () => {
  const c = newCity(),
    g = findGrass(c);
  place(c, g.x, g.y, "residential");
  assert.equal(getStats(c).jobs, 0, "residential zones provide no jobs");
});

test("undeveloped residential has zero residents before tick", () => {
  const c = newCity(),
    g = findGrass(c);
  place(c, g.x, g.y, "residential");
  assert.equal(
    getStats(c).population,
    0,
    "level-0 residential should contribute 0 residents",
  );
});

test("undeveloped residential has zero income before tick", () => {
  const c = newCity(),
    g = findGrass(c);
  place(c, g.x, g.y, "residential");
  assert.equal(getStats(c).income, 0, "zero population yields zero income");
});

// ── Unknown tool / bad coords ─────────────────────────────────────

test("unknown tool id returns ok:false and does not mutate city", () => {
  const c = newCity(),
    g = findGrass(c);
  const snap = { money: c.money, rev: c.revision, type: g.type };
  const r = place(c, g.x, g.y, "supervillain");
  assert.equal(r.ok, false, "unknown tool must return ok:false");
  assert.equal(c.money, snap.money, "money must be unchanged");
  assert.equal(c.revision, snap.rev, "revision must be unchanged");
  assert.equal(g.type, snap.type, "tile type must be unchanged");
});

test("fractional x coord does not corrupt city", () => {
  const c = newCity(),
    snap = { money: c.money, rev: c.revision };
  const r = place(c, 1.5, 5, "road");
  assert.equal(r.ok, false);
  assert.equal(c.money, snap.money, "money unchanged after fractional coord");
  assert.equal(
    c.revision,
    snap.rev,
    "revision unchanged after fractional coord",
  );
});

test("NaN coord returns ok:false and does not mutate city", () => {
  const c = newCity(),
    snap = { money: c.money, rev: c.revision };
  const r = place(c, NaN, 5, "road");
  assert.equal(r.ok, false, "NaN coord must return ok:false");
  assert.equal(c.money, snap.money);
  assert.equal(c.revision, snap.rev);
});

// ── Demolition: listed fee minus advertised refund ───────────────

test("bulldoze charges its listed fee and refunds 25% salvage", () => {
  const c = newCity(),
    g = findGrass(c);
  const cost = TOOLS.find((t) => t.id === "residential").cost;
  place(c, g.x, g.y, "residential");
  const afterPlace = c.money;
  place(c, g.x, g.y, "bulldoze");
  assert.equal(
    c.money,
    afterPlace +
      Math.floor(cost * 0.25) -
      TOOLS.find((t) => t.id === "bulldoze").cost,
  );
});

test("isolated road loses utilities until connected to the plant network", () => {
  const c = newCity();
  for (let x = 3; x <= 6; x++) assert.ok(place(c, x, 5, "road").ok);
  assert.ok(place(c, 4, 4, "power").ok);
  assert.ok(place(c, 5, 4, "water").ok);
  assert.ok(place(c, 12, 5, "road").ok);
  assert.ok(place(c, 12, 6, "residential").ok);
  const zone = c.tiles[6 * 40 + 12];
  assert.equal(zone.roadAccess, true);
  assert.equal(zone.powered, false);
  for (let x = 7; x <= 11; x++) assert.ok(place(c, x, 5, "road").ok);
  assert.equal(zone.powered, true);
  assert.equal(zone.watered, true);
  for (let i = 0; i < 36; i++) tick(c);
  assert.ok(zone.level > 0);
  place(c, 9, 5, "bulldoze");
  assert.equal(zone.powered, false);
  assert.equal(zone.watered, false);
});

// ── Deserialize validation ────────────────────────────────────────

test("deserialize throws on null input", () => {
  assert.throws(() => deserialize(null), "null must throw");
});

test("deserialize throws on fractional month", () => {
  assert.throws(
    () => deserialize(patched(newCity(), { month: 1.5 })),
    "fractional month must be rejected",
  );
});

test("deserialize throws on negative month", () => {
  assert.throws(() => deserialize(patched(newCity(), { month: -1 })));
});

test("deserialize throws on non-numeric demand.residential", () => {
  const d = JSON.parse(serialize(newCity()));
  d.demand.residential = "bad";
  assert.throws(() => deserialize(JSON.stringify(d)));
});

test("deserialize throws on null demand.residential", () => {
  const d = JSON.parse(serialize(newCity()));
  d.demand.residential = null;
  assert.throws(() => deserialize(JSON.stringify(d)));
});

test("deserialize throws on tile level > 4", () => {
  assert.throws(() => deserialize(patchedTile(newCity(), 0, { level: 5 })));
});

test("deserialize throws on fractional tile level", () => {
  assert.throws(
    () => deserialize(patchedTile(newCity(), 0, { level: 1.5 })),
    "fractional level must be rejected",
  );
});

test("deserialize throws on invalid variant (null)", () => {
  const d = JSON.parse(serialize(newCity()));
  d.tiles[0].variant = null;
  assert.throws(() => deserialize(JSON.stringify(d)));
});

test("deserialize throws on unknown terrain value", () => {
  assert.throws(() =>
    deserialize(patchedTile(newCity(), 0, { terrain: "lava" })),
  );
});

test("deserialize throws on unknown tile type", () => {
  assert.throws(() =>
    deserialize(patchedTile(newCity(), 0, { type: "supervillain" })),
  );
});

test("deserialize throws on mismatched tile coords", () => {
  const d = JSON.parse(serialize(newCity()));
  d.tiles[0].x = 99;
  d.tiles[0].y = 99;
  assert.throws(
    () => deserialize(JSON.stringify(d)),
    "tile at index 0 with coords (99,99) must be rejected",
  );
});

test("deserialize throws on residential type on water terrain", () => {
  const c = newCity();
  const wi = c.tiles.findIndex((t) => t.terrain === "water");
  assert.throws(
    () => deserialize(patchedTile(c, wi, { type: "residential" })),
    "residential on water terrain is an invalid combination",
  );
});

// ── Deterministic save/load continuation ─────────────────────────

test("save/load mid-sequence produces identical result to a continuous run", () => {
  const a = createCity(99, true);
  for (let i = 0; i < 10; i++) tick(a);

  const b = createCity(99, true);
  for (let i = 0; i < 5; i++) tick(b);
  const c = deserialize(serialize(b));
  for (let i = 0; i < 5; i++) tick(c);

  assert.equal(c.money, a.money, "money must match");
  assert.equal(c.population, a.population, "population must match");
  assert.equal(c.month, a.month, "month must match");
  for (let i = 0; i < a.tiles.length; i += 200) {
    assert.equal(
      c.tiles[i].level,
      a.tiles[i].level,
      `tile[${i}] level must match`,
    );
  }
});

// ── Isolated zone: no growth without utility path through river ───

test("zone east of river with adjacent road but no utility path does not grow", () => {
  // Power/water at x=5 (west). River at x≈28-32 blocks conductsTile BFS.
  // Zone at x=36 has road access but cannot receive power/water without a bridge.
  const c = createCity(42, false);
  place(c, 5, 10, "power");
  place(c, 5, 11, "water");
  place(c, 35, 10, "road");
  const { ok } = place(c, 36, 10, "residential");
  assert.ok(ok, "setup: residential must place on grass east of river");
  const idx = c.tiles.findIndex((t) => t.x === 36 && t.y === 10);
  assert.ok(
    c.tiles[idx].roadAccess,
    "zone must have road access from adjacent road",
  );
  assert.ok(
    !c.tiles[idx].powered,
    "zone must not be powered: river blocks BFS",
  );
  assert.ok(
    !c.tiles[idx].watered,
    "zone must not be watered: river blocks BFS",
  );
  for (let i = 0; i < 24; i++) tick(c);
  assert.equal(
    c.tiles[idx].level,
    0,
    "isolated zone must not develop without power and water",
  );
});
