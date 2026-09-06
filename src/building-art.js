// Original procedural architecture for every lot. A recipe draws into the
// lot rectangle using fractions of its width/depth, so the same recipe fits
// 1×1, 2×2 and 3×3 lots. Heights are in renderer z units (≈ pixels at zoom 1).
export const random = (x, y, n = 0) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + n * 73.3) * 43758.5453;
  return v - Math.floor(v);
};
const pick = (list, n) => list[Math.floor(n * list.length) % list.length];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Approximate roof height for depth sorting, shadows and fire markers.
export function heightOf(t) {
  const lot = t.lot;
  if (!lot) return 0;
  const level = t.level || 1;
  if (t.type === "residential") return t.density === 1 ? 10 + level * 3 : t.density === 2 ? 18 + level * 6 : 30 + level * 18;
  if (t.type === "commercial") return t.density === 1 ? 10 + level * 2 : t.density === 2 ? 20 + level * 7 : 40 + level * 24;
  if (t.type === "industrial") return t.density === 1 ? 12 : t.density === 2 ? 18 : 26;
  return { coal: 46, oil: 34, gas: 30, nuclear: 60, wind: 42, solar: 6, waterpump: 10, watertower: 47, treatment: 14,
    police: 24, fire: 21, hospital: 40, school: 22, college: 30, library: 18, museum: 26, landfill: 6, incinerator: 40, recycling: 16,
    park: 14, largepark: 16, zoo: 14, bus: 9, railstation: 16, airport: 18, seaport: 16, substation: 8,
    mayorhouse: 24, cityhall: 46, courthouse: 27, stadium: 30, statue: 25, prison: 20, casino: 36, toxicdump: 10, armybase: 14,
    clocktower: 61, operahouse: 38, observatory: 34, cathedral: 60, aquarium: 22 }[t.type] || 12;
}

// Scaled drawing helpers for one lot.
function scoped(r, lot, dim) {
  const { x, y, w, h } = lot;
  const s = (a, b) => [x + a * w, y + b * h];
  const k = dim ? 0.55 : 1;
  const tone = (c) => (dim ? shadeHex(c, k) : c);
  return {
    w, h, x, y,
    flat: (a, b, fw, fd, z, c, stroke) => r.flat(x + a * w, y + b * h, fw * w, fd * h, z, tone(c), stroke),
    box: (a, b, fw, fd, hh, c, z = 0) => r.box(x + a * w, y + b * h, fw * w, fd * h, hh, tone(c), z),
    roof: (a, b, fw, fd, z, hh, c) => r.roof(x + a * w, y + b * h, fw * w, fd * h, z, hh, tone(c)),
    cyl: (a, b, radius, hh, c, z = 0) => r.cylinder(x + a * w, y + b * h, radius * Math.min(w, h), hh, tone(c), z),
    tree: (a, b, n = 0) => r.tree(x + a * w, y + b * h, n),
    fence: (a, b, fw, fd, c) => r.fence(x + a * w, y + b * h, fw * w, fd * h, tone(c)),
    line: (a, b, z, a2, b2, z2, c, width = 1) => r.line(r.project(x + a * w, y + b * h, z), r.project(x + a2 * w, y + b2 * h, z2), tone(c), width),
    windows: (a, b, fw, fd, hh, seed, glass = false, z = 0, lit = !dim) => r.windows(x + a * w, y + b * h, fw * w, fd * h, hh, seed, glass, z, lit),
    bands: (a, b, fw, fd, from, to, step, c) => { for (let z = from; z < to; z += step) for (const f of r.faces(x + a * w, y + b * h, fw * w, fd * h, 0, z)) r.line(f.points[0], f.points[1], tone(c), 1); },
    pt: (a, b, z = 0) => r.project(x + a * w, y + b * h, z),
  };
}

function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => clamp(v * k, 0, 255) | 0);
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}

const WALLS = ["#d0b690", "#c2b69c", "#d8c6a6", "#a69583", "#c1baa5", "#d8c4b0", "#e0d2b8", "#b9a98f"];
const BRICKS = ["#aa8066", "#987864", "#b29b80", "#ad9984", "#998981", "#8f6a55"];
const ROOFS = ["#8c543c", "#555a56", "#8b7961", "#6e4b3c", "#a0774e", "#4f5f6b", "#7a4a3a"];
const GLASS = ["#527a87", "#648d96", "#56746e", "#738d87", "#648491", "#879b9a", "#4d6f8a"];
const STONE = ["#b4b3a0", "#c4b9a1", "#b4a88d", "#d0c9b4", "#9eaba5", "#c9c1ad"];

