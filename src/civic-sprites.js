import { spriteVariant, spriteFrameKey } from './architecture-variation.js';
import { zoneArtKey } from './zone-art-key.js';
import { drawLotEffects } from './lot-art-effects.js';
import {drawConstructionSite,isUnderConstruction} from './construction-art.js';
import { CIVIC_SPRITES } from './civic-sprite-manifest.js';

// Authored models are baked offline. One decoded image is shared by every lot
// of its type; there is no 3D engine, model parsing or per-lot rasterization.
const MAX_DECODED_BYTES = 32 * 1024 * 1024;
// A turn of the camera swaps every sprite for a different file, so the angles
// you are not looking at are kept ready at a fraction of the on-screen
// resolution. That is enough to draw the instant you turn, and requestFrame's
// upgrade path sharpens whichever angle you land on. Speculative art must never
// crowd out art on screen, so it is only fetched while well under the budget
// and, having no viewer, is always the first thing trimFrames releases.
const PREFETCH_QUALITY = 0.6;
const PREFETCH_HEADROOM = 0.6;
const MAX_PREFETCH_QUEUE = 512;
const entries = new Map();
let bytes = 0, clock = 0, loads = 0, speculativeLoads = 0;

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

// What to decode into. A frame someone is looking at gets the resolution they
// draw it at. A frame held for an angle they might turn to gets a fraction of
// that, enough to bridge the turn. A frame with no viewer at all is an explicit
// inspection preload and keeps its full pixels.
function decodeQuality(entry) {
  const active = activeQuality(entry);
  if (active !== null) return active;
  let requested = null;
  for (const [ref] of entry.owners) {
    const owner = ref.deref();
    if (!owner) { entry.owners.delete(ref); continue; }
    requested = Math.max(requested ?? 0, requestedQuality(owner, entry.scale));
  }
  for (const owner of entry.waiters) requested = Math.max(requested ?? 0, requestedQuality(owner, entry.scale));
  return requested === null ? 1 : requested * PREFETCH_QUALITY;
}

function loadFrame(key, entry) {
  entry.loading = true;
  // A fetch for a frame someone is drawing counts against loads, whether it is
  // the first one or a sharper replacement; anything else is warming ahead.
  if (activeQuality(entry) !== null) loads++; else speculativeLoads++;
  entry.ready = new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      // Decode at the size the map actually draws, not the size it was baked
      // at. Models bake at scale 3, roughly five times the pixels a default
      // zoom shows, so holding one rotation at full resolution nearly fills
      // the budget and a quarter turn evicts and reloads the whole city. The
      // upgrade path in requestFrame still restores pixels on a closer look.
      const quality = decodeQuality(entry);
      const width = Math.max(1, Math.ceil(entry.frame.width * quality));
      const height = Math.max(1, Math.ceil(entry.frame.height * quality));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, width, height);
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
        renderer.artRevision=(renderer.artRevision || 0)+1;
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

// Angles the camera could turn to next, fetched while the browser is idle.
const queuedFiles = new Set();
const queue = [];
let draining = false;

const whenIdle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 400 }) : setTimeout(fn, 50));

// Speculative work stops well short of the cap. Past it, a big city simply
// keeps today's behaviour of loading an angle the first time it is shown,
// rather than thrashing frames that are on screen.
const hasHeadroom = () => bytes < MAX_DECODED_BYTES * PREFETCH_HEADROOM;

function drainPrefetch() {
  draining = false;
  for (let i = 0; i < 8 && queue.length && hasHeadroom(); i++) {
    const job = queue.shift();
    queuedFiles.delete(job.file);
    const owner = job.owner.deref();
    // Skip anything already resident, and anything whose renderer has gone.
    if (owner && !entries.has(job.file)) requestFrame(job.type, job.state, job.rotation, owner, job.variant, true);
  }
  if (!queue.length || !hasHeadroom()) { queue.length = 0; queuedFiles.clear(); return; }
  draining = true;
  whenIdle(drainPrefetch);
}

function schedulePrefetch(type, state, rotation, owner, variant) {
  const spec = CIVIC_SPRITES[type];
  if (!owner?.warmRotations || !spec || !hasHeadroom() || queue.length >= MAX_PREFETCH_QUEUE) return;
  const ref = new WeakRef(owner);
  for (let angle = 0; angle < 4; angle++) {
    if (angle === rotation) continue;
    const frame = spec.frames[spriteFrameKey(state, angle, variant)];
    if (!frame || entries.has(frame.file) || queuedFiles.has(frame.file)) continue;
    queuedFiles.add(frame.file);
    queue.push({ type, state, rotation: angle, variant, owner: ref, file: frame.file });
  }
  if (queue.length && !draining) { draining = true; whenIdle(drainPrefetch); }
}

function requestFrame(type, state, rotation, owner, variant = 0, speculative = false) {
  const spec = CIVIC_SPRITES[type];
  const frame = spec?.frames[spriteFrameKey(state, rotation, variant)];
  if (!frame || typeof Image === 'undefined') return null;
  const key = frame.file;
  let entry = entries.get(key);
  if (entry) {
    entry.used = ++clock;
    markActive(entry, owner);
    // Speculative art never makes the renderer wait on it or repaint for it.
    if (owner && !speculative && !entry.failed && (!entry.canvas || entry.loading)) entry.waiters.add(owner);
    const quality = requestedQuality(owner, spec.scale);
    if (entry.canvas && !entry.loading && !entry.failed && (entry.canvas.width < Math.ceil(frame.width * quality) || entry.canvas.height < Math.ceil(frame.height * quality))) {
      if (owner) entry.waiters.add(owner);
      loadFrame(key, entry);
    }
    return entry;
  }
  entry = { frame, scale: spec.scale, canvas: null, used: ++clock, waiters: new Set(owner && !speculative ? [owner] : []), bytes: 0, owners: new Map(), rotation, night: state !== 'day' };
  markActive(entry, owner);
  entries.set(key, entry);
  loadFrame(key, entry);
  // Warm the other angles of anything actually drawn, never of a guess.
  if (!speculative) schedulePrefetch(type, state, rotation, owner, variant);
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
  // loads counts frames fetched because something drew them; speculativeLoads
  // counts angles warmed ahead of a turn. Keeping them apart lets a test assert
  // on drawing without depending on when the idle queue happens to drain.
  return { entries: entries.size, decodedBytes: bytes, maxDecodedBytes: MAX_DECODED_BYTES, loads, speculativeLoads, prefetchQueued: queue.length };
}

export function civicSpriteKey(t) { return zoneArtKey(t) || t.type; }

// Drawing, culling and shadow proxy heights must agree on eligibility.
export function civicSpriteSpec(t) {
  const spec = CIVIC_SPRITES[civicSpriteKey(t)];
  return spec && t.lot && t.lot.w === (spec.footprint?.w ?? spec.tiles) && t.lot.h === (spec.footprint?.h ?? spec.tiles) ? spec : null;
}

export function drawCivicSprite(r, t) {
  const spec = civicSpriteSpec(t);
  if (!spec || !r.base?.drawImage) return null;
  if(isUnderConstruction(t))return drawConstructionSite(r,t,spec.height);
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
  if(spec.zone)drawLotEffects(r,t);
  return bounds;
}
