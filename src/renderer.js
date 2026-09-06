// Isometric Canvas 2D renderer. Static ground and buildings are painted into
// a cache whenever the city revision changes; animated cars, water sparkle,
// fires and the construction preview are drawn every frame on top.
import { drawArchitecture, heightOf, random } from "./building-art.js";
import { BUILDINGS } from "./sim/catalog.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  return "rgb(" + [n >> 16, (n >> 8) & 255, n & 255].map((v) => clamp(v * k, 0, 255) | 0).join(",") + ")";
};
const ROAD = new Set(["road", "rail", "highway"]);
const TILE_W = 32, TILE_H = 16;
const ELEV_PX = 8; // screen pixels per terrain level at zoom 1

export const OVERLAYS = ["none", "power", "water", "landvalue", "pollution", "crime", "traffic", "police", "fire", "health", "education", "garbage"];

export class CityRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cache = document.createElement("canvas");
    this.ground = document.createElement("canvas");
    this.base = this.cache.getContext("2d");
    this.zoom = 1; this.panX = 0; this.panY = 0; this.rotation = 0; this.size = 64;
    this.hover = null; this.preview = null; this.tool = "inspect"; this.overlay = "none"; this.night = false;
    this.dirty = true; this.lastRevision = -1; this.w = 0; this.h = 0; this.sorted = [];
    this.minZoom = 0.3; this.maxZoom = 2.8;
    this.corners = null; this.platform = null; this.tiles = null;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  // Screen origin of the map: centred in the space right of the toolbar.
  get cx() { return this.w * 0.5 + (this.w > 800 ? 100 : 0); }
  get cy() { return this.h * 0.5; }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = rect.width; this.h = rect.height;
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    for (const c of [this.canvas, this.cache, this.ground]) { c.width = Math.round(this.w * this.dpr); c.height = Math.round(this.h * this.dpr); }
    this.dirty = true;
  }

  home() {
    const n = this.size || 64;
    this.zoom = clamp((this.w - 220) / (n * TILE_W * 1.15), 0.45, 1.1);
    this.panX = 0; this.panY = 0; this.dirty = true;
  }

  // ── Camera ────────────────────────────────────────────────────
  orient(x, y) {
    const n = this.size || 64;
    switch (this.rotation || 0) {
      case 1: return { x: n - y, y: x };
      case 2: return { x: n - x, y: n - y };
      case 3: return { x: y, y: n - x };
      default: return { x, y };
    }
  }
  unorient(x, y) {
    const n = this.size || 64;
    switch (this.rotation || 0) {
      case 1: return { x: y, y: n - x };
      case 2: return { x: n - x, y: n - y };
      case 3: return { x: n - y, y: x };
      default: return { x, y };
    }
  }
  // Terrain height in pixels (zoom 1) under map point (x, y). Ground is
  // interpolated between corner heights; while a lot is being drawn the
  // whole lot sits on a flat platform at its tile's level.
  groundZ(x, y) {
    if (this.platform != null) return this.platform;
    const c = this.corners;
    if (!c) return 0;
    const n = this.size || 64;
    const fx = Math.max(0, Math.min(n - 1e-6, x)), fy = Math.max(0, Math.min(n - 1e-6, y));
    const ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
    const w = n + 1;
    const z00 = c[iy * w + ix], z10 = c[iy * w + ix + 1], z01 = c[(iy + 1) * w + ix], z11 = c[(iy + 1) * w + ix + 1];
    return (z00 * (1 - u) + z10 * u) * (1 - v) + (z01 * (1 - u) + z11 * u) * v;
  }
  // Average the elevation of the tiles around every vertex.
  buildCorners(city) {
    const n = city.size, w = n + 1;
    const c = new Float32Array(w * w);
    for (let vy = 0; vy <= n; vy++) {
      for (let vx = 0; vx <= n; vx++) {
        let sum = 0, count = 0;
        for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
          const tx = vx + dx, ty = vy + dy;
          if (tx < 0 || ty < 0 || tx >= n || ty >= n) continue;
          sum += city.tiles[ty * n + tx].elev || 0; count++;
        }
        c[vy * w + vx] = count ? (sum / count) * ELEV_PX : 0;
      }
    }
    this.corners = c;
    this.tiles = city.tiles;
  }
  project(x, y, z = 0) {
    const p = this.orient(x, y);
    return { x: this.cx + this.panX + (p.x - p.y) * TILE_W * this.zoom, y: this.cy + this.panY + (p.x + p.y - (this.size || 64)) * TILE_H * this.zoom - (z + this.groundZ(x, y)) * this.zoom };
  }
  pickFlat(sx, sy) {
    const dx = (sx - this.cx - this.panX) / (TILE_W * this.zoom);
    const dy = (sy - this.cy - this.panY) / (TILE_H * this.zoom) + (this.size || 64);
    const p = this.unorient((dx + dy) / 2, (dy - dx) / 2);
    return { x: Math.floor(p.x), y: Math.floor(p.y) };
  }
  // Hills lift tiles on screen, so refine the flat guess with the height
  // under it a few times.
  pick(sx, sy) {
    let p = this.pickFlat(sx, sy);
    if (!this.corners) return p;
    for (let i = 0; i < 3; i++) {
      const z = this.groundZ(p.x + 0.5, p.y + 0.5) * this.zoom;
      const q = this.pickFlat(sx, sy + z);
      if (q.x === p.x && q.y === p.y) break;
      p = q;
    }
    return p;
  }
  zoomAt(delta, sx = this.cx, sy = this.cy) {
    const old = this.zoom;
    this.zoom = clamp(this.zoom * Math.exp(delta), this.minZoom, this.maxZoom);
    const k = this.zoom / old;
    this.panX = sx - this.cx - (sx - this.cx - this.panX) * k;
    this.panY = sy - this.cy - (sy - this.cy - this.panY) * k;
    this.dirty = true;
  }
  rotate(delta = 1) {
    const p = this.pick(this.cx, this.cy);
    this.rotation = ((this.rotation + delta) % 4 + 4) % 4;
    const target = this.project(p.x + 0.5, p.y + 0.5);
    this.pan(this.cx - target.x, this.cy - target.y);
    this.dirty = true;
  }
  pan(dx, dy) { this.panX += dx; this.panY += dy; this.dirty = true; }

  // Painter's key: the front-most corner of a tile or lot in the current orientation.
  depthKey(x, y, w = 1, h = 1) {
    let best = -Infinity;
    for (const [cx, cy] of [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]]) {
      const p = this.orient(cx + 0.5, cy + 0.5);
      if (p.x + p.y > best) best = p.x + p.y;
    }
    return best;
  }

  // ── Primitives (tile units, z in pixels at zoom 1) ────────────
  poly(points, fill, stroke, ctx = this.base) {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = 0.65 * this.zoom; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  flat(x, y, w, d, z, color, stroke, ctx = this.base) {
    this.poly([this.project(x, y, z), this.project(x + w, y, z), this.project(x + w, y + d, z), this.project(x, y + d, z)], color, stroke, ctx);
  }
  faces(x, y, w, d, h, z = 0) {
    const p = (a, b, c) => this.project(a, b, c);
    const all = {
      south: [p(x, y + d, z + h), p(x + w, y + d, z + h), p(x + w, y + d, z), p(x, y + d, z)],
      east: [p(x + w, y, z + h), p(x + w, y + d, z + h), p(x + w, y + d, z), p(x + w, y, z)],
      north: [p(x, y, z + h), p(x + w, y, z + h), p(x + w, y, z), p(x, y, z)],
      west: [p(x, y, z + h), p(x, y + d, z + h), p(x, y + d, z), p(x, y, z)],
    };
    return [["south", "east"], ["east", "north"], ["north", "west"], ["west", "south"]][this.rotation || 0].map((name) => ({ name, points: all[name] }));
  }
  box(x, y, w, d, h, color, z = 0) {
    for (const face of this.faces(x, y, w, d, h, z)) {
      const left = face.points[0].x + face.points[1].x < this.project(x + w / 2, y + d / 2).x * 2;
      this.poly(face.points, shade(color, left ? 0.65 : 0.86));
    }
    this.flat(x, y, w, d, z + h, shade(color, 1.09));
  }
  roof(x, y, w, d, z, h, color) {
    const p = (a, b, c) => this.project(a, b, c);
    const a = p(x, y, z), b = p(x + w, y, z), c = p(x + w, y + d, z), e = p(x, y + d, z), r1 = p(x + w / 2, y, z + h), r2 = p(x + w / 2, y + d, z + h);
    const polys = [{ p: [a, r1, r2, e], c: shade(color, 0.82) }, { p: [r1, b, c, r2], c: shade(color, 1.12) }, { p: [a, b, r1], c: shade(color, 0.72) }, { p: [e, c, r2], c: shade(color, 0.92) }];
    polys.sort((m, n) => m.p.reduce((s, q) => s + q.y, 0) / m.p.length - n.p.reduce((s, q) => s + q.y, 0) / n.p.length);
    for (const face of polys) this.poly(face.p, face.c);
  }
  // Hip roof: four faces rising to a short ridge (or an apex when ridge is 0).
  pyramid(x, y, w, d, z, h, color, ridge = 0) {
    const p = (a, b, c) => this.project(a, b, c);
    const a = p(x, y, z), b = p(x + w, y, z), c = p(x + w, y + d, z), e = p(x, y + d, z);
    const r1 = p(x + w / 2 - ridge / 2, y + d / 2, z + h), r2 = p(x + w / 2 + ridge / 2, y + d / 2, z + h);
    const faces = [{ p: [a, b, r2, r1], c: shade(color, 0.78) }, { p: [b, c, r2], c: shade(color, 1.1) }, { p: [c, e, r1, r2], c: shade(color, 0.95) }, { p: [e, a, r1], c: shade(color, 0.7) }];
    faces.sort((m, n) => m.p.reduce((s, q) => s + q.y, 0) / m.p.length - n.p.reduce((s, q) => s + q.y, 0) / n.p.length);
    for (const f of faces) this.poly(f.p, f.c);
  }
  cylinder(x, y, radius, h, color, z = 0) {
    const p = this.project(x, y, z + h), b = this.project(x, y, z), rx = radius * 43 * this.zoom, ry = radius * 23 * this.zoom, ctx = this.base;
    ctx.beginPath(); ctx.ellipse(b.x, b.y, rx, ry, 0, 0, Math.PI); ctx.lineTo(p.x - rx, p.y); ctx.ellipse(p.x, p.y, rx, ry, 0, Math.PI, 0); ctx.closePath();
    const g = ctx.createLinearGradient(p.x - rx, 0, p.x + rx, 0);
    g.addColorStop(0, shade(color, 0.61)); g.addColorStop(0.4, color); g.addColorStop(1, shade(color, 0.84));
    ctx.fillStyle = g; ctx.fill();
    ctx.beginPath(); ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = shade(color, 1.13); ctx.fill();
  }
  line(a, b, color, width = 1, ctx = this.base) {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = color; ctx.lineWidth = width * this.zoom; ctx.stroke();
  }
  fence(x, y, w, d, color) {
    this.line(this.project(x, y, 3), this.project(x + w, y + d, 3), color, 0.8);
    for (let a = 0; a <= 1; a += 0.12) this.line(this.project(x + w * a, y + d * a), this.project(x + w * a, y + d * a, 5), color, 0.6);
  }
  tree(x, y, n = 0) {
    const h = 10 + random(x, y, n) * 11, p = this.project(x, y, h), ctx = this.base;
    this.line(this.project(x, y), this.project(x, y, h * 0.8), "#61523a", 1.5);
    ctx.fillStyle = "#263d242e";
    const foot = this.project(x, y);
    ctx.beginPath(); ctx.ellipse(foot.x - 4 * this.zoom, foot.y + 2 * this.zoom, 8 * this.zoom, 3 * this.zoom, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4, r = i ? 3 * this.zoom : 0, cx = p.x + Math.cos(a) * r, cy = p.y + Math.sin(a) * r * 0.6;
      ctx.beginPath(); ctx.ellipse(cx, cy, 4.1 * this.zoom, (6 + (i % 2)) * this.zoom, 0, 0, Math.PI * 2);
      ctx.fillStyle = ["#3b632c", "#4b7632", "#628c3c", "#416c2e", "#739348", "#537d34"][(i + n) % 6]; ctx.fill();
    }
  }
  windows(x, y, w, d, h, seed, glass = false, base = 0, lit = true) {
    if (this.zoom < 0.5) return;
    const faces = this.faces(x, y, w, d, h, base);
    const rows = Math.max(1, Math.floor((h - 4) / 7));
    for (const face of faces) {
      const alongX = face.name === "south" || face.name === "north", length = alongX ? w : d, cols = Math.max(1, Math.min(7, Math.floor(length * 7)));
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const z = base + 3 + row * 7, offset = 0.055 + col * (length - 0.1) / cols, span = ((length - 0.12) / cols) * 0.66;
          const a = alongX ? x + offset : face.name === "east" ? x + w + 0.002 : x - 0.002;
          const b = alongX ? (face.name === "south" ? y + d + 0.002 : y - 0.002) : y + offset;
          const on = this.night && lit && random(seed + row, col) > 0.35;
          const color = on ? "#edcd77" : glass ? ["#38545a", "#496c70", "#69908e", "#89a5a0"][(row + col + seed) % 4 | 0] : "#425751";
          this.poly([this.project(a, b, z + 3.3), this.project(a + (alongX ? span : 0), b + (alongX ? 0 : span), z + 3.3), this.project(a + (alongX ? span : 0), b + (alongX ? 0 : span), z), this.project(a, b, z)], color);
        }
      }
    }
  }

  // ── Ground ────────────────────────────────────────────────────
  // Slope lighting: faces toward the north-west light are brighter.
  slopeShade(x, y) {
    const c = this.corners;
    if (!c) return 1;
    const w = (this.size || 64) + 1, i = y * w + x;
    const ew = (c[i] + c[i + w]) - (c[i + 1] + c[i + w + 1]);
    const ns = (c[i] + c[i + 1]) - (c[i + w] + c[i + w + 1]);
    return clamp(1 + (ew * 0.5 + ns * 0.35) / ELEV_PX * 0.11, 0.8, 1.2);
  }
  terrain(t, city) {
    const { x, y } = t, n = random(x, y), water = t.terrain === "water";
    let color = water ? ["#477e92", "#4b8396", "#528b9a", "#4c8390"][Math.floor(n * 4)]
      : t.terrain === "sand" ? ["#b3b17b", "#bdba88", "#aeb07d"][Math.floor(n * 3)]
      : ["#78904d", "#7c9550", "#829950", "#7c914b", "#759049"][Math.floor(n * 5)];
    if (!water) {
      const k = this.slopeShade(x, y);
      if (k !== 1) color = shade(color, k);
      else if (t.elev >= 5) color = shade(color, 1 + (t.elev - 4) * 0.03);
    }
    this.flat(x, y, 1, 1, 0, color);
    if (!water && t.type === "empty" && !t.trees) for (let i = 0; i < 3; i++) { const a = random(x, y, i + 1), b = random(y, x, i + 7); this.flat(x + a * 0.85, y + b * 0.85, 0.1, 0.045, 0.05, "#a8ae642b"); }
    if (this.tool !== "inspect" && !water && this.zoom > 0.55) this.flat(x, y, 1, 1, 0.1, null, "#344b2833");
    if (!ROAD.has(t.type)) return;
    const isRail = t.type === "rail";
    const joins = (a, b) => a === b || (a !== "rail" && b !== "rail" && ROAD.has(a) && ROAD.has(b));
    const adjacent = (dx, dy) => x + dx >= 0 && y + dy >= 0 && x + dx < city.size && y + dy < city.size && joins(city.tiles[(y + dy) * city.size + x + dx]?.type, t.type);
    if (t.type === "highway") {
      const ew = adjacent(1, 0) || adjacent(-1, 0), ns = adjacent(0, 1) || adjacent(0, -1);
      this.flat(x, y, 1, 1, 0.3, "#5c6266");
      this.flat(x + 0.04, y + 0.04, 0.92, 0.92, 0.45, "#3f4549");
      if (ew) { this.line(this.project(x, y + 0.5, 0.8), this.project(x + 1, y + 0.5, 0.8), "#d9c34a", 1); this.line(this.project(x, y + 0.26, 0.7), this.project(x + 1, y + 0.26, 0.7), "#8a9296", 0.5); this.line(this.project(x, y + 0.74, 0.7), this.project(x + 1, y + 0.74, 0.7), "#8a9296", 0.5); }
      if (ns) { this.line(this.project(x + 0.5, y, 0.8), this.project(x + 0.5, y + 1, 0.8), "#d9c34a", 1); this.line(this.project(x + 0.26, y, 0.7), this.project(x + 0.26, y + 1, 0.7), "#8a9296", 0.5); this.line(this.project(x + 0.74, y, 0.7), this.project(x + 0.74, y + 1, 0.7), "#8a9296", 0.5); }
      if (water) { this.line(this.project(x, y + 0.03, 5), this.project(x + 1, y + 0.03, 5), "#b9bda8", 1.8); this.line(this.project(x, y + 0.97, 5), this.project(x + 1, y + 0.97, 5), "#b9bda8", 1.8); }
      return;
    }
    this.flat(x + 0.015, y + 0.015, 0.97, 0.97, 0.3, isRail ? "#857f67" : "#a3a796");
    this.flat(x + 0.1, y + 0.1, 0.8, 0.8, 0.4, isRail ? "#736e5c" : "#69736b");
    const ew = adjacent(1, 0) || adjacent(-1, 0), ns = adjacent(0, 1) || adjacent(0, -1);
    if (isRail) {
      for (let a = 0.08; a < 1; a += 0.15) {
        if (ew) this.line(this.project(x + a, y + 0.2, 0.6), this.project(x + a, y + 0.8, 0.6), "#514c3f", 2);
        if (ns) this.line(this.project(x + 0.2, y + a, 0.6), this.project(x + 0.8, y + a, 0.6), "#514c3f", 2);
      }
      for (const a of [0.32, 0.68]) {
        if (ew) this.line(this.project(x, y + a, 1), this.project(x + 1, y + a, 1), "#b5b7a5", 1);
        if (ns) this.line(this.project(x + a, y, 1), this.project(x + a, y + 1, 1), "#b5b7a5", 1);
      }
    } else {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!adjacent(dx, dy)) continue;
        this.flat(x + (dx === 1 ? 0.5 : dx === -1 ? 0 : 0.1), y + (dy === 1 ? 0.5 : dy === -1 ? 0 : 0.1), dx === 0 ? 0.8 : 0.5, dy === 0 ? 0.8 : 0.5, 0.5, "#69736b");
        if (this.zoom > 0.6) this.line(this.project(x + 0.5 + dx * 0.15, y + 0.5 + dy * 0.15, 0.6), this.project(x + 0.5 + dx * 0.42, y + 0.5 + dy * 0.42, 0.6), "#c9c6a4", 0.65);
      }
      if (ew && ns && this.zoom > 0.6) for (const a of [0.14, 0.24, 0.34]) { this.flat(x + a, y + 0.75, 0.045, 0.12, 0.7, "#bebfa5"); this.flat(x + 0.75, y + a, 0.12, 0.045, 0.7, "#bebfa5"); }
    }
    if (water) {
      if (ew) { this.line(this.project(x, y + 0.055, 4), this.project(x + 1, y + 0.055, 4), "#b9bda8", 1.7); this.line(this.project(x, y + 0.94, 4), this.project(x + 1, y + 0.94, 4), "#b9bda8", 1.7); }
      else { this.line(this.project(x + 0.055, y, 4), this.project(x + 0.055, y + 1, 4), "#b9bda8", 1.7); this.line(this.project(x + 0.94, y, 4), this.project(x + 0.94, y + 1, 4), "#b9bda8", 1.7); }
    }
  }

  powerline(t, city) {
    const { x, y } = t, p = this.project(x + 0.5, y + 0.5, 24);
    this.line(this.project(x + 0.5, y + 0.5), p, "#615b47", 1.8);
    this.line({ x: p.x - 5 * this.zoom, y: p.y }, { x: p.x + 5 * this.zoom, y: p.y }, "#918a6e", 1.2);
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const other = city.tiles[(y + dy) * city.size + x + dx];
      if (x + dx >= city.size || y + dy >= city.size || !other?.powerline) continue;
      const q = this.project(x + dx + 0.5, y + dy + 0.5, 24);
      for (const shift of [-2, 2]) {
        const ctx = this.base;
        ctx.beginPath(); ctx.moveTo(p.x + shift * this.zoom, p.y);
        ctx.quadraticCurveTo((p.x + q.x) / 2 + shift * this.zoom, (p.y + q.y) / 2 + 5 * this.zoom, q.x + shift * this.zoom, q.y);
        ctx.strokeStyle = "#3f4940"; ctx.lineWidth = 0.6 * this.zoom; ctx.stroke();
      }
    }
  }
  pipe(t, city) {
    const { x, y } = t, center = this.project(x + 0.5, y + 0.5, 0.9);
    let any = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (x + dx < 0 || y + dy < 0 || x + dx >= city.size || y + dy >= city.size) continue;
      const n = city.tiles[(y + dy) * city.size + x + dx];
      if (!n.pipe && !BUILDINGS[n.type]?.waterOut) continue;
      any = true;
      this.line(center, this.project(x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5, 0.9), t.watered ? "#66d0ed" : "#7598a9", 4);
    }
    if (!any) this.flat(x + 0.4, y + 0.4, 0.2, 0.2, 0.9, t.watered ? "#66d0ed" : "#7598a9");
  }

  // Data maps: dim the world and tint only the tiles that carry a value.
  subway(t, city) {
    const { x, y } = t, center = this.project(x + 0.5, y + 0.5, 0.9);
    let any = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (x + dx < 0 || y + dy < 0 || x + dx >= city.size || y + dy >= city.size) continue;
      const n = city.tiles[(y + dy) * city.size + x + dx];
      if (!n.subway && n.type !== "substation") continue;
      any = true;
      this.line(center, this.project(x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5, 0.9), "#e0a83a", 5);
      this.line(center, this.project(x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5, 0.9), "#5a4a2a", 1.5);
    }
    if (!any) this.flat(x + 0.35, y + 0.35, 0.3, 0.3, 0.9, "#e0a83a");
  }

  heatColor(t) {
    const o = this.overlay;
    if (t.terrain === "water" && o !== "pollution") return null;
    if (o === "power") return t.powered ? "#dbe64488" : (t.lot || t.type !== "empty") ? "#db5b40aa" : null;
    if (o === "water") return t.watered ? "#469bdbaa" : (t.lot || t.type !== "empty") ? "#bd7045aa" : null;
    if (o === "landvalue") return "hsla(" + (t.landValue * 1.2) + ",65%,48%,.6)";
    if (["police", "fire", "health", "education"].includes(o)) { const v = t.svc?.[o] || 0; return v ? "hsla(" + (60 + v * 0.6) + ",70%,50%," + (0.15 + v / 160) + ")" : null; }
    if (o === "transit") { const v = (t.svc?.rail || 0) + (t.svc?.bus || 0); return v ? "hsla(200,70%,55%," + (0.1 + Math.min(1, v / 100) * 0.4) + ")" : null; }
    const value = t[o] || 0;
    if (value <= 0) return null;
    return "hsla(" + (60 - value * 0.6) + ",80%,50%," + (0.25 + value / 160) + ")";
  }

  // Centre the camera on a tile, optionally at a zoom level.
  focusOn(x, y, zoom) {
    if (zoom) this.zoom = clamp(zoom, this.minZoom, this.maxZoom);
    this.panX = 0; this.panY = 0;
    const p = this.project(x + 0.5, y + 0.5);
    this.panX = this.cx - p.x;
    this.panY = this.cy - p.y;
    this.dirty = true;
  }

  // Flat platform for a lot with retaining walls where the ground falls away.
  platformFor(t) {
    const { x, y, w, h } = t.lot;
    const top = t.elev * ELEV_PX;
    this.platform = null;
    const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    const ground = corners.map(([cx, cy]) => this.groundZ(cx, cy));
    this.platform = top;
    const flatPts = corners.map(([cx, cy]) => this.project(cx, cy, 0));
    this.platform = null;
    // Walls on the two front edges, only where the ground is lower.
    const front = [["south", 3, 2], ["east", 2, 1], ["north", 0, 1], ["west", 3, 0]];
    const visible = [["south", "east"], ["east", "north"], ["north", "west"], ["west", "south"]][this.rotation || 0];
    for (const [name, a, b] of front) {
      if (!visible.includes(name)) continue;
      if (ground[a] >= top - 0.5 && ground[b] >= top - 0.5) continue;
      const pa = this.project(corners[a][0], corners[a][1], 0), pb = this.project(corners[b][0], corners[b][1], 0);
      this.poly([flatPts[a], flatPts[b], pb, pa], name === "south" || name === "west" ? "#6f6a58" : "#8a836c");
    }
    this.platform = top;
    this.poly(flatPts, t.terrain === "sand" ? "#b7b487" : "#7c914b");
  }

  // ── Static layer ──────────────────────────────────────────────
  paint(city) {
    this.size = city.size;
    if (!this.corners || this.tiles !== city.tiles || city.revision !== this.lastRevision) this.buildCorners(city);
    const ctx = this.base;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.fillStyle = this.night ? "#233640" : "#526c60";
    ctx.fillRect(0, 0, this.w, this.h);

    const key = (t) => this.depthKey(t.x, t.y);
    this.sorted = [...city.tiles].sort((a, b) => key(a) - key(b));
    const visible = (x, y) => { const p = this.project(x, y); return p.x > -260 * this.zoom && p.x < this.w + 260 * this.zoom && p.y > -80 * this.zoom && p.y < this.h + 420 * this.zoom; };

    for (const t of this.sorted) if (visible(t.x + 0.5, t.y + 0.5)) this.terrain(t, city);

    // Platforms and shadows for every lot.
    for (const t of this.sorted) {
      if (!t.lot || t.lot.x !== t.x || t.lot.y !== t.y) continue;
      if (!visible(t.x, t.y)) continue;
      this.platformFor(t);
      const h = heightOf(t);
      if (h) {
        const { w, h: d } = t.lot;
        const a = this.project(t.x + 0.15, t.y + 0.15), b = this.project(t.x + w - 0.15, t.y + 0.15), c = this.project(t.x + w - 0.15, t.y + d - 0.15), e = this.project(t.x + 0.15, t.y + d - 0.15);
        const dx = -h * 0.3 * this.zoom, dy = h * 0.15 * this.zoom;
        this.poly([a, b, c, { x: c.x + dx, y: c.y + dy }, { x: e.x + dx, y: e.y + dy }, e], "#26352539");
      }
      this.platform = null;
    }

    if (this.overlay !== "none") {
      ctx.fillStyle = "#1a222a55";
      ctx.fillRect(0, 0, this.w, this.h);
      for (const t of this.sorted) { const c = this.heatColor(t); if (c) this.flat(t.x, t.y, 1, 1, 0.5, c); }
    }
    const showSubway = this.overlay === "transit" || this.tool === "subway" || this.tool === "substation";
    const showPipes = this.overlay === "water" || this.tool === "pipe" || showSubway;
    if (this.overlay === "water" || this.tool === "pipe") for (const t of this.sorted) if (t.pipe) this.pipe(t, city);
    if (showSubway) for (const t of this.sorted) if (t.subway || t.type === "substation") this.subway(t, city);

    const ground = this.ground.getContext("2d");
    ground.clearRect(0, 0, this.ground.width, this.ground.height);
    ground.drawImage(this.cache, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (showPipes) ctx.globalAlpha = 0.3;

    // Buildings, trees and poles sorted by their front-most corner.
    const items = [];
    for (const t of city.tiles) {
      if (t.lot) {
        if (t.lot.x === t.x && t.lot.y === t.y) items.push({ k: this.depthKey(t.x, t.y, t.lot.w, t.lot.h), t, kind: "lot" });
      } else if (t.type !== "empty" && !ROAD.has(t.type)) {
        items.push({ k: this.depthKey(t.x, t.y), t, kind: "zone" });
      } else if (t.type === "empty" && t.trees) {
        items.push({ k: this.depthKey(t.x, t.y), t, kind: "trees" });
      }
      if (t.powerline) items.push({ k: this.depthKey(t.x, t.y) + 0.01, t, kind: "pole" });
    }
    items.sort((a, b) => a.k - b.k || a.t.x - b.t.x);
    for (const it of items) {
      const t = it.t;
      if (!visible(t.x + (t.lot?.w || 1) / 2, t.y + (t.lot?.h || 1) / 2)) continue;
      if (it.kind === "lot") { this.platform = t.elev * ELEV_PX; drawArchitecture(this, t); this.platform = null; }
      else if (it.kind === "zone") drawArchitecture(this, t);
      else if (it.kind === "trees") {
        const n = Math.floor(random(t.y, t.x) * 3);
        const jx = random(t.x, t.y, 11) * 0.4, jy = random(t.x, t.y, 12) * 0.4;
        if (t.trees >= 1) this.tree(t.x + 0.2 + jx, t.y + 0.3 + jy, n);
        if (t.trees >= 2) this.tree(t.x + 0.55 + jy * 0.8, t.y + 0.6 + jx * 0.8, (n + 1) % 3);
        if (t.trees >= 3) this.tree(t.x + 0.65 - jx * 0.5, t.y + 0.15 + jy * 0.5, (n + 2) % 3);
      } else this.powerline(t, city);
    }
    ctx.globalAlpha = 1;
    this.lastRevision = city.revision;
    this.dirty = false;
  }

  // ── Frame ─────────────────────────────────────────────────────
  render(city, time) {
    if (this.dirty || city.revision !== this.lastRevision || this.size !== city.size || this.tiles !== city.tiles) this.paint(city);
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.ground, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Water sparkle.
    for (let i = 0; i < city.tiles.length; i += 7) {
      const t = city.tiles[i];
      if (t.terrain !== "water" || ROAD.has(t.type)) continue;
      const p = this.project(t.x + 0.3, t.y + 0.5);
      if (p.x < -20 || p.x > this.w + 20 || p.y < -20 || p.y > this.h + 20) continue;
      ctx.globalAlpha = 0.12 + 0.1 * Math.sin(time * 0.0008 + i);
      this.line(p, { x: p.x + 9 * this.zoom, y: p.y - 1 * this.zoom }, "#bed5c5", 0.8, ctx);
    }
    ctx.globalAlpha = 1;

    // Cars: more on busy roads, faster on highways.
    if (this.overlay !== "water" && this.tool !== "pipe") {
      for (let i = 0; i < city.tiles.length; i++) {
        const t = city.tiles[i];
        const hw = t.type === "highway";
        if ((t.type !== "road" && !hw) || random(t.x, t.y, 9) > (hw ? 0.3 : 0.18) + (t.traffic || 0) * 0.008) continue;
        const east = t.x + 1 < city.size && city.tiles[i + 1]?.type === t.type, south = city.tiles[i + city.size]?.type === t.type;
        if (!east && !south) continue;
        const vertical = south && (!east || i % 2 === 0), f = (time * (hw ? 0.0003 : 0.00016) + random(t.x, t.y)) % 1, back = i % 3 === 0;
        const a = back ? 1 - f : f, p = this.project(t.x + (vertical ? (back ? 0.68 : 0.32) : a), t.y + (vertical ? a : back ? 0.68 : 0.32), 2.1);
        if (p.x < -20 || p.x > this.w + 20 || p.y < -20 || p.y > this.h + 20) continue;
        const bus = i % 17 === 0;
        ctx.fillStyle = bus ? "#487b91" : ["#dfd3aa", "#ac5743", "#658694", "#d4c8af", "#445351"][i % 5];
        ctx.fillRect(p.x - 3 * this.zoom, p.y - 2 * this.zoom, (bus ? 9 : 6) * this.zoom, 3.5 * this.zoom);
        ctx.fillStyle = "#bcc9ba"; ctx.fillRect(p.x - this.zoom, p.y - 2 * this.zoom, 2 * this.zoom, this.zoom);
        if (this.night) { ctx.fillStyle = "#eddca0"; ctx.fillRect(p.x + 3 * this.zoom, p.y, 1.7 * this.zoom, this.zoom); }
      }
    }

    // Trains on busy rails.
    for (let i = 0; i < city.tiles.length; i++) {
      const t = city.tiles[i];
      if (t.type !== "rail" || !t.traffic || random(t.x, t.y, 5) > 0.12) continue;
      const east = city.tiles[i + 1]?.type === "rail" && t.x + 1 < city.size, south = city.tiles[i + city.size]?.type === "rail";
      if (!east && !south) continue;
      const f = (time * 0.0002 + random(t.x, t.y, 6)) % 1;
      const p = this.project(t.x + (east ? f : 0.5), t.y + (east ? 0.5 : f), 3);
      if (p.x < -20 || p.x > this.w + 20 || p.y < -20 || p.y > this.h + 20) continue;
      ctx.fillStyle = "#3b4a52"; ctx.fillRect(p.x - 6 * this.zoom, p.y - 4 * this.zoom, 12 * this.zoom, 5 * this.zoom);
      ctx.fillStyle = "#c9a23a"; ctx.fillRect(p.x - 5 * this.zoom, p.y - 5 * this.zoom, 3 * this.zoom, 1.5 * this.zoom);
    }
    // Boats near seaports, planes over airports.
    for (const t of city.tiles) {
      if (!t.lot || t.lot.x !== t.x || t.lot.y !== t.y) continue;
      if (t.type === "seaport") {
        const a = time * 0.0004 + t.x;
        const p = this.project(t.x + t.lot.w / 2 + Math.cos(a) * 4, t.y + t.lot.h / 2 + Math.sin(a) * 4, 1);
        const tile = city.tiles[Math.floor(t.y + t.lot.h / 2 + Math.sin(a) * 4) * city.size + Math.floor(t.x + t.lot.w / 2 + Math.cos(a) * 4)];
        if (tile?.terrain === "water") {
          ctx.fillStyle = "#e9e6d8"; ctx.fillRect(p.x - 5 * this.zoom, p.y - 2 * this.zoom, 10 * this.zoom, 3 * this.zoom);
          ctx.fillStyle = "#5b6f7a"; ctx.fillRect(p.x - 2 * this.zoom, p.y - 4 * this.zoom, 3 * this.zoom, 2 * this.zoom);
        }
      } else if (t.type === "airport") {
        const a = time * 0.0005 + t.y;
        const p = this.project(t.x + 3 + Math.cos(a) * 9, t.y + 2 + Math.sin(a) * 6, 60 + Math.sin(a * 2) * 10);
        const s = this.project(t.x + 3 + Math.cos(a) * 9, t.y + 2 + Math.sin(a) * 6, 0);
        ctx.fillStyle = "#00000022"; ctx.beginPath(); ctx.ellipse(s.x, s.y, 5 * this.zoom, 2 * this.zoom, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#f2f2ec";
        ctx.fillRect(p.x - 6 * this.zoom, p.y - 1 * this.zoom, 12 * this.zoom, 2 * this.zoom);
        ctx.fillRect(p.x - 1 * this.zoom, p.y - 4 * this.zoom, 2 * this.zoom, 8 * this.zoom);
        if (this.night) { ctx.fillStyle = Math.floor(time / 400) % 2 ? "#ff6060" : "#f2f2ec"; ctx.fillRect(p.x - 7 * this.zoom, p.y - 1.5 * this.zoom, 2 * this.zoom, 2 * this.zoom); }
      }
    }

    ctx.drawImage(this.cache, 0, 0, this.w, this.h);
    if (this.night) {
      ctx.fillStyle = "#12253d45"; ctx.fillRect(0, 0, this.w, this.h);
      // Street lamps at intersections and every third road tile.
      if (this.zoom > 0.5) {
        for (let i = 0; i < city.tiles.length; i++) {
          const t = city.tiles[i];
          if ((t.type !== "road" && t.type !== "highway") || (t.x + t.y) % 3 !== 0) continue;
          const p = this.project(t.x + 0.5, t.y + 0.5, 0);
          if (p.x < -40 || p.x > this.w + 40 || p.y < -40 || p.y > this.h + 40) continue;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 22 * this.zoom);
          g.addColorStop(0, "rgba(255,214,140,0.28)"); g.addColorStop(1, "rgba(255,214,140,0)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.ellipse(p.x, p.y, 22 * this.zoom, 11 * this.zoom, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#ffe4a0"; ctx.fillRect(p.x - 0.8 * this.zoom, p.y - 12 * this.zoom, 1.6 * this.zoom, 1.6 * this.zoom);
        }
      }
    }

    // Neighbour names along the map edges.
    if (city._connections && this.zoom > 0.4) {
      const n = city.size;
      const spots = { north: [n / 2, -1.5], south: [n / 2, n + 1.5], west: [-1.5, n / 2], east: [n + 1.5, n / 2] };
      ctx.font = `700 ${Math.max(10, 12 * this.zoom)}px system-ui, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const [side, [x, y]] of Object.entries(spots)) {
        const c = city._connections[side];
        if (!c) continue;
        const p = this.project(x, y, 0);
        if (p.x < 0 || p.x > this.w || p.y < 0 || p.y > this.h) continue;
        const links = [c.road ? "road" : "", c.rail ? "rail" : "", c.power ? "power" : "", c.water ? "water" : ""].filter(Boolean).join(" · ");
        const label = `${c.name}${links ? " — " + links : ""}`;
        ctx.lineWidth = 3; ctx.strokeStyle = "#101820cc"; ctx.strokeText(label, p.x, p.y);
        ctx.fillStyle = links ? "#e8f0d8" : "#b8c4b0"; ctx.fillText(label, p.x, p.y);
      }
    }

    // Fires and smoke.
    for (const t of city.tiles) {
      if (!t.fire) continue;
      const w = t.lot?.w || 1, h = t.lot?.h || 1;
      this.platform = t.lot ? t.elev * ELEV_PX : null;
      for (let i = 0; i < w * h; i++) {
        const p = this.project(t.x + 0.5 + (i % w), t.y + 0.5 + Math.floor(i / w), heightOf(t) * 0.5);
        ctx.fillStyle = i % 2 ? "#e79731" : "#f2c14e";
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 5 * this.zoom, (8 + Math.sin(time * 0.012 + t.x + i) * 3) * this.zoom, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#5a5a5a66";
        ctx.beginPath(); ctx.ellipse(p.x + 3 * this.zoom, p.y - 18 * this.zoom - ((time * 0.02 + i * 7) % 20) * this.zoom, 7 * this.zoom, 5 * this.zoom, 0, 0, Math.PI * 2); ctx.fill();
      }
      this.platform = null;
    }

    // Flood water, tornado funnels, earthquake shake.
    for (const t of city.tiles) {
      if (!t.flooded) continue;
      const p = this.project(t.x + 0.5, t.y + 0.5, 0.6);
      if (p.x < -40 || p.x > this.w + 40 || p.y < -40 || p.y > this.h + 40) continue;
      this.flat(t.x, t.y, 1, 1, 0.6, `rgba(70,130,170,${0.35 + 0.1 * Math.sin(time * 0.003 + t.x)})`, null, ctx);
    }
    for (const e of city.effects || []) {
      if (e.type === "tornado") {
        const f = (time * 0.0005) % 1;
        const idx = Math.min(e.path.length - 1, Math.floor(f * e.path.length));
        const at = e.path[idx];
        const base = this.project(at.x + 0.5, at.y + 0.5, 0);
        for (let i = 0; i < 7; i++) {
          const w = (3 + i * 3.2) * this.zoom, y = base.y - i * 9 * this.zoom, wob = Math.sin(time * 0.02 + i) * 3 * this.zoom;
          ctx.fillStyle = `rgba(90,95,100,${0.55 - i * 0.05})`;
          ctx.beginPath(); ctx.ellipse(base.x + wob, y, w, w * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        }
      } else if (e.type === "earthquake") {
        this.shakeUntil = Math.max(this.shakeUntil || 0, time + 900);
      }
    }
    if (this.shakeUntil && time < this.shakeUntil) {
      const k = (this.shakeUntil - time) / 900;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, Math.sin(time * 0.09) * 6 * k * this.dpr, Math.cos(time * 0.11) * 4 * k * this.dpr);
      ctx.drawImage(this.ground, 0, 0, this.w, this.h);
      ctx.drawImage(this.cache, 0, 0, this.w, this.h);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    // Construction preview or hover.
    const preview = this.preview?.tiles;
    if (preview?.length) {
      for (const t of preview) {
        if (t.x < 0 || t.y < 0 || t.x >= city.size || t.y >= city.size) continue;
        const good = t.valid && !t.noop;
        this.flat(t.x, t.y, 1, 1, 1, t.noop ? "#d9d9a944" : good ? "#aad74977" : "#db513c99", t.noop ? "#e8e6c0" : good ? "#ecf29a" : "#ffc4a7", ctx);
      }
    } else if (this.hover && this.hover.x >= 0 && this.hover.y >= 0 && this.hover.x < city.size && this.hover.y < city.size) {
      const { x, y } = this.hover;
      this.flat(x, y, 1, 1, 1, this.tool === "bulldoze" ? "#d65e4166" : "#e9e6ae33", "#efecc0", ctx);
    }
  }
}
