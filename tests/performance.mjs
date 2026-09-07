// Reproducible renderer benchmark. CPU timings exclude deferred GPU work;
// requestAnimationFrame intervals also measure real browser frame cadence.
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173');
  await page.waitForFunction(() => window.civic);
  const results = await page.evaluate(async () => {
    const { CityRenderer } = await import('/src/renderer.js');
    const { preloadCivicSprites } = await import('/src/building-art.js');
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:1440px;height:1000px;z-index:99999';
    document.body.append(canvas);
    const r = new CityRenderer(canvas);
    const summary = values => {
      values.sort((a, b) => a - b);
      return { median: +values[Math.floor(values.length * 0.5)].toFixed(2), p95: +values[Math.floor(values.length * 0.95)].toFixed(2) };
    };
    const results = [];
    for (const size of [64, 128]) {
      const city = civic.sim.createCity(42, true, { size });
      if (size === 128) {
        const district = civic.sim.createCity(42, true);
        for (const ox of [0, 64]) for (const oy of [0, 64]) for (const original of district.tiles) {
          const t = structuredClone(original); t.x += ox; t.y += oy;
          if (t.lot) { t.lot.x += ox; t.lot.y += oy; }
          city.tiles[t.y * size + t.x] = t;
        }
        civic.sim.refresh(city);
      }
      r.size = size; r.buildCorners(city);
      const built = city.tiles.filter(t => t.lot && t.x < 64 && t.y < 64);
      r.focusOn(built.reduce((s, t) => s + t.x, 0) / built.length, built.reduce((s, t) => s + t.y, 0) / built.length, 0.85);
      if (!Number.isFinite(r.panX + r.panY)) throw new Error("Benchmark camera must be finite");
      for (const night of [false, true]) {
        await preloadCivicSprites({ night });
        r.night = night; r.paint(city);
        const paint = [], idle = [], intervals = [];
        for (let i = 0; i < 40; i++) {
          r.pan(1, 0);
          let start = performance.now(); r.render(city, i * 16); paint.push(performance.now() - start);
          start = performance.now(); r.render(city, i * 16); idle.push(performance.now() - start);
        }
        let previous;
        for (let i = 0; i < 90; i++) {
          const now = await new Promise(requestAnimationFrame);
          if (previous && i > 10) intervals.push(now - previous);
          previous = now; r.render(city, now);
        }
        results.push({ size, lots: city.tiles.filter(t => t.lot?.x === t.x && t.lot?.y === t.y).length, night, cameraRedrawMs: summary(paint), cachedFrameCpuMs: summary(idle), browserFrameIntervalMs: summary(intervals) });
      }
    }
    r.resizeObserver.disconnect(); canvas.remove();
    return results;
  });
  await writeFile('artifacts/renderer-performance.json', JSON.stringify({ viewport: '1440x1000', note: 'Chrome headless, local hardware, warm caches; not a cross-device guarantee', results }, null, 2));
  console.table(results.map(r => ({ size: r.size, night: r.night, redrawP95: r.cameraRedrawMs.p95, cachedP95: r.cachedFrameCpuMs.p95, frameIntervalP95: r.browserFrameIntervalMs.p95 })));
} finally { await browser.close(); }
