import { noise } from './sim/terrain.js';
import { tileAt } from './sim/grid.js';
import { fanValueAt } from './water-geometry.js';

// Beaches meet grass along a contour, not along tile edges.
//
// Every tile carries a sand value: 1 for a sand tile, 0 for grass or rock,
// and for water 1 wherever a beach touches it, so the sand always reaches the
// waterline. The value is sampled at the tile's four corners (the mean of the
// tiles around each vertex) and at its centre, with a little deterministic
// noise so the line wanders. That is the tile's sand field.
//
// The sand region is where the field is at least one half. It is cut from
// the same fan of triangles the terrain is drawn with (water-geometry.js):
// the caller hands over the fan and the pieces of ground it wants sand on,
// which for a shore are the pieces above the waterline, and gets back the
// sandy part of each piece. Because the field is read through the fan's own
// interpolation, the contour is continuous across the map, agrees with the
// waterline cut from the same fan, and a change of terrain anywhere only
// moves the line within the tiles around it.
export const SAND_THRESHOLD = 0.5;
const WANDER = 0.42;
const CARDINAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const EPS = 1e-9;

function tileValue(city, t) {
  if (!t) return null;
  if (t.terrain === 'sand') return 1;
  if (t.terrain !== 'water') return 0;
  return CARDINAL.some(([dx, dy]) => tileAt(city, t.x + dx, t.y + dy)?.terrain === 'sand') ? 1 : 0;
}

const wander = (city, x, y) => (noise(x, y, 2.3, city.seed + 77) - 0.5) * WANDER;

// The field at a vertex of the tile grid.
function vertexValue(city, vx, vy) {
  let sum = 0, count = 0;
  for (const [dx, dy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
    const value = tileValue(city, tileAt(city, vx + dx, vy + dy));
    if (value === null) continue;
    sum += value; count++;
  }
  if (!count) return 0;
  return sum / count + wander(city, vx, vy);
}

// The sand field of one tile: { corners: [nw, ne, se, sw], center }. Rock
// keeps its hard edges and carries no field of its own.
export function sandField(city, t) {
  if (t.terrain === 'rock') return null;
  const { x, y } = t;
  return {
    corners: [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]].map(([vx, vy]) => vertexValue(city, vx, vy)),
    center: tileValue(city, t) + wander(city, x + 0.5, y + 0.5),
  };
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

// The field spread over a fan: its four corners take the corner samples and
// any edge midpoints (a water tile's fan has eight corners) the mean of the
// two corners beside them, which is what linear interpolation along the edge
// gives, so a four-corner neighbour reads the shared edge identically.
export function sandFan(field, fan) {
  const count = fan.corners.length, stride = count / 4;
  const corners = fan.corners.map(([x, y], i) => {
    const k = Math.floor(i / stride), f = (i % stride) / stride;
    const a = field.corners[k], b = field.corners[(k + 1) % 4];
    return [x, y, a + (b - a) * f];
  });
  return { center: [fan.center[0], fan.center[1], field.center], corners };
}

// Clip one convex piece to its sandy side. Points are [x, y, z, value]; the
// result is the polygon (in x, y, z) where value >= SAND_THRESHOLD. Values
// and heights are both linear along an edge, so the crossing point carries
// the height of the ground at that spot.
function clipPiece(points) {
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

const area = polygon => Math.abs(polygon.reduce((sum, [x, y], i) => { const [nx, ny] = polygon[(i + 1) % polygon.length]; return sum + x * ny - nx * y; }, 0)) / 2;

// The sandy part of each piece of ground. `fan` is the fan the pieces were
// cut from ({ center: [x, y], corners: [[x, y], ...] }); each piece is a
// convex [x, y, z] polygon inside one of its sectors. Returns { full, polygons }:
// full when every piece is sand throughout, so the ground can simply be
// painted sand; otherwise the polygons, in map coordinates with the ground
// height at every vertex, that are to be painted over the ground.
export function beachPolygons(field, fan, pieces) {
  if (!field) return { full: false, polygons: [] };
  const values = sandFan(field, fan);
  const valued = pieces.map(piece => piece.map(([x, y, z]) => [x, y, z, fanValueAt(values, x, y)]));
  if (valued.every(piece => piece.every(p => p[3] >= SAND_THRESHOLD))) return { full: true, polygons: pieces };
  const polygons = valued.map(clipPiece).filter(polygon => polygon.length >= 3 && area(polygon) > EPS);
  return { full: false, polygons };
}

// The plain fan of a tile that is not touched by water: four triangles from
// the centre to the corners, at the height of the terrain mesh.
export function meshFan(r, t) {
  const corners = [[t.x, t.y], [t.x + 1, t.y], [t.x + 1, t.y + 1], [t.x, t.y + 1]].map(([x, y]) => [x, y, r.meshZ(x, y)]);
  const center = [t.x + 0.5, t.y + 0.5, corners.reduce((sum, c) => sum + c[2], 0) / 4];
  return { center, corners, pieces: corners.map((c, i) => [center, c, corners[(i + 1) % 4]]) };
}
