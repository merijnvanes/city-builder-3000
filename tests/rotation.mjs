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
      rotation: 0, night: false, panX: 0, panY: 0, platform: 0, paintEpoch: 1, pickables: [], warmRotations: true,
    });
    r.pick = () => ({ miss: true });

    const city = sim.createCity({ seed: 42, starter: true });
    const lots = city.tiles.filter(t => t.lot && t.lot.x === t.x && t.lot.y === t.y && civicSpriteSpec(t));
    const settle = () => new Promise(resolve => setTimeout(resolve, 400));
    const paint = () => { r.paintEpoch++; r.pickables = []; for (const t of lots) drawCachedArchitecture(r, t, { tiles: [] }); };

    const phases = [];
    let peak = 0;

    // What the player sees on a turn: how much of the city has artwork on the
    // very first paint at the new angle, before anything has a chance to load.
    // A cold angle draws nothing and the city visibly pops.
    const turn = (label, rotation) => {
      r.rotation = rotation;
      r.paintEpoch++; r.pickables = [];
      for (const t of lots) drawCachedArchitecture(r, t, { tiles: [] });
      const stats = civicSpriteStats();
      peak = Math.max(peak, stats.decodedBytes);
      phases.push({ label, rotation, drawn: r.pickables.filter(hit => hit.canvas).length });
    };

    r.rotation = 0; paint(); await settle(); paint(); await settle();
    const cold = r.pickables.filter(hit => hit.canvas).length;
    // Let the idle queue warm the other angles, the way it would while a player
    // looks around before turning. Background tabs throttle timers, so wait on
    // the queue draining rather than on a fixed delay.
    for (let i = 0; i < 80 && (civicSpriteStats().prefetchQueued || i < 2); i++) await settle();

    for (const [label, rotation] of [['turn to 1', 1], ['turn to 2', 2], ['turn to 3', 3], ['back to 0', 0]]) turn(label, rotation);
    return { lots: lots.length, cold, phases, peak, budget: civicSpriteStats().maxDecodedBytes, stats: civicSpriteStats() };
  });

  assert.ok(result.lots > 100, 'the starter town should place a substantial sprite working set');
  assert.equal(result.cold, result.lots, 'the starting angle should be fully drawn once loaded');

  // The whole point: every turn draws immediately. There are only four angles,
  // so all of them are warmed while the camera sits still. A turn that has to
  // fetch first is a turn the player watches the city reappear.
  for (const phase of result.phases) {
    assert.equal(phase.drawn, result.lots, `${phase.label}: only ${phase.drawn} of ${result.lots} lots had artwork on the first paint`);
  }

  assert.ok(result.peak <= result.budget, `peak ${result.peak} exceeds budget ${result.budget}`);
  assert.ok(result.stats.speculativeLoads > 0, 'other angles should be warmed ahead of the turn');

  await page.close();
  console.log(`rotation: ${result.lots} sprite lots, ${result.stats.loads} drawn + ${result.stats.speculativeLoads} warmed, ` +
    `${(result.peak / 1048576).toFixed(1)} MB peak of ${(result.budget / 1048576).toFixed(0)} MB, every turn fully drawn`);
} finally {
  await browser.close();
}
