import { waterSurface } from './sim/surface-water.js';
import {waterGeometry,waterPath,clipAtLevel} from './water-geometry.js';
import {shadeHex} from './art-colors.js';
import {sandCoverage,nearSand} from './terrain-contours.js';
// Broad, continuous color variation keeps natural terrain from reading as a
// checkerboard. The simulation grid remains visible when a tool is selected.
import { noise } from './sim/terrain.js';

const mix = (a, b, amount) => '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('');
const at = (city, x, y) => x >= 0 && y >= 0 && x < city.size && y < city.size ? city.tiles[y * city.size + x] : null;

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

// Per-tile colours and beach contours, recomputed only when the terrain
// itself changes. Buildings and roads come and go without touching them.
const palettes = new WeakMap();
export function terrainPalette(city) {
  let palette = palettes.get(city.tiles);
  if (palette && palette.revision === city.revision) return palette;
  const signature = city.tiles.map(t => t.terrain[0]).join('') + ':' + city.seed;
  if (palette && palette.signature === signature) { palette.revision = city.revision; return palette; }
  palette = {
    revision: city.revision, signature,
    // Ground colour with sand treated as grass: the beach is painted over it.
    ground: city.tiles.map(t => surfaceColor(t.terrain === 'sand' ? { ...t, terrain: 'grass' } : t, city)),
    sand: city.tiles.map(t => surfaceColor({ ...t, terrain: 'sand' }, city)),
    beach: city.tiles.map(t => t.terrain === 'water' || !nearSand(city, t) ? null : sandCoverage(city, t)),
  };
  palettes.set(city.tiles, palette);
  return palette;
}

// Sand polygons of one tile, projected through the renderer's ground height
// so they follow hills and the terrain fan of a coast. All pieces go into one
// path and the outline is stroked in the same colour: antialiased edges of
// separately filled pieces would otherwise leave hairline seams of the
// ground beneath, between the fan's triangles and between neighbouring tiles.
function paintSand(r, ctx, t, coverage, color) {
  const polygons = coverage.full ? [[[t.x, t.y], [t.x + 1, t.y], [t.x + 1, t.y + 1], [t.x, t.y + 1]]] : coverage.polygons;
  ctx.beginPath();
  for (const polygon of polygons) polygon.forEach(([x, y], i) => { const p = r.project(x, y, 0.04); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.lineJoin = 'round'; ctx.stroke();
}

// One tile of dry ground: base colour, then its share of a beach. A tile
// that is all sand is painted sand outright, with nothing to show through.
export function drawGroundTile(r, t, city, color) {
  const palette = terrainPalette(city), index = t.y * city.size + t.x, coverage = palette.beach[index];
  const sand = coverage ? shadeHex(palette.sand[index], r.slopeShade?.(t.x, t.y) || 1) : null;
  r.flat(t.x, t.y, 1, 1, 0, coverage?.full ? sand : color);
  if (coverage && !coverage.full) paintSand(r, r.base, t, coverage, sand);
}

export function drawWaterTerrain(r,tile,city,dryColor=null) {
  const old=r.platform;r.platform=0;
  try {
    const geometry=waterGeometry(r,tile),ctx=r.base,palette=terrainPalette(city),index=tile.y*city.size+tile.x;
    // Distinct stored pools retain their own level. Close only a true drop
    // between pools; natural land boundaries come from the contour below.
    if(tile.terrain==='water')for(const [i,dx,dy] of [[0,0,-1],[1,1,0],[2,0,1],[3,-1,0]]) {
      const neighbor=at(city,tile.x+dx,tile.y+dy);
      if(neighbor?.terrain!=='water' || waterSurface(neighbor)>=waterSurface(tile)-1e-7)continue;
      const stride=geometry.corners.length/4;
      for(let j=i*stride;j<(i+1)*stride;j++) {
        const a=geometry.corners[j],b=geometry.corners[(j+1)%geometry.corners.length];
        const edge=clipAtLevel([a,b],geometry.level);
        if(edge.length<2)continue;
        const low=waterSurface(neighbor)*8,first=edge[0],last=edge.at(-1);
        r.poly([[...first.slice(0,2),geometry.level],[...last.slice(0,2),geometry.level],
          [...last.slice(0,2),Math.max(low,last[2])],[...first.slice(0,2),Math.max(low,first[2])]].map(p=>r.project(...p)),'#527e83');
      }
    }
    const waterColor=tile.terrain==='water'?palette.ground[index]:surfaceColor({...tile,terrain:'water'},city);
    waterPath(r,ctx,geometry.wet);ctx.fillStyle=waterColor;ctx.fill();
    waterPath(r,ctx,geometry.shelf);ctx.fillStyle='#b8d1be30';ctx.fill();
    const slope=r.slopeShade?.(tile.x,tile.y) || 1;
    // The bank of a water tile is sand where a beach meets it, grass elsewhere.
    const bankSand=tile.terrain==='water' && sandCoverage(city,tile).full;
    waterPath(r,ctx,geometry.dry);ctx.fillStyle=dryColor || shadeHex(bankSand?palette.sand[index]:palette.ground[index],slope);ctx.fill();
    const coverage=tile.terrain==='water'?null:palette.beach[index];
    if(coverage) {
      // The beach is clipped to the dry ground of the tile; the water keeps its edge.
      ctx.save();waterPath(r,ctx,geometry.dry);ctx.clip();
      paintSand(r,ctx,tile,coverage,shadeHex(palette.sand[index],slope));
      ctx.restore();
    }
    for(const [a,b] of geometry.shore)r.line(r.project(...a),r.project(...b),'#d1dbc566',.65);
  } finally {r.platform=old;}
}
