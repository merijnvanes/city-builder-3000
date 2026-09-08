// Render the complete civic catalog at city scale and inspect every rotation,
// day/night and unpowered state. Run against the worktree's Vite server.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { FAMILY_LAYOUT_COUNTS } from './art-families.mjs';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/civic-gallery', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto(`${process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173'}/civic-gallery`);
  await mkdir('artifacts', { recursive: true });
  for (const mode of ['overview', 'rotations', 'night', 'unpowered']) {
    const count = await page.evaluate(async ({mode,family}) => {
      const { CityRenderer } = await import('/src/renderer.js');
      const { drawArchitecture, preloadCivicSprites } = await import('/src/building-art.js');
      const { CIVIC_SPRITES } = await import('/src/civic-sprite-manifest.js');
      const { BUILDINGS } = await import('/src/sim/catalog.js');
      document.body.replaceChildren();
      document.documentElement.style.cssText = 'height:auto;overflow:visible';
      document.body.style.cssText = 'display:grid;grid-template-columns:repeat(4,300px);background:#263c46;margin:0;height:auto;overflow:visible';
      let count = 0;
      const { familyBuildings, EXPECTED_VARIANTS } = await import('/tests/art-families.mjs');
      for (const [type, spec] of familyBuildings(family)) {
        const variants = spec.artVariants || EXPECTED_VARIANTS[type] || 1;
        for (let variant = 0; variant < variants; variant++)
        for (const rotation of mode === 'overview' ? [0] : [0, 1, 2, 3]) {
          await preloadCivicSprites({ types: [type], variant, rotation, night: mode === 'night' || mode === 'unpowered', powered: mode !== 'unpowered' });
          const canvas = document.createElement('canvas');
          canvas.width = 600; canvas.height = 540;
          canvas.style.cssText = 'width:300px;height:270px';
          document.body.append(canvas);
          const r = Object.assign(Object.create(CityRenderer.prototype), {
            base: canvas.getContext('2d'), w: 300, h: 270, zoom: Math.min(1.4, 270 / (spec.w * 64), 195 / (CIVIC_SPRITES[type].height + spec.w * 16)), size: spec.w,
            panX: 0, panY: 35, rotation, night: mode === 'night' || mode === 'unpowered', platform: 0,
          });
          r.base.scale(2, 2);
          drawArchitecture(r, { x: 0, y: 0, lot: { x: 0, y: 0, w: spec.w, h: spec.h }, type, variant: (variant+.5)/variants, level: 1, ...spec.zone, age: 10, powered: mode !== 'unpowered' });
          const pixels = r.base.getImageData(0, 0, canvas.width, canvas.height).data;
          let occupied = 0;
          for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
            if (!pixels[(y * canvas.width + x) * 4 + 3]) continue;
            occupied++;
            if (x < 2 || y < 2 || x >= canvas.width - 2 || y >= canvas.height - 2) {
              throw new Error(`${type}: clipped artwork in ${mode}, rotation ${rotation}`);
            }
          }
          if (occupied < 100) throw new Error(`${type}: missing artwork in ${mode}`);
          r.base.fillStyle = '#f1e7d0'; r.base.font = '600 15px sans-serif';
          r.base.fillText(variants>1?`${spec.label} · ${CIVIC_SPRITES[type].variants[variant].label}`:spec.label, 20, 27);
          r.base.fillStyle = '#a2b8bb'; r.base.font = '11px sans-serif';
          r.base.fillText(mode === 'overview' ? `${spec.w} × ${spec.h} ${family} campus` : `${mode} · camera ${rotation + 1}`, 20, 45);
          count++;
        }
      }
      return count;
    }, {mode, family: process.env.ART_FAMILY || 'civic'});
    const types = FAMILY_LAYOUT_COUNTS[process.env.ART_FAMILY || 'civic'];
    assert.equal(count, types * (mode === 'overview' ? 1 : 4));
    await page.screenshot({ path: `artifacts/${process.env.ART_FAMILY || 'civic'}-${mode}.png`, fullPage: true });
  }
  assert.deepEqual(errors, []);
  console.log(`Rendered ${process.env.ART_FAMILY || 'civic'} collection: overview and four rotations by day, night, and without power.`);
} finally { await browser.close(); }
