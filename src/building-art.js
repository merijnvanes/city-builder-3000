import { drawStadium } from "./civic-art.js";
import { drawPolice, drawFire, drawHospital, drawSchool, drawJail } from "./civic-services-art.js";
import { drawCollegeCampus, drawLibrary, drawMuseum } from "./civic-culture-art.js";
import { drawLandfill, drawIncinerator, drawRecycling, drawWasteEnergy } from "./civic-sanitation-art.js";
import { drawIndustrialYard, drawPort, drawMarina } from "./industrial-art.js";
import { drawPocketPark, drawGardenPark } from "./park-art.js";
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
  return { coal: 46, oil: 34, gas: 30, nuclear: 60, wind: 42, solar: 6, microwave: 45, fusion: 40, waterpump: 10, watertower: 47, treatment: 14, desalination: 20,
    police: 38, fire: 44, jail: 30, hospital: 37, school: 33, college: 52, library: 25, museum: 36, landfill: 8, incinerator: 46, wasteenergy: 51, recycling: 20,
    park: 14, largepark: 16, zoo: 14, bus: 9, railstation: 16, airport: 18, seaport: 16, substation: 8,
    mayorhouse: 24, cityhall: 46, courthouse: 27, stadium: 30, statue: 25, prison: 20, casino: 36, toxicdump: 10, armybase: 14,
    marina: 14, university: 34, medcenter: 40, gigamall: 20,
    clocktower: 61, operahouse: 38, observatory: 34, cathedral: 60, aquarium: 22 }[t.type] || 12;
}

// Scaled drawing helpers for one lot.
function scoped(r, lot, dim, powered = true) {
  const { x, y, w, h } = lot;
  const s = (a, b) => [x + a * w, y + b * h];
  const k = (dim ? 0.55 : 1) * (r.night ? NIGHT_EXPOSURE : 1);
  const tone = (c) => (k !== 1 ? shadeHex(c, k) : c);
  return {
    w, h, x, y,
    visible: (side) => [["south", "east"], ["east", "north"], ["north", "west"], ["west", "south"]][r.rotation || 0].includes(side),
    // Keep each solid and its surface details together as the camera rotates.
    parts: (parts) => parts.map(([a, b, draw]) => {
      const p = r.orient(...s(a, b));
      return { depth: p.x + p.y, draw };
    }).sort((a, b) => a.depth - b.depth).forEach((part) => part.draw()),
    flat: (a, b, fw, fd, z, c, stroke) => r.flat(x + a * w, y + b * h, fw * w, fd * h, z, tone(c), stroke),
    box: (a, b, fw, fd, hh, c, z = 0) => r.box(x + a * w, y + b * h, fw * w, fd * h, hh, tone(c), z),
    roof: (a, b, fw, fd, z, hh, c) => r.roof(x + a * w, y + b * h, fw * w, fd * h, z, hh, tone(c)),
    hip: (a, b, fw, fd, z, hh, c, ridge = 0) => r.pyramid(x + a * w, y + b * h, fw * w, fd * h, z, hh, tone(c), ridge * w),
    cyl: (a, b, radius, hh, c, z = 0) => r.cylinder(x + a * w, y + b * h, radius * Math.min(w, h), hh, tone(c), z),
    tree: (a, b, n = 0) => r.tree(x + a * w, y + b * h, n),
    fence: (a, b, fw, fd, c) => r.fence(x + a * w, y + b * h, fw * w, fd * h, tone(c)),
    line: (a, b, z, a2, b2, z2, c, width = 1) => r.line(r.project(x + a * w, y + b * h, z), r.project(x + a2 * w, y + b2 * h, z2), tone(c), width),
    windows: (a, b, fw, fd, hh, seed, glass = false, z = 0, lit = !dim, floorHeight = 8) => r.windows(x + a * w, y + b * h, fw * w, fd * h, hh, seed, glass, z, lit && powered, floorHeight),
    bands: (a, b, fw, fd, from, to, step, c) => { for (let z = from; z < to; z += step) for (const f of r.faces(x + a * w, y + b * h, fw * w, fd * h, 0, z)) r.line(f.points[0], f.points[1], tone(c), 1); },
    fins: (a, b, fw, fd, hh, z, c, width = 0.8) => {
      const ax = x + a * w, ay = y + b * h, ww = fw * w, dd = fd * h;
      for (const face of r.faces(ax, ay, ww, dd, hh, z)) {
        const alongX = face.name === "north" || face.name === "south";
        const length = alongX ? ww : dd, count = Math.max(1, Math.floor(length * 6));
        for (let i = 0; i < count; i++) {
          const offset = (i + 0.5) * length / count;
          const px = alongX ? ax + offset : face.name === "east" ? ax + ww : ax;
          const py = alongX ? face.name === "south" ? ay + dd : ay : ay + offset;
          r.line(r.project(px, py, z + 1), r.project(px, py, z + hh), tone(c), width);
        }
      }
    },
    pt: (a, b, z = 0) => r.project(x + a * w, y + b * h, z),
  };
}