// ── Zones ─────────────────────────────────────────────────────────────────────
function residential(d, t, n, level, r) {
  const density = t.density;
  const wall = pick(WALLS, n), brick = pick(BRICKS, n), roof = pick(ROOFS, n * 7);
  d.flat(0.03, 0.03, 0.94, 0.94, 0.2, "#6f8845");
  if (density === 1) {
    // Detached homes: level grows the house and adds a garage, porch, pool.
    const fam = Math.floor(n * 4);
    const hw = 0.42 + level * 0.06, hd = 0.4 + level * 0.05;
    const hx = fam % 2 ? 0.12 : 0.5 - hw / 2, hy = 0.12;
    const stories = level >= 3 ? 2 : 1, hh = 9 * stories + 2;
    d.box(hx, hy, hw, hd, hh, wall);
    d.roof(hx - 0.03, hy - 0.03, hw + 0.06, hd + 0.06, hh, 6 + level, roof);
    d.windows(hx, hy, hw, hd, hh, t.x + t.y);
    if (level >= 2) { d.box(hx + hw + 0.02, hy + 0.1, 0.24, 0.3, 7, "#b4aa91"); d.roof(hx + hw, hy + 0.08, 0.28, 0.34, 7, 3, "#6d6b5a"); }
    if (level >= 4) { d.flat(0.15, 0.68, 0.32, 0.22, 0.4, "#5aa6c9"); d.flat(0.13, 0.66, 0.36, 0.26, 0.3, "#d8d3bb"); }
    d.flat(0.62, hy + hd + 0.06, 0.12, 0.9 - hy - hd, 0.3, "#b8b39c");
    d.box(0.2, 0.2, 0.06, 0.06, hh + 5, "#94755a", 0);
    d.fence(0.05, 0.94, 0.9, 0, "#ada894"); d.fence(0.94, 0.05, 0, 0.89, "#ada894");
    d.tree(0.12, 0.85, 1); if (fam >= 2) d.tree(0.88, 0.2, 2);
    return;
  }
  if (density === 2) {
    // Townhouses and apartment blocks with balconies.
    const stories = 2 + level, hh = stories * 8;
    if (d.w === 1) {
      d.box(0.1, 0.12, 0.8, 0.72, hh, n > 0.5 ? brick : wall);
      d.windows(0.1, 0.12, 0.8, 0.72, hh, t.x * 3 + t.y);
      d.flat(0.11, 0.13, 0.78, 0.7, hh + 0.1, "#7b7e6c");
      d.box(0.3, 0.3, 0.2, 0.2, 4, "#a39e88", hh);
      d.tree(0.85, 0.9, 1);
    } else {
      // U-shaped block around a courtyard.
      d.box(0.06, 0.06, 0.88, 0.32, hh, wall); d.windows(0.06, 0.06, 0.88, 0.32, hh, t.x + t.y);
      d.box(0.06, 0.38, 0.28, 0.5, hh - 4, brick); d.windows(0.06, 0.38, 0.28, 0.5, hh - 4, t.x * 2);
      d.box(0.66, 0.38, 0.28, 0.5, hh - 4, brick); d.windows(0.66, 0.38, 0.28, 0.5, hh - 4, t.y * 2);
      d.flat(0.07, 0.07, 0.86, 0.3, hh + 0.1, "#7b7e6c"); d.flat(0.07, 0.39, 0.26, 0.48, hh - 3.9, "#7b7e6c"); d.flat(0.67, 0.39, 0.26, 0.48, hh - 3.9, "#7b7e6c");
      d.flat(0.36, 0.42, 0.28, 0.44, 0.3, "#8faa5c"); d.tree(0.5, 0.65, 2); d.tree(0.42, 0.85, 1); d.tree(0.6, 0.88, 0);
      d.bands(0.06, 0.06, 0.88, 0.32, 8, hh, 8, "#c2baa1");
    }
    return;
  }
  // High density: podium and tower. Taller with level; 3×3 lots get twin towers at level 4.
  const hh = 26 + level * 16 + Math.floor(n * 3) * 4;
  const glass = pick(GLASS, n);
  d.flat(0.04, 0.04, 0.92, 0.92, 0.3, "#aaa78d");
  d.box(0.08, 0.08, 0.84, 0.84, 8, brick); d.windows(0.08, 0.08, 0.84, 0.84, 8, t.x + t.y);
  d.flat(0.09, 0.09, 0.82, 0.82, 8.1, "#858978");
  const tw = d.w >= 3 && level === 4 ? 0.34 : 0.56, tx = d.w >= 3 && level === 4 ? 0.12 : 0.22;
  d.box(tx, 0.2, tw, 0.58, hh, n > 0.5 ? glass : wall, 8); d.windows(tx, 0.2, tw, 0.58, hh, t.x + t.y, n > 0.5, 8);
  d.bands(tx, 0.2, tw, 0.58, 14, hh + 8, 8, "#d1c4a0");
  d.flat(tx + 0.02, 0.22, tw - 0.04, 0.54, hh + 8.1, "#6f7368"); d.box(tx + tw * 0.35, 0.42, tw * 0.3, 0.16, 5, "#a39e88", hh + 8);
  if (d.w >= 3 && level === 4) {
    d.box(0.54, 0.2, 0.34, 0.58, hh - 12, wall, 8); d.windows(0.54, 0.2, 0.34, 0.58, hh - 12, t.y * 5, false, 8);
    d.flat(0.56, 0.22, 0.3, 0.54, hh - 3.9, "#6f7368");
  }
  d.tree(0.1, 0.9, 0); d.tree(0.9, 0.1, 2);
}

function commercial(d, t, n, level, r) {
  const density = t.density;
  const stone = pick(STONE, n), glass = pick(GLASS, n * 3);
  d.flat(0.025, 0.025, 0.95, 0.95, 0.2, "#b1aea0");
  if (density === 1) {
    // Shops with awnings and a parking strip.
    const hh = 10 + level * 2;
    d.flat(0.05, 0.62, 0.9, 0.33, 0.3, "#727b72");
    for (let a = 0.12; a < 0.9; a += 0.17) d.flat(a, 0.66, 0.018, 0.25, 0.5, "#ccc9ae");
    d.box(0.08, 0.1, 0.84, 0.48, hh, stone); d.windows(0.08, 0.1, 0.84, 0.48, hh, t.x + t.y, true);
    d.flat(0.07, 0.09, 0.86, 0.5, hh + 0.1, "#8b8e7d");
    d.box(0.09, 0.55, 0.82, 0.07, 3, pick(["#a24d3e", "#3e7377", "#b28e48", "#617844", "#7b4f7d"], n), hh - 4);
    d.box(0.3, 0.2, 0.19, 0.15, 3, "#bec0ad", hh);
    if (level >= 3) d.box(0.62, 0.15, 0.2, 0.2, 8, "#c9c3a1", hh);
    for (let a = 0; a < 3; a++) d.box(0.14 + a * 0.25, 0.75, 0.095, 0.17, 3, pick(["#e3dbb9", "#698c9a", "#a66049", "#c9c3a1"], (n + a * 0.23) % 1));
    return;
  }
  if (density === 2) {
    // Office blocks with banded floors.
    const hh = 16 + level * 7;
    d.box(0.08, 0.08, 0.84, 0.84, hh, stone); d.windows(0.08, 0.08, 0.84, 0.84, hh, t.x + t.y, level >= 3);
    d.bands(0.065, 0.065, 0.87, 0.87, 8, hh, 8, "#c9c5ad");
    d.box(0.06, 0.06, 0.88, 0.88, 3, "#d3cbb2", hh); d.flat(0.13, 0.13, 0.74, 0.74, hh + 3.1, "#777e70");
    d.box(0.3, 0.27, 0.18, 0.2, 4, "#b2b3a0", hh + 3);
    if (d.w > 1) { d.box(0.6, 0.6, 0.25, 0.25, 6, "#c3b9a0", hh + 3); }
    return;
  }
  // Skyscrapers: setbacks, glass curtain walls, spire at level 4.
  const hh = 40 + level * 24 + Math.floor(n * 4) * 6;
  const fam = Math.floor(n * 3);
  d.box(0.06, 0.06, 0.88, 0.88, 10, stone); d.windows(0.06, 0.06, 0.88, 0.88, 10, t.x + t.y, true);
  d.flat(0.07, 0.07, 0.86, 0.86, 10.1, "#6c7f75");
  const w1 = fam === 1 ? 0.52 : 0.66, d1 = fam === 2 ? 0.5 : 0.66;
  const gx = 0.5 - w1 / 2, gy = 0.5 - d1 / 2;
  d.box(gx, gy, w1, d1, hh, glass, 10); d.windows(gx, gy, w1, d1, hh, t.x + t.y, true, 10);
  d.bands(gx - 0.003, gy - 0.003, w1 + 0.006, d1 + 0.006, 16, hh + 10, 6, fam === 0 ? "#aab5a6" : "#9aa89c");
  if (fam === 1) { d.box(gx + 0.06, gy + 0.06, w1 - 0.12, d1 - 0.12, 12, glass, hh + 10); d.box(0.44, 0.44, 0.12, 0.12, 8, stone, hh + 22); if (level === 4) d.line(0.5, 0.5, hh + 30, 0.5, 0.5, hh + 52, "#c6c8b5", 1.2); }
  else if (fam === 2) { d.box(gx + 0.03, gy + 0.03, w1 - 0.06, d1 - 0.06, 4, "#c4c8b5", hh + 10); d.roof(gx + 0.03, gy + 0.03, w1 - 0.06, d1 - 0.06, hh + 14, 14, "#607d76"); }
  else { d.flat(gx + 0.02, gy + 0.02, w1 - 0.04, d1 - 0.04, hh + 10.1, "#6c7f75"); d.box(0.42, 0.42, 0.16, 0.14, 6, "#b0b4a3", hh + 10); if (level === 4) d.line(0.5, 0.49, hh + 16, 0.5, 0.49, hh + 36, "#c6c8b5", 1); }
  d.tree(0.9, 0.1, 2); d.tree(0.1, 0.9, 1);
}

