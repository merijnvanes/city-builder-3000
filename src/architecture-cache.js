import { drawCivicSprite } from './civic-sprites.js';
import { drawArchitecture, heightOf } from './building-art.js';
import { lotPlatform } from './deck-geometry.js';

// Bounded lot artwork, retained across months when a building has not changed.
// Half-step raster scales avoid rebuilding on every wheel event.
const caches = new WeakMap();
const MAX_BYTES = 48 * 1024 * 1024;

function recordPick(r, t, bounds, canvas = null) {
  if (!r.pickables) return;
  r.pickables.push({ t, ...bounds, canvas });
}

// Direct-render overflow still gets exact picking: rasterize only the clicked
// pixel on demand instead of allocating a full-sized secondary sprite.
export function hitUncachedArchitecture(r, t, sx, sy) {
  const pixel = document.createElement('canvas'); pixel.width = pixel.height = 1;
  const base = pixel.getContext('2d', { willReadFrequently: true });
  const proxy = Object.assign(Object.create(r), { base, platform: lotPlatform(t), atlasOwner: r });
  const project = r.project.bind(proxy);
  proxy.project = (x, y, z = 0) => { const p = project(x, y, z); return { x: p.x - sx, y: p.y - sy }; };
  drawArchitecture(proxy, t);
  return base.getImageData(0, 0, 1, 1).data[3] > 24;
}
export function drawCachedArchitecture(r, t, city) {
  const civic = drawCivicSprite(r, t);
  if (civic) {
    const cache = caches.get(r), fallback = cache?.sprites.get(t);
    if (fallback) { cache.bytes -= fallback.bytes; cache.sprites.delete(t); }
    recordPick(r, t, civic, civic.canvas); return;
  }
  const scale = Math.max(0.5, Math.ceil(r.zoom * 2) / 2);
  const key = `${r.rotation}:${scale}:${r.dpr}:${!!r.night}`;
  let cache = caches.get(r);
  if (!cache || cache.key !== key || cache.tiles !== city.tiles) {
    cache = { key, tiles: city.tiles, bytes: 0, sprites: new Map() }; caches.set(r, cache);
  }
  const edgeLot = t.x === 0 || t.y === 0 || t.x + t.lot.w === r.size || t.y + t.lot.h === r.size;
  const state = [t.type, t.density, t.level, t.variant, t.abandoned, t.age === 0, t.elev, t.powered, t.x, t.y, t.lot.w, t.lot.h, edgeLot ? r.terrainBoundaryRevision : 0].join(':');
  const epoch = r.paintEpoch || 0;
  let sprite = cache.sprites.get(t);
  if (sprite && sprite.state !== state) {
    cache.bytes -= sprite.bytes; cache.sprites.delete(t); sprite = null;
  }
  if (!sprite) {
    const { x, y, w, h } = t.lot;
    const anchor = r.project(x, y), ratio = scale / r.zoom;
    const relative = (a, b, z = 0) => {
      const p = r.project(a, b, z);
      return { x: (p.x - anchor.x) * ratio, y: (p.y - anchor.y) * ratio };
    };
    const points = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([a, b]) => relative(a, b));
    const pad = 32 * scale;
    const left = Math.floor(Math.min(...points.map(p => p.x)) - pad);
    const top = Math.floor(Math.min(...points.map(p => p.y)) - (heightOf(t) * 2 + 70) * scale);
    const right = Math.ceil(Math.max(...points.map(p => p.x)) + pad);
    const bottom = Math.ceil(Math.max(...points.map(p => p.y)) + pad);
    const width = Math.ceil((right - left) * r.dpr), height = Math.ceil((bottom - top) * r.dpr);
    const bytes = width * height * 4;
    // Never evict the working set just to rasterize the next visible lot.
    // Overflow draws directly, without allocating another temporary canvas.
    if (cache.bytes + bytes > MAX_BYTES) {
      for (const [tile, entry] of cache.sprites) {
        if (entry.lastSeen >= epoch - 1) continue;
        cache.bytes -= entry.bytes; cache.sprites.delete(tile);
        if (cache.bytes + bytes <= MAX_BYTES) break;
      }
    }
    if (cache.bytes + bytes > MAX_BYTES) {
      drawArchitecture(r, t);
      recordPick(r, t, { x: anchor.x + left / ratio, y: anchor.y + top / ratio, w: width / r.dpr / ratio, h: height / r.dpr / ratio });
      return;
    }
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const base = canvas.getContext('2d'); base.scale(r.dpr, r.dpr);
    const proxy = Object.assign(Object.create(r), { base, atlasOwner: r, zoom: scale });
    proxy.project = (a, b, z = 0) => { const p = relative(a, b, z); return { x: p.x - left, y: p.y - top }; };
    proxy.projectGround = (a, b) => {
      const p = r.projectGround(a, b);
      return { x: (p.x - anchor.x) * ratio - left, y: (p.y - anchor.y) * ratio - top };
    };
    drawArchitecture(proxy, t);
    sprite = { canvas, dx: left, dy: top, bytes, state };
    cache.bytes += bytes; cache.sprites.set(t, sprite);
  }
  sprite.lastSeen = epoch;
  const p = r.project(t.x, t.y), ratio = r.zoom / scale;
  const bounds = { x: p.x + sprite.dx * ratio, y: p.y + sprite.dy * ratio, w: sprite.canvas.width / r.dpr * ratio, h: sprite.canvas.height / r.dpr * ratio };
  r.base.drawImage(sprite.canvas, bounds.x, bounds.y, bounds.w, bounds.h);
  recordPick(r, t, bounds, sprite.canvas);
}

export function architectureCacheStats(r) {
  const cache = caches.get(r);
  return { entries: cache?.sprites.size || 0, bytes: cache?.bytes || 0 };
}