// One definition of the night exposure so drawing code and tests agree.
export const NIGHT_EXPOSURE = 0.62;
export function shadeHex(hex, k) {
  if (typeof hex !== "string" || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => clamp(v * k, 0, 255) | 0);
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("") + hex.slice(7);
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
    // Detached homes: reserve a real side yard for the garage and keep
    // paving, pool water and landscaping below the camera-sorted solids.
    const fam = Math.floor(n * 4);
    const hw = 0.42 + level * 0.06, hd = 0.4 + level * 0.05;
    const hx = level === 1 ? 0.5 - hw / 2 : fam % 2 ? 0.08 : 0.1, hy = 0.12;
    const hh = (level >= 3 ? 2 : 1) * 9 + 2;
    const gx = hx + hw + 0.02, gy = hy + 0.1, gw = 0.17;
    const fence = fam === 3 ? "#6f7a72" : "#ada894", entry = hx + hw * 0.65;
    d.flat(entry, hy + hd, 0.075, 0.94 - hy - hd, 0.3, "#b8b39c");
    if (level >= 2) d.flat(gx, gy + 0.3, gw, 0.94 - gy - 0.3, 0.3, "#aaa995");
    if (level >= 4) {
      d.flat(0.1, 0.79, 0.34, 0.14, 0.3, "#d8d3bb");
      d.flat(0.12, 0.81, 0.3, 0.1, 0.4, "#5aa6b9");
      d.line(0.14, 0.83, 0.45, 0.37, 0.83, 0.45, "#a2d3d3", 0.5);
    }
    const parts = [
      [hx + hw / 2, hy + hd / 2, () => {
        d.box(hx, hy, hw, hd, hh, fam === 3 ? pick(["#e6e2d6", "#c9d0cf", "#d9cfc0"], n) : wall);
        d.windows(hx, hy, hw, hd, hh, t.x + t.y, fam === 3);
        if (fam === 0) d.roof(hx - 0.03, hy - 0.03, hw + 0.06, hd + 0.06, hh, 6 + level, roof);
        else if (fam === 1) d.hip(hx - 0.03, hy - 0.03, hw + 0.06, hd + 0.06, hh, 5 + level, roof, 0.2);
        else if (fam === 2) {
          d.roof(hx - 0.03, hy - 0.03, hw + 0.06, hd + 0.06, hh, 7 + level, roof);
          d.box(hx + hw * 0.35, hy - 0.02, hw * 0.3, 0.12, 4, wall, hh + 2);
          d.roof(hx + hw * 0.33, hy - 0.04, hw * 0.34, 0.16, hh + 6, 3, roof);
        } else {
          d.box(hx - 0.02, hy - 0.02, hw + 0.04, hd + 0.04, 1.5, "#4f5a58", hh);
          d.flat(hx + 0.04, hy + 0.04, hw - 0.08, hd - 0.08, hh + 1.6, "#8a9a8c");
        }
        if (fam !== 3) d.box(hx + hw * 0.22, hy + hd * 0.35, 0.06, 0.06, 6, "#94755a", hh + 3);
        if ([0, 3].includes(r.rotation || 0)) {
          d.box(entry, hy + hd + 0.002, 0.075, 0.004, 5.8, "#605746", 0.3);
          d.line(entry + 0.057, hy + hd + 0.008, 2.8, entry + 0.057, hy + hd + 0.008, 3.2, "#c9b578", 0.5);
        }
      }],
      [0.5, 0.96, () => {
        const openings = [[entry - 0.015, entry + 0.09]];
        if (level >= 2) openings.push([gx - 0.01, gx + gw + 0.01]);
        let cursor = 0.04;
        for (const [start, end] of openings) {
          if (start - cursor > 0.025) d.fence(cursor, 0.96, start - cursor, 0, fence);
          cursor = end;
        }
        if (0.96 - cursor > 0.025) d.fence(cursor, 0.96, 0.96 - cursor, 0, fence);
      }],
      [0.97, 0.5, () => d.fence(0.97, 0.04, 0, 0.92, fence)],
      [0.06, 0.76, () => d.tree(0.06, 0.76, 1)],
    ];
    if (fam >= 2) parts.push([0.9, 0.1, () => d.tree(0.9, 0.1, 2)]);
    if (fam === 2) parts.push([hx + hw / 2, hy + hd + 0.0225, () => d.box(hx, hy + hd, hw, 0.045, 3, "#d8d2c0")]);
    if (level >= 2) parts.push([gx + gw / 2, gy + 0.15, () => {
      d.box(gx, gy, gw, 0.3, 7, "#b4aa91");
      if (fam === 3) d.flat(gx, gy, gw, 0.3, 7.1, "#8a9a8c");
      else d.roof(gx - 0.01, gy - 0.01, gw + 0.02, 0.32, 7, 3, "#6d6b5a");
      if ([0, 3].includes(r.rotation || 0)) {
        for (let z = 1; z < 6; z += 1.5) d.line(gx + 0.02, gy + 0.302, z, gx + gw - 0.02, gy + 0.302, z, "#766f5f", 0.45);
      }
    }]);
    d.parts(parts);
    return;
  }
  if (density === 2) {
    // Townhouses, brownstones and small apartment blocks with balconies.
    const stories = 2 + level, hh = stories * 8;
    const fam = Math.floor(n * 3);
    if (d.w === 1) {
      if (fam === 0) {
        d.box(0.1, 0.12, 0.8, 0.72, hh, n > 0.5 ? brick : wall);
        d.windows(0.1, 0.12, 0.8, 0.72, hh, t.x * 3 + t.y);
        d.flat(0.11, 0.13, 0.78, 0.7, hh + 0.1, "#7b7e6c");
        d.box(0.3, 0.3, 0.2, 0.2, 4, "#a39e88", hh);
      } else if (fam === 1) {
        // Brownstone with a stoop and a cornice.
        d.box(0.12, 0.1, 0.76, 0.66, hh, pick(["#8f5a44", "#a86f54", "#7a4e3e"], n));
        d.windows(0.12, 0.1, 0.76, 0.66, hh, t.x + t.y * 3);
        d.box(0.1, 0.08, 0.8, 0.7, 2.5, "#c9b89a", hh); d.flat(0.14, 0.12, 0.72, 0.62, hh + 2.6, "#5f5a52");
        for (let s = 0; s < 4; s++) d.box(0.4, 0.78 + s * 0.04, 0.2, 0.04, 4 - s, "#b5ab96");
      } else {
        // Apartment with balconies on the street side.
        d.box(0.1, 0.1, 0.8, 0.74, hh, wall); d.windows(0.1, 0.1, 0.8, 0.74, hh, t.x + t.y);
        for (let s = 1; s < stories; s++) { d.box(0.18, 0.84, 0.64, 0.08, 1.2, "#c9c4b0", s * 8); d.line(0.18, 0.92, s * 8 + 1.2, 0.82, 0.92, s * 8 + 1.2, "#6f6f66", 0.8); }
        d.flat(0.11, 0.11, 0.78, 0.72, hh + 0.1, "#7b7e6c");
      }
      d.tree(0.85, 0.9, 1);
    } else if (fam === 2) {
      // Ground and paths sit below the slab in every orientation.
      d.flat(0.08, 0.58, 0.84, 0.34, 0.3, "#8faa5c");
      d.flat(0.46, 0.52, 0.08, 0.4, 0.4, "#bfb798");
      d.parts([
        [0.5, 0.31, () => {
          d.box(0.06, 0.1, 0.88, 0.42, hh + 8, wall);
          d.windows(0.06, 0.1, 0.88, 0.42, hh + 8, t.x + t.y);
          d.bands(0.06, 0.1, 0.88, 0.42, 8, hh + 8, 8, "#c2baa1");
          d.flat(0.07, 0.11, 0.86, 0.4, hh + 8.1, "#7b7e6c");
        }],
        [0.2, 0.75, () => d.tree(0.2, 0.75, 1)],
        [0.5, 0.8, () => d.tree(0.5, 0.8, 0)],
        [0.8, 0.72, () => d.tree(0.8, 0.72, 2)],
      ]);
    } else {
      // Ground must precede the wings, and facade bands belong to their wing.
      d.flat(0.36, 0.42, 0.28, 0.44, 0.3, "#8faa5c");
      d.parts([
        [0.5, 0.22, () => {
          d.box(0.06, 0.06, 0.88, 0.32, hh, wall);
          d.windows(0.06, 0.06, 0.88, 0.32, hh, t.x + t.y);
          d.bands(0.06, 0.06, 0.88, 0.32, 8, hh, 8, "#c2baa1");
          d.flat(0.07, 0.07, 0.86, 0.3, hh + 0.1, "#7b7e6c");
        }],
        ...[0.06, 0.66].map((a, i) => [a + 0.14, 0.63, () => {
          d.box(a, 0.38, 0.28, 0.5, hh - 4, brick);
          d.windows(a, 0.38, 0.28, 0.5, hh - 4, (i ? t.y : t.x) * 2);
          d.flat(a + 0.01, 0.39, 0.26, 0.48, hh - 3.9, "#7b7e6c");
        }]),
        [0.5, 0.65, () => d.tree(0.5, 0.65, 2)],
        [0.42, 0.85, () => d.tree(0.42, 0.85, 1)],
        [0.6, 0.88, () => d.tree(0.6, 0.88, 0)],
      ]);
    }
    return;
  }
  // High density: podium and tower. Taller with level; 3×3 lots get twin towers at level 4.
  const hh = 26 + level * 16 + Math.floor(n * 3) * 4;
  const glass = pick(GLASS, n);
  d.flat(0.04, 0.04, 0.92, 0.92, 0.3, "#aaa78d");
  const style = Math.floor(n * 5) % 3;
  if (style === 1 && d.w >= 2) {
    // Stepped tower: three tiers.
    d.box(0.08, 0.08, 0.84, 0.84, hh * 0.45, brick); d.windows(0.08, 0.08, 0.84, 0.84, hh * 0.45, t.x + t.y);
    d.box(0.18, 0.18, 0.64, 0.64, hh * 0.35, wall, hh * 0.45); d.windows(0.18, 0.18, 0.64, 0.64, hh * 0.35, t.x * 2, false, hh * 0.45);
    d.box(0.3, 0.3, 0.4, 0.4, hh * 0.3, glass, hh * 0.8); d.windows(0.3, 0.3, 0.4, 0.4, hh * 0.3, t.y * 2, true, hh * 0.8);
    d.flat(0.31, 0.31, 0.38, 0.38, hh * 1.1 + 0.1, "#6f7368"); d.line(0.5, 0.5, hh * 1.1, 0.5, 0.5, hh * 1.1 + 12, "#c6c8b5", 1);
    d.tree(0.1, 0.9, 0); d.tree(0.9, 0.1, 2);
    return;
  }
  if (style === 2) {
    // The balcony stack is in front only when its facade faces the camera.
    const sw = d.w >= 2 ? 0.82 : 0.76, balconyDepth = 0.075 / d.h;
    d.flat(0.1, 0.78, 0.8, 0.14, 0.3, "#8faa5c");
    d.parts([
      [0.09 + sw / 2, 0.45, () => {
        d.box(0.09, 0.2, sw, 0.5, hh + 8, wall);
        d.windows(0.09, 0.2, sw, 0.5, hh + 8, t.x + t.y);
        d.flat(0.1, 0.21, sw - 0.02, 0.48, hh + 8.1, "#6f7368");
        d.box(0.4, 0.4, 0.2, 0.14, 5, "#a39e88", hh + 8);
      }],
      [0.09 + sw / 2, 0.7 + balconyDepth / 2, () => {
        for (let z = 8; z < hh + 4; z += 8) {
          d.box(0.12, 0.7, sw - 0.06, balconyDepth, 0.65, "#bcbba9", z);
          const front = 0.7 + balconyDepth;
          d.line(0.12, front, z + 2, 0.12 + sw - 0.06, front, z + 2, "#646b64", 0.55);
          for (const a of [0.12, 0.12 + (sw - 0.06) / 2, sw + 0.06]) d.line(a, front, z + 0.65, a, front, z + 2, "#646b64", 0.45);
        }
      }],
      [0.2, 0.86, () => d.tree(0.2, 0.86, 1)],
      [0.8, 0.86, () => d.tree(0.8, 0.86, 2)],
    ]);
    return;
  }
  d.parts([
    [0.5, 0.5, () => {
      d.box(0.08, 0.08, 0.84, 0.84, 8, brick);
      d.windows(0.08, 0.08, 0.84, 0.84, 8, t.x + t.y);
      d.flat(0.09, 0.09, 0.82, 0.82, 8.1, "#858978");
      const twin = d.w >= 3 && level === 4, tw = twin ? 0.34 : 0.56, tx = twin ? 0.12 : 0.22;
      const towers = [[tx + tw / 2, 0.49, () => {
        d.box(tx, 0.2, tw, 0.58, hh, n > 0.5 ? glass : wall, 8);
        d.windows(tx, 0.2, tw, 0.58, hh, t.x + t.y, n > 0.5, 8);
        d.bands(tx - 0.003, 0.197, tw + 0.006, 0.586, 16, hh + 8, 8, "#d1c4a0");
        d.flat(tx + 0.02, 0.22, tw - 0.04, 0.54, hh + 8.1, "#6f7368");
        d.box(tx + tw * 0.35, 0.42, tw * 0.3, 0.16, 5, "#a39e88", hh + 8);
      }]];
      if (twin) towers.push([0.71, 0.49, () => {
        d.box(0.54, 0.2, 0.34, 0.58, hh - 12, wall, 8);
        d.windows(0.54, 0.2, 0.34, 0.58, hh - 12, t.y * 5, false, 8);
        d.flat(0.56, 0.22, 0.3, 0.54, hh - 3.9, "#6f7368");
      }]);
      d.parts(towers);
    }],
    [0.1, 0.9, () => d.tree(0.1, 0.9, 0)],
    [0.9, 0.1, () => d.tree(0.9, 0.1, 2)],
  ]);
}

