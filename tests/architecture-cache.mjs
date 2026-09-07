// Compare every building family with uncached vector art. This catches clipped
// rooftops, wrong placement, rotation mistakes and stale cached lot images.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173');
  const results = await page.evaluate(async () => {
    const { CityRenderer } = await import('/src/renderer.js');
    const { drawArchitecture } = await import('/src/building-art.js');
    const { drawCachedArchitecture } = await import('/src/architecture-cache.js');
    const { BUILDINGS } = await import('/src/sim/catalog.js');
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 800;
    const base = canvas.getContext('2d', { willReadFrequently: true });
    const r = Object.assign(Object.create(CityRenderer.prototype), { base, w: 800, h: 800, zoom: 1.5, dpr: 1, size: 6, panX: 0, panY: 50, rotation: 0, platform: 0, paintingSolids: true });
    const city = { revision: 0, tiles: [] }, failures = [];
    const models = [];
    for (const [type, spec] of Object.entries(BUILDINGS)) {
      if (spec.overlay || spec.terrain || spec.emergency || ['road', 'rail', 'highway', 'bulldoze'].includes(type)) continue;
      models.push({ type, density: 0, level: 1, w: spec.w, h: spec.h, variant: 0.4 });
    }
    for (const type of ['residential', 'commercial', 'industrial']) for (const density of [1, 2, 3]) for (const variant of [0.1, 0.45, 0.8]) models.push({ type, density, level: 4, w: density, h: density, variant });
    let checked = 0;
    for (const model of models) for (const night of [false, true]) for (let rotation = 0; rotation < 4; rotation++) {
      Object.assign(r, { rotation, night });
      const t = { ...model, x: 1, y: 1, elev: 0, powered: true, age: 20, lot: { x: 1, y: 1, w: model.w || 1, h: model.h || 1 } };
      base.clearRect(0, 0, 800, 800); drawArchitecture(r, t);
      const expected = base.getImageData(0, 0, 800, 800).data;
      base.clearRect(0, 0, 800, 800); drawCachedArchitecture(r, t, city);
      const actual = base.getImageData(0, 0, 800, 800).data;
      let changed = 0, occupied = 0;
      for (let i = 0; i < expected.length; i += 4) {
        if (expected[i + 3] || actual[i + 3]) occupied++;
        // Canvas rasterization can differ at shared polygon edges after an
        // integer translation. Compare stable interiors and opaque silhouettes.
        if (expected[i + 3] !== 255) continue;
        const offsets = [-3204, -3200, -3196, -4, 0, 4, 3196, 3200, 3204];
        if (offsets.some(o => expected[i + o + 3] !== 255)) continue;
        const smooth = offsets.every(o => [0, 1, 2].every(c => Math.abs(expected[i + o + c] - expected[i + c]) < 8));
        if (actual[i + 3] < 245 || (smooth && [0, 1, 2].some(c => Math.abs(expected[i + c] - actual[i + c]) > 8))) changed++;
      }
      if (changed > 10) failures.push({ model, night, rotation, changed, occupied });
      checked++;
    }
    // Same object changes appearance across a revision, then moves on screen.
    const t = { type: 'commercial', density: 3, level: 1, variant: 0.4, x: 1, y: 1, elev: 0, age: 20, lot: { x: 1, y: 1, w: 3, h: 3 } };
    drawCachedArchitecture(r, t, city); t.level = 4; city.revision++; r.panX += 20;
    base.clearRect(0, 0, 800, 800); drawArchitecture(r, t);
    const expected = base.getImageData(0, 0, 800, 800).data;
    base.clearRect(0, 0, 800, 800); drawCachedArchitecture(r, t, city);
    const actual = base.getImageData(0, 0, 800, 800).data;
    let stale = 0;
    for (let i = 0; i < expected.length; i += 4) if (expected[i + 3] === 255 && actual[i + 3] < 245 && [-3200, -4, 4, 3200].every(o => expected[i + o + 3] === 255)) stale++;
    return { checked, failures, stale };
  });
  assert.deepEqual(results.failures, [], 'cached artwork matches vector geometry');
  assert.ok(results.stale < 10, `revision and camera invalidation: ${results.stale}`);
  console.log(`Architecture cache: ${results.checked} day/night/rotation comparisons pass; revision changes refresh the artwork.`);
} finally { await browser.close(); }