function industrial(d, t, n, level, r) {
  const density = t.density;
  const brick = pick(["#9f7558", "#ae9270", "#b0a28a", "#8e8f80", "#aa8d6d"], n);
  if (density === 1 && d.w >= 3) {
    // Farm: fields, a barn, a silo and a farmhouse.
    const crop = pick([["#b9a24a", "#c9b45a"], ["#7f9d3e", "#93b04a"], ["#a77c3e", "#b98c4e"], ["#6f9c54", "#82ad62"]], n);
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#8f9a5c");
    for (let row = 0; row < 3; row++) d.flat(0.04, 0.06 + row * 0.2, 0.56, 0.16, 0.35, row % 2 ? crop[0] : crop[1]);
    for (let a = 0.06; a < 0.6; a += 0.06) d.line(a, 0.06, 0.5, a, 0.62, 0.5, "#0000001a", 0.6);
    d.box(0.66, 0.1, 0.26, 0.22, 10, "#a8452f"); d.roof(0.64, 0.08, 0.3, 0.26, 10, 6, "#6b3a2a");
    d.cyl(0.9, 0.42, 0.05, 18, "#c7c4b3"); d.cyl(0.9, 0.42, 0.052, 3, "#8d8a7a", 18);
    d.box(0.66, 0.5, 0.2, 0.18, 8, pick(WALLS, n)); d.roof(0.64, 0.48, 0.24, 0.22, 8, 5, pick(ROOFS, n));
    d.flat(0.06, 0.72, 0.86, 0.2, 0.3, "#8a8f66"); d.fence(0.03, 0.96, 0.94, 0, "#ada894"); d.fence(0.03, 0.03, 0.94, 0, "#ada894");
    d.tree(0.3, 0.86, 1); d.tree(0.5, 0.9, 0);
    if (level >= 3) { d.box(0.66, 0.74, 0.14, 0.14, 4, "#6f7d3e"); d.cyl(0.88, 0.8, 0.04, 6, "#9a9a8a"); }
    return;
  }
  d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#9e9980");
  if (density === 1) {
    // Workshops with sawtooth roofs and a yard.
    d.flat(0.05, 0.66, 0.9, 0.28, 0.4, "#818371");
    d.box(0.08, 0.08, 0.84, 0.52, 11, brick); d.windows(0.08, 0.08, 0.84, 0.52, 11, t.x + t.y);
    for (let a = 0; a < 3; a++) d.roof(0.08 + a * 0.28, 0.08, 0.28, 0.52, 11, 4, "#8d9685");
    d.box(0.15, 0.72, 0.22, 0.14, 4, "#9c6542"); d.box(0.5, 0.72, 0.3, 0.14, 5, "#60797a");
    if (level >= 3) d.cyl(0.85, 0.8, 0.06, 9, "#b4b6a0");
    return;
  }
  if (density === 2) {
    // Factories with smokestacks and loading bays.
    d.flat(0.06, 0.7, 0.88, 0.24, 0.4, "#818371");
    d.box(0.08, 0.1, 0.84, 0.55, 15 + level * 2, brick); d.windows(0.08, 0.1, 0.84, 0.55, 15, t.x + t.y);
    for (let a = 0; a < 3; a++) d.roof(0.08 + a * 0.28, 0.1, 0.28, 0.55, 15 + level * 2, 5, "#8d9685");
    for (let a = 0; a < 2; a++) d.cyl(0.22 + a * 0.38, 0.34, 0.05, 26 + level * 4, "#ad9577", 14);
    d.box(0.62, 0.72, 0.28, 0.2, 5, "#777e6b"); d.box(0.14, 0.74, 0.2, 0.16, 4, "#9c6542");
    return;
  }
  // Heavy industry: sheds, tanks, stacks, pipes.
  d.flat(0.04, 0.04, 0.92, 0.92, 0.3, "#8f8b74");
  d.box(0.06, 0.08, 0.56, 0.5, 20 + level * 2, brick); d.windows(0.06, 0.08, 0.56, 0.5, 20, t.x + t.y);
  d.flat(0.07, 0.09, 0.54, 0.48, 20.1 + level * 2, "#7d8577");
  for (let a = 0; a < 3; a++) d.cyl(0.14 + a * 0.2, 0.3, 0.04, 30 + level * 5 + a * 3, "#a89a80", 20 + level * 2);
  d.cyl(0.78, 0.25, 0.1, 14, "#b4b6a0"); d.cyl(0.78, 0.55, 0.1, 18, "#a5aa98");
  d.box(0.08, 0.66, 0.5, 0.26, 9, "#6f7d7a"); d.roof(0.08, 0.66, 0.5, 0.26, 9, 3, "#8d9685");
  d.line(0.68, 0.72, 6, 0.9, 0.72, 6, "#8e8f80", 2); d.line(0.68, 0.8, 6, 0.9, 0.8, 6, "#8e8f80", 2);
}

