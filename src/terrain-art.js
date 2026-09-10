import { waterSurface } from './sim/surface-water.js';
import { waterGeometry, waterPath, clipAtLevel } from './water-geometry.js';
import { shadeHex } from './art-colors.js';
import { sandField, nearSand, beachPolygons, meshFan } from './terrain-contours.js';
import { ELEV_PX } from './render-scale.js';
// Broad, continuous color variation keeps natural terrain from reading as a
// checkerboard. The simulation grid remains visible when a tool is selected.
import { noise } from './sim/terrain.js';

const mix = (a, b, amount) => '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('');
const at = (city, x, y) => x >= 0 && y >= 0 && x < city.size && y < city.size ? city.tiles[y * city.size + x] : null;
const EPS = 1e-9;

export function surfaceColor(tile, city) {
  const { x, y, terrain } = tile;
  const variation = noise(x + 0.5, y + 0.5, 6, city.seed);
  if (terrain === 'water') {
    // Shallow teal near the shore, cooler blue in the channel or open sea.
    let distance = 4;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const neighbor = at(city, x + dx, y + dy);
      if (neighbor && neighbor.terrain !== 'water') distance = Math.min(distance, Math.hypot(dx, dy));
    }
    return mix([87, 143, 146], [48, 101, 128], Math.min(1, distance / 4 * 0.87 + variation * 0.13));
  }
  // Pale sand shows every step between tiles, so a beach varies only gently.
  if (terrain === 'sand') return mix([187, 181, 134], [199, 192, 146], variation);
  if (terrain === 'rock') return mix([86, 80, 73], [110, 103, 92], variation);
  const broad = noise(x, y, 19, city.seed + 31);
  return mix([113, 138, 73], [139, 157, 88], broad * 0.6 + variation * 0.4);
}

// Per-tile colours and sand fields, recomputed only when the terrain itself
// changes. Buildings and roads come and go without touching them.
//
// `ground` is the colour of the tile's land: grass for a sand tile, whose
// beach is painted over it, and for a water tile, whose bank above the
// waterline is land like any other. `water` is the surface colour of a water
// tile. `beach` is the sand field of every tile that can carry sand.
const palettes = new WeakMap();
export function terrainPalette(city) {
  let palette = palettes.get(city.tiles);
  if (palette && palette.revision === city.revision) return palette;
  const signature = city.tiles.map(t => t.terrain[0]).join('') + ':' + city.seed;
  if (palette && palette.signature === signature) { palette.revision = city.revision; return palette; }
  palette = {
    revision: city.revision, signature,
    ground: city.tiles.map(t => surfaceColor(t.terrain === 'sand' || t.terrain === 'water' ? { ...t, terrain: 'grass' } : t, city)),
    water: city.tiles.map(t => t.terrain === 'water' ? surfaceColor(t, city) : null),
    sand: city.tiles.map(t => surfaceColor({ ...t, terrain: 'sand' }, city)),
    beach: city.tiles.map(t => nearSand(city, t) ? sandField(city, t) : null),
  };
  palettes.set(city.tiles, palette);
  return palette;
}

const onTileEdge = (t, a, b) => [[0, t.x], [0, t.x + 1], [1, t.y], [1, t.y + 1]]
  .some(([axis, line]) => Math.abs(a[axis] - line) < EPS && Math.abs(b[axis] - line) < EPS);

// The beach of one tile over its ground. All pieces go into one path, so the
// fan's interior edges cannot show a seam. Along the tile's own edges the
// neighbour paints its own share, and two antialiased fills meeting on a
// pixel leave the ground beneath showing through; a one-pixel line in the
// same colour along just those edges closes the seam without thickening the
// contour or the waterline, which are painted edge to edge as they are.
function paintBeach(r, ctx, t, polygons, color) {
  waterPath(r, ctx, polygons);
  ctx.fillStyle = color; ctx.fill();
  ctx.beginPath();
  for (const polygon of polygons) polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    if (!onTileEdge(t, a, b)) return;
    const p = r.project(...a), q = r.project(...b);
    ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
  });
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.lineCap = 'square'; ctx.stroke();
}

// Where a stored pool sits above a lower one, close the drop between them
// with a wall. Natural land boundaries come from the fan itself.
function paintPoolDrops(r, tile, city, geometry) {
  for (const [i, dx, dy] of [[0, 0, -1], [1, 1, 0], [2, 0, 1], [3, -1, 0]]) {
    const neighbor = at(city, tile.x + dx, tile.y + dy);
    if (neighbor?.terrain !== 'water' || waterSurface(neighbor) >= waterSurface(tile) - 1e-7) continue;
    const stride = geometry.corners.length / 4;
    for (let j = i * stride; j < (i + 1) * stride; j++) {
      const a = geometry.corners[j], b = geometry.corners[(j + 1) % geometry.corners.length];
      const edge = clipAtLevel([a, b], geometry.level);
      if (edge.length < 2) continue;
      const low = waterSurface(neighbor) * ELEV_PX, first = edge[0], last = edge.at(-1);
      r.poly([[...first.slice(0, 2), geometry.level], [...last.slice(0, 2), geometry.level],
        [...last.slice(0, 2), Math.max(low, last[2])], [...first.slice(0, 2), Math.max(low, first[2])]].map(p => r.project(...p)), '#527e83');
    }
  }
}

// The ground of one tile, on the terrain mesh. The tile's fan is split by
// the waterline into wet and dry pieces (every tile that touches water; a
// tile far from water is all dry) and the dry pieces by the sand contour.
// Water, land and beach are all cut from that one fan, so they meet exactly.
// `shade` brightens or darkens the land for its slope or height.
export function drawTerrainSurface(r, t, city, shade = 1) {
  const palette = terrainPalette(city), index = t.y * city.size + t.x, ctx = r.base;
  const geometry = waterGeometry(r, t), fan = geometry || meshFan(r, t);
  const pieces = geometry ? geometry.dry : fan.pieces;
  const ground = shadeHex(palette.ground[index], shade), sand = shadeHex(palette.sand[index], shade);
  const coverage = beachPolygons(palette.beach[index], fan, pieces);
  const old = r.platform; r.platform = 0;
  try {
    if (geometry) {
      if (t.terrain === 'water') paintPoolDrops(r, t, city, geometry);
      waterPath(r, ctx, geometry.wet); ctx.fillStyle = palette.water[index] || surfaceColor({ ...t, terrain: 'water' }, city); ctx.fill();
      waterPath(r, ctx, geometry.shelf); ctx.fillStyle = '#b8d1be30'; ctx.fill();
    }
    const base = coverage.full ? sand : ground;
    if (geometry) { if (pieces.length) { waterPath(r, ctx, pieces); ctx.fillStyle = base; ctx.fill(); } }
    else r.poly(fan.corners.map(c => r.project(...c)), base);
    if (!coverage.full && coverage.polygons.length) paintBeach(r, ctx, t, coverage.polygons, sand);
    if (geometry) for (const [a, b] of geometry.shore) r.line(r.project(...a), r.project(...b), '#d1dbc566', .65);
  } finally { r.platform = old; }
}
