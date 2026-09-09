import { noise } from './sim/terrain.js';
import { tileAt } from './sim/grid.js';

// Beaches meet grass along a contour, not along tile edges.
//
// Every tile carries a sand value: 1 for a sand tile, 0 for grass or rock,
// and for water 1 wherever a beach touches it, so the sand always reaches the
// waterline. The value is sampled at the tile's four corners (the mean of the
// tiles around each vertex) and at its centre, with a little deterministic
// noise so the line wanders. The sand region is where the interpolated field
// is at least one half: marching squares over the four triangles of the tile
// fan. Neighbouring tiles share their corner samples, so the contour is
// continuous across the map, and a change of terrain anywhere only moves the
// line within the tiles around it.
const THRESHOLD = 0.5;
const WANDER = 0.42;
const CARDINAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function tileValue(city, t) {
  if (!t) return null;
  if (t.terrain === 'sand') return 1;
  if (t.terrain !== 'water') return 0;
  return CARDINAL.some(([dx, dy]) => tileAt(city, t.x + dx, t.y + dy)?.terrain === 'sand') ? 1 : 0;
}

// The field at a vertex of the tile grid.
function vertexValue(city, vx, vy) {
  let sum = 0, count = 0;
  for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
    const value = tileValue(city, tileAt(city, vx + dx, vy + dy));
    if (value === null) continue;
    sum += value; count++;
  }
  if (!count) return 0;
  return sum / count + (noise(vx, vy, 2.3, city.seed + 77) - 0.5) * WANDER;
}

// Clip one triangle of the fan to the sandy side of the contour. Points are
// [x, y, value]; the result is the polygon (in x, y) where value >= THRESHOLD.
function clipTriangle(points) {
  const out = [];
  let a = points.at(-1);
  for (const b of points) {
    const insideA = a[2] >= THRESHOLD, insideB = b[2] >= THRESHOLD;
    if (insideA !== insideB) {
      const f = (THRESHOLD - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
    if (insideB) out.push([b[0], b[1]]);
    a = b;
  }
  return out;
}

// { full: true } when the whole tile is sand, { full: false, polygons } with
// zero or more polygons in map coordinates otherwise. Rock keeps its edges.
export function sandCoverage(city, t) {
  if (t.terrain === 'rock') return { full: false, polygons: [] };
  const { x, y } = t;
  const corners = [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([vx, vy]) => [vx, vy, vertexValue(city, vx, vy)]);
  const center = [x + 0.5, y + 0.5, tileValue(city, t) + (noise(x + 0.5, y + 0.5, 2.3, city.seed + 77) - 0.5) * WANDER];
  const sandy = corners.every(c => c[2] >= THRESHOLD) && center[2] >= THRESHOLD;
  if (sandy) return { full: true, polygons: [] };
  const polygons = [];
  for (let i = 0; i < 4; i++) {
    const polygon = clipTriangle([center, corners[i], corners[(i + 1) % 4]]);
    if (polygon.length >= 3) polygons.push(polygon);
  }
  return { full: false, polygons };
}

// True when this tile can carry any sand at all: only such tiles need the
// contour worked out. Anything two tiles or more from sand or a beach shore
// is plain ground.
export function nearSand(city, t) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const n = tileAt(city, t.x + dx, t.y + dy);
    if (n && tileValue(city, n) === 1) return true;
  }
  return false;
}