// ── Catalog buildings ─────────────────────────────────────────────────────────
const RECIPES = {
  coal(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.3, "#8b8a78");
    d.box(0.08, 0.36, 0.62, 0.55, 20, "#8f8074"); d.windows(0.08, 0.36, 0.62, 0.55, 20, t.x + t.y);
    d.roof(0.08, 0.36, 0.62, 0.55, 20, 6, "#5f5f58");
    d.cyl(0.24, 0.18, 0.06, 46, "#c4bda4"); d.cyl(0.24, 0.18, 0.062, 5, "#a4624c", 32);
    d.cyl(0.46, 0.18, 0.06, 46, "#c4bda4"); d.cyl(0.46, 0.18, 0.062, 5, "#a4624c", 32);
    d.box(0.76, 0.08, 0.18, 0.4, 6, "#4a4642"); d.roof(0.74, 0.06, 0.22, 0.44, 6, 6, "#3b3835");
    d.box(0.76, 0.56, 0.18, 0.34, 12, "#7c7a70");
    d.fence(0.04, 0.96, 0.92, 0, "#8b8c77");
  },
  oil(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.3, "#8f8a76");
    for (const [a, b] of [[0.2, 0.22], [0.48, 0.22], [0.2, 0.55]]) { d.cyl(a, b, 0.11, 16, "#c9c3a9"); d.cyl(a, b, 0.113, 2, "#8a8577", 16); }
    d.box(0.62, 0.5, 0.32, 0.42, 18, "#a49681"); d.windows(0.62, 0.5, 0.32, 0.42, 18, t.x + t.y);
    d.cyl(0.8, 0.28, 0.045, 34, "#bfb8a0"); d.line(0.34, 0.85, 4, 0.62, 0.85, 4, "#8e8f80", 2);
    d.fence(0.04, 0.96, 0.92, 0, "#8b8c77");
  },
  gas(d, t, n) {
    d.flat(0.03, 0.03, 0.94, 0.94, 0.3, "#96988a");
    d.box(0.1, 0.3, 0.55, 0.6, 16, "#b9c0b5"); d.windows(0.1, 0.3, 0.55, 0.6, 16, t.x + t.y, true);
    d.flat(0.11, 0.31, 0.53, 0.58, 16.1, "#7f8a83");
    d.cyl(0.78, 0.7, 0.12, 12, "#d0d3c4"); d.cyl(0.78, 0.7, 0.09, 6, "#b6bcb0", 12);
    d.cyl(0.8, 0.22, 0.04, 30, "#c9cbbf");
  },
  nuclear(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.3, "#9a9c8e");
    d.cyl(0.28, 0.3, 0.14, 58, "#d9d8cc"); d.cyl(0.66, 0.3, 0.14, 58, "#d9d8cc");
    d.cyl(0.28, 0.3, 0.1, 2, "#b7c4c0", 58); d.cyl(0.66, 0.3, 0.1, 2, "#b7c4c0", 58);
    d.box(0.1, 0.62, 0.8, 0.3, 14, "#c5c7bb"); d.windows(0.1, 0.62, 0.8, 0.3, 14, t.x + t.y, true);
    d.cyl(0.5, 0.78, 0.11, 10, "#bfc4b8", 14); d.cyl(0.5, 0.78, 0.1, 6, "#e6e5da", 24);
    d.fence(0.04, 0.96, 0.92, 0, "#8b8c77");
  },
  wind(d, t, n) {
    d.flat(0.2, 0.2, 0.6, 0.6, 0.2, "#8f9a7a");
    d.cyl(0.5, 0.5, 0.05, 40, "#e2e3da");
    const hub = d.pt(0.5, 0.5, 42);
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + n * 6.28; d.line(0.5, 0.5, 42, 0.5 + Math.cos(a) * 0.36, 0.5, 42 + Math.sin(a) * 15, "#eef0e6", 1.4); }
    void hub;
  },
  solar(d, t, n) {
    d.flat(0.03, 0.03, 0.94, 0.94, 0.2, "#9aa38a");
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const a = 0.08 + col * 0.3, b = 0.1 + row * 0.3;
      d.box(a, b, 0.24, 0.2, 3, "#6a7a86"); d.flat(a, b, 0.24, 0.2, 3.2, "#2f4a63");
      d.flat(a + 0.02, b + 0.02, 0.2, 0.16, 3.4, "#3a6a9c");
    }
    d.box(0.42, 0.9, 0.16, 0.08, 6, "#c4c2b0");
  },
  waterpump(d, t, n) {
    d.flat(0.08, 0.08, 0.84, 0.84, 0.2, "#7f9585");
    d.box(0.3, 0.3, 0.4, 0.4, 8, "#9aa9a0"); d.roof(0.28, 0.28, 0.44, 0.44, 8, 4, "#5c6f6a");
    d.cyl(0.78, 0.7, 0.07, 6, "#6a8fa3"); d.line(0.5, 0.7, 3, 0.78, 0.7, 3, "#6a8fa3", 2);
  },
  watertower(d, t, n) {
    d.flat(0.06, 0.06, 0.88, 0.88, 0.2, "#859678");
    for (const a of [0.26, 0.68]) for (const b of [0.26, 0.68]) d.box(a, b, 0.045, 0.045, 29, "#899b8d");
    d.cyl(0.49, 0.49, 0.28, 14, "#a5b9b0", 29); d.cyl(0.49, 0.49, 0.24, 3, "#d1d2b6", 43);
    d.line(0.77, 0.45, 0, 0.77, 0.45, 43, "#a4b3a1", 1);
  },
  treatment(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.3, "#8e9a8a");
    for (const [a, b] of [[0.22, 0.25], [0.5, 0.25], [0.78, 0.25], [0.22, 0.55], [0.5, 0.55]]) { d.cyl(a, b, 0.1, 4, "#a7b3ae"); d.cyl(a, b, 0.085, 1.5, "#5f8ca6", 4); }
    d.box(0.62, 0.68, 0.32, 0.26, 12, "#b7bdb1"); d.windows(0.62, 0.68, 0.32, 0.26, 12, t.x + t.y, true);
    d.box(0.08, 0.72, 0.4, 0.2, 6, "#98a39b");
  },
  police(d, t, n) {
    d.flat(0.03, 0.03, 0.94, 0.94, 0.2, "#a6ac97");
    d.box(0.1, 0.14, 0.78, 0.6, 19, "#a7b2a6"); d.windows(0.1, 0.14, 0.78, 0.6, 19, t.x + t.y, true);
    d.flat(0.08, 0.12, 0.82, 0.64, 19.1, "#557580"); d.box(0.34, 0.23, 0.25, 0.24, 5, "#c5c6ac", 19);
    d.flat(0.1, 0.78, 0.78, 0.16, 0.3, "#727b72"); for (let a = 0; a < 4; a++) d.box(0.13 + a * 0.19, 0.8, 0.12, 0.1, 3, "#dfe3ea");
    d.line(0.9, 0.5, 0, 0.9, 0.5, 26, "#c9c9c9", 1);
  },
  fire(d, t, n) {
    d.flat(0.03, 0.03, 0.94, 0.94, 0.2, "#a6ac97");
    d.box(0.1, 0.14, 0.78, 0.6, 18, "#a97456"); d.windows(0.1, 0.14, 0.78, 0.6, 18, t.x + t.y, true);
    d.flat(0.08, 0.12, 0.82, 0.64, 18.1, "#926146"); d.box(0.72, 0.2, 0.14, 0.14, 12, "#b08466", 18);
    for (let a = 0; a < 2; a++) d.box(0.16 + a * 0.32, 0.74, 0.24, 0.18, 3, "#c14432");
    d.flat(0.1, 0.72, 0.78, 0.22, 0.3, "#727b72");
  },
  hospital(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#aaad99");
    d.box(0.08, 0.12, 0.84, 0.6, 12, "#d0d1bc"); d.windows(0.08, 0.12, 0.84, 0.6, 12, t.x + t.y);
    d.box(0.26, 0.16, 0.48, 0.5, 34, "#c8cec0"); d.windows(0.26, 0.16, 0.48, 0.5, 34, t.x + t.y, true);
    d.flat(0.28, 0.18, 0.44, 0.46, 34.1, "#768b79"); d.flat(0.42, 0.22, 0.16, 0.38, 34.3, "#e4ded0"); d.flat(0.31, 0.33, 0.38, 0.16, 34.3, "#e4ded0");
    d.flat(0.08, 0.76, 0.84, 0.18, 0.3, "#727b72"); d.box(0.62, 0.8, 0.12, 0.12, 3, "#e3dfca"); d.box(0.2, 0.8, 0.12, 0.12, 3, "#e3dfca");
  },
  school(d, t, n) {
    d.flat(0.025, 0.025, 0.95, 0.95, 0.2, "#a6ac8c");
    d.box(0.08, 0.1, 0.84, 0.36, 15, "#ae785b"); d.roof(0.06, 0.08, 0.88, 0.4, 15, 6, "#6c7666"); d.windows(0.08, 0.1, 0.84, 0.36, 15, t.x + t.y);
    d.box(0.4, 0.08, 0.2, 0.22, 21, "#bca986"); d.roof(0.38, 0.06, 0.24, 0.26, 21, 5, "#737c6e");
    d.flat(0.1, 0.55, 0.8, 0.38, 0.3, "#87976f"); d.flat(0.16, 0.6, 0.68, 0.28, 0.5, "#a0ad83");
    d.line(0.2, 0.68, 0, 0.2, 0.68, 12, "#c5c5b2", 1); d.tree(0.9, 0.9, 1);
  },
  college(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#a2a98e");
    d.box(0.06, 0.06, 0.4, 0.3, 18, "#c6b89c"); d.roof(0.04, 0.04, 0.44, 0.34, 18, 6, "#6c7666"); d.windows(0.06, 0.06, 0.4, 0.3, 18, t.x);
    d.box(0.56, 0.06, 0.38, 0.3, 18, "#c6b89c"); d.roof(0.54, 0.04, 0.42, 0.34, 18, 6, "#6c7666"); d.windows(0.56, 0.06, 0.38, 0.3, 18, t.y);
    d.box(0.42, 0.4, 0.16, 0.16, 34, "#d3c8b0"); d.roof(0.4, 0.38, 0.2, 0.2, 34, 9, "#5b6c63");
    d.box(0.06, 0.62, 0.88, 0.3, 14, "#bfb094"); d.windows(0.06, 0.62, 0.88, 0.3, 14, t.x + t.y); d.roof(0.04, 0.6, 0.92, 0.34, 14, 5, "#6c7666");
    d.flat(0.12, 0.4, 0.28, 0.18, 0.3, "#8faa5c"); d.flat(0.6, 0.4, 0.28, 0.18, 0.3, "#8faa5c"); d.tree(0.25, 0.48, 1); d.tree(0.75, 0.48, 2);
  },
  library(d, t, n) {
    d.flat(0.04, 0.04, 0.92, 0.92, 0.2, "#aab09a");
    d.box(0.12, 0.12, 0.76, 0.66, 14, "#d4c9b2"); d.windows(0.12, 0.12, 0.76, 0.66, 14, t.x + t.y);
    for (let a = 0.16; a < 0.86; a += 0.14) d.box(a, 0.8, 0.04, 0.04, 14, "#e7e1cf");
    d.flat(0.1, 0.1, 0.8, 0.76, 14.1, "#8a8d7c"); d.roof(0.3, 0.28, 0.4, 0.34, 14, 6, "#7b8a80");
  },
  museum(d, t, n) {
    d.flat(0.03, 0.03, 0.94, 0.94, 0.2, "#b0b3a1");
    d.box(0.1, 0.1, 0.8, 0.62, 18, "#ded6c1"); d.windows(0.1, 0.1, 0.8, 0.62, 18, t.x + t.y);
    for (let a = 0.14; a < 0.86; a += 0.12) d.box(a, 0.74, 0.04, 0.04, 18, "#efe9d8");
    d.flat(0.08, 0.08, 0.84, 0.68, 18.1, "#9a9d8c");
    d.cyl(0.5, 0.4, 0.2, 5, "#c8c3ad", 18); d.cyl(0.5, 0.4, 0.15, 5, "#7e9b8f", 23);
    d.flat(0.1, 0.8, 0.8, 0.14, 0.3, "#c2bda6");
  },
  landfill(d, t, n) {
    d.flat(0.04, 0.04, 0.92, 0.92, 0.2, "#847957");
    for (let i = 0; i < 6; i++) d.box(0.1 + (i % 3) * 0.28, 0.15 + Math.floor(i / 3) * 0.4, 0.22, 0.25, 2 + random(t.x, t.y, i) * 5, pick(["#9a926d", "#b7a780", "#706e51", "#a0a187"], random(t.x, t.y, i)));
    d.fence(0.03, 0.96, 0.92, 0, "#9b9a82");
  },
  incinerator(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.3, "#8e8c7c");
    d.box(0.08, 0.3, 0.6, 0.6, 18, "#8f8a7c"); d.windows(0.08, 0.3, 0.6, 0.6, 18, t.x + t.y); d.roof(0.08, 0.3, 0.6, 0.6, 18, 5, "#5f5f58");
    d.cyl(0.8, 0.3, 0.06, 40, "#c0b9a4"); d.cyl(0.8, 0.3, 0.062, 4, "#a4624c", 28);
    d.box(0.72, 0.62, 0.22, 0.3, 8, "#77756b");
  },
  recycling(d, t, n) {
    d.flat(0.03, 0.03, 0.94, 0.94, 0.2, "#96a08c");
    d.box(0.1, 0.12, 0.8, 0.44, 12, "#a5ad9c"); d.windows(0.1, 0.12, 0.8, 0.44, 12, t.x + t.y); d.roof(0.1, 0.12, 0.8, 0.44, 12, 4, "#6b8071");
    for (let i = 0; i < 4; i++) d.box(0.12 + i * 0.2, 0.68, 0.14, 0.2, 5, pick(["#3f7a5c", "#4d6f9a", "#b28e48", "#a24d3e"], i / 4));
  },
  park(d, t, n) {
    d.flat(0.03, 0.03, 0.94, 0.94, 0.2, "#557c38");
    d.flat(0.44, 0.02, 0.12, 0.96, 0.3, "#bfb798"); d.flat(0.02, 0.44, 0.96, 0.12, 0.3, "#bfb798");
    if (n < 0.33) { d.cyl(0.5, 0.5, 0.16, 2, "#aaa88a"); d.cyl(0.5, 0.5, 0.125, 1, "#60999e", 2); d.cyl(0.5, 0.5, 0.035, 6, "#c2c9b3", 2); }
    d.tree(0.2, 0.2, 1); d.tree(0.8, 0.75, 0); d.tree(0.2, 0.78, 2); d.box(0.68, 0.22, 0.21, 0.045, 3, "#90704d");
  },
  largepark(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#5b8340");
    d.flat(0.47, 0.02, 0.06, 0.96, 0.3, "#c4bd9c"); d.flat(0.02, 0.47, 0.96, 0.06, 0.3, "#c4bd9c");
    d.flat(0.58, 0.58, 0.32, 0.28, 0.35, "#5fa0b5"); d.flat(0.56, 0.56, 0.36, 0.32, 0.25, "#a9b48f");
    for (const [a, b, k] of [[0.12, 0.12, 0], [0.3, 0.2, 1], [0.15, 0.35, 2], [0.7, 0.15, 1], [0.85, 0.3, 0], [0.2, 0.7, 2], [0.32, 0.88, 1], [0.12, 0.88, 0], [0.9, 0.9, 2], [0.62, 0.9, 1]]) d.tree(a, b, k);
    d.cyl(0.25, 0.55, 0.05, 2, "#aaa88a"); d.box(0.6, 0.3, 0.14, 0.03, 3, "#90704d"); d.box(0.78, 0.6, 0.03, 0.12, 3, "#90704d");
  },
  zoo(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#7f9a54");
    for (const [a, b] of [[0.06, 0.06], [0.52, 0.06], [0.06, 0.52]]) { d.flat(a, b, 0.42, 0.42, 0.3, pick(["#c8b98a", "#9db56b", "#b9c39a"], a + b)); d.fence(a, b + 0.42, 0.42, 0, "#8e8a72"); d.fence(a + 0.42, b, 0, 0.42, "#8e8a72"); }
    d.flat(0.6, 0.6, 0.3, 0.26, 0.35, "#5fa0b5");
    d.box(0.56, 0.54, 0.38, 0.1, 8, "#c9b58c"); d.roof(0.54, 0.52, 0.42, 0.14, 8, 4, "#6c7666");
    d.tree(0.2, 0.2, 1); d.tree(0.7, 0.24, 2); d.tree(0.24, 0.7, 0); d.tree(0.9, 0.9, 1);
    for (const [a, b] of [[0.18, 0.3], [0.62, 0.3], [0.3, 0.62]]) d.box(a, b, 0.05, 0.04, 3, "#7a6a52");
  },
  clocktower(d, t, n) {
    d.flat(0.04, 0.04, 0.92, 0.92, 0.2, "#b5b3a0");
    d.box(0.3, 0.3, 0.4, 0.4, 44, "#c9bfa4"); d.windows(0.3, 0.3, 0.4, 0.4, 44, t.x + t.y);
    d.box(0.26, 0.26, 0.48, 0.48, 5, "#ded6c1", 44); d.flat(0.36, 0.36, 0.28, 0.28, 49.1, "#f2efe0"); d.flat(0.44, 0.44, 0.12, 0.02, 49.3, "#333"); d.flat(0.49, 0.42, 0.02, 0.1, 49.3, "#333");
    d.roof(0.24, 0.24, 0.52, 0.52, 49, 12, "#4f6a63");
    for (const [a, b] of [[0.1, 0.1], [0.85, 0.1], [0.1, 0.85], [0.85, 0.85]]) d.tree(a, b, 1);
  },
  operahouse(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#b8b6a6");
    d.box(0.08, 0.14, 0.84, 0.6, 16, "#e2d9c4"); d.windows(0.08, 0.14, 0.84, 0.6, 16, t.x + t.y, true);
    for (let a = 0.12; a < 0.9; a += 0.11) d.box(a, 0.76, 0.04, 0.04, 16, "#f0ead9");
    d.flat(0.06, 0.12, 0.88, 0.66, 16.1, "#8a8f82");
    d.cyl(0.5, 0.42, 0.24, 8, "#cdbfa0", 16); d.cyl(0.5, 0.42, 0.2, 8, "#7fa39a", 24); d.cyl(0.5, 0.42, 0.04, 6, "#e8d27a", 32);
    d.flat(0.1, 0.82, 0.8, 0.12, 0.3, "#c9c4ad"); d.line(0.2, 0.9, 0, 0.2, 0.9, 10, "#c9c9c9", 1); d.line(0.8, 0.9, 0, 0.8, 0.9, 10, "#c9c9c9", 1);
  },
  observatory(d, t, n) {
    d.flat(0.05, 0.05, 0.9, 0.9, 0.2, "#9aa38a");
    d.box(0.2, 0.3, 0.6, 0.5, 12, "#d8d3c0"); d.windows(0.2, 0.3, 0.6, 0.5, 12, t.x + t.y);
    d.cyl(0.5, 0.5, 0.2, 10, "#cfcbb8", 12); d.cyl(0.5, 0.5, 0.18, 6, "#a9b3b8", 22); d.cyl(0.5, 0.5, 0.05, 8, "#6f7a80", 26);
    d.tree(0.12, 0.85, 2); d.tree(0.88, 0.15, 1);
  },
  cathedral(d, t, n) {
    d.flat(0.03, 0.03, 0.94, 0.94, 0.2, "#b3b1a0");
    d.box(0.2, 0.1, 0.6, 0.7, 26, "#d5cbb3"); d.windows(0.2, 0.1, 0.6, 0.7, 26, t.x + t.y, true); d.roof(0.18, 0.08, 0.64, 0.74, 26, 14, "#5a6270");
    d.box(0.12, 0.72, 0.18, 0.18, 46, "#cdc3a9"); d.roof(0.1, 0.7, 0.22, 0.22, 46, 14, "#4f5866");
    d.box(0.7, 0.72, 0.18, 0.18, 46, "#cdc3a9"); d.roof(0.68, 0.7, 0.22, 0.22, 46, 14, "#4f5866");
    d.line(0.5, 0.45, 40, 0.5, 0.45, 52, "#e8d27a", 1.2);
    d.flat(0.3, 0.9, 0.4, 0.06, 0.3, "#c9c4ad");
  },
  aquarium(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#9aaaa6");
    d.box(0.1, 0.1, 0.8, 0.5, 14, "#7fa3b8"); d.windows(0.1, 0.1, 0.8, 0.5, 14, t.x + t.y, true);
    d.roof(0.08, 0.08, 0.84, 0.54, 14, 8, "#3f6f88");
    d.flat(0.14, 0.66, 0.72, 0.26, 0.4, "#5fa0b5"); d.cyl(0.3, 0.79, 0.06, 4, "#9fc5cf"); d.cyl(0.7, 0.79, 0.06, 4, "#9fc5cf");
    d.tree(0.9, 0.9, 1);
  },
  substation(d, t, n) {
    d.flat(0.06, 0.06, 0.88, 0.88, 0.2, "#a8a99a");
    d.box(0.22, 0.28, 0.56, 0.44, 6, "#5f8fa8"); d.flat(0.18, 0.24, 0.64, 0.52, 6.1, "#3f6b84");
    d.flat(0.3, 0.72, 0.4, 0.2, 0.3, "#5a5a56"); for (let a = 0; a < 4; a++) d.flat(0.32, 0.74 + a * 0.045, 0.36, 0.02, 0.4, "#8f8f8a");
    d.box(0.44, 0.34, 0.12, 0.05, 3, "#e0a83a", 6); d.line(0.5, 0.36, 9, 0.5, 0.36, 14, "#e0a83a", 1.2);
  },
  bus(d, t, n) {
    d.flat(0.08, 0.08, 0.84, 0.84, 0.2, "#aeb5a0");
    d.box(0.2, 0.3, 0.6, 0.3, 7, "#7b9891"); d.flat(0.16, 0.26, 0.68, 0.38, 7.1, "#5b7971");
    d.line(0.85, 0.7, 0, 0.85, 0.7, 10, "#bcc5af", 1); d.box(0.83, 0.68, 0.05, 0.03, 2, "#e3dfca", 9);
  },
  railstation(d, t, n) {
    d.flat(0.04, 0.04, 0.92, 0.92, 0.2, "#9a9b8c");
    d.box(0.1, 0.1, 0.8, 0.4, 14, "#b9a98c"); d.windows(0.1, 0.1, 0.8, 0.4, 14, t.x + t.y); d.roof(0.08, 0.08, 0.84, 0.44, 14, 5, "#5f6f6a");
    d.flat(0.08, 0.58, 0.84, 0.32, 1.5, "#bdbaa5");
    for (const a of [0.15, 0.5, 0.85]) d.line(a, 0.62, 1.5, a, 0.62, 9, "#8e8f80", 1);
    d.flat(0.08, 0.58, 0.84, 0.32, 9, "#7c8a83");
  },
  airport(d, t, n) {
    d.flat(0.01, 0.01, 0.98, 0.98, 0.2, "#8f9a86");
    d.flat(0.06, 0.12, 0.88, 0.16, 0.4, "#6d7370"); d.flat(0.08, 0.19, 0.84, 0.02, 0.6, "#e6e2c8");
    for (let a = 0.1; a < 0.9; a += 0.1) d.flat(a, 0.18, 0.04, 0.04, 0.6, "#e6e2c8");
    d.flat(0.06, 0.34, 0.5, 0.12, 0.4, "#767b76");
    d.box(0.1, 0.56, 0.5, 0.26, 12, "#c9ccc2"); d.windows(0.1, 0.56, 0.5, 0.26, 12, t.x + t.y, true); d.flat(0.08, 0.54, 0.54, 0.3, 12.1, "#7f8a83");
    d.box(0.7, 0.6, 0.12, 0.12, 20, "#b9bdb5"); d.box(0.68, 0.58, 0.16, 0.16, 5, "#6f8f8a", 20);
    d.box(0.64, 0.34, 0.3, 0.16, 10, "#a7aba2"); d.roof(0.64, 0.34, 0.3, 0.16, 10, 4, "#7e8479");
    d.box(0.3, 0.36, 0.14, 0.05, 3, "#e8e8e0"); d.box(0.36, 0.33, 0.03, 0.11, 2, "#e8e8e0", 2); d.box(0.28, 0.375, 0.03, 0.03, 4, "#e8e8e0", 3);
  },
  seaport(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#8c9088");
    d.flat(0.05, 0.05, 0.9, 0.24, 0.4, "#7a7f7b");
    for (let i = 0; i < 6; i++) d.box(0.08 + (i % 3) * 0.16, 0.08 + Math.floor(i / 3) * 0.1, 0.14, 0.08, 4 + (i % 2) * 3, pick(["#b0473a", "#3a6fa0", "#c9a53a", "#5a8f5a"], random(t.x, t.y, i)));
    d.box(0.1, 0.4, 0.5, 0.3, 10, "#a9aa9b"); d.roof(0.1, 0.4, 0.5, 0.3, 10, 4, "#6d7470"); d.windows(0.1, 0.4, 0.5, 0.3, 10, t.x + t.y);
    d.line(0.78, 0.5, 0, 0.78, 0.5, 30, "#8e8f80", 1.4); d.line(0.78, 0.5, 30, 0.95, 0.35, 24, "#8e8f80", 1.2);
    d.cyl(0.8, 0.8, 0.08, 10, "#c3c4b4"); d.cyl(0.62, 0.84, 0.06, 8, "#b0b3a3");
  },
  mayorhouse(d, t, n) {
    d.flat(0.03, 0.03, 0.94, 0.94, 0.2, "#6f8f48");
    d.box(0.16, 0.16, 0.56, 0.5, 16, "#e6dcc4"); d.windows(0.16, 0.16, 0.56, 0.5, 16, t.x + t.y); d.roof(0.13, 0.13, 0.62, 0.56, 16, 8, "#6b4a3c");
    for (const a of [0.2, 0.34, 0.48, 0.62]) d.box(a, 0.66, 0.04, 0.04, 14, "#f2ecdc");
    d.flat(0.16, 0.7, 0.56, 0.06, 14.1, "#dcd2b8");
    d.flat(0.4, 0.76, 0.1, 0.2, 0.3, "#c7c1a2"); d.tree(0.85, 0.2, 1); d.tree(0.88, 0.8, 2); d.tree(0.1, 0.85, 0);
    d.cyl(0.85, 0.5, 0.05, 2, "#aaa88a"); d.cyl(0.85, 0.5, 0.04, 1, "#60999e", 2);
  },
  cityhall(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#b3b5a3");
    d.box(0.1, 0.16, 0.8, 0.56, 22, "#dfd7c2"); d.windows(0.1, 0.16, 0.8, 0.56, 22, t.x + t.y);
    for (let a = 0.14; a < 0.86; a += 0.1) d.box(a, 0.72, 0.04, 0.04, 22, "#efe9d8");
    d.flat(0.08, 0.14, 0.84, 0.62, 22.1, "#8f9484");
    d.box(0.36, 0.34, 0.28, 0.24, 10, "#d8d0b8", 22); d.cyl(0.5, 0.46, 0.13, 8, "#c9c3ad", 32); d.cyl(0.5, 0.46, 0.09, 6, "#6f8f86", 40);
    d.line(0.5, 0.46, 46, 0.5, 0.46, 58, "#c6c8b5", 1.2);
    d.flat(0.1, 0.8, 0.8, 0.14, 0.3, "#c2bda6"); d.flat(0.44, 0.76, 0.12, 0.2, 0.4, "#d4cfb7");
  },
  courthouse(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#aeb0a0");
    d.box(0.1, 0.12, 0.8, 0.6, 20, "#cfc8b0"); d.windows(0.1, 0.12, 0.8, 0.6, 20, t.x + t.y);
    for (let a = 0.16; a < 0.86; a += 0.12) d.box(a, 0.74, 0.05, 0.05, 20, "#e4ddc8");
    d.roof(0.08, 0.1, 0.84, 0.66, 20, 7, "#5d6b66");
    d.flat(0.1, 0.82, 0.8, 0.12, 0.3, "#c2bda6");
  },
  stadium(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#8a9a7d");
    d.box(0.08, 0.08, 0.84, 0.84, 6, "#b5b6a6");
    d.box(0.1, 0.1, 0.8, 0.14, 18, "#a9aa9b", 6); d.box(0.1, 0.76, 0.8, 0.14, 18, "#a9aa9b", 6);
    d.box(0.1, 0.24, 0.14, 0.52, 14, "#a9aa9b", 6); d.box(0.76, 0.24, 0.14, 0.52, 14, "#a9aa9b", 6);
    d.flat(0.26, 0.26, 0.48, 0.48, 6.2, "#4f9a4a"); d.flat(0.3, 0.3, 0.4, 0.4, 6.3, "#5fae58");
    for (const [a, b] of [[0.12, 0.12], [0.86, 0.12], [0.12, 0.86], [0.86, 0.86]]) d.line(a, b, 24, a, b, 44, "#dcdccc", 1.2);
  },
  statue(d, t, n) {
    d.flat(0.1, 0.1, 0.8, 0.8, 0.3, "#c9c4ad");
    d.box(0.35, 0.35, 0.3, 0.3, 6, "#b9b3a0"); d.box(0.42, 0.42, 0.16, 0.16, 14, "#8e9a94", 6); d.cyl(0.5, 0.5, 0.06, 5, "#9fa8a2", 20);
    d.tree(0.15, 0.85, 1); d.tree(0.85, 0.15, 2);
  },
  prison(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#9c9a86");
    d.box(0.12, 0.12, 0.76, 0.3, 16, "#a9a598"); d.windows(0.12, 0.12, 0.76, 0.3, 16, t.x + t.y);
    d.box(0.12, 0.5, 0.34, 0.36, 12, "#a9a598"); d.box(0.54, 0.5, 0.34, 0.36, 12, "#a9a598");
    d.fence(0.04, 0.96, 0.92, 0, "#7d7d70"); d.fence(0.96, 0.04, 0, 0.92, "#7d7d70"); d.fence(0.04, 0.04, 0.92, 0, "#7d7d70"); d.fence(0.04, 0.04, 0, 0.92, "#7d7d70");
    for (const [a, b] of [[0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95]]) { d.box(a - 0.03, b - 0.03, 0.06, 0.06, 20, "#8c8c7e"); }
  },
  casino(d, t, n) {
    d.flat(0.03, 0.03, 0.94, 0.94, 0.2, "#b3aea4");
    d.box(0.1, 0.1, 0.8, 0.6, 24, "#7d4f8a"); d.windows(0.1, 0.1, 0.8, 0.6, 24, t.x + t.y, true);
    d.flat(0.08, 0.08, 0.84, 0.64, 24.1, "#5c3a66"); d.box(0.3, 0.2, 0.4, 0.3, 10, "#e0b23c", 24);
    d.line(0.5, 0.35, 34, 0.5, 0.35, 50, "#f2d36b", 1.4);
    d.flat(0.1, 0.74, 0.8, 0.2, 0.3, "#727b72"); for (let a = 0; a < 4; a++) d.box(0.13 + a * 0.19, 0.78, 0.12, 0.1, 3, pick(["#e3dbb9", "#698c9a", "#a66049", "#c9c3a1"], (n + a * 0.3) % 1));
  },
  toxicdump(d, t, n) {
    d.flat(0.03, 0.03, 0.94, 0.94, 0.2, "#7b7a58");
    for (let i = 0; i < 6; i++) d.cyl(0.18 + (i % 3) * 0.3, 0.22 + Math.floor(i / 3) * 0.36, 0.07, 6 + random(t.x, t.y, i) * 4, pick(["#9bb03a", "#b3a832", "#6f7f3a"], random(t.x, t.y, i)));
    d.box(0.62, 0.7, 0.28, 0.22, 7, "#8a8570"); d.fence(0.03, 0.96, 0.92, 0, "#8d8b6d"); d.fence(0.96, 0.03, 0, 0.92, "#8d8b6d");
  },
  armybase(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#8f9470");
    for (let i = 0; i < 4; i++) { d.box(0.08 + i * 0.22, 0.1, 0.16, 0.3, 8, "#7f8a62"); d.roof(0.07 + i * 0.22, 0.09, 0.18, 0.32, 8, 4, "#5c6647"); }
    d.box(0.1, 0.5, 0.36, 0.3, 12, "#8e9578"); d.windows(0.1, 0.5, 0.36, 0.3, 12, t.x + t.y);
    d.flat(0.52, 0.5, 0.4, 0.42, 0.4, "#6c7358"); for (let i = 0; i < 3; i++) d.box(0.56 + i * 0.12, 0.6, 0.08, 0.16, 4, "#5f6a48");
    d.line(0.9, 0.12, 0, 0.9, 0.12, 30, "#cfcfc0", 1); d.flat(0.86, 0.06, 0.08, 0.05, 28, "#c8443a");
    d.fence(0.03, 0.96, 0.92, 0, "#8d8b6d");
  },
};

