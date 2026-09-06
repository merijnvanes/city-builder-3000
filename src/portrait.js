// Query-card portrait: one lot drawn on its own small canvas.
import { CityRenderer } from "./renderer.js";
import { drawArchitecture, heightOf } from "./building-art.js";

export function createPortrait(canvas) {
  const r = new CityRenderer(canvas);
  r.resizeObserver.disconnect();
  r.base = canvas.getContext("2d");
  r.corners = null; r.platform = null; r.size = 64;

  return {
    draw(tile, night = false) {
      const lot = tile?.lot;
      if (!lot) return false;
      const rect = canvas.getBoundingClientRect();
      r.w = rect.width || 150; r.h = rect.height || 110;
      r.dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.w * r.dpr); canvas.height = Math.round(r.h * r.dpr);
      r.night = night; r.rotation = 0; r.panX = 0; r.panY = 0;
      // Fit the lot: project its ground corners and roof, then centre the box.
      const h = heightOf(tile) + 6;
      r.zoom = Math.min(2.4, (r.w - 16) / (Math.max(lot.w, lot.h) * 2 * 32), (r.h - 12) / (Math.max(lot.w, lot.h) * 16 + h));
      const pts = [];
      for (const z of [0, h]) for (const [x, y] of [[lot.x, lot.y], [lot.x + lot.w, lot.y], [lot.x, lot.y + lot.h], [lot.x + lot.w, lot.y + lot.h]]) pts.push(r.project(x, y, z));
      const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
      r.panX = r.w / 2 - (minX + maxX) / 2; r.panY = r.h / 2 - (minY + maxY) / 2;

      const ctx = r.base;
      ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
      ctx.clearRect(0, 0, r.w, r.h);
      const grass = tile.abandoned ? "#7d8a5a" : "#7fa04f";
      r.flat(lot.x - 0.5, lot.y - 0.5, lot.w + 1, lot.h + 1, 0, night ? "#3d4d33" : grass, "#3f5a2e55");
      drawArchitecture(r, tile);
      return true;
    },
  };
}
