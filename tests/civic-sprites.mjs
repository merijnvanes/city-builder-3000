// Production-asset lifecycle checks: cold loads, shared canvases, memory,
// rotation/power variants, alpha picking, and actual single-blit rendering.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url().includes('/assets/civic/')) failures.push(response.url()); });
  await page.route('**/sprite-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.goto(`${process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173'}/sprite-test`);
  const result = await page.evaluate(async () => {
    const { CityRenderer } = await import('/src/renderer.js');
    const { drawArchitecture, preloadCivicSprites, civicSpriteStats } = await import('/src/building-art.js');
    const { drawCachedArchitecture, architectureCacheStats } = await import('/src/architecture-cache.js');
    const { CIVIC_SPRITES } = await import('/src/civic-sprite-manifest.js');
    const canvas = document.createElement('canvas'); canvas.width = 900; canvas.height = 600;
    const r = Object.assign(Object.create(CityRenderer.prototype), { base: canvas.getContext('2d'), zoom: 1, dpr: 1, w: 700, h: 600, size: 3, panX: 0, panY: 70, platform: 0, rotation: 0, night: false, pickables: [], dirty: false });
    const tile = { x: 0, y: 0, lot: { x: 0, y: 0, w: 3, h: 3 }, type: 'fire', age: 20, powered: true };
    const city = { tiles: [] };
    drawCachedArchitecture(r, tile, city); // Cold load temporarily caches fallback art.
    const coldEntries = architectureCacheStats(r).entries;
    await preloadCivicSprites({ types: ['fire'] });
    const invalidated = r.dirty;
    r.dirty = false;
    drawCachedArchitecture(r, tile, city);
    r.pickables = [];
    let blits = 0;
    const draw = r.base.drawImage.bind(r.base);
    r.base.drawImage = (...args) => { blits++; draw(...args); };
    for (let i = 0; i < 200; i++) drawCachedArchitecture(r, { ...tile }, { tiles: [] });
    const fallbackReleased = architectureCacheStats(r).entries === 0;
    const sharedCanvases = new Set(r.pickables.map(p => p.canvas)).size;
    const hit = r.pickables[0];
    const pixels = hit.canvas.getContext('2d').getImageData(0, 0, hit.canvas.width, hit.canvas.height).data;
    let opaquePixel = -1, transparentPixel = -1;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] > 240 && opaquePixel === -1) opaquePixel = i / 4;
      if (!pixels[i + 3] && transparentPixel === -1) transparentPixel = i / 4;
    }
    const point = pixel => ({ x: hit.x + ((pixel % hit.canvas.width) + .5) / hit.canvas.width * hit.w, y: hit.y + (Math.floor(pixel / hit.canvas.width) + .5) / hit.canvas.height * hit.h });
    // Test the actual hit mask, with a known fallback for a transparent pixel.
    r.pick = () => ({ miss: true });
    const solid = point(opaquePixel), clear = point(transparentPixel);
    const solidHit = r.pickObject(solid.x, solid.y);
    const clearHit = r.pickObject(clear.x, clear.y);
    const { createPortrait } = await import('/src/portrait.js');
    const portraitCanvas = document.createElement('canvas');
    portraitCanvas.style.cssText = 'width:200px;height:160px'; document.body.append(portraitCanvas);
    const portrait = createPortrait(portraitCanvas);
    portrait.draw({ ...tile, type: 'police' });
    const coldPortrait = portraitCanvas.toDataURL();
    await preloadCivicSprites({ types: ['police'] });
    const portraitRefreshed = portraitCanvas.toDataURL() !== coldPortrait;
    // Keep one actual game view pinned while other views fill the LRU.
    const pinned = Object.assign(Object.create(CityRenderer.prototype), {
      ...r, rotation: 0, night: false, pickables: [], dirty: false, paintEpoch: 1,
    });
    drawCachedArchitecture(pinned, tile, city);
    const pinnedCanvas = pinned.pickables[0].canvas;
    const hashes = [];
    for (const state of ['day', 'night', 'unpowered']) for (let rotation = 0; rotation < 4; rotation++) {
      await preloadCivicSprites({ rotation, night: state !== 'day', powered: state !== 'unpowered' });
      for (const [type, spec] of Object.entries(CIVIC_SPRITES)) {
        r.rotation = rotation; r.night = state !== 'day'; r.pickables = [];
        drawCachedArchitecture(r, { ...tile, type, powered: state !== 'unpowered', lot: { x: 0, y: 0, w: spec.tiles, h: spec.tiles } }, { tiles: [] });
        if (!r.pickables[0]?.canvas) throw new Error(`${type} ${state} ${rotation}: missing sprite`);
        if (type === 'fire') {
          const p = r.pickables[0].canvas;
          const data = p.getContext('2d').getImageData(0, 0, p.width, p.height).data;
          let hash = 0; for (let i = 0; i < data.length; i++) hash = (hash * 31 + data[i]) >>> 0;
          hashes.push(hash);
        }
      }
      if (civicSpriteStats().decodedBytes > civicSpriteStats().maxDecodedBytes) throw new Error('Decoded sprite budget exceeded');
    }
    pinned.pickables = []; pinned.dirty = false;
    drawCachedArchitecture(pinned, tile, city);
    const activeViewRetained = pinned.pickables[0].canvas === pinnedCanvas;
    // Exercise alpha picking at Retina snapping and non-integer zoom in every view.
    let retinaPicks = 0;
    for (let rotation = 0; rotation < 4; rotation++) {
      await preloadCivicSprites({ types: ['fire'], rotation });
      r.rotation = rotation; r.night = false; r.zoom = 1.75; r.dpr = 2; r.dirty = false; r.pickables = [];
      drawCachedArchitecture(r, tile, city);
      const hit = r.pickables[0], mask = hit.canvas.getContext('2d').getImageData(0, 0, hit.canvas.width, hit.canvas.height).data;
      let pixel = 0; while (pixel < mask.length / 4 && mask[pixel * 4 + 3] < 250) pixel++;
      const px = hit.x + ((pixel % hit.canvas.width) + .5) / hit.canvas.width * hit.w;
      const py = hit.y + (Math.floor(pixel / hit.canvas.width) + .5) / hit.canvas.height * hit.h;
      if (r.pickObject(px, py).x === tile.x) retinaPicks++;
    }
    return { activeViewRetained, retinaPicks, portraitRefreshed, coldEntries, fallbackReleased, invalidated, initialBlits: blits - 150, sharedCanvases, solidHit, clearHit, variants: new Set(hashes).size, stats: civicSpriteStats() };
  });
  assert.equal(result.activeViewRetained, true, 'active view survives background cache churn');
  assert.equal(result.retinaPicks, 4, 'Retina picking works in all four views');
  assert.equal(result.portraitRefreshed, true, 'cold inspection portrait redraws automatically');
  assert.equal(result.coldEntries, 1);
  assert.equal(result.fallbackReleased, true, 'temporary procedural canvas is released');
  assert.equal(result.invalidated, true, 'cold asset load requests a redraw');
  assert.equal(result.initialBlits, 200, 'each civic instance requires exactly one image draw');
  assert.equal(result.sharedCanvases, 1, '200 instances share one decoded sprite');
  assert.deepEqual(result.solidHit, { x: 0, y: 0 }, 'opaque sprite pixel selects the lot');
  assert.deepEqual(result.clearHit, { miss: true }, 'transparent sprite pixel does not block ground picking');
  assert.equal(result.variants, 12, 'rotation and lighting each select distinct artwork');
  assert.deepEqual(failures, []);
  console.log('Civic sprites: async redraw, single-blit reuse, 12 visual states, alpha picking and bounded memory pass.', result.stats);
} finally { await browser.close(); }
