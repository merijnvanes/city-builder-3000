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
const ROAD = new Set(["road", "rail"]);
const TILE_W = 32, TILE_H = 16;

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
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

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
  project(x, y, z = 0) {
    const p = this.orient(x, y);
    return { x: this.w * 0.45 + this.panX + (p.x - p.y) * TILE_W * this.zoom, y: this.h * 0.47 + this.panY + (p.x + p.y - (this.size || 64)) * TILE_H * this.zoom - z * this.zoom };
  }
  pick(sx, sy) {
    const dx = (sx - this.w * 0.45 - this.panX) / (TILE_W * this.zoom);
    const dy = (sy - this.h * 0.47 - this.panY) / (TILE_H * this.zoom) + (this.size || 64);
    const p = this.unorient((dx + dy) / 2, (dy - dx) / 2);
    return { x: Math.floor(p.x), y: Math.floor(p.y) };
  }
  zoomAt(delta, sx = this.w * 0.45, sy = this.h * 0.47) {
    const old = this.zoom;
    this.zoom = clamp(this.zoom * Math.exp(delta), this.minZoom, this.maxZoom);
    const k = this.zoom / old;
    this.panX = sx - this.w * 0.45 - (sx - this.w * 0.45 - this.panX) * k;
    this.panY = sy - this.h * 0.47 - (sy - this.h * 0.47 - this.panY) * k;
    this.dirty = true;
  }
  rotate(delta = 1) {
    const p = this.pick(this.w * 0.45, this.h * 0.47);
    this.rotation = ((this.rotation + delta) % 4 + 4) % 4;
    const target = this.project(p.x + 0.5, p.y + 0.5);
    this.pan(this.w * 0.45 - target.x, this.h * 0.47 - target.y);
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
  terrain(t, city) {
    const { x, y } = t, n = random(x, y), water = t.terrain === "water";
    const color = water ? ["#477e92", "#4b8396", "#528b9a", "#4c8390"][Math.floor(n * 4)]
      : t.terrain === "sand" ? ["#b3b17b", "#bdba88", "#aeb07d"][Math.floor(n * 3)]
      : ["#78904d", "#7c9550", "#829950", "#7c914b", "#759049"][Math.floor(n * 5)];
    this.flat(x, y, 1, 1, 0, color);
    if (!water && t.type === "empty" && !t.trees) for (let i = 0; i < 3; i++) { const a = random(x, y, i + 1), b = random(y, x, i + 7); this.flat(x + a * 0.85, y + b * 0.85, 0.1, 0.045, 0.05, "#a8ae642b"); }
    if (this.tool !== "inspect" && !water && this.zoom > 0.55) this.flat(x, y, 1, 1, 0.1, null, "#344b2833");
    if (!ROAD.has(t.type)) return;
    const isRail = t.type === "rail";
    const adjacent = (dx, dy) => city.tiles[(y + dy) * city.size + x + dx]?.type === t.type && x + dx >= 0 && y + dy >= 0 && x + dx < city.size && y + dy < city.size;
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

  heatColor(t) {
    const o = this.overlay;
    if (o === "power") return t.terrain === "water" ? null : t.powered ? "#dbe64488" : (t.lot || t.type !== "empty") ? "#db5b4088" : "#33333322";
    if (o === "water") return t.watered ? "#469bdbaa" : "#bd704588";
    if (o === "landvalue") return "hsla(" + (t.landValue * 1.2) + ",65%,48%,.65)";
    if (["police", "fire", "health", "education"].includes(o)) { const v = t.svc?.[o] || 0; return v ? "hsla(" + (60 + v * 0.6) + ",70%,50%," + (0.15 + v / 160) + ")" : "#2a2a2a55"; }
    if (o === "garbage") return null;
    const value = t[o] || 0;
    return "hsla(" + (120 - value * 1.2) + ",65%,48%,.65)";
  }

  // ── Static layer ──────────────────────────────────────────────
  paint(city) {
    this.size = city.size;
    const ctx = this.base;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.fillStyle = this.night ? "#233640" : "#526c60";
    ctx.fillRect(0, 0, this.w, this.h);

    const key = (t) => this.depthKey(t.x, t.y);
    this.sorted = [...city.tiles].sort((a, b) => key(a) - key(b));
    const visible = (x, y) => { const p = this.project(x, y); return p.x > -260 * this.zoom && p.x < this.w + 260 * this.zoom && p.y > -80 * this.zoom && p.y < this.h + 420 * this.zoom; };

    for (const t of this.sorted) if (visible(t.x + 0.5, t.y + 0.5)) this.terrain(t, city);

    // Shadows for every lot.
    for (const t of this.sorted) {
      if (!t.lot || t.lot.x !== t.x || t.lot.y !== t.y) continue;
      const h = heightOf(t);
      if (!h || !visible(t.x, t.y)) continue;
      const { w, h: d } = t.lot;
      const a = this.project(t.x + 0.15, t.y + 0.15), b = this.project(t.x + w - 0.15, t.y + 0.15), c = this.project(t.x + w - 0.15, t.y + d - 0.15), e = this.project(t.x + 0.15, t.y + d - 0.15);
      const dx = -h * 0.3 * this.zoom, dy = h * 0.15 * this.zoom;
      this.poly([a, b, c, { x: c.x + dx, y: c.y + dy }, { x: e.x + dx, y: e.y + dy }, e], "#26352539");
    }

    if (this.overlay !== "none") for (const t of this.sorted) { const c = this.heatColor(t); if (c) this.flat(t.x, t.y, 1, 1, 0.5, c); }
    const showPipes = this.overlay === "water" || this.tool === "pipe";
    if (showPipes) for (const t of this.sorted) if (t.pipe) this.pipe(t, city);

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
      if (it.kind === "lot" || it.kind === "zone") drawArchitecture(this, t);
      else if (it.kind === "trees") {
        const n = Math.floor(random(t.y, t.x) * 3);
        if (t.trees >= 1) this.tree(t.x + 0.35, t.y + 0.45, n);
        if (t.trees >= 2) this.tree(t.x + 0.72, t.y + 0.72, (n + 1) % 3);
        if (t.trees >= 3) this.tree(t.x + 0.7, t.y + 0.25, (n + 2) % 3);
      } else this.powerline(t, city);
    }
    ctx.globalAlpha = 1;
    this.lastRevision = city.revision;
    this.dirty = false;
  }

  // ── Frame ─────────────────────────────────────────────────────
  render(city, time) {
    if (this.dirty || city.revision !== this.lastRevision || this.size !== city.size) this.paint(city);
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

    // Cars: more on busy roads.
    if (this.overlay !== "water" && this.tool !== "pipe") {
      for (let i = 0; i < city.tiles.length; i++) {
        const t = city.tiles[i];
        if (t.type !== "road" || random(t.x, t.y, 9) > 0.18 + (t.traffic || 0) * 0.008) continue;
        const east = t.x + 1 < city.size && city.tiles[i + 1]?.type === "road", south = city.tiles[i + city.size]?.type === "road";
        if (!east && !south) continue;
        const vertical = south && (!east || i % 2 === 0), f = (time * 0.00016 + random(t.x, t.y)) % 1, back = i % 3 === 0;
        const a = back ? 1 - f : f, p = this.project(t.x + (vertical ? (back ? 0.68 : 0.32) : a), t.y + (vertical ? a : back ? 0.68 : 0.32), 2.1);
        if (p.x < -20 || p.x > this.w + 20 || p.y < -20 || p.y > this.h + 20) continue;
        const bus = i % 17 === 0;
        ctx.fillStyle = bus ? "#487b91" : ["#dfd3aa", "#ac5743", "#658694", "#d4c8af", "#445351"][i % 5];
        ctx.fillRect(p.x - 3 * this.zoom, p.y - 2 * this.zoom, (bus ? 9 : 6) * this.zoom, 3.5 * this.zoom);
        ctx.fillStyle = "#bcc9ba"; ctx.fillRect(p.x - this.zoom, p.y - 2 * this.zoom, 2 * this.zoom, this.zoom);
        if (this.night) { ctx.fillStyle = "#eddca0"; ctx.fillRect(p.x + 3 * this.zoom, p.y, 1.7 * this.zoom, this.zoom); }
      }
    }

    ctx.drawImage(this.cache, 0, 0, this.w, this.h);
    if (this.night) { ctx.fillStyle = "#12253d45"; ctx.fillRect(0, 0, this.w, this.h); }

    // Fires and smoke.
    for (const t of city.tiles) {
      if (!t.fire) continue;
      const w = t.lot?.w || 1, h = t.lot?.h || 1;
      for (let i = 0; i < w * h; i++) {
        const p = this.project(t.x + 0.5 + (i % w), t.y + 0.5 + Math.floor(i / w), heightOf(t) * 0.5);
        ctx.fillStyle = i % 2 ? "#e79731" : "#f2c14e";
        ctx.beginPath(); ctx.ellipse(p.x, p.y, 5 * this.zoom, (8 + Math.sin(time * 0.012 + t.x + i) * 3) * this.zoom, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#5a5a5a66";
        ctx.beginPath(); ctx.ellipse(p.x + 3 * this.zoom, p.y - 18 * this.zoom - ((time * 0.02 + i * 7) % 20) * this.zoom, 7 * this.zoom, 5 * this.zoom, 0, 0, Math.PI * 2); ctx.fill();
      }
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
