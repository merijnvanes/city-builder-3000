// Highways and on-ramps.
//
// The manual: "Highways are basically elevated, high capacity roads...
// Highways may be built over roads, but if you want your Sims to be able to
// get from one to the other, the intersection requires an on-ramp. On-Ramps
// allow your Sims to get on and off highways."
//
// Every highway tile rides on a viaduct. A street it crosses keeps running
// underneath (tile.under), and the two networks never meet there. An on-ramp
// is one tile that climbs from a street at its foot to the deck at its head,
// so it has an axis: the direction of the highway it serves. The axis is
// derived from the neighbours, never stored, so a save cannot disagree with
// the tiles around it.
import { tileAt } from "./grid.js";
import { carriesRoute } from "./catalog.js";

export const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// The direction a ramp climbs. Prefers a highway with open ground or a street
// on the opposite side; a ramp wedged between two highways keeps the first.
// Null when no highway touches it any more: the ramp then acts as a street.
export function rampAxis(city, t) {
  if (t?.type !== "onramp") return null;
  let fallback = null;
  for (const [dx, dy] of DIRECTIONS) {
    if (!carriesRoute(tileAt(city, t.x + dx, t.y + dy), "highway")) continue;
    if (!carriesRoute(tileAt(city, t.x - dx, t.y - dy), "highway")) return { dx, dy };
    fallback ??= { dx, dy };
  }
  return fallback;
}

// Where a ramp may stand: a highway on one side and a street on the opposite
// side, so the slope has somewhere to climb from and somewhere to arrive.
export function rampSite(city, x, y) {
  for (const [dx, dy] of DIRECTIONS) {
    const head = tileAt(city, x + dx, y + dy), foot = tileAt(city, x - dx, y - dy);
    if (carriesRoute(head, "highway") && carriesRoute(foot, "road") && !carriesRoute(foot, "highway")) return { dx, dy };
  }
  return null;
}

// Does the ramp at `ramp` meet the tile at (x, y) at its head (the highway
// end) or at its foot (the street end)?
export function rampMeets(city, ramp, x, y, end) {
  const axis = rampAxis(city, ramp);
  if (!axis) return end === "foot" && Math.abs(ramp.x - x) + Math.abs(ramp.y - y) === 1;
  const sign = end === "head" ? 1 : -1;
  return ramp.x + axis.dx * sign === x && ramp.y + axis.dy * sign === y;
}

// How far up the climb a point of the ramp tile is, 0 at the foot edge and 1
// at the head edge. A ramp without an axis is level with the street.
export function rampGrade(axis, t, x, y) {
  if (!axis) return 0;
  const along = axis.dx ? (axis.dx > 0 ? x - t.x : t.x + 1 - x) : (axis.dy > 0 ? y - t.y : t.y + 1 - y);
  return Math.max(0, Math.min(1, along));
}