// Distinct silhouettes break up the repeated office slabs in mature districts.
function signatureTower(d, t, n, level) {
  const style = Math.floor(n * 3), height = 42 + level * 24;
  const stone = pick(["#d8c9aa", "#c6b8a1", "#d6d5c8"], n);
  const glass = pick(["#527f91", "#548c94", "#678a9c"], n);
  d.flat(0.02, 0.02, 0.96, 0.96, 0.25, "#bbb9a7");
  d.flat(0.07, 0.78, 0.86, 0.13, 0.4, "#d8d0b7");
  d.parts([
    [0.5, 0.48, () => {
      d.box(0.07, 0.07, 0.86, 0.74, 10, stone);
      d.windows(0.07, 0.07, 0.86, 0.74, 10, t.x + t.y, true);
      d.flat(0.08, 0.08, 0.84, 0.72, 10.1, "#84958b");
      if (style === 0) {
        // Limestone setbacks and a patinated copper crown.
        const tiers = [[0.15, 0.12, 0.7, 0.62, height * 0.58], [0.23, 0.2, 0.54, 0.46, height * 0.27], [0.33, 0.28, 0.34, 0.3, height * 0.15]];
        let base = 10;
        for (const [x, y, w, h, rise] of tiers) {
          d.box(x, y, w, h, rise, stone, base);
          d.windows(x, y, w, h, rise, t.x * 3 + t.y, false, base, true, 7);
          d.fins(x, y, w, h, rise, base, "#e7dcc6", 0.8);
          d.box(x - 0.008, y - 0.008, w + 0.016, h + 0.016, 1.4, "#e1d5bb", base + rise);
          base += rise + 1.4;
        }
        d.hip(0.33, 0.28, 0.34, 0.3, base, 13, "#538b80", 0.06);
        d.line(0.5, 0.43, base + 13, 0.5, 0.43, base + 30, "#c8d1c5", 1);
      } else if (style === 1) {
        // Slim blue-glass tower with a recessed mechanical crown.
        d.box(0.2, 0.15, 0.6, 0.54, height, glass, 10);
        d.windows(0.2, 0.15, 0.6, 0.54, height, t.x + t.y * 5, true, 10, true, 6);
        d.bands(0.2, 0.15, 0.6, 0.54, 16, height + 10, 12, "#94b4bc");
        for (const x of [0.2, 0.8]) for (const y of [0.15, 0.69]) d.line(x, y, 10, x, y, height + 16, "#b7cdd0", 1.25);
        d.box(0.24, 0.19, 0.52, 0.46, 6, "#658a94", height + 10);
        d.flat(0.25, 0.2, 0.5, 0.44, height + 16.1, "#98b8b7");
        d.box(0.33, 0.29, 0.34, 0.25, 5, "#405a67", height + 16);
      } else {
        // Stacked garden terraces: each roof stays visible around the next tier.
        let base = 10;
        for (let tier = 0; tier < 3; tier++) {
          const x = 0.14 + tier * 0.075, y = 0.12 + tier * 0.07;
          const w = 0.72 - tier * 0.15, h = 0.62 - tier * 0.14, rise = height / 3;
          d.box(x, y, w, h, rise, glass, base);
          d.windows(x, y, w, h, rise, t.x + tier * 11, true, base, true, 6);
          d.bands(x, y, w, h, base + 6, base + rise, 6, "#b2c6c0");
          base += rise;
          d.flat(x, y, w, h, base + 0.1, "#a9baa2");
          d.box(x + 0.02, y + h - 0.05, w - 0.04, 0.035, 2.2, "#57815a", base + 0.2);
          d.box(x + w - 0.05, y + 0.02, 0.035, h - 0.09, 2.2, "#678b5f", base + 0.2);
        }
        d.box(0.41, 0.36, 0.18, 0.15, 5, "#778f94", base);
      }
    }],
    [0.1, 0.9, () => d.tree(0.1, 0.9, 0)],
    [0.88, 0.88, () => d.tree(0.88, 0.88, 1)],
  ]);
}

