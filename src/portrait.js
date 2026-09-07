// Query-card diorama. Measure the actual artwork so spires, cranes and wide
// facilities fit, then redraw at the display resolution for crisp details.
import { CityRenderer } from './renderer.js';
import { drawArchitecture } from './building-art.js';

export function createPortrait(canvas) {
  const scratch = document.createElement('canvas');
  scratch.width = scratch.height = 1024;
  const measuring = scratch.getContext('2d', { willReadFrequently: true });
  const r = Object.assign(Object.create(CityRenderer.prototype), {
    corners: null, platform: 0, size: 64, panX: 0, panY: 0,
  });
  let lastKey, bounds;

  function artwork(tile) {
    const { x, y, w, h } = tile.lot;
    const grass = tile.abandoned ? '#7d8a5a' : r.night ? '#3d4d33' : '#7b944e';
    r.box(x - 0.08, y - 0.08, w + 0.16, h + 0.16, 1.4, grass, -1.4);
    drawArchitecture(r, tile);
  }

  return {
    draw(tile, night = false, rotation = 0) {
      const lot = tile?.lot;
      if (!lot) return false;
      r.night = night; r.rotation = rotation;
      const key = JSON.stringify([tile.x, tile.y, lot.w, lot.h, tile.type, tile.density, tile.level, tile.variant, tile.abandoned, tile.age === 0, rotation]);
      if (key !== lastKey) {
        r.base = measuring; r.w = r.h = 1024; r.zoom = 1;
        r.panX = r.panY = 0;
        const origin = r.project(lot.x, lot.y);
        r.panX = 512 - origin.x; r.panY = 512 - origin.y;
        measuring.clearRect(0, 0, 1024, 1024);
        artwork(tile);
        const pixels = measuring.getImageData(0, 0, 1024, 1024).data;
        let left = 1024, top = 1024, right = 0, bottom = 0;
        for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) {
          if (!pixels[(y * 1024 + x) * 4 + 3]) continue;
          left = Math.min(left, x); right = Math.max(right, x + 1);
          top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
        }
        bounds = { left: left - 512, right: right - 512, top: top - 512, bottom: bottom - 512 };
        lastKey = key;
      }
      const rect = canvas.getBoundingClientRect();
      r.w = rect.width || 150; r.h = rect.height || 110;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.w * dpr); canvas.height = Math.round(r.h * dpr);
      r.base = canvas.getContext('2d');
      r.base.setTransform(dpr, 0, 0, dpr, 0, 0);
      r.zoom = Math.min(2.4, Math.max(1, r.w - 16) / (bounds.right - bounds.left), Math.max(1, r.h - 12) / (bounds.bottom - bounds.top));
      r.panX = r.panY = 0;
      const origin = r.project(lot.x, lot.y);
      r.panX = r.w / 2 - origin.x - (bounds.left + bounds.right) / 2 * r.zoom;
      r.panY = r.h / 2 - origin.y - (bounds.top + bounds.bottom) / 2 * r.zoom;
      artwork(tile);
      return true;
    },
  };
}
