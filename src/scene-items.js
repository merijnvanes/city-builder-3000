import { ROAD_TYPES } from './sim/catalog.js';
import { hasStreetLamp, tunnelPortal } from './street-art.js';
import { deckKind } from './deck-geometry.js';
import { orderScene } from './scene-order.js';

// What each layer of the picture may hold.
//
// The ground cache is painted first, tile by tile, and holds only surfaces
// that lie on the terrain mesh: soil, sand, water, streets, rails, zone
// markings and the shadows cast onto them. Such a surface can never hide
// anything behind it, because a slope climbs at most one level (8 px) per
// tile while the screen descends 16 px per tile.
//
// Everything that rises above the mesh is a scene item: a building on its
// graded site, a bridge or highway deck, an on-ramp, a tunnel mouth, natural
// trees, street lamps and pylons. Items are painted after the ground in
// footprint order (scene-order.js). A deck in front of a tower therefore
// covers the tower's base, and a tower in front of a deck covers the deck.
// Anything raised that is painted into the ground layer instead will be
// overdrawn by whatever stands behind it; that is the bug this rule prevents.
export const ITEM_KINDS = ['lot', 'deck', 'portal', 'trees', 'lamp', 'pole'];

// The ordered item list for one city revision and camera orientation.
export function sceneItems(r, city) {
  const items = [];
  const add = (kind, t, w = 1, h = 1) => items.push({ kind, t, x: t.x, y: t.y, w, h, k: r.depthKey(t.x, t.y, w, h) });
  for (const t of city.tiles) {
    if (t.lot) {
      if (t.lot.x === t.x && t.lot.y === t.y) add('lot', t, t.lot.w, t.lot.h);
    } else if (t.type === 'empty' && t.trees) add('trees', t);
    if (deckKind(t)) add('deck', t);
    else if (ROAD_TYPES.has(t.type) && tunnelPortal(t, city)) add('portal', t);
    if (hasStreetLamp(t)) add('lamp', t);
    if (t.powerline) add('pole', t);
  }
  // Ties (items on one tile) keep this insertion order: the deck or portal
  // before the lamp that stands on it.
  items.sort((a, b) => a.k - b.k || a.t.y - b.t.y || a.t.x - b.t.x);
  return orderScene(items, r);
}
