// Lots: a building occupies a w×h footprint. Every tile of the footprint
// carries `lot = { x, y, w, h }`; the tile at (lot.x, lot.y) is the anchor
// and holds level, variant and abandonment state.
import { inBounds, tileAt } from "./grid.js";
import { CAPACITY, DRAW, BUILDINGS, ZONE_TYPES, ZONED_TYPES, LOT_SIZES, LOT_SIZES_BY_TYPE } from "./catalog.js";
import { industryTraits } from "./industry.js";
import { commerceTraits } from "./commerce.js";
import { isPort, portDraw } from "./ports.js";

export const isAnchor = (t) => !!t.lot && t.lot.x === t.x && t.lot.y === t.y;

export function anchorOf(city, t) {
  if (!t?.lot) return null;
  return tileAt(city, t.lot.x, t.lot.y);
}

export function lotTiles(city, lot) {
  const out = [];
  for (let y = lot.y; y < lot.y + lot.h; y++)
    for (let x = lot.x; x < lot.x + lot.w; x++) {
      const t = tileAt(city, x, y);
      if (t) out.push(t);
    }
  return out;
}

export function* anchors(city) {
  for (const t of city.tiles) if (isAnchor(t)) yield t;
}

// Can a lot of size s×s be formed with (ax, ay) as anchor for zone tile `seed`?
function blockFits(city, ax, ay, s, seed) {
  for (let y = ay; y < ay + s; y++) {
    for (let x = ax; x < ax + s; x++) {
      if (!inBounds(city.size, x, y)) return false;
      const t = city.tiles[y * city.size + x];
      if (t.type !== seed.type || t.density !== seed.density || t.lot || t.terrain === "water" || t.elev !== seed.elev) return false;
    }
  }
  return true;
}

// Find the largest lot that can include the undeveloped zone tile `seed`.
// Returns { x, y, w, h } or null. Lots hug the top-left so neighbouring
// zone strips pack into a regular block pattern.
export function findLot(city, seed) {
  if (!ZONE_TYPES.has(seed.type) || seed.lot) return null;
  const sizes = LOT_SIZES_BY_TYPE[seed.type]?.[seed.density] || LOT_SIZES[seed.density] || [1];
  for (const s of sizes) {
    for (let oy = 0; oy < s; oy++) {
      for (let ox = 0; ox < s; ox++) {
        const ax = seed.x - ox, ay = seed.y - oy;
        if (blockFits(city, ax, ay, s, seed)) return { x: ax, y: ay, w: s, h: s };
      }
    }
  }
  return null;
}

export function assignLot(city, lot, level, variant) {
  for (const t of lotTiles(city, lot)) {
    t.powerline = false;
    t.lot = { x: lot.x, y: lot.y, w: lot.w, h: lot.h };
    t.level = 0;
    t.abandoned = false;
    t.age = 0;
    t.industry = null;
    t.commerce = null;
    t.fill = 0;
    t.part = null;
  }
  const anchor = tileAt(city, lot.x, lot.y);
  anchor.level = level;
  if (variant != null) anchor.variant = variant;
  return anchor;
}

// Remove a building. Zoned tiles keep their zone unless keepZone is false.
export function clearLot(city, anchor, { keepZone = true } = {}) {
  const lot = anchor.lot;
  for (const t of lotTiles(city, lot)) {
    t.lot = null;
    t.level = 0;
    t.abandoned = false;
    t.age = 0;
    t.fire = 0;
    t.industry = null;
    t.commerce = null;
    t.fill = 0;
    t.part = null;
    if (!(keepZone && ZONED_TYPES.has(t.type))) { t.type = "empty"; t.density = 0; }
  }
}

// Residents (residential) or jobs (commercial, industrial) on a lot anchor.
export function capacityOf(anchor) {
  if (!anchor.lot || !ZONE_TYPES.has(anchor.type) || !anchor.level || anchor.abandoned) return 0;
  const perTile = CAPACITY[anchor.type][anchor.density] || 0;
  const kind = anchor.type === "industrial" ? industryTraits(anchor).jobs
    : anchor.type === "commercial" ? commerceTraits(anchor).jobs : 1;
  return Math.round(perTile * anchor.lot.w * anchor.lot.h * anchor.level * kind / 4);
}

// Power and water draw for any lot anchor (zones or catalog buildings).
export function drawOf(anchor) {
  if (!anchor.lot) return { power: 0, water: 0 };
  if (ZONE_TYPES.has(anchor.type)) {
    if (!anchor.level || anchor.abandoned) return { power: 0, water: 0 };
    const tiles = anchor.lot.w * anchor.lot.h;
    const k = DRAW[anchor.type];
    const scale = tiles * anchor.density * anchor.level;
    return { power: k.power * scale, water: k.water * scale };
  }
  if (isPort(anchor.type)) return portDraw(anchor);
  const b = BUILDINGS[anchor.type];
  return { power: b?.powerUse || 0, water: b?.waterUse || 0 };
}
