import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  const results = await page.evaluate(async () => {
    const { CityRenderer } = await import('/src/renderer.js');
    const { withGroundClip } = await import('/src/ground-effects.js');
    const { drawTree } = await import('/src/foliage.js');
    const results = [];
    for (let rotation = 0; rotation < 4; rotation++) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 400;
      const ctx = canvas.getContext('2d');
      const r = Object.assign(Object.create(CityRenderer.prototype), { base: ctx, w: 400, h: 400, zoom: 2, size: 2, panX: 0, panY: 0, rotation });
      r.buildCorners({ size: 2, tiles: [{ elev: 0 }, { elev: 1 }, { elev: 1 }, { elev: 2 }] });
      withGroundClip(r, () => { ctx.fillStyle = 'red'; ctx.fillRect(0, 0, 400, 400); });
      const mask = ctx.getImageData(0, 0, 400, 400).data;
      ctx.clearRect(0, 0, 400, 400);
      for (const [x,y] of [[0.01,0.01],[1.99,0.01],[1.99,1.99],[0.01,1.99]]) drawTree(r,x,y,0);
      const pixels = ctx.getImageData(0, 0, 400, 400).data;
      let escapedShadows = 0, canopyOutside = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (mask[i+3] || !pixels[i+3]) continue;
        // Shadow uses #243523; crowns and trunks have different RGB values.
        if (Math.abs(pixels[i]-36)<3 && Math.abs(pixels[i+1]-53)<3 && Math.abs(pixels[i+2]-35)<3 && pixels[i+3]>15) escapedShadows++;
        if (pixels[i+3]>200) canopyOutside++;
      }
      // A subsequent draw must be unaffected by the temporary clipping state.
      ctx.fillStyle = 'blue'; ctx.fillRect(0,0,1,1);
      results.push({ rotation, escapedShadows, canopyOutside, restored: ctx.getImageData(0,0,1,1).data[3] });
    }
    return results;
  });
  for (const r of results) { assert.equal(r.escapedShadows, 0, JSON.stringify(r)); assert.ok(r.canopyOutside > 0); assert.equal(r.restored, 255); }
  console.log('Terrain-edge shadow clipping passed at all four rotations; canopies remain visible.');
} finally { await browser.close(); }
