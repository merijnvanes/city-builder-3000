import { noise } from './sim/terrain.js';
import { tileAt } from './sim/grid.js';

// Beaches meet grass along a contour, not along tile edges.
//
// Every tile carries a sand value: 1 for a sand tile, 0 for grass or rock,
// and for water 1 wherever a beach touches it, so the sand always reaches the
// waterline. Those values sit at the tile centres and are blended smoothly
// between them (the same smoothstep the map's value noise uses), with a
// little deterministic noise added so the line wanders: that is the sand
// field, one continuous function over the whole map.
//
// The sand region is where the field is at least one half. It is cut from
// the same triangles the terrain is drawn with (water-geometry.js): the
// caller hands over the pieces of ground it wants sand on, which for a shore
// are the pieces above the waterline, and gets back the sandy part of each.
// Each piece is first split along a fine grid so the polyline follows the
// curve of the field. Neighbouring tiles sample the field at the same points
// along their shared edge, so the contour is continuous across the map, and a
// change of terrain anywhere only moves the line within the tiles around it.
export const SAND_THRESHOLD = 0.5;
export const SUBDIVISIONS = 6;
const WANDER = 0.42;
const CARDINAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const EPS = 1e-9;

function tileValue(city, t) {
  if (t.terrain === 'sand') return 1;
  if (t.terrain !== 'water') return 0;
  return CARDINAL.some(([dx, dy]) => tileAt(city, t.x + dx, t.y + dy)?.terrain === 'sand') ? 1 : 0;
}

// The sand value of every tile, indexed like city.tiles. A sand tile with no
// sand or beach shore beside it (a drained one-tile pond) speaks louder, so
// the spline's peak at it still clears one half and it shows as a patch.
const LONE = 1.8;
export function sandLattice(city) {
  const values = Float32Array.from(city.tiles, t => tileValue(city, t));
  city.tiles.forEach((t, i) => {
    if (t.terrain !== 'sand') return;
    if (!CARDINAL.some(([dx, dy]) => { const n = tileAt(city, t.x + dx, t.y + dy); return n && values[n.y * city.size + n.x] === 1; })) values[i] = LONE;
  });
  return values;
}

// Quadratic B-spline weights of the three tile centres nearest a coordinate:
// the nearest centre and the ones either side. The spline blends across a
// step in the lattice with a gentle S rather than bowing into every tile, so
// a staircase of sand tiles reads as one straight diagonal beach. It reaches
// exactly half way at the edge between a sand tile and a grass tile, the
// same place a straight beach's contour has always run, and a lone sand
// tile still peaks above one half at its centre.
function weights(f) {
  const i = Math.floor(f + 0.5), d = f - i;
  return [i - 1, (0.5 - d) ** 2 / 2, i, 0.75 - d * d, i + 1, (0.5 + d) ** 2 / 2];
}

// The sand field at map point (x, y). Beyond the map edge the nearest tile's
// value continues, so a beach can run off the edge without thinning.
export function sandAt(city, lattice, x, y) {
  const n = city.size, wx = weights(x - 0.5), wy = weights(y - 0.5);
  const clamp = i => Math.max(0, Math.min(n - 1, i));
  let sum = 0;
  for (let j = 0; j < 6; j += 2) {
    const row = clamp(wy[j]) * n, weight = wy[j + 1];
    for (let i = 0; i < 6; i += 2) sum += lattice[row + clamp(wx[i])] * weight * wx[i + 1];
  }
  return sum + (noise(x, y, 2.3, city.seed + 77) - 0.5) * WANDER;
}

// True when this tile can carry any sand at all: only such tiles need the
// contour worked out. The field around any point of a tile two tiles or more
// from sand or a beach shore is only the wander noise, well below one half.
export function nearSand(city, t) {
  if (t.terrain === 'rock') return false;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const n = tileAt(city, t.x + dx, t.y + dy);
    if (n && tileValue(city, n) === 1) return true;
  }
  return false;
}

const area = polygon => Math.abs(polygon.reduce((sum, [x, y], i) => { const [nx, ny] = polygon[(i + 1) % polygon.length]; return sum + x * ny - nx * y; }, 0)) / 2;
const same = (a, b) => Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS;
const clean = polygon => polygon.filter((p, i) => !same(p, polygon[(i + 1) % polygon.length]));

// Split a convex [x, y, z, ...] polygon by the line `axis = value` into the
// parts below and above it. Every coordinate is linear along an edge, so the
// crossing point carries the right height.
function split(polygon, axis, value) {
  const below = [], above = [];
  let a = polygon.at(-1);
  for (const b of polygon) {
    const da = a[axis] - value, db = b[axis] - value;
    if ((da < 0) !== (db < 0)) {
      const f = da / (da - db), p = a.map((v, k) => v + (b[k] - v) * f);
      p[axis] = value; below.push(p); above.push(p);
    }
    (db < 0 ? below : above).push(b);
    a = b;
  }
  return [below, above];
}

// A piece of a tile cut along the sub-grid, so the field can be sampled at
// every cell corner.
function cells(piece, t) {
  let parts = [piece];
  for (const axis of [0, 1]) for (let i = 1; i < SUBDIVISIONS; i++) {
    const line = (axis ? t.y : t.x) + i / SUBDIVISIONS;
    parts = parts.flatMap(part => part.length ? split(part, axis, line) : []);
  }
  return parts.map(clean).filter(part => part.length >= 3 && area(part) > EPS);
}

// Clip one convex cell to its sandy side. Points are [x, y, z, value]; the
// result is the polygon (in x, y, z) where value >= SAND_THRESHOLD.
function clipCell(points) {
  const out = [];
  let a = points.at(-1);
  for (const b of points) {
    const insideA = a[3] >= SAND_THRESHOLD, insideB = b[3] >= SAND_THRESHOLD;
    if (insideA !== insideB) {
      const f = (SAND_THRESHOLD - a[3]) / (b[3] - a[3]);
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
    }
    if (insideB) out.push([b[0], b[1], b[2]]);
    a = b;
  }
  return out;
}

// The sandy part of each piece of ground of tile `t`. Each piece is a convex
// [x, y, z] polygon inside the tile. Returns { full, polygons }: full when
// every piece is sand throughout, so the ground can simply be painted sand;
// otherwise the polygons, in map coordinates with the ground height at every
// vertex, that are to be painted over the ground. Rock keeps its hard edges.
export function beachPolygons(city, lattice, t, pieces) {
  if (t.terrain === 'rock' || !pieces.length) return { full: false, polygons: [] };
  const valued = pieces.flatMap(piece => cells(piece, t)).map(cell => cell.map(([x, y, z]) => [x, y, z, sandAt(city, lattice, x, y)]));
  if (valued.every(cell => cell.every(p => p[3] >= SAND_THRESHOLD))) return { full: true, polygons: pieces };
  const polygons = valued.map(clipCell).map(clean).filter(polygon => polygon.length >= 3 && area(polygon) > EPS);
  return { full: false, polygons };
}

// The plain fan of a tile that is not touched by water: four triangles from
// the centre to the corners, at the height of the terrain mesh.
export function meshFan(r, t) {
  const corners = [[t.x, t.y], [t.x + 1, t.y], [t.x + 1, t.y + 1], [t.x, t.y + 1]].map(([x, y]) => [x, y, r.meshZ(x, y)]);
  const center = [t.x + 0.5, t.y + 0.5, corners.reduce((sum, c) => sum + c[2], 0) / 4];
  return { center, corners, pieces: corners.map((c, i) => [center, c, corners[(i + 1) % 4]]) };
}
