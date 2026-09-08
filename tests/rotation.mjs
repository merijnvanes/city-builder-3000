// Turning the camera must not reload the city.
//
// Every rotation is a different set of sprite files, so a working set decoded
// at its baked size fills the budget at one angle and evicts itself on the
// next. Frames decode at the resolution the viewer draws instead, which leaves
// room for all four angles. Returning to a visited angle must cost nothing.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const url = process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173';
try {
  const page = await browser.newPage();
  await page.route('**/rotation', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.goto(`${url}/rotation`);

  const result = await page.evaluate(async () => {
    const { CityRenderer } = await import('/src/renderer.js');
    const { civicSpriteStats, civicSpriteSpec } = await import('/src/building-art.js');
    const { drawCachedArchitecture } = await import('/src/architecture-cache.js');
    const sim = await import('/src/sim/index.js');

    let requests = 0;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    Object.defineProperty(HTMLImageElement.prototype, 'src', { ...descriptor, set(value) { requests++; descriptor.set.call(this, value); } });

    const canvas = document.createElement('canvas'); canvas.width = 2400; canvas.height = 2000;
    const r = Object.assign(Object.create(CityRenderer.prototype), {
      base: canvas.getContext('2d'), w: 1200, h: 1000, size: 64, zoom: .85, dpr: 1.6,
      rotation: 0, night: false, panX: 0, panY: 0, platform: 0, paintEpoch: 1, pickables: [],
    });
    r.pick = () => ({ miss: true });

    const city = sim.createCity({ seed: 42, starter: true });
    const lots = city.tiles.filter(t => t.lot && t.lot.x === t.x && t.lot.y === t.y && civicSpriteSpec(t));
    const settle = () => new Promise(resolve => setTimeout(resolve, 400));
    const paint = () => { r.paintEpoch++; r.pickables = []; for (const t of lots) drawCachedArchitecture(r, t, { tiles: [] }); };

    const phases = [];
    let peak = 0;
    for (const [label, rotation] of [['first 0', 0], ['repaint 0', 0], ['first 1', 1], ['first 2', 2], ['first 3', 3], ['back 1', 1], ['back 0', 0]]) {
      r.rotation = rotation;
      const before = requests;
      paint(); await settle(); paint(); await settle();
      const stats = civicSpriteStats();
      peak = Math.max(peak, stats.decodedBytes);
      phases.push({ label, loads: requests - before, decodedBytes: stats.decodedBytes });
    }
    return { lots: lots.length, phases, peak, budget: civicSpriteStats().maxDecodedBytes };
  });

  const at = label => result.phases.find(p => p.label === label);
  assert.ok(result.lots > 100, 'the starter town should place a substantial sprite working set');
  assert.ok(at('first 0').loads > 0, 'the first paint loads the visible artwork');
  assert.equal(at('repaint 0').loads, 0, 'a repaint at the same angle reloads nothing');

  // The point of the whole exercise: a visited angle is already resident.
  assert.equal(at('back 1').loads, 0, 'returning to a visited angle reloads nothing');
  assert.equal(at('back 0').loads, 0, 'returning to the first angle reloads nothing');

  // All four angles have to coexist for that to be possible.
  assert.ok(result.peak <= result.budget, `peak ${result.peak} exceeds budget ${result.budget}`);
  const perAngle = at('first 0').decodedBytes;
  assert.ok(perAngle * 4 <= result.budget, `one angle costs ${perAngle}; four must fit ${result.budget}`);

  await page.close();
  console.log(`rotation: ${result.lots} sprite lots, ${(perAngle / 1048576).toFixed(1)} MB per angle, ` +
    `${(result.peak / 1048576).toFixed(1)} MB peak of ${(result.budget / 1048576).toFixed(0)} MB, ` +
    `${result.phases.filter(p => p.label.startsWith('back')).every(p => !p.loads) ? 'no' : 'some'} reloads on return`);
} finally {
  await browser.close();
}
