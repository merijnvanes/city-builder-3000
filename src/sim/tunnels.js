// Boring a tunnel through high ground.
//
// The manual, page 35: "A road or rail tunnel will be recommended by the city
// engineers when traversing mountainous terrain. Drag the transit Drop Shadow
// to the base of steep terrain. If the underground distance is sufficient for
// the tunnel to be constructed, six tiles minimum, the city engineers will ask
// if you wish to bore a tunnel and let you know the cost of this construction.
// If you accept... the city engineers will place a tunnel entrance and exit
// and bore the tunnel for you."
//
// A bore runs dead straight and dead level from one portal to the other. The
// ground above it is untouched, and nothing can join the line in between: the
// only ways in are the two portals.
import { tileAt } from "./grid.js";

// "six tiles minimum" of ground to pass under, and a limit on how far the
// engineers are willing to dig.
export const MIN_BORE = 6;
export const MAX_BORE = 24;

export const TUNNEL_KIND = { road: 1, rail: 2 };
export const TUNNEL_TYPE = [null, "road", "rail"];

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Can a portal stand here? It has to be open ground or already a matching
// route, and on dry land.
function portalOk(t, type) {
  if (!t || t.terrain === "water" || t.tunnel) return false;
  return t.type === "empty" || t.type === type;
}

// Look for a bore starting at (x, y). Returns the shortest run that satisfies
// the manual's rule, or null. `type` is "road" or "rail".
export function findBore(city, x, y, type) {
  const start = tileAt(city, x, y);
  if (!portalOk(start, type)) return null;
  let best = null;
  for (const [dx, dy] of DIRECTIONS) {
    const buried = [];
    for (let step = 1; step <= MAX_BORE + 1; step++) {
      const t = tileAt(city, x + dx * step, y + dy * step);
      if (!t || t.terrain === "water" || t.tunnel) break;
      // Ground the bore passes under has to actually be higher than the
      // portals, or there is nothing to tunnel through.
      if (t.elev > start.elev) { buried.push(t); continue; }
      // Level ground again: this is where the far portal goes.
      if (t.elev === start.elev && buried.length >= MIN_BORE && portalOk(t, type)) {
        const run = { dx, dy, length: buried.length, buried, entrance: start, exit: t };
        if (!best || run.length < best.length) best = run;
      }
      break;
    }
  }
  return best;
}

// Cut the bore in. The portals become ordinary route tiles; the ground
// between them keeps whatever is on the surface and carries the line beneath.
export function bore(city, run, type) {
  for (const portal of [run.entrance, run.exit]) {
    portal.type = type;
    portal.trees = 0;
    portal.density = 0;
    portal.level = 0;
  }
  for (const t of run.buried) t.tunnel = TUNNEL_KIND[type];
  city.revision++;
}
