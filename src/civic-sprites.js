import { spriteVariant, spriteFrameKey } from './architecture-variation.js';
import { zoneArtKey } from './zone-art-key.js';
import { drawLotEffects } from './lot-art-effects.js';
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

function requestedQuality(owner, scale) {
  if (!owner) return 1; // Explicit inspection preloads retain the full export.
  return Math.min(1, ((owner.zoom ?? 1) * (owner.dpr || 1)) / scale);
}

function activeQuality(entry) {
  let quality = null;
  for (const [ref, epoch] of entry.owners) {
    const owner = ref.deref();
    if (!owner) { entry.owners.delete(ref); continue; }
    if ((owner.rotation || 0) === entry.rotation && !!owner.night === entry.night && epoch >= (owner.paintEpoch || 0) - 1) {
      quality = Math.max(quality ?? 0, requestedQuality(owner, entry.scale));
    }
  }
  return quality;
}

// Picking records share the current buffer; retiring a frame must also release
// their references before its bytes leave the cache accounting.
function replaceCanvas(entry, canvas) {
  const previous = entry.canvas;
  for (const [ref] of entry.owners) {
    const owner = ref.deref();
    if (!owner) continue;
    for (const hit of owner.pickables || []) {
      if (previous && hit.canvas === previous) hit.canvas = canvas;
    }
    owner.dirty = true;
  }
  entry.canvas = canvas;
}

function trimFrames(current) {
  while (bytes > MAX_DECODED_BYTES) {
    let inactive, active, reducible;
    for (const [key, entry] of entries) {
      if (entry === current || !entry.canvas) continue;
      const quality = activeQuality(entry);
      if (quality === null) {
        if (!inactive || entry.used < inactive.entry.used) inactive = { key, entry };
      } else {
        if (!active || entry.used < active.entry.used) active = { key, entry };
        const width = Math.ceil(entry.frame.width * quality), height = Math.ceil(entry.frame.height * quality);
        const saved = entry.bytes - width * height * 4;
        if (width < entry.canvas.width && height < entry.canvas.height && saved > (reducible?.saved || 0)) reducible = { entry, width, height, saved };
      }
    }
    if (!inactive && reducible) {
      // Keep visible frames at sufficient screen resolution. Full exports stay
      // on disk, and a closer view asynchronously restores their native pixels.
      const { entry, width, height, saved } = reducible;
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.imageSmoothingQuality = 'high';
      context.drawImage(entry.canvas, 0, 0, width, height);
      replaceCanvas(entry, canvas); entry.bytes -= saved; bytes -= saved;
      continue;
    }
    const victim = inactive || active;
    if (!victim) break;
    replaceCanvas(victim.entry, null);
    entries.delete(victim.key); bytes -= victim.entry.bytes;
  }
}

function loadFrame(key, entry) {
  entry.loading = true;
  entry.ready = new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = entry.frame.width; canvas.height = entry.frame.height;
      canvas.getContext('2d', { willReadFrequently: true }).drawImage(image, 0, 0);
      // An upgrade can be evicted while its image is loading. Its late result
      // must not add untracked bytes or resurrect an off-screen cache entry.
      const retained = entries.get(key) === entry;
      if (retained) {
        bytes += canvas.width * canvas.height * 4 - entry.bytes;
        replaceCanvas(entry, canvas); entry.bytes = canvas.width * canvas.height * 4;
        trimFrames(entry);
      }
      entry.loading = false;
      for (const renderer of entry.waiters) {
        renderer.dirty = true;
        renderer.onArtworkReady?.();
      }
      entry.waiters.clear(); image.onload = null; image.onerror = null;
      // Readiness promises must not retain a full buffer after cache reduction.
      resolve();
    };
    image.onerror = () => {
      // Initial failures keep procedural fallback. Failed upgrades keep their
      // usable smaller image, and neither failure retries on every paint.
      entry.loading = false; entry.failed = true; entry.waiters.clear();
      image.onload = null; image.onerror = null; resolve(null);
    };
    image.src = `${import.meta.env?.BASE_URL || './'}assets/civic/${entry.frame.file}`;
  });
}

function requestFrame(type, state, rotation, owner, variant = 0) {
  const spec = CIVIC_SPRITES[type];
  const frame = spec?.frames[spriteFrameKey(state, rotation, variant)];
  if (!frame || typeof Image === 'undefined') return null;
  const key = frame.file;
  let entry = entries.get(key);
  if (entry) {
    entry.used = ++clock;
    markActive(entry, owner);
    if (owner && !entry.failed && (!entry.canvas || entry.loading)) entry.waiters.add(owner);
    const quality = requestedQuality(owner, spec.scale);
    if (entry.canvas && !entry.loading && !entry.failed && (entry.canvas.width < Math.ceil(frame.width * quality) || entry.canvas.height < Math.ceil(frame.height * quality))) {
      if (owner) entry.waiters.add(owner);
      loadFrame(key, entry);
    }
    return entry;
  }
  entry = { frame, scale: spec.scale, canvas: null, used: ++clock, waiters: new Set(owner ? [owner] : []), bytes: 0, owners: new Map(), rotation, night: state !== 'day' };
  markActive(entry, owner);
  entries.set(key, entry);
  loadFrame(key, entry);
  return entry;
}

export async function preloadCivicSprites({ rotation = 0, night = false, powered = true, owner, variant, types = Object.keys(CIVIC_SPRITES) } = {}) {
  const state = night ? powered ? 'night' : 'unpowered' : 'day';
  return Promise.all(types.flatMap(type => {
    const count = CIVIC_SPRITES[type]?.variants?.length || 1;
    const selected = count === 1 ? [0] : variant === undefined ? Array.from({ length: count }, (_, i) => i) : [variant];
    return selected.map(index => requestFrame(type, state, rotation, owner, index)?.ready);
  }));
}

export function civicSpriteStats() {
  return { entries: entries.size, decodedBytes: bytes, maxDecodedBytes: MAX_DECODED_BYTES };
}

export function civicSpriteKey(t) { return zoneArtKey(t) || t.type; }

// Drawing, culling heights and shadow direction must agree on eligibility.
export function civicSpriteSpec(t) {
  const spec = CIVIC_SPRITES[civicSpriteKey(t)];
  return spec && t.lot && t.lot.w === (spec.footprint?.w ?? spec.tiles) && t.lot.h === (spec.footprint?.h ?? spec.tiles) ? spec : null;
}

export function drawCivicSprite(r, t) {
  const spec = civicSpriteSpec(t);
  if (!spec || !r.base?.drawImage) return null;
  const state = r.night ? t.powered === false || (spec.zone && t.abandoned) ? 'unpowered' : 'night' : 'day';
  const entry = requestFrame(civicSpriteKey(t), state, r.rotation || 0, r.atlasOwner || r, spriteVariant(t, spec.variants?.length || 1));
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
  const effects = spec.zone && drawLotEffects(r, t, spec.height);
  if (effects) {
    const right=Math.max(bounds.x+bounds.w,effects.right),bottom=Math.max(bounds.y+bounds.h,effects.bottom);
    bounds.x=Math.min(bounds.x,effects.left);bounds.y=Math.min(bounds.y,effects.top);
    bounds.w=right-bounds.x;bounds.h=bottom-bounds.y;
    // Temporary crane/scaffold pixels use the existing exact click-pixel path.
    bounds.canvas=null;
  }
  return bounds;
}