// Undeveloped zone tile: painted lot outline.
export function drawZoneMarker(r, t) {
  const c = { residential: "#569238", commercial: "#346d9a", industrial: "#b79c38" }[t.type];
  r.flat(t.x + 0.035, t.y + 0.035, 0.93, 0.93, 0.25, c);
  for (let a = 0.1; a < 0.9; a += 0.2) r.line(r.project(t.x + a, t.y + 0.05, 0.3), r.project(t.x + a, t.y + 0.95, 0.3), "#d1dcba66", 0.5);
  r.flat(t.x + 0.08, t.y + 0.08, 0.84, 0.025, 0.4, "#e0e0ae"); r.flat(t.x + 0.08, t.y + 0.08, 0.025, 0.84, 0.4, "#e0e0ae");
  if (t.density > 1) for (let i = 0; i < t.density; i++) r.flat(t.x + 0.75 + i * 0.08, t.y + 0.1, 0.05, 0.05, 0.5, "#f3f0c8");
}

export function drawArchitecture(r, t) {
  const lot = t.lot;
  if (!lot) { drawZoneMarker(r, t); return; }
  const n = t.variant ?? random(t.x, t.y);
  const level = Math.max(1, t.level || 1);
  const d = scoped(r, lot, !!t.abandoned);
  if (t.type === "residential") residential(d, t, n, level, r);
  else if (t.type === "commercial") commercial(d, t, n, level, r);
  else if (t.type === "industrial") industrial(d, t, n, level, r);
  else if (RECIPES[t.type]) RECIPES[t.type](d, t, n, r);
  else { d.box(0.15, 0.15, 0.7, 0.7, 12, "#b0aa96"); }
  if (t.abandoned) {
    // Boarded windows and weeds.
    for (let i = 0; i < 4; i++) d.flat(0.1 + random(t.x, t.y, i) * 0.7, 0.1 + random(t.y, t.x, i + 3) * 0.7, 0.12, 0.08, 0.5, "#6b6a4c");
  } else if (t.age === 0 && ["residential", "commercial", "industrial"].includes(t.type)) {
    // Freshly built or expanded: a crane and scaffolding for the month.
    const h = heightOf(t) + 10;
    d.line(0.85, 0.15, 0, 0.85, 0.15, h, "#d9c24a", 1.4);
    d.line(0.85, 0.15, h, 0.3, 0.15, h, "#d9c24a", 1.2);
    d.line(0.45, 0.15, h, 0.45, 0.15, h * 0.55, "#d9c24a", 0.7);
    d.box(0.42, 0.12, 0.06, 0.06, 3, "#8a8a80", h * 0.55 - 3);
    for (let z = 4; z < Math.min(h - 6, 30); z += 6) d.line(0.06, 0.94, z, 0.94, 0.94, z, "#c9c4a8", 0.6);
  }
}
