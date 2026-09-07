// Every building delivers what its catalog entry declares.
//
// A building's entry is a contract: `service: { kind: "police", radius: 12 }`
// says a precinct reaches twelve tiles, `effects: { crime: 18, radius: 10 }`
// says a prison makes trouble around it. Two ordinances turned out to be
// charging players for effects that appeared nowhere in the simulation, and the
// same thing can happen to a building — the entry is data, and nothing forces
// anybody to read it.
//
// So this places each one on cleared ground in the middle of a real town and
// compares the tiles around it before and against after a single refresh. No
// ticks: growth would drift and the comparison would stop being like for like.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, place, refresh, serialize, deserialize, BUILDINGS } from "../src/sim.js";
import { isAnchor } from "../src/sim/lots.js";
import { SERVICE_KINDS } from "../src/sim/services.js";

// One settled town, saved once and reloaded per case: twenty years of ticks for
// each of thirty buildings is half a minute of the suite for no extra coverage.
let TOWN;
function town() {
  if (!TOWN) {
    const c = createCity(21, true);
    for (let i = 0; i < 240; i++) tick(c);
    const homes = c.tiles.filter((t) => isAnchor(t) && t.type === "residential" && t.level);
    TOWN = {
      saved: serialize(c),
      x: Math.round(homes.reduce((a, t) => a + t.x, 0) / homes.length),
      y: Math.round(homes.reduce((a, t) => a + t.y, 0) / homes.length),
    };
  }
  return TOWN;
}

// Clear a block big enough for `b`, place it, and report the largest change to
// each measure anywhere in its radius.
function effectOf(id) {
  const b = BUILDINGS[id];
  const { x: hx, y: hy, saved } = town();
  const c = deserialize(saved);
  c.money = 50_000_000;
  c.unlocked = Object.fromEntries(Object.keys(BUILDINGS).map((k) => [k, true]));
  // Twice: the first pass clears the lot and leaves the zoning, which still
  // blocks the site.
  for (let pass = 0; pass < 2; pass++)
    for (let y = hy - 1; y < hy + (b.h || 1) + 1; y++)
      for (let x = hx - 1; x < hx + (b.w || 1) + 1; x++) place(c, x, y, "bulldoze", { deferRefresh: true });
  refresh(c);
  const before = c.tiles.map((t) => ({ ...t.svc, crime: t.crime, pollution: t.pollution, landValue: t.landValue }));
  const placed = place(c, hx, hy, id);
  if (!placed.ok) return null;
  refresh(c);
  const R = Math.max(b.service?.radius ?? 0, b.effects?.radius ?? 0, 4);
  const peak = {};
  const bump = (k, v) => { peak[k] = Math.max(peak[k] ?? 0, v); };
  for (let y = Math.max(0, hy - R); y <= Math.min(c.size - 1, hy + R); y++)
    for (let x = Math.max(0, hx - R); x <= Math.min(c.size - 1, hx + R); x++) {
      const i = y * c.size + x, t = c.tiles[i], u = before[i];
      if (t.type === id) continue;
      for (const k of SERVICE_KINDS) bump(k, (t.svc?.[k] || 0) - (u[k] || 0));
      bump("crime", t.crime - u.crime);
      bump("pollution", t.pollution - u.pollution);
      bump("landValue", Math.abs(t.landValue - u.landValue));
    }
  return peak;
}

describe("what a building's catalog entry promises, it delivers", () => {
  // Everything with a radius, minus the three the manual makes conditional and
  // the two that have to stand on a shoreline. Both groups are covered below.
  const CONDITIONAL = new Set(["bus", "railstation", "substation"]);
  const ids = Object.entries(BUILDINGS)
    .filter(([id, b]) => (b.service || b.effects?.radius) && !CONDITIONAL.has(id))
    .map(([id]) => id);

  test("there is something to check", () => {
    assert.ok(ids.length > 20, `only ${ids.length} buildings declare an area effect`);
  });

  for (const id of ids) {
    const b = BUILDINGS[id];
    test(`${id} does what its entry says`, () => {
      const peak = effectOf(id);
      if (peak === null) {
        // Shoreline buildings cannot go in the middle of town; that is the rule
        // rather than a failure, and it has its own test in siting.test.js.
        assert.ok(b.requiresWater, `${id} could not be placed and is not a waterfront building`);
        return;
      }
      if (b.service) {
        assert.ok(peak[b.service.kind] > 0,
          `${id} declares ${b.service.kind} coverage over radius ${b.service.radius} and provided none`);
      }
      for (const key of ["crime", "pollution"]) {
        if (b.effects?.[key]) assert.ok(peak[key] > 0, `${id} declares ${key} ${b.effects[key]} and changed none`);
      }
      if (b.effects?.landValue) {
        assert.ok(peak.landValue > 0, `${id} declares a land value effect of ${b.effects.landValue} and moved none`);
      }
    });
  }

  // "Bus stops must be placed along the side of roads to be effective." / "You
  // must place Train Stations on tiles that touch the track." / "Subway
  // stations must be placed next to subway rails to be effective."
  test("a stop or station is worth nothing until it is sited properly", () => {
    const blank = () => { const c = createCity({ seed: 12, starter: false, layout: "plains", hills: 0 }); c.money = 5_000_000; return c; };
    const peak = (c, kind) => c.tiles.reduce((m, t) => Math.max(m, t.svc?.[kind] || 0), 0);
    for (const [id, track, kind] of [["bus", "road", "bus"], ["railstation", "rail", "rail"], ["substation", "subway", "rail"]]) {
      const alone = blank();
      place(alone, 25, 31, id);
      refresh(alone);
      assert.equal(peak(alone, kind), 0, `${id} served a city with no ${track} beside it`);

      const sited = blank();
      for (let x = 10; x <= 40; x++) place(sited, x, 30, track, { deferRefresh: true });
      place(sited, 25, 31, id);
      refresh(sited);
      assert.ok(peak(sited, kind) > 0, `${id} beside ${track} still served nobody`);
    }
  });
});
