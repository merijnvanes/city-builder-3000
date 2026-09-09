import { ELEV_PX, BRIDGE_LIFT, VIADUCT_HEIGHT } from './render-scale.js';
import { isPortal } from './sim/structures.js';
import { rampAxis, rampGrade } from './sim/highways.js';
import { waterSurface } from './sim/surface-water.js';

// Every surface a vehicle can drive on that is not the terrain mesh itself:
// a bridge over water, a highway viaduct, or the slope of an on-ramp. The
// platform replaces the ground height under project(), so artwork, traffic,
// shadows and picking all agree on where that surface is.

// A road or rail bridge floats just above its banks; a highway keeps the
// height it has everywhere else, so the deck runs level across the water.
export const deckLift = route => route === 'highway' ? VIADUCT_HEIGHT : BRIDGE_LIFT;

// The water span stays level; each dry approach blends down to the exact
// terrain edge shared with the adjoining street, including its cross-slope.
export function bridgeSurfaceHeight(r, t, x, y) {
  const s = t.structure, lift = deckLift(s.route), deck = s.elevation * ELEV_PX + lift;
  if (!isPortal(t, s)) return deck;
  const alongX = s.from.y === s.to.y;
  const low = alongX ? t.x === Math.min(s.from.x, s.to.x) : t.y === Math.min(s.from.y, s.to.y);
  const u = alongX ? x - t.x : y - t.y;
  const blend = Math.max(0, Math.min(1, low ? u : 1 - u));
  // A highway approach is itself a viaduct, so it meets the deck level.
  const edge = (alongX ? r.meshZ(t.x + (low ? 0 : 1), y) : r.meshZ(x, t.y + (low ? 0 : 1))) + (s.route === 'highway' ? VIADUCT_HEIGHT : 0);
  return edge + (deck - edge) * blend;
}

export function bridgePlatform(r, t) {
  const s = t?.structure;
  if (s?.kind !== 'bridge') return null;
  return isPortal(t, s) ? (x, y) => bridgeSurfaceHeight(r, t, x, y) : s.elevation * ELEV_PX + deckLift(s.route);
}

// 'bridge', 'viaduct', 'ramp' or null for a tile that carries no deck.
export function deckKind(t) {
  if (!t) return null;
  if (t.structure?.kind === 'bridge') return 'bridge';
  if (t.type === 'highway') return 'viaduct';
  if (t.type === 'onramp') return 'ramp';
  return null;
}

// Height in pixels (zoom 1) of the carried surface at map point (x, y): a
// number, a function of the point, or null when the tile has no deck.
export function surfacePlatform(r, t, city = r) {
  switch (deckKind(t)) {
    case 'bridge': return bridgePlatform(r, t);
    case 'viaduct': return (x, y) => r.meshZ(x, y) + VIADUCT_HEIGHT;
    case 'ramp': {
      const axis = rampAxis(city, t);
      return (x, y) => r.meshZ(x, y) + VIADUCT_HEIGHT * rampGrade(axis, t, x, y);
    }
    default: return null;
  }
}

export const platformHeight = (platform, x, y) => typeof platform === 'function' ? platform(x, y) : platform;

// The level a building on a lot stands on. A pier over water floats on the
// water surface; everything else stands on its graded pad.
export const lotPlatform = t => (t.terrain === 'water' ? waterSurface(t) : t.elev) * ELEV_PX;
