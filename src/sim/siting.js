// Whether a building is standing somewhere it can actually work.
//
// The manual is specific about several: "Bus stops must be placed along the
// side of roads to be effective. If you place bus stops and Sims don't seem to
// use them, they may be too far apart." "Once the track is laid, you must
// place Train Stations on tiles that touch the track. This tells trains where
// to stop." And of seaports: "They must be located along a shoreline to do
// anything, but if you want to see real results, build one on a seacoast."
//
// So a stop in a field is not a mistake the game refuses; it is a mistake the
// game lets you make and then quietly does nothing with. Querying it says so.
import { BUILDINGS } from "./catalog.js";
import { lotTiles } from "./lots.js";
import { tileAt } from "./grid.js";

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Does anything the building needs to touch actually touch it?
export function besideWhatItNeeds(city, t) {
  const needs = BUILDINGS[t.type]?.beside;
  if (!needs) return true;
  const footprint = t.lot ? lotTiles(city, t.lot) : [t];
  for (const cell of footprint) {
    for (const [dx, dy] of NEIGHBOURS) {
      const n = tileAt(city, cell.x + dx, cell.y + dy);
      if (!n) continue;
      if (needs === "subway" ? n.subway : n.type === needs) return true;
    }
  }
  return false;
}

// How well a building performs where it stands, 0..1. A stop or station that
// touches nothing does nothing; a seaport on a river works, but a seaport on
// the open sea is the one that pays.
export function sitingFactor(city, t) {
  const b = BUILDINGS[t.type];
  if (!b) return 1;
  if (!besideWhatItNeeds(city, t)) return 0;
  if (b.prefers === "salt") return onSalt(city, t) ? 1 : 0.4;
  return 1;
}

export function onSalt(city, t) {
  const footprint = t.lot ? lotTiles(city, t.lot) : [t];
  for (const cell of footprint) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const n = tileAt(city, cell.x + dx, cell.y + dy);
      if (n?.terrain === "water" && n.salt) return true;
    }
  }
  return false;
}

// One line for the query card when a building is in the wrong place.
export function sitingNote(city, t) {
  const b = BUILDINGS[t.type];
  if (!b) return null;
  if (!besideWhatItNeeds(city, t)) {
    const what = b.beside === "road" ? "a road" : b.beside === "rail" ? "rail track" : "a subway line";
    return `Not beside ${what}: nobody uses it.`;
  }
  if (b.prefers === "salt" && !onSalt(city, t)) return "Inland water only: a seacoast berth would carry far more trade.";
  return null;
}
