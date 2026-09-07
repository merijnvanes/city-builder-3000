// Real Canvas regression: hidden courtyard details must never overwrite a
// foreground wing. Run against Vite, like tests/browser.mjs.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
  await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173');
  const results = await page.evaluate(async () => {
    const { CityRenderer } = await import('/src/renderer.js');
    const { drawArchitecture, shadeHex, NIGHT_EXPOSURE } = await import('/src/building-art.js');
    document.body.replaceChildren();
    document.documentElement.style.cssText = 'height:auto;overflow:visible';
    Object.assign(document.body.style, { display: 'grid', gridTemplateColumns: 'repeat(4, 300px)', background: '#20313d', margin: '0', height: 'auto', overflow: 'visible' });
    const results = [];
    for (const model of ['courtyard', 'garden slab', 'balcony tower']) for (const night of [false, true]) for (let rotation = 0; rotation < 4; rotation++) {
      const canvas = document.createElement('canvas');
      canvas.width = 600; canvas.height = 800;
      canvas.style.width = '300px'; canvas.style.height = '400px';
      document.body.append(canvas);
      const r = Object.assign(Object.create(CityRenderer.prototype), {
        base: canvas.getContext('2d'), w: 300, h: 400, zoom: 2, size: 2,
        panX: 0, panY: 50, rotation, night, platform: 0,
      });
      r.base.scale(2, 2);
      const t = { x: 0, y: 0, lot: { x: 0, y: 0, w: 2, h: 2 }, type: 'residential', density: 2, level: 4, age: 10, variant: model === 'courtyard' ? 0.1 : model === 'garden slab' ? 0.8 : 0.45 };
      if (model === 'balcony tower') t.density = 3;
      const tree = r.tree;
      r.tree = () => {}; // Exclude legitimate foliage overlapping the facade.
      drawArchitecture(r, t);
      const actual = r.base.getImageData(0, 0, 600, 800).data;
      r.base.clearRect(0, 0, 300, 400);
      // Materials pass through the same night exposure the lot helpers apply.
      const tone = (c) => (night ? shadeHex(c, NIGHT_EXPOSURE) : c);
      if (model === 'courtyard') {
        const rear = rotation === 1 || rotation === 2;
        const a = rotation === 3 ? 0.06 : 0.66;
        const x = rear ? 0.12 : a * 2, y = rear ? 0.12 : 0.76;
        const w = rear ? 1.76 : 0.56, d = rear ? 0.64 : 1;
        const h = rear ? 48 : 44;
        r.box(x, y, w, d, h, tone(rear ? '#d0b690' : '#aa8066'));
        r.windows(x, y, w, d, h, 0);
        if (rear) for (let z = 8; z < 48; z += 8) for (const f of r.faces(x, y, w, d, 0, z)) r.line(f.points[0], f.points[1], tone('#c2baa1'), 1);
        r.flat(x + 0.02, y + 0.02, w - 0.04, d - 0.04, h + 0.1, tone('#7b7e6c'));
      } else if (model === 'garden slab') {
        r.box(0.12, 0.2, 1.76, 0.84, 56, tone('#e0d2b8'));
        r.windows(0.12, 0.2, 1.76, 0.84, 56, 0);
        for (let z = 8; z < 56; z += 8) for (const f of r.faces(0.12, 0.2, 1.76, 0.84, 0, z)) r.line(f.points[0], f.points[1], tone('#c2baa1'), 1);
        r.flat(0.14, 0.22, 1.72, 0.8, 56.1, tone('#7b7e6c'));
      } else {
        r.box(0.18, 0.4, 1.64, 1, 102, tone('#a69583'));
        r.windows(0.18, 0.4, 1.64, 1, 102, 0);
        r.flat(0.2, 0.42, 1.6, 0.96, 102.1, tone('#6f7368'));
        r.box(0.8, 0.8, 0.4, 0.28, 5, tone('#a39e88'), 102);
      }
      const expected = r.base.getImageData(0, 0, 600, 800).data;
      let checked = 0, mismatched = 0;
      for (let py = 2; py < 798; py++) for (let px = 2; px < 598; px++) {
        const i = (py * 600 + px) * 4;
        if ([-1200, -2, 0, 2, 1200].some(offset => expected[i + offset * 4 + 3] !== 255)) continue;
        checked++;
        if ([0, 1, 2, 3].some(c => actual[i + c] !== expected[i + c])) mismatched++;
      }
      if (model !== 'balcony tower' || rotation === 1 || rotation === 2) results.push({ model, rotation, night, checked, mismatched });
      r.base.clearRect(0, 0, 300, 400);
      r.tree = tree;
      drawArchitecture(r, t);
      r.base.fillStyle = '#d3dfde'; r.base.font = '13px sans-serif';
      r.base.fillText(`${model} · ${night ? 'night' : 'day'} · ${rotation}`, 20, 30);
    }
    return results;
  });
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/apartment-rotations.png', fullPage: true });
  for (const r of results) {
    assert.ok(r.checked > 1000, 'sample a substantial facade area');
    assert.equal(r.mismatched, 0, `Foreground wing occlusion: ${JSON.stringify(r)}`);
  }
  console.log('Courtyards, garden slabs and rear balcony facades pass Canvas occlusion checks, day and night.');
} finally { await browser.close(); }
