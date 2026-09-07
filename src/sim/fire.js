// How readily a building burns, and what SimNation does about the aftermath.
//
// The manual, page 87-88: "All buildings in your city have an inherent
// flammability rating, which you can see if you query the building. The higher
// the rating, the more likely that building will be consumed by fire if one
// occurs. The most effective way to reduce the flammability of a building is
// to see that it is receiving water, meaning that it is located on a watered
// tile... The reduction in potential fire damage is significant. Ordinances
// can be enacted to reduce the global flammability level in your city."
//
// And page 64: "In the event of a catastrophic disaster, the powers that be in
// SimNation may take it upon themselves to assist you in the clean up costs.
// Be forewarned, a Mayor that is well prepared generally receives better
// treatment."
import { BUILDINGS, ZONE_TYPES } from "./catalog.js";
import { isAnchor } from "./lots.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Water is the single biggest thing a mayor can do about fire.
export const WATERED_RELIEF = 0.45;

export function flammability(city, t) {
  const ord = city.ordinances || {};
  let f;
  if (ZONE_TYPES.has(t.type)) {
    // Timber-framed housing burns; a concrete tower does not, and a crowded
    // block that has been standing a long time is worse than a new one.
    f = 34 + (t.level || 0) * 5 + (t.density || 1) * 6;
    if (t.type === "industrial") f += 16;
    if (t.abandoned) f += 18;
  } else if (BUILDINGS[t.type]) {
    f = BUILDINGS[t.type].powerOut || BUILDINGS[t.type].waterOut ? 18 : 30;
  } else {
    f = t.trees ? 22 + t.trees * 12 : 0;
  }
  if (t.watered) f *= WATERED_RELIEF;
  if (ord.fireCode) f *= 0.7;
  if (ord.leafBurningBan) f *= 0.95;
  return Math.round(clamp(f, 0, 100));
}

// How many chances a tile gets in the pool a fire picks its origin from.
export const fireWeight = (city, t) => Math.max(0, Math.round(flammability(city, t) / 12));

// How prepared the city was, 0..1. Coverage the mayor paid for beforehand is
// what SimNation looks at.
export function preparedness(city, stats) {
  const funding = city.funding || {};
  const cover = clamp(((stats.fireCover || 0) + (stats.police || 0)) / 90, 0, 1);
  const paid = clamp(((funding.fire ?? 100) + (funding.police ?? 100)) / 200, 0, 1);
  return clamp(cover * 0.65 + paid * 0.35, 0, 1);
}

// Aid after a catastrophe. Small incidents get nothing; a district flattened
// in a well-run city gets real help.
export const RELIEF_THRESHOLD = 6;   // lots lost before SimNation notices
export const RELIEF_PER_LOT = 260;

export function reliefGrant(city, stats, lotsLost) {
  if (lotsLost < RELIEF_THRESHOLD) return 0;
  const ready = preparedness(city, stats);
  return Math.round(lotsLost * RELIEF_PER_LOT * (0.35 + ready * 0.85));
}

export function developedLots(city) {
  let n = 0;
  for (const t of city.tiles) if (isAnchor(t) && (!ZONE_TYPES.has(t.type) || t.level > 0)) n++;
  return n;
}
