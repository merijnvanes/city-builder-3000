// Compare an earthquake frame to a translated complete scene. This catches
// layers being repainted over fire, traffic, or night lighting during shake.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
  await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173');
  const results = await page.evaluate(async () => {
    const { CityRenderer } = await import('/src/renderer.js');
    const { createCity } = await import('/src/sim/index.js');
    document.body.replaceChildren();
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'width:640px;height:480px';
    document.body.append(canvas);
    const r = new CityRenderer(canvas);
    r.resizeObserver.disconnect();
    const city = createCity({ size: 32, seed: 7, starter: false, hills: 0 });
    r.size = 32; r.zoom = 0.65;
    const tile = city.tiles[16 * 32 + 16];
    tile.type = 'road'; tile.terrain = 'grass'; tile.fire = 3;
    city.tiles[16 * 32 + 17].type = 'road';
    const results = [];
    for (const night of [false, true]) {
      r.night = night; r.dirty = true;
      city.effects = []; r.shakeUntil = 0;
      r.render(city, 0, 0);
      const reference = r.ctx.getImageData(0, 0, 640, 480).data;
      city.effects.push({ type: 'earthquake', x: 16, y: 16, ttl: 1 });
      r.render(city, 0, 0); // At time zero the displacement is exactly (0, 4).
      const shaken = r.ctx.getImageData(0, 0, 640, 480).data;
      let mismatches = 0;
      for (let y = 10; y < 460; y++) for (let x = 10; x < 630; x++) {
        const source = (y * 640 + x) * 4, target = ((y + 4) * 640 + x) * 4;
        if ([0, 1, 2, 3].some(c => Math.abs(reference[source + c] - shaken[target + c]) > 2)) mismatches++;
      }
      r.render(city, 0, 901); // Simulation time is still paused at zero.
      const settled = r.ctx.getImageData(0, 0, 640, 480).data;
      const restored = reference.every((v, i) => v === settled[i]);
      results.push({ night, mismatches, restored });
    }
    return results;
  });
  for (const result of results) {
    assert.equal(result.mismatches, 0, `Entire scene moves together: ${JSON.stringify(result)}`);
    assert.ok(result.restored, 'camera returns to its original position while paused');
  }
  console.log('Earthquake preserves every scene layer and expires while paused, day and night.');
} finally { await browser.close(); }