function commercial(d, t, n, level, r) {
  const density = t.density;
  const stone = pick(STONE, n), glass = pick(GLASS, n * 3);
  d.flat(0.025, 0.025, 0.95, 0.95, 0.2, "#b1aea0");
  if (density === 1) {
    // Corner shops, a diner or a filling station, with a parking strip.
    const hh = 10 + level * 2;
    const fam = Math.floor(n * 5) % 3;
    d.flat(0.05, 0.62, 0.9, 0.33, 0.3, "#727b72");
    for (let a = 0.12; a < 0.9; a += 0.17) d.flat(a, 0.66, 0.018, 0.25, 0.5, "#ccc9ae");
    if (fam === 1) {
      // Diner: rounded front, neon sign.
      d.box(0.1, 0.16, 0.8, 0.4, 9, "#d9d6cc"); d.windows(0.1, 0.16, 0.8, 0.4, 9, t.x + t.y, true);
      d.cyl(0.5, 0.56, 0.16, 9, "#c9c6bb"); d.flat(0.08, 0.14, 0.84, 0.44, 9.1, "#b34a3a");
      d.box(0.36, 0.3, 0.28, 0.06, 6, pick(["#e0455a", "#39b8c9", "#f2c14e"], n), 9); d.line(0.5, 0.33, 15, 0.5, 0.33, 22, "#e0e0d8", 1);
    } else if (fam === 2 && level <= 2) {
      // Filling station: canopy on posts, kiosk at the back.
      d.box(0.12, 0.08, 0.5, 0.3, 8, stone); d.windows(0.12, 0.08, 0.5, 0.3, 8, t.x + t.y, true); d.flat(0.11, 0.07, 0.52, 0.32, 8.1, "#8b8e7d");
      for (const [a, b] of [[0.2, 0.5], [0.8, 0.5], [0.2, 0.9], [0.8, 0.9]]) d.line(a, b, 0.5, a, b, 9, "#c9c9c9", 1.2);
      d.flat(0.12, 0.44, 0.76, 0.5, 9, pick(["#d94a3a", "#2f7fb3", "#3a9a5a"], n)); d.flat(0.14, 0.46, 0.72, 0.46, 9.2, "#e9e9e2");
      for (const a of [0.35, 0.65]) d.box(a, 0.66, 0.06, 0.1, 4, "#e0453f");
    } else {
      d.box(0.08, 0.1, 0.84, 0.48, hh, stone); d.windows(0.08, 0.1, 0.84, 0.48, hh, t.x + t.y, true);
      d.flat(0.07, 0.09, 0.86, 0.5, hh + 0.1, "#8b8e7d");
      d.box(0.09, 0.55, 0.82, 0.07, 3, pick(["#a24d3e", "#3e7377", "#b28e48", "#617844", "#7b4f7d"], n), hh - 4);
      d.box(0.3, 0.2, 0.19, 0.15, 3, "#bec0ad", hh);
      if (level >= 3) d.box(0.62, 0.15, 0.2, 0.2, 8, "#c9c3a1", hh);
    }
    for (let a = 0; a < 3; a++) d.box(0.14 + a * 0.25, 0.75, 0.095, 0.17, 3, pick(["#e3dbb9", "#698c9a", "#a66049", "#c9c3a1"], (n + a * 0.23) % 1));
    return;
  }
  if (density === 2) {
    // Office blocks, hotels and department stores.
    const hh = 16 + level * 7;
    const fam = Math.floor(n * 7) % 3;
    if (fam === 1) {
      // Hotel: entrance canopy and a rooftop sign.
      d.box(0.1, 0.08, 0.8, 0.7, hh + 6, pick(["#c9b9a0", "#d8cbb2", "#b9a68b"], n)); d.windows(0.1, 0.08, 0.8, 0.7, hh + 6, t.x + t.y);
      d.bands(0.08, 0.06, 0.84, 0.74, 8, hh + 6, 8, "#d8d0ba");
      d.flat(0.11, 0.09, 0.78, 0.68, hh + 6.1, "#777e70");
      d.box(0.3, 0.78, 0.4, 0.14, 1, "#9a3a3a", 7); for (const a of [0.32, 0.66]) d.line(a, 0.9, 0, a, 0.9, 7, "#c9c9c9", 0.8);
      d.box(0.25, 0.3, 0.5, 0.06, 5, "#e0a83a", hh + 6);
    } else if (fam === 2) {
      // Department store: wide, few windows, big awning.
      d.box(0.06, 0.08, 0.88, 0.76, hh - 4, pick(["#d9d0bc", "#e2dccb", "#cbc3ae"], n)); d.windows(0.06, 0.08, 0.88, 0.76, hh - 4, t.x + t.y, true);
      d.flat(0.07, 0.09, 0.86, 0.74, hh - 3.9, "#8b8e7d");
      d.box(0.1, 0.84, 0.8, 0.08, 2, pick(["#a24d3e", "#3e7377", "#7b4f7d"], n), 9);
      d.box(0.3, 0.3, 0.4, 0.3, 4, "#b2b3a0", hh - 4);
    } else {
      d.box(0.08, 0.08, 0.84, 0.84, hh, stone); d.windows(0.08, 0.08, 0.84, 0.84, hh, t.x + t.y, level >= 3);
      d.bands(0.065, 0.065, 0.87, 0.87, 8, hh, 8, "#c9c5ad");
      d.box(0.06, 0.06, 0.88, 0.88, 3, "#d3cbb2", hh); d.flat(0.13, 0.13, 0.74, 0.74, hh + 3.1, "#777e70");
      d.box(0.3, 0.27, 0.18, 0.2, 4, "#b2b3a0", hh + 3);
      if (d.w > 1) { d.box(0.6, 0.6, 0.25, 0.25, 6, "#c3b9a0", hh + 3); }
    }
    return;
  }
  if (d.w >= 2 && random(t.x, t.y, 37) < 0.45) { signatureTower(d, t, n, level); return; }
  // Skyscrapers: setbacks, glass curtain walls, spire at level 4.
  const hh = 40 + level * 24 + Math.floor(n * 4) * 6;
  const fam = Math.floor(n * 3);
  d.box(0.06, 0.06, 0.88, 0.88, 10, stone); d.windows(0.06, 0.06, 0.88, 0.88, 10, t.x + t.y, true);
  d.flat(0.07, 0.07, 0.86, 0.86, 10.1, "#6c7f75");
  const w1 = fam === 1 ? 0.52 : 0.66, d1 = fam === 2 ? 0.5 : 0.66;
  const gx = 0.5 - w1 / 2, gy = 0.5 - d1 / 2;
  d.box(gx, gy, w1, d1, hh, glass, 10); d.windows(gx, gy, w1, d1, hh, t.x + t.y, true, 10, !t.abandoned, 6);
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
  drawIndustrialYard(d, t, n, level);
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
  // A ground station: a dish aimed at the collector satellite, ringed by
  // rectifier arrays that turn the beam back into current.
  microwave(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.3, "#8e9490");
    for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
      const a = 0.06 + col * 0.3, b = 0.06 + row * 0.22;
      d.box(a, b, 0.24, 0.16, 2.5, "#79837f"); d.flat(a + 0.01, b + 0.01, 0.22, 0.14, 2.8, "#40525c");
    }
    d.cyl(0.5, 0.68, 0.1, 16, "#c9ccc2");
    d.cyl(0.5, 0.68, 0.19, 3, "#dfe2d6", 16);
    d.cyl(0.5, 0.68, 0.13, 4, "#aeb6ac", 19);
    d.line(0.5, 0.68, 23, 0.5, 0.68, 40, "#e8ecdf", 1.2);
    d.box(0.08, 0.84, 0.3, 0.12, 9, "#b6bbb0"); d.windows(0.08, 0.84, 0.3, 0.12, 9, t.x + t.y, true);
    d.fence(0.03, 0.97, 0.94, 0, "#7f867e");
  },
  // Containment torus under a vented hall, with the cryogenic plant beside it.
  fusion(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.3, "#93998f");
    d.cyl(0.42, 0.44, 0.3, 26, "#cfd4c8");
    d.cyl(0.42, 0.44, 0.22, 6, "#9fb6bd", 26);
    d.cyl(0.42, 0.44, 0.12, 5, "#cfe6ea", 32);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047 + n;
      d.box(0.42 + Math.cos(a) * 0.26 - 0.03, 0.44 + Math.sin(a) * 0.26 - 0.03, 0.06, 0.06, 30, "#b8bdb2");
    }
    d.box(0.06, 0.78, 0.34, 0.16, 15, "#c2c6ba"); d.windows(0.06, 0.78, 0.34, 0.16, 15, t.x + t.y, true);
    d.roof(0.04, 0.76, 0.38, 0.2, 15, 5, "#6c7570");
    d.cyl(0.86, 0.16, 0.07, 22, "#dde0d4"); d.cyl(0.86, 0.16, 0.075, 3, "#8fb0b8", 22);
    d.box(0.76, 0.72, 0.2, 0.22, 10, "#b6bbb0");
    d.fence(0.03, 0.97, 0.94, 0, "#828a80");
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
  // Reverse-osmosis racks under a long hall, with intake pipework running to
  // the shore and brine tanks behind.
  desalination(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.3, "#93a09c");
    d.box(0.08, 0.14, 0.62, 0.34, 15, "#c3c9c0"); d.windows(0.08, 0.14, 0.62, 0.34, 15, t.x + t.y, true);
    d.roof(0.06, 0.12, 0.66, 0.38, 15, 5, "#5d7078");
    for (let i = 0; i < 4; i++) {
      const a = 0.1 + i * 0.16;
      d.cyl(a, 0.62, 0.055, 9, "#aebbb8");
      d.line(a, 0.56, 6, a, 0.68, 6, "#7d8f92", 1.2);
    }
    d.cyl(0.82, 0.28, 0.09, 13, "#d5dad0"); d.cyl(0.82, 0.28, 0.095, 2.5, "#6f9fb0", 13);
    d.cyl(0.82, 0.62, 0.09, 9, "#c6cdc4");
    d.box(0.1, 0.82, 0.5, 0.12, 5, "#9fa9a2");
    d.line(0.6, 0.88, 2.5, 0.96, 0.88, 2.5, "#6f8f9c", 2.2);
    d.fence(0.03, 0.97, 0.94, 0, "#7d877f");
  },
  // A county jail: a low cell block behind a walled yard, with a watchtower.
  jail: drawJail,
  police: drawPolice,
  fire: drawFire,
  hospital: drawHospital,
  school: drawSchool,
  college: drawCollegeCampus,
  library: drawLibrary,
  museum: drawMuseum,
  landfill: drawLandfill,
  incinerator: drawIncinerator,
  // Burns refuse and sells the heat back to the grid: a boiler hall with a
  // scrubbed stack, a turbine house and the switchyard that ties it in.
  wasteenergy: drawWasteEnergy,
  recycling: drawRecycling,
  park: drawPocketPark,
  largepark: drawGardenPark,
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
  seaport: drawPort,
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
  stadium: drawStadium,
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
  gigamall(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#9a9a90");
    // Parking on the street side, a long low hall with a glass atrium.
    for (let a = 0.08; a < 0.9; a += 0.1) d.line(a, 0.7, 0.4, a, 0.94, 0.4, "#c9c8bc", 0.6);
    for (let i = 0; i < 5; i++) d.box(0.1 + i * 0.17, 0.76, 0.1, 0.12, 3, pick(["#e3dbb9", "#698c9a", "#a66049", "#c9c3a1", "#8a8f96"], (n + i * 0.23) % 1));
    d.box(0.06, 0.08, 0.88, 0.56, 16, "#d9d2c0"); d.flat(0.07, 0.09, 0.86, 0.54, 16.1, "#b9b3a3");
    d.box(0.34, 0.16, 0.32, 0.4, 8, "#8fb2c4", 16); d.roof(0.32, 0.14, 0.36, 0.44, 24, 6, "#6f98ad");
    d.box(0.08, 0.6, 0.84, 0.05, 6, "#c94a3c", 12); d.flat(0.36, 0.58, 0.28, 0.06, 20, "#f2d36b");
    d.tree(0.03, 0.97, 1); d.tree(0.97, 0.97, 2);
  },
  marina: drawMarina,
  university(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#7c9a56");
    d.flat(0.3, 0.3, 0.4, 0.4, 0.3, "#c9c3a6"); d.flat(0.47, 0.1, 0.06, 0.8, 0.35, "#c9c3a6"); d.flat(0.1, 0.47, 0.8, 0.06, 0.35, "#c9c3a6");
    // Main hall with a dome, two wings and a library block.
    d.box(0.3, 0.06, 0.4, 0.24, 20, "#d8cbb0"); d.windows(0.3, 0.06, 0.4, 0.24, 20, t.x + t.y); d.roof(0.28, 0.04, 0.44, 0.28, 20, 5, "#5f6b66");
    for (const a of [0.34, 0.42, 0.5, 0.58, 0.66]) d.box(a, 0.3, 0.03, 0.03, 20, "#eee8d8");
    d.cyl(0.5, 0.18, 0.08, 6, "#c4bda6", 25); d.cyl(0.5, 0.18, 0.06, 5, "#6c8f82", 31);
    d.box(0.06, 0.06, 0.2, 0.36, 14, "#c9bc9f"); d.windows(0.06, 0.06, 0.2, 0.36, 14, t.x + 3 * t.y); d.roof(0.04, 0.04, 0.24, 0.4, 14, 4, "#6e4b3c");
    d.box(0.74, 0.06, 0.2, 0.36, 14, "#c9bc9f"); d.windows(0.74, 0.06, 0.2, 0.36, 14, t.x * 3 + t.y); d.roof(0.72, 0.04, 0.24, 0.4, 14, 4, "#6e4b3c");
    d.box(0.06, 0.62, 0.3, 0.32, 12, "#b9a98f"); d.windows(0.06, 0.62, 0.3, 0.32, 12, t.x + t.y + 5, true); d.flat(0.07, 0.63, 0.28, 0.3, 12.1, "#6f7a72");
    d.tree(0.62, 0.7, 1); d.tree(0.78, 0.84, 2); d.tree(0.9, 0.62, 0); d.tree(0.66, 0.92, 3);
  },
  medcenter(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, "#aab3ad");
    d.box(0.08, 0.1, 0.56, 0.5, 38, "#e9ecec"); d.windows(0.08, 0.1, 0.56, 0.5, 38, t.x + t.y, true);
    d.flat(0.09, 0.11, 0.54, 0.48, 38.1, "#a7b2b4");
    d.cyl(0.36, 0.35, 0.12, 0.8, "#c5cccb", 38.2); d.line(0.29, 0.35, 39, 0.43, 0.35, 39, "#e8544a", 1.4); d.line(0.36, 0.3, 39, 0.36, 0.4, 39, "#e8544a", 1.4);
    d.box(0.66, 0.1, 0.28, 0.4, 16, "#dfe3e1"); d.windows(0.66, 0.1, 0.28, 0.4, 16, t.x * 2 + t.y, true); d.flat(0.67, 0.11, 0.26, 0.38, 16.1, "#9fb2b6");
    d.box(0.08, 0.66, 0.5, 0.26, 10, "#d3d8d5"); d.windows(0.08, 0.66, 0.5, 0.26, 10, t.x + t.y * 2);
    d.box(0.26, 0.6, 0.12, 0.06, 4, "#e8544a", 10); d.box(0.29, 0.6, 0.06, 0.06, 6, "#e8544a", 10);
    d.flat(0.64, 0.6, 0.3, 0.34, 0.4, "#8d9a95"); d.box(0.7, 0.7, 0.16, 0.12, 5, "#f2f2ec"); d.box(0.72, 0.68, 0.06, 0.04, 3, "#e8544a", 5);
    d.tree(0.94, 0.96, 1);
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
  const d = scoped(r, lot, !!t.abandoned, t.powered !== false);
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
