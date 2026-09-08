import { surfaceStep, providesAccess } from './structures.js';
// Whether a building is standing somewhere it can actually work.
//
// The manual is specific about several: "Bus stops must be placed along the
// side of roads to be effective. If you place bus stops and Sims don't seem to
// use them, they may be too far apart." "Once the track is laid, you must
// place Train Stations on tiles that touch the track. This tells trains where
// to stop."
//
// So a stop in a field is not a mistake the game refuses; it is a mistake the
// game lets you make and then quietly does nothing with. Querying it says so.
//
// Seaports carry the same idea, but they are zones rather than buildings; the
// berth rule lives in ports.js.
import { BUILDINGS, carriesRoute } from "./catalog.js";
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
      if (needs === "subway" ? n.subway : carriesRoute(n, needs) && providesAccess(n) && surfaceStep(cell,n)) return true;
    }
  }
  return false;
}

// How well a building performs where it stands, 0..1. A stop or station that
// touches nothing does nothing.
export function sitingFactor(city, t) {
  if (!BUILDINGS[t.type]) return 1;
  return besideWhatItNeeds(city, t) ? 1 : 0;
}

// One line for the query card when a building is in the wrong place.
export function sitingNote(city, t) {
  const b = BUILDINGS[t.type];
  if (!b || besideWhatItNeeds(city, t)) return null;
  const what = b.beside === "road" ? "a road" : b.beside === "rail" ? "rail track" : "a subway line";
  return `Not beside ${what}: nobody uses it.`;
}
