import { CIVIC_SPRITES } from './civic-sprite-manifest.js';

// Authored models are baked offline. One decoded image is shared by every lot
// of its type; there is no 3D engine, model parsing or per-lot rasterization.
const MAX_DECODED_BYTES = 32 * 1024 * 1024;
const entries = new Map();
let bytes = 0, clock = 0;

function markActive(entry, owner) {
  if (!owner) return;
  for (const [ref] of entry.owners) {
    const renderer = ref.deref();
    if (!renderer) entry.owners.delete(ref);
    else if (renderer === owner) { entry.owners.set(ref, owner.paintEpoch || 0); return; }
  }
  entry.owners.set(new WeakRef(owner), owner.paintEpoch || 0);
}

function active(entry) {
  for (const [ref, epoch] of entry.owners) {
    const owner = ref.deref();
    if (!owner) { entry.owners.delete(ref); continue; }
    if ((owner.rotation || 0) === entry.rotation && !!owner.night === entry.night && epoch >= (owner.paintEpoch || 0) - 1) return true;
  }
  return false;
}

function requestFrame(type, state, rotation, owner) {
  const spec = CIVIC_SPRITES[type];
  const frame = spec?.frames[`${state}-${rotation}`];
  if (!frame || typeof Image === 'undefined') return null;
  const key = frame.file;
  let entry = entries.get(key);
  if (entry) {
    entry.used = ++clock;
    markActive(entry, owner);
    if (owner && !entry.canvas && !entry.failed) entry.waiters.add(owner);
    return entry;
  }
  entry = { frame, canvas: null, used: ++clock, waiters: new Set(owner ? [owner] : []), bytes: 0, owners: new Map(), rotation, night: state !== 'day' };
  markActive(entry, owner);
  entries.set(key, entry);
  entry.ready = new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = frame.width; canvas.height = frame.height;
      canvas.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0);
      entry.canvas = canvas; entry.bytes = canvas.width * canvas.height * 4;
      bytes += entry.bytes;
      // Picking may still retain a canvas during a frame. Let GC release it
      // after the renderer replaces that frame, rather than zeroing it here.
      while (bytes > MAX_DECODED_BYTES) {
        let victim;
        for (const [key, candidate] of entries) {
          if (candidate === entry || !candidate.canvas) continue;
          const protectedView = active(candidate);
          if (!victim || Number(protectedView) < Number(victim[2]) || (protectedView === victim[2] && candidate.used < victim[1].used)) victim = [key, candidate, protectedView];
        }
        if (!victim) break;
        entries.delete(victim[0]); bytes -= victim[1].bytes;
      }
      for (const renderer of entry.waiters) {
        renderer.dirty = true;
        renderer.onArtworkReady?.();
      }
      entry.waiters.clear(); image.onload = null; image.onerror = null;
      resolve(canvas);
    };
    image.onerror = () => {
      // Keep the procedural fallback if an asset cannot load. Failed entries
      // are retained so a missing file cannot trigger a request every frame.
      entry.failed = true; entry.waiters.clear(); image.onload = null; image.onerror = null; resolve(null);
    };
    image.src = `${import.meta.env?.BASE_URL || './'}assets/civic/${frame.file}`;
  });
  return entry;
}

export async function preloadCivicSprites({ rotation = 0, night = false, powered = true, owner, types = Object.keys(CIVIC_SPRITES) } = {}) {
  const state = night ? powered ? 'night' : 'unpowered' : 'day';
  return Promise.all(types.map(type => requestFrame(type, state, rotation, owner)?.ready));
}

export function civicSpriteStats() {
  return { entries: entries.size, decodedBytes: bytes, maxDecodedBytes: MAX_DECODED_BYTES };
}

export function drawCivicSprite(r, t) {
  const spec = CIVIC_SPRITES[t.type];
  if (!spec || !t.lot || !r.base?.drawImage || t.lot.w !== spec.tiles || t.lot.h !== spec.tiles) return null;
  const state = r.night ? t.powered === false ? 'unpowered' : 'night' : 'day';
  const entry = requestFrame(t.type, state, r.rotation || 0, r.atlasOwner || r);
  if (!entry?.canvas) return null;
  const { frame, canvas } = entry;
  const center = r.project(t.lot.x + t.lot.w / 2, t.lot.y + t.lot.h / 2);
  const scale = r.zoom / spec.scale;
  const snap = value => Math.round(value * (r.dpr || 1)) / (r.dpr || 1);
  const bounds = { x: snap(center.x - frame.anchor[0] * scale), y: snap(center.y - frame.anchor[1] * scale), w: frame.width * scale, h: frame.height * scale, canvas };
  r.base.save();
  r.base.imageSmoothingQuality = 'high';
  if (t.abandoned) { r.base.globalAlpha *= 0.7; r.base.filter = 'saturate(0.35)'; }
  r.base.drawImage(canvas, bounds.x, bounds.y, bounds.w, bounds.h);
  r.base.restore();
  return bounds;
}
