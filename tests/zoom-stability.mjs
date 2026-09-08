import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.route('**/zoom-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.goto(`${process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173'}/zoom-test`);
  const result = await page.evaluate(async () => {
    const { CityRenderer } = await import('/src/renderer.js');
    const { preloadCivicSprites } = await import('/src/civic-sprites.js');
    const { drawCachedArchitecture } = await import('/src/architecture-cache.js');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 800;
    const r = Object.assign(Object.create(CityRenderer.prototype), {
      base: canvas.getContext('2d'), w: 800, h: 800, size: 8, platform: 0,
      panX: 0, panY: 0, zoom: 1, rotation: 0, night: false, pickables: [],
      pick: () => ({ miss: true }),
    });
    const city = { tiles: [], revision: 0 };
    const authored = { x: 2, y: 2, type: 'fire', elev: 0, powered: true, age: 20, lot: { x: 2, y: 2, w: 3, h: 3 } };
    // A footprint outside the authored contract takes the procedural cache path.
    const fallback = { ...authored, lot: { x: 2, y: 2, w: 2, h: 1 } };
    let maxPanError = 0, maxZoomError = 0, picks = 0;
    const draw = t => { r.pickables = []; drawCachedArchitecture(r, t, city); r.dirty = false; return r.pickables[0]; };
    for (const dpr of [1, 2]) for (let rotation = 0; rotation < 4; rotation++) {
      Object.assign(r, { dpr, rotation });
      await preloadCivicSprites({ types: ['fire'], rotation });
      for (const tile of [authored, fallback]) {
        Object.assign(r, { zoom: 1.13, panX: 0, panY: 0 });
        const initial = draw(tile);
        for (let i = 1; i <= 12; i++) {
          r.panX = i * 0.07; r.panY = i * 0.09;
          const hit = draw(tile);
          maxPanError = Math.max(maxPanError, Math.abs(hit.x - initial.x - r.panX), Math.abs(hit.y - initial.y - r.panY));
        }
        r.panX = r.panY = 0;
        for (let i = 1; i <= 12; i++) {
          r.zoom = 1.13 + i * 0.013;
          const hit = draw(tile), ratio = r.zoom / 1.13;
          maxZoomError = Math.max(maxZoomError, Math.abs(hit.x - r.cx - (initial.x - r.cx) * ratio), Math.abs(hit.y - r.cy - (initial.y - r.cy) * ratio));
          const ctx = hit.canvas.getContext('2d'), mask = ctx.getImageData(0, 0, hit.canvas.width, hit.canvas.height).data;
          let pixel = 0; while (pixel < mask.length / 4 && mask[pixel * 4 + 3] < 250) pixel++;
          if (pixel === mask.length / 4) throw new Error('Missing opaque artwork');
          const x = hit.x + (pixel % hit.canvas.width + 0.5) / hit.canvas.width * hit.w;
          const y = hit.y + (Math.floor(pixel / hit.canvas.width) + 0.5) / hit.canvas.height * hit.h;
          const picked = r.pickObject(x, y);
          if (picked.x === tile.x && picked.y === tile.y) picks++;
        }
      }
    }
    return { maxPanError, maxZoomError, picks };
  });
  assert.ok(result.maxPanError < 1e-9, JSON.stringify(result));
  assert.ok(result.maxZoomError < 1e-9, JSON.stringify(result));
  assert.equal(result.picks, 192);
  console.log('Zoom stability: fractional pan, zoom anchors and alpha picking pass for both sprite paths, four rotations, DPR 1 and 2.');
} finally { await browser.close(); }
