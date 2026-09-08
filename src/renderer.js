import { waterSurface } from './sim/surface-water.js';
import { EDGE_DIRECTIONS } from './sim/neighbor-links.js';
import { drawRail, drawTrain } from './rail-art.js';
import { withGroundClip } from './ground-effects.js';
import { civicSpriteSpec } from './civic-sprites.js';
import { drawMapBackdrop, drawBoat, drawOutageMarkers, drawAirplane } from "./scene-art.js";
// Isometric Canvas 2D renderer. Static ground and buildings are painted into
// a cache whenever the city revision changes; animated cars, water sparkle,
// fires and the construction preview are drawn every frame on top.
import { drawCachedArchitecture, hitUncachedArchitecture } from "./architecture-cache.js";
import { drawArchitecture, heightOf, random } from "./building-art.js";
import { BUILDINGS, PORT_TYPES, carriesRoute } from "./sim/catalog.js";
import { drawTree } from "./foliage.js";
import { surfaceColor, drawShoreline } from "./terrain-art.js";
import { drawStreet, drawViaduct, hasStreetLamp, drawStreetLamp, drawVehicle, tunnelPortal, drawTunnelMouth } from "./street-art.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  return "rgb(" + [n >> 16, (n >> 8) & 255, n & 255].map((v) => clamp(v * k, 0, 255) | 0).join(",") + ")";
};
const ROAD = new Set(["road", "rail", "highway", "onramp"]);
const ZONE_TINT = {
  residential: { fill: "#7ed05a77", edge: "#dcf7b0" },
  commercial: { fill: "#5aa0e077", edge: "#c8e4ff" },
  industrial: { fill: "#e0c04a77", edge: "#fff0b0" },
  airport: { fill: "#9aa2b077", edge: "#dfe4ec" },
  seaport: { fill: "#4fa8b077", edge: "#c4ecef" },
};
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
    // A city view can be turned, and each angle is a different set of sprites.
    // Say so, and the sprite cache warms the other three while the browser is
    // idle. Portraits and offscreen probes build renderers without this
    // constructor and stay lean, because they never rotate.
    this.warmRotations = true;
    this.corners = null; this.platform = null; this.tiles = null;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  get size() { return this._size || 64; }
  set size(value) {
    if (this._size !== value) { this.corners = null; this.tiles = null; }
    this._size = value;
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
    const tx=Math.max(0,Math.min(this.size-1,Math.floor(x))),ty=Math.max(0,Math.min(this.size-1,Math.floor(y)));
    const tile=this.tiles?.[ty*this.size+tx];
    if(x>=0 && y>=0 && x<=this.size && y<=this.size && tile?.terrain==='water')return waterSurface(tile)*ELEV_PX;
    return this.meshZ(x,y);
  }
  meshZ(x,y) {
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
          const tile=city.tiles[ty*n+tx];
          sum += tile.terrain==='water'?waterSurface(tile):(tile.elev || 0); count++;
        }
        c[vy * w + vx] = count ? (sum / count) * ELEV_PX : 0;
      }
    }
    const boundary = [];
    for (let i = 0; i <= n; i++) boundary.push(c[i], c[n * w + i], c[i * w], c[i * w + n]);
    for(let i=0;i<n;i++)for(const index of [i,(n-1)*n+i,i*n,i*n+n-1]) {
      const t=city.tiles[index];boundary.push(t.terrain==='water'?waterSurface(t):t.elev);
    }
    const boundaryKey = boundary.join(',');
    if (boundaryKey !== this.terrainBoundaryKey) this.terrainBoundaryRevision = (this.terrainBoundaryRevision || 0) + 1;
    this.terrainBoundaryKey = boundaryKey;
    this.corners = c;
    this.cornerRevision = city.revision;
    this.tiles = city.tiles;
  }
  project(x, y, z = 0) {
    const p = this.orient(x, y);
    return { x: this.cx + this.panX + (p.x - p.y) * TILE_W * this.zoom, y: this.cy + this.panY + (p.x + p.y - (this.size || 64)) * TILE_H * this.zoom - (z + this.groundZ(x, y)) * this.zoom };
  }
  projectGround(x, y) {
    const platform = this.platform;
    this.platform = null;
    try { return this.project(x, y); }
    finally { this.platform = platform; }
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
  // Front-to-back alpha picking selects the visible roof or facade, rather
  // than the ground tile several blocks behind a tall building.
  pickObject(sx, sy) {
    if (this.dirty || !this.pickables || this.overlay === "water" || ["pipe", "subway", "substation"].includes(this.tool)) return this.pick(sx, sy);
    for (let i = this.pickables.length - 1; i >= 0; i--) {
      const hit = this.pickables[i];
      if (!hit.t.lot || sx < hit.x || sy < hit.y || sx >= hit.x + hit.w || sy >= hit.y + hit.h) continue;
      let opaque;
      if (hit.canvas) {
        const px = Math.min(hit.canvas.width - 1, Math.floor((sx - hit.x) / hit.w * hit.canvas.width));
        const py = Math.min(hit.canvas.height - 1, Math.floor((sy - hit.y) / hit.h * hit.canvas.height));
        opaque = hit.canvas.getContext("2d").getImageData(px, py, 1, 1).data[3] > 24;
      } else opaque = hitUncachedArchitecture(this, hit.t, sx, sy);
      if (opaque) return { x: hit.t.x, y: hit.t.y };
    }
    return this.pick(sx, sy);
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
      const top = Math.min(...face.points.map(p => p.y)), bottom = Math.max(...face.points.map(p => p.y));
      const light = this.base.createLinearGradient(0, top, 0, Math.max(top + 1, bottom));
      light.addColorStop(0, shade(color, left ? 0.78 : 1.02));
      light.addColorStop(1, shade(color, left ? 0.57 : 0.79));
      this.poly(face.points, light);
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
  tree(x, y, n = 0) { drawTree(this, x, y, n); }
  windows(x, y, w, d, h, seed, glass = false, base = 0, lit = true, floorHeight = 8) {
    if (this.zoom < 0.5) return;
    const faces = this.faces(x, y, w, d, h, base);
    const sill = Math.min(3, floorHeight * 0.35), paneHeight = Math.min(3.3, floorHeight * 0.5);
    const rows = Math.max(1, Math.floor((h - sill - paneHeight) / floorHeight) + 1);
    for (const face of faces) {
      const alongX = face.name === "south" || face.name === "north", length = alongX ? w : d, cols = Math.max(1, Math.min(7, Math.floor(length * 7)));
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const z = base + sill + row * floorHeight, offset = 0.055 + col * (length - 0.1) / cols, span = ((length - 0.12) / cols) * 0.66;
          const a = alongX ? x + offset : face.name === "east" ? x + w + 0.002 : x - 0.002;
          const b = alongX ? (face.name === "south" ? y + d + 0.002 : y - 0.002) : y + offset;
          const on = this.night && lit && random(seed + row, col) > 0.35;
          const reflect = row / Math.max(1, rows - 1);
          const color = on ? (random(seed, row, col) > 0.6 ? "#ffe5aa" : "#d8b97c") : glass ? shade("#85b2c1", (0.48 + reflect * 0.5 + random(seed, col) * 0.12) * (this.night ? 0.42 : 1)) : this.night ? "#223039" : "#3d5359";
          const points = [this.project(a, b, z + paneHeight), this.project(a + (alongX ? span : 0), b + (alongX ? 0 : span), z + paneHeight), this.project(a + (alongX ? span : 0), b + (alongX ? 0 : span), z), this.project(a, b, z)];
          this.poly(points, color);
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
    const platform=this.platform;
    this.platform=t.terrain==='water'?waterSurface(t)*ELEV_PX:null;
    try { this.paintTerrain(t,city); }
    finally { this.platform=platform; }
  }
  paintTerrain(t, city) {
    const { x, y } = t, water = t.terrain === "water";
    let color = this.surfaceColors?.[y * city.size + x] || surfaceColor(t, city);
    if (!water) {
      const k = this.slopeShade(x, y);
      if (k !== 1) color = shade(color, k);
      else if (t.elev >= 5) color = shade(color, 1 + (t.elev - 4) * 0.03);
    }
    this.flat(x, y, 1, 1, 0, color);
    if (water) drawShoreline(this, t, city);
    if (!water && t.type === "empty" && !t.trees) for (let i = 0; i < 3; i++) { const a = random(x, y, i + 1), b = random(y, x, i + 7); this.flat(x + a * 0.85, y + b * 0.85, 0.1, 0.045, 0.05, "#a8ae642b"); }
    if (this.tool !== "inspect" && !water && this.zoom > 0.55) this.flat(x, y, 1, 1, 0.1, null, "#344b2833");
    if (!ROAD.has(t.type)) return;
    // A viaduct is two surfaces: the street it was built over, then the deck.
    if (t.under === 1) { drawStreet(this, t, city, { as: "road" }); drawViaduct(this, t, city); return; }
    if (t.under === 2) {
      if (t.type === "road") { drawStreet(this, t, city); this.railBed(t, city, true); }
      else { this.railBed(t, city); drawViaduct(this, t, city); }
      return;
    }
    if (t.type !== "rail") {
      drawStreet(this, t, city);
      const portal = tunnelPortal(t, city);
      if (portal) drawTunnelMouth(this, t, city, portal);
      return;
    }
    this.railBed(t, city);
  }

  // Sleepers, ballast and rails on a track tile.
  railBed(t, city, crossing = false) {
    drawRail(this, t, city, { crossing });
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
    // Contaminated ground reads as a sickly green wherever pollution is shown.
    if (o === "pollution" && t.radiation) return "hsla(96,90%,45%,.75)";
    // Same red-to-green ramp as land value, so the two maps read alike.
    if (o === "aura") return "hsla(" + ((t.aura ?? 50) * 1.2) + ",62%,50%,.55)";
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
    this.poly(flatPts, t.terrain === "sand" ? "#b7b487" : t.terrain === "rock" ? "#615a53" : "#7c914b");
  }

  // ── Static layer ──────────────────────────────────────────────
  paint(city) {
    this.paintEpoch = (this.paintEpoch || 0) + 1;
    this.pickables = [];
    this.size = city.size;
    if (!this.corners || this.tiles !== city.tiles || city.revision !== this.cornerRevision) this.buildCorners(city);
    const ctx = this.base;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    drawMapBackdrop(this, city);

    // Terrain order only depends on the grid and orientation, not camera motion.
    if (this.sortedTiles !== city.tiles || this.sortedRotation !== this.rotation) {
      this.sorted = city.tiles.map(t => ({ t, k: this.depthKey(t.x, t.y) }))
        .sort((a, b) => a.k - b.k).map(entry => entry.t);
      this.sortedTiles = city.tiles; this.sortedRotation = this.rotation;
    }
    if (this.colorTiles !== city.tiles || this.colorRevision !== city.revision) {
      const terrainChanged = this.colorTiles !== city.tiles || this.colorSeed !== city.seed ||
        city.tiles.some((t, i) => this.colorTerrain[i] !== t.terrain);
      if (terrainChanged) {
        this.surfaceColors = city.tiles.map(t => surfaceColor(t, city));
        this.colorTerrain = city.tiles.map(t => t.terrain);
        this.colorSeed = city.seed;
      }
      this.colorTiles = city.tiles; this.colorRevision = city.revision;
    }
    const visible = (x, y) => { const p = this.project(x, y); return p.x > -260 * this.zoom && p.x < this.w + 260 * this.zoom && p.y > -80 * this.zoom && p.y < this.h + 420 * this.zoom; };

    for (const t of this.sorted) if (visible(t.x + 0.5, t.y + 0.5)) this.terrain(t, city);

    // All platforms precede cast shadows, so adjacent lots cannot erase them.
    for (const t of this.sorted) {
      if (t.lot?.x === t.x && t.lot?.y === t.y && visible(t.x, t.y)) this.platformFor(t);
      this.platform = null;
    }
    // Shadows for every lot share one clip.
    withGroundClip(this, () => {
    for (const t of this.sorted) {
      if (!t.lot || t.lot.x !== t.x || t.lot.y !== t.y) continue;
      if (!visible(t.x, t.y)) continue;
      this.platform = t.elev * ELEV_PX;
      const h = heightOf(t);
      if (h) {
        const { w, h: d } = t.lot;
        const a = this.project(t.x + 0.15, t.y + 0.15), b = this.project(t.x + w - 0.15, t.y + 0.15), c = this.project(t.x + w - 0.15, t.y + d - 0.15), e = this.project(t.x + 0.15, t.y + d - 0.15);
        const authored = civicSpriteSpec(t);
        const dx = (authored ? 1 : -1) * h * 0.3 * this.zoom, dy = h * 0.15 * this.zoom;
        let shadow = [a, b, c, { x: c.x + dx, y: c.y + dy }, { x: e.x + dx, y: e.y + dy }, e];
        if (authored) {
          // New civic assets establish a soft upper-left key light. Extrude
          // the screen-right edge regardless of the map's current rotation.
          const corners = [a, b, c, e].sort((p, q) => p.y - q.y);
          const [left, right] = corners.slice(1, 3).sort((p, q) => p.x - q.x);
          const top = corners[0], bottom = corners[3];
          shadow = [top, right, { x: right.x + dx, y: right.y + dy }, { x: bottom.x + dx, y: bottom.y + dy }, bottom, left];
        }
        this.poly(shadow, this.night ? "#12202f22" : "#203a4a45");
      }
      this.platform = null;
    }

    });

    if (this.night) {
      ctx.fillStyle = '#10284288'; ctx.fillRect(0, 0, this.w, this.h);
    }
    if (this.night && this.zoom > 0.5) withGroundClip(this, () => {
      for (const t of this.sorted) if (hasStreetLamp(t) && visible(t.x, t.y)) drawStreetLamp(this, t, true);
    });

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

    this.paintingSolids = true;
    // Buildings, trees and poles sorted by their front-most corner.
    if (this.itemTiles !== city.tiles || this.itemRevision !== city.revision || this.itemRotation !== this.rotation) {
      const items = [];
    for (const t of city.tiles) {
      if (t.lot) {
        if (t.lot.x === t.x && t.lot.y === t.y) items.push({ k: this.depthKey(t.x, t.y, t.lot.w, t.lot.h), t, kind: "lot" });
      } else if (t.type !== "empty" && !ROAD.has(t.type)) {
        items.push({ k: this.depthKey(t.x, t.y), t, kind: "zone" });
      } else if (t.type === "empty" && t.trees) {
        items.push({ k: this.depthKey(t.x, t.y), t, kind: "trees" });
      }
      if (hasStreetLamp(t)) items.push({ k: this.depthKey(t.x, t.y) - 0.8, t, kind: "lamp" });
      if (t.powerline) items.push({ k: this.depthKey(t.x, t.y) + 0.01, t, kind: "pole" });
    }
    items.sort((a, b) => a.k - b.k || a.t.x - b.t.x);
      this.flightAltitude = items.reduce((height, it) => it.kind === "lot" ? Math.max(height, heightOf(it.t) * 1.7 + 80 + it.t.elev * ELEV_PX) : height, 210);
      this.outages = items.filter(it => it.kind === "lot" && !it.t.powered && !it.t.abandoned && (ZONE_TINT[it.t.type] || BUILDINGS[it.t.type]?.powerUse))
        .map(it => ({ t: it.t, height: heightOf(it.t) }));
      this.items = items; this.itemTiles = city.tiles; this.itemRevision = city.revision; this.itemRotation = this.rotation;
    }
    const items = this.items;
    for (const it of items) {
      const t = it.t;
      if (!visible(t.x + (t.lot?.w || 1) / 2, t.y + (t.lot?.h || 1) / 2)) continue;
      if (it.kind === "lot") { this.platform = t.elev * ELEV_PX; drawCachedArchitecture(this, t, city); this.platform = null; }
      else if (it.kind === "zone") drawArchitecture(this, t);
      else if (it.kind === "trees") {
        const n = Math.floor(random(t.y, t.x) * 3);
        const jx = random(t.x, t.y, 11) * 0.4, jy = random(t.x, t.y, 12) * 0.4;
        if (t.trees >= 1) this.tree(t.x + 0.2 + jx, t.y + 0.3 + jy, n);
        if (t.trees >= 2) this.tree(t.x + 0.55 + jy * 0.8, t.y + 0.6 + jx * 0.8, (n + 1) % 3);
        if (t.trees >= 3) this.tree(t.x + 0.65 - jx * 0.5, t.y + 0.15 + jy * 0.5, (n + 2) % 3);
      } else if (it.kind === "lamp") { if (this.zoom > 0.5) drawStreetLamp(this, t); }
      else this.powerline(t, city);
    }
    this.paintingSolids = false;
    ctx.globalAlpha = 1;
    this.lastRevision = city.revision;
    this.dirty = false;
  }

  // ── Frame ─────────────────────────────────────────────────────
  shakeOffset(city, now) {
    if (this.shakeCity !== city) {
      this.shakeCity = city; this.seenQuakes = new WeakSet(); this.shakeUntil = 0;
    }
    for (const effect of city.effects || []) {
      if (effect.type !== "earthquake" || this.seenQuakes.has(effect)) continue;
      this.seenQuakes.add(effect); this.shakeUntil = now + 900;
    }
    const k = Math.max(0, (this.shakeUntil - now) / 900);
    return { x: Math.sin(now * 0.09) * 6 * k, y: Math.cos(now * 0.11) * 4 * k };
  }

  render(city, time, now = performance.now()) {
    if (this.dirty || city.revision !== this.lastRevision || this.size !== city.size || this.tiles !== city.tiles) this.paint(city);
    const ctx = this.ctx;
    // Shake the whole scene once, using real time even when the city is paused.
    const shake = this.shakeOffset(city, now);
    const dx = shake.x * this.dpr, dy = shake.y * this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (dx || dy) {
      ctx.fillStyle = this.night ? "#233640" : "#526c60";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    ctx.drawImage(this.ground, dx, dy);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, dx, dy);

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
        const east = t.x + 1 < city.size && carriesRoute(city.tiles[i + 1], hw ? "highway" : "road"), south = carriesRoute(city.tiles[i + city.size], hw ? "highway" : "road");
        if (!east && !south) continue;
        const vertical = south && (!east || i % 2 === 0), f = (time * (hw ? 0.0003 : 0.00016) + random(t.x, t.y)) % 1, back = i % 3 === 0;
        const a = back ? 1 - f : f, p = this.project(t.x + (vertical ? (back ? 0.68 : 0.32) : a), t.y + (vertical ? a : back ? 0.68 : 0.32), 2.1);
        if (p.x < -20 || p.x > this.w + 20 || p.y < -20 || p.y > this.h + 20) continue;
        const bus = i % 17 === 0;
        drawVehicle(this, t.x + (vertical ? (back ? 0.68 : 0.32) : a), t.y + (vertical ? a : back ? 0.68 : 0.32), vertical, back, bus ? "#4f9db1" : ["#e9dfbc", "#c5684e", "#739bab", "#e6e4d7", "#dfb45b"][i % 5], bus);
      }
    }

    // Trains on busy rails.
    for (let i = 0; i < city.tiles.length; i++) {
      const t = city.tiles[i];
      if (!carriesRoute(t, "rail") || !t.traffic || random(t.x, t.y, 5) > 0.12) continue;
      const f = (time * 0.0002 + random(t.x, t.y, 6)) % 1;
      const p = this.project(t.x + .5, t.y + .5, 3);
      if (p.x < -20 || p.x > this.w + 20 || p.y < -20 || p.y > this.h + 20) continue;
      drawTrain(this, t, city, f);
    }
    // Surface traffic remains below buildings; cruising aircraft are above them.
    const aircraft = [];
    for (const t of city.tiles) {
      if (!t.lot || t.lot.x !== t.x || t.lot.y !== t.y) continue;
      if (t.type === "seaport") {
        const a = time * 0.0004 + t.x;
        const x = t.x + t.lot.w / 2 + Math.cos(a) * 4, y = t.y + t.lot.h / 2 + Math.sin(a) * 4;
        const tx = Math.floor(x), ty = Math.floor(y);
        const tile = tx >= 0 && ty >= 0 && tx < city.size && ty < city.size ? city.tiles[ty * city.size + tx] : null;
        if (tile?.terrain === "water" && !ROAD.has(tile.type)) drawBoat(this, x, y, a + Math.PI / 2, time, t.x);
      } else if (t.type === "airport") {
        const a = time * 0.00028 + t.y;
        const x = t.x + 3 + Math.cos(a) * 9, y = t.y + 2 + Math.sin(a) * 6;
        const p = this.project(x, y, this.flightAltitude + Math.sin(a * 2) * 8);
        const next = this.project(x - Math.sin(a) * 0.09, y + Math.cos(a) * 0.06, this.flightAltitude + Math.sin(a * 2) * 8);
        const shadow = this.project(x, y);
        withGroundClip(this, () => { ctx.fillStyle = "#20333d22"; ctx.beginPath(); ctx.ellipse(shadow.x, shadow.y, 7 * this.zoom, 2.5 * this.zoom, 0, 0, Math.PI * 2); ctx.fill(); }, ctx);
        aircraft.push({ p, heading: Math.atan2(next.y - p.y, next.x - p.x) });
      }
    }

    ctx.drawImage(this.cache, 0, 0, this.w, this.h);
    for (const plane of aircraft) drawAirplane(this, plane.p, plane.heading, time);

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

    // Purchased endpoints have a sign and an outward arrow on the route.
    for (const link of city.transportConnections || []) {
      const [dx,dy]=EDGE_DIRECTIONS[link.side],x=link.x+.5+dx*.35,y=link.y+.5+dy*.35;
      const p=this.project(x,y,10),foot=this.project(x,y,0);
      this.line(foot,p,'#dae2bf',1,ctx);
      ctx.fillStyle='#245a43';ctx.fillRect(p.x-8*this.zoom,p.y-5*this.zoom,16*this.zoom,10*this.zoom);
      const direction=this.project(x+dx*.2,y+dy*.2,10);
      const length=Math.hypot(direction.x-p.x,direction.y-p.y),ux=(direction.x-p.x)/length,uy=(direction.y-p.y)/length;
      const a={x:p.x-ux*5*this.zoom,y:p.y-uy*5*this.zoom},b={x:p.x+ux*5*this.zoom,y:p.y+uy*5*this.zoom};
      this.line(a,b,'#f3dfa2',1.5,ctx);
      for(const side of [-1,1]) this.line(b,{x:b.x-ux*4*this.zoom-uy*side*3*this.zoom,y:b.y-uy*4*this.zoom+ux*side*3*this.zoom},'#f3dfa2',1.2,ctx);
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

    // Flood water, tornado funnels, saucers, lava, toxic clouds.
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
      } else if (e.type === "ufo") {
        const z = this.zoom, f = (time * 0.0004) % 1;
        const idx = Math.min(e.path.length - 1, Math.floor(f * e.path.length));
        const at = e.path[idx];
        const p = this.project(at.x + 0.5, at.y + 0.5, 72 + Math.sin(time * 0.004) * 4), g = this.project(at.x + 0.5, at.y + 0.5, 0);
        if (idx % 3 === 2) {
          ctx.fillStyle = `rgba(170,255,200,${0.22 + 0.1 * Math.sin(time * 0.03)})`;
          ctx.beginPath(); ctx.moveTo(p.x - 5 * z, p.y); ctx.lineTo(p.x + 5 * z, p.y); ctx.lineTo(g.x + 18 * z, g.y + 4 * z); ctx.lineTo(g.x - 18 * z, g.y + 4 * z); ctx.closePath(); ctx.fill();
        }
        withGroundClip(this, () => { ctx.fillStyle = "#00000022"; ctx.beginPath(); ctx.ellipse(g.x, g.y + 2 * z, 18 * z, 6 * z, 0, 0, Math.PI * 2); ctx.fill(); }, ctx);
        ctx.fillStyle = "#59616d"; ctx.beginPath(); ctx.ellipse(p.x, p.y + 2 * z, 28 * z, 8 * z, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#7d8794"; ctx.beginPath(); ctx.ellipse(p.x, p.y, 28 * z, 8 * z, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = "#b7cad9"; ctx.beginPath(); ctx.ellipse(p.x, p.y - 5 * z, 11 * z, 7.5 * z, 0, Math.PI, 0); ctx.fill();
        for (let i = 0; i < 8; i++) {
          const a = i * 0.785 + time * 0.003;
          ctx.fillStyle = Math.floor(time / 180 + i) % 3 ? "#f2d36b" : "#ff6b6b";
          ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 22 * z, p.y + Math.sin(a) * 6 * z + 2 * z, 1.8 * z, 0, Math.PI * 2); ctx.fill();
        }
      } else if (e.type === "lava") {
        const z = this.zoom;
        for (let dy = -e.radius; dy <= e.radius; dy++) for (let dx = -e.radius; dx <= e.radius; dx++) {
          const x = e.x + dx, y = e.y + dy;
          if (x < 0 || y < 0 || x >= city.size || y >= city.size) continue;
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          const a = (0.75 - d * 0.18) * (0.8 + 0.2 * Math.sin(time * 0.004 + dx * 1.7 + dy * 2.3));
          this.flat(x, y, 1, 1, 0.6, `rgba(255,${110 - d * 20},30,${Math.max(0.1, a)})`, null, ctx);
        }
        const top = this.project(e.x + 0.5, e.y + 0.5, 4);
        for (let i = 0; i < 6; i++) {
          const rise = ((time * 0.03 + i * 17) % 90);
          ctx.fillStyle = `rgba(70,60,55,${0.5 - rise / 200})`;
          ctx.beginPath(); ctx.ellipse(top.x + Math.sin(i * 2 + time * 0.002) * 6 * z, top.y - rise * z * 0.8, (8 + rise * 0.25) * z, (5 + rise * 0.15) * z, 0, 0, Math.PI * 2); ctx.fill();
        }
      } else if (e.type === "riot") {
        // The block that is out of hand, and a crowd milling about in it, so
        // the mayor can see where a patrol car has to go.
        const z = this.zoom, reach = 3;
        const pulse = 0.16 + 0.06 * Math.sin(time * 0.004);
        for (let dy = -reach; dy <= reach; dy++) {
          for (let dx = -reach; dx <= reach; dx++) {
            if (Math.abs(dx) + Math.abs(dy) > reach) continue;
            // Onto the live overlay, not the cache: this repaints every frame.
            this.flat(e.x + dx, e.y + dy, 1, 1, 0.45, `rgba(214,72,58,${pulse})`, null, ctx);
          }
        }
        for (let i = 0; i < 34; i++) {
          const a = i * 2.4 + time * 0.0012 * (i % 2 ? 1 : -1), d = 0.4 + (i % 6) * 0.45;
          const bob = (i + Math.floor(time / 180)) % 2;
          const p = this.project(e.x + 0.5 + Math.cos(a) * d, e.y + 0.5 + Math.sin(a) * d, 1 + bob);
          ctx.fillStyle = ["#3a3f46", "#7a4c42", "#4a5560", "#6b5a44"][i % 4];
          ctx.fillRect(p.x - 1.1 * z, p.y - 6 * z, 2.2 * z, 6 * z);
          ctx.fillStyle = "#c9a98a";
          ctx.fillRect(p.x - 1.1 * z, p.y - 8 * z, 2.2 * z, 2 * z);
        }
      } else if (e.type === "toxic") {
        const z = this.zoom, c = this.project(e.x + 0.5, e.y + 0.5, 16);
        for (let i = 0; i < 16; i++) {
          const a = i * 0.39 + time * 0.0006, r = (20 + (i % 5) * 16) * z;
          ctx.fillStyle = `rgba(${150 + (i % 2) * 30},${190 + (i % 3) * 20},60,${0.42 + 0.1 * Math.sin(time * 0.002 + i)})`;
          ctx.beginPath(); ctx.ellipse(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.45 - (i % 3) * 6 * z, (20 + (i % 5) * 5) * z, (11 + (i % 3) * 3) * z, 0, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    drawOutageMarkers(this, time);

    // Construction preview or hover.
    const preview = this.preview?.tiles;
    if (preview?.length) {
      const zone = ZONE_TINT[this.preview.tool];
      // Zoning: show the lot grid the zone will split into. A port takes the
      // whole block as one lot, so it gets no grid.
      const lot = zone && !PORT_TYPES.has(this.preview.tool)
        ? (this.preview.tool === "industrial" && this.preview.density === 1 ? 3 : this.preview.density) : 1;
      for (const t of preview) {
        if (t.x < 0 || t.y < 0 || t.x >= city.size || t.y >= city.size) continue;
        const good = t.valid && !t.noop;
        const edge = t.noop ? "#e8e6c0" : good ? (zone ? (lot > 1 ? zone.fill : zone.edge) : "#ecf29a") : "#ffc4a7";
        this.flat(t.x, t.y, 1, 1, 1, t.noop ? "#d9d9a944" : good ? (zone ? zone.fill : "#aad74977") : "#db513c99", edge, ctx);
      }
      if (lot > 1) {
        const good = preview.filter((t) => t.valid && !t.noop);
        if (good.length) {
          const x0 = Math.min(...good.map((t) => t.x)), x1 = Math.max(...good.map((t) => t.x)) + 1;
          const y0 = Math.min(...good.map((t) => t.y)), y1 = Math.max(...good.map((t) => t.y)) + 1;
          for (let x = x0; x <= x1; x += lot) this.line(this.project(x, y0, 1.2), this.project(x, y1, 1.2), zone.edge, 1.8, ctx);
          for (let y = y0; y <= y1; y += lot) this.line(this.project(x0, y, 1.2), this.project(x1, y, 1.2), zone.edge, 1.8, ctx);
          if ((x1 - x0) % lot) this.line(this.project(x1, y0, 1.2), this.project(x1, y1, 1.2), zone.edge, 1.8, ctx);
          if ((y1 - y0) % lot) this.line(this.project(x0, y1, 1.2), this.project(x1, y1, 1.2), zone.edge, 1.8, ctx);
        }
      }
    } else if (this.hover && this.hover.x >= 0 && this.hover.y >= 0 && this.hover.x < city.size && this.hover.y < city.size) {
      const { x, y } = this.hover;
      const tile = city.tiles[y * city.size + x];
      if (this.tool === "inspect" && tile.lot) {
        this.platform = city.tiles[tile.lot.y * city.size + tile.lot.x].elev * ELEV_PX;
        this.flat(tile.lot.x, tile.lot.y, tile.lot.w, tile.lot.h, 1, null, "#fff0bd", ctx);
        this.platform = null;
      } else this.flat(x, y, 1, 1, 1, this.tool === "bulldoze" ? "#d65e4166" : "#e9e6ae33", "#efecc0", ctx);
    }
  }
}
