import { waterSurface } from './sim/surface-water.js';
import {waterGeometry,waterPath,clipAtLevel} from './water-geometry.js';
import {shadeHex} from './art-colors.js';
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
  if (terrain === 'sand') return mix([181, 176, 128], [203, 195, 149], variation);
  if (terrain === 'rock') return mix([86, 80, 73], [110, 103, 92], variation);
  const broad = noise(x, y, 19, city.seed + 31);
  return mix([113, 138, 73], [139, 157, 88], broad * 0.6 + variation * 0.4);
}

export function drawWaterTerrain(r,tile,city,dryColor=null) {
  const old=r.platform;r.platform=0;
  try {
    const geometry=waterGeometry(r,tile),ctx=r.base;
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
    const waterColor=tile.terrain==='water'?(r.surfaceColors?.[tile.y*city.size+tile.x] || surfaceColor(tile,city)):surfaceColor({...tile,terrain:'water'},city);
    waterPath(r,ctx,geometry.wet);ctx.fillStyle=waterColor;ctx.fill();
    waterPath(r,ctx,geometry.shelf);ctx.fillStyle='#b8d1be30';ctx.fill();
    const sand=surfaceColor({...tile,terrain:'sand'},city);
    waterPath(r,ctx,geometry.dry);ctx.fillStyle=dryColor || shadeHex(sand,r.slopeShade?.(tile.x,tile.y) || 1);ctx.fill();
    for(const [a,b] of geometry.shore)r.line(r.project(...a),r.project(...b),'#d1dbc566',.65);
  } finally {r.platform=old;}
}
