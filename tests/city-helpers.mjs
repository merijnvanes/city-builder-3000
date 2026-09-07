// Shared helpers for long-running simulation tests. Not a test file itself:
// `npm test` only picks up tests/*.test.js.
import assert from "node:assert/strict";
import { place, tick, refresh, setPolicy, getStats, BUILDINGS } from "../src/sim.js";
import { ageFactor, wears } from "../src/sim/wear.js";

const SPANS = { school: 3, college: 4, hospital: 3, library: 2, museum: 3, coal: 4, gas: 3 };

// Place `count` buildings on open land, each with a road along its front and
// power lines around it, so they are reachable, powered and therefore staffed.
export function build(city, type, count) {
  const span = SPANS[type];
  if (!span) throw new Error(`build(): no footprint known for ${type}`);
  let placed = 0;
  for (let y = 1; y + span + 1 < city.size && placed < count; y += span + 2) {
    for (let x = 1; x + span + 1 < city.size && placed < count; x += span + 2) {
      city.money = 5_000_000;
      if (!place(city, x, y, type).ok) continue;
      for (let i = -1; i <= span; i++) {
        place(city, x + i, y + span, "road");
        place(city, x + i, y - 1, "powerline");
      }
      for (let i = 0; i < span; i++) place(city, x - 1, y + i, "powerline");
      placed++;
    }
  }
  return placed;
}

export function educate(city, { schools = 14, colleges = 5, libraries = 14, museums = 6 } = {}) {
  assert.equal(build(city, "school", schools), schools, "could not place every school");
  build(city, "college", colleges);
  build(city, "library", libraries);
  build(city, "museum", museums);
  setPolicy(city, "funding.education", 120);
}

// Rebuild worn-out plants and pumps in place, which keeps their connections.
function replaceWorn(city) {
  let rebuilt = 0;
  for (const t of city.tiles) {
    if (!t.lot || t.lot.x !== t.x || t.lot.y !== t.y || !wears(t)) continue;
    if (ageFactor(t.type, t.age || 0) > 0.75) continue;
    const { x, y, type } = t;
    city.money = 5_000_000;
    if (place(city, x, y, "bulldoze").ok && place(city, x, y, type).ok) rebuilt++;
  }
  return rebuilt;
}

// Add water towers beside the existing mains. Towers work anywhere, so this
// is the one source that is always available whatever the map.
function addWaterTowers(city, count) {
  let placed = 0;
  for (const t of city.tiles) {
    if (placed >= count) break;
    if (t.type !== "empty" || t.terrain === "water" || t.lot) continue;
    const beside = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const n = city.tiles[(t.y + dy) * city.size + (t.x + dx)];
      return n && (n.pipe || BUILDINGS[n.type]?.waterOut);
    });
    if (!beside) continue;
    city.money = 5_000_000;
    if (!place(city, t.x, t.y, "watertower").ok) continue;
    place(city, t.x, t.y, "powerline");
    placed++;
  }
  return placed;
}

// Put a plant on the grid that needs it and wire it in.
//
// `build()` scans from the top-left and lays power lines only around the plant's
// own footprint, so a new plant can end up alone on an island network. That
// lifts the city-wide total while the strained grid stays exactly as short as
// it was — the mistake the totals-based version of this helper made for years
// on end. Place near the tile the simulation named, run a line back to it, and
// check the two ended up on the same network before believing it worked.
function plantOn(city, near, type = "coal") {
  const at = (x, y) => city._util.netOf[y * city.size + x];
  const { w, h } = BUILDINGS[type];
  for (let r = 3; r < 30; r++) {
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
      const x = near.x + dx, y = near.y + dy;
      if (x < 1 || y < 1 || x + w >= city.size || y + h >= city.size) continue;
      city.money = 5_000_000;
      if (!place(city, x, y, type).ok) continue;
      // An L back to the tile that went dark. Lines that will not go down —
      // water, an existing lot — are skipped; a lot conducts on its own.
      const sx = x + (w >> 1), sy = y + (h >> 1);
      for (let px = Math.min(sx, near.x); px <= Math.max(sx, near.x); px++) place(city, px, sy, "powerline");
      for (let py = Math.min(sy, near.y); py <= Math.max(sy, near.y); py++) place(city, near.x, py, "powerline");
      refresh(city);
      if (at(x, y) >= 0 && at(x, y) === at(near.x, near.y)) return true;
      place(city, x, y, "bulldoze");
      refresh(city);
    }
  }
  return false;
}

// Keep the utilities in repair, as a player watching the news would: replace
// what has worn out, and add capacity before a network is overdrawn long
// enough to destroy a plant.
//
// Read the worst-off network, not the city-wide total. A total says the city
// has power to spare while the one grid carrying it runs past capacity, which
// is how seed 44 used to go from 18,390 residents to zero with $5M in the bank.
// Returns how many buildings went up.
export function maintainUtilities(city) {
  let built = replaceWorn(city);
  const { power, water } = getStats(city).utilities;
  const short = power.worst && power.worst.demand > power.worst.supply * 0.85;
  if (short && plantOn(city, power.worst)) built++;
  if (water.demand > water.supply * 0.85) {
    built += addWaterTowers(city, Math.max(1, Math.ceil((water.demand - water.supply * 0.85) / 500)));
  }
  return built;
}

// Run the city for `n` years with its utilities kept in repair.
export function years(city, n) {
  for (let year = 0; year < n; year++) {
    for (let m = 0; m < 12; m++) tick(city);
    maintainUtilities(city);
  }
}
