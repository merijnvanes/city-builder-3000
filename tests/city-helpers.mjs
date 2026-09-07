// Shared helpers for long-running simulation tests. Not a test file itself:
// `npm test` only picks up tests/*.test.js.
import assert from "node:assert/strict";
import { place, tick, setPolicy, getStats } from "../src/sim.js";
import { isPlant, ageFactor } from "../src/sim/power.js";

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

// Keep the lights on, as a player watching the news would: replace plants
// that have worn out, and add capacity before the grid is overdrawn long
// enough to blow one up. Returns how many plants were built.
export function maintainPower(city) {
  let built = 0;
  for (const t of city.tiles) {
    if (!t.lot || t.lot.x !== t.x || t.lot.y !== t.y || !isPlant(t)) continue;
    if (ageFactor(t.type, t.age || 0) > 0.75) continue;
    const { x, y, type } = t;
    city.money = 5_000_000;
    if (place(city, x, y, "bulldoze").ok && place(city, x, y, type).ok) built++;
  }
  const { supply, demand } = getStats(city).utilities.power;
  if (demand > supply * 0.85) built += build(city, "coal", Math.max(1, Math.ceil((demand - supply * 0.85) / 6000)));
  return built;
}

// Run the city for `n` years with the power grid kept in repair.
export function years(city, n) {
  for (let year = 0; year < n; year++) {
    for (let m = 0; m < 12; m++) tick(city);
    maintainPower(city);
  }
}
