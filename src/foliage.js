import {shadowPoint,SUN} from './sunlight.js';
import {treeHeight,naturalTrees} from './tree-layout.js';
// Small, deterministic tree silhouettes shared by lots and natural forests.
// Screen-space crowns stay legible at city scale as the map rotates.
import { random } from './building-art.js';
import { withGroundClip } from './ground-effects.js';

function paintTree(r, x, y, variant = 0) {
  const z = r.zoom;
  const species = ((variant % 3) + 3) % 3;
  const height = treeHeight(x,y,variant);
  const foot = r.project(x, y);
  const crown = r.project(x, y, height);
  const orient=r.orient?.bind(r) || ((x,y)=>({x,y}));
  const origin=orient(0,0),sun=orient(-SUN.x,-SUN.y);
  // SUN is displacement per vertical pixel: include that upward pixel so
  // crown highlights follow the elevated light, not its ground projection.
  const lightAngle=Math.atan2((sun.x+sun.y-origin.x-origin.y)*16-1,(sun.x-sun.y-origin.x+origin.y)*32);
  const litIndex=Math.round(lightAngle/(Math.PI*2)*9+9)%9;
  const colors = r.night
    ? ['#203e32', '#2a4d3b', '#385b42', '#486849', '#55744e']
    : ['#304d2b', '#416432', '#587d3b', '#71934b', '#8aa75a'];

  r.line(foot, r.project(x, y, height + 1), '#655239', 1.6);
  if (z >= 0.85) r.line({ x: foot.x + 0.45 * z, y: foot.y - z }, { x: foot.x + 0.45 * z, y: crown.y + 3 * z }, '#9b8054', 0.45);

  if (species === 2) {
    // Conifer: overlapping boughs, shaded toward the right.
    for (let tier = 0; tier < 3; tier++) {
      const width = (7.3 - tier * 1.7) * z;
      const cy = crown.y + (7 - tier * 5) * z;
      const tip = { x: crown.x - 0.5 * z, y: cy - 10 * z };
      const left = { x: crown.x - width, y: cy };
      const bottom = { x: crown.x, y: cy + 2 * z };
      const right = { x: crown.x + width, y: cy };
      r.poly([tip, left, bottom, right], colors[1]);
      r.poly([tip, Math.cos(lightAngle)<0?left:right, bottom], colors[2]);
      r.poly([tip, { x: crown.x + (Math.cos(lightAngle)<0?-1:1) * width * 0.4, y: cy - z }, bottom], colors[3]);
    }
    return;
  }

  const narrow = species === 1;
  const width = (narrow ? 4.2 : 7.4) * z;
  const depth = (narrow ? 9.8 : 6.5) * z;
  const lobes = narrow ? 5 : 7;
  // Lower lobes first, then the sunlit upper crown; unequal contours avoid
  // the repeated oval "lollipop" appearance of the original trees.
  for (let i = 0; i < lobes; i++) {
    const a = i * 2.399;
    const offset = i === lobes - 1 ? 0 : 0.48;
    const cx = crown.x + Math.cos(a) * width * offset;
    const cy = crown.y + Math.sin(a) * depth * offset - (i === lobes - 1 ? 2 * z : 0);
    const rx = width * (0.56 + random(x, y, i + 20) * 0.16);
    const ry = depth * (0.59 + random(y, x, i + 31) * 0.16);
    const points = Array.from({ length: 9 }, (_, j) => {
      const angle = j * Math.PI * 2 / 9;
      const uneven = 0.9 + random(x + i, y + j, 41) * 0.2;
      return { x: cx + Math.cos(angle) * rx * uneven, y: cy + Math.sin(angle) * ry * uneven };
    });
    r.poly(points, colors[1 + (i % 3)]);
    if (z >= 0.65) {
      r.poly([points[(litIndex+7)%9], points[(litIndex+8)%9], points[litIndex], points[(litIndex+1)%9], { x: cx, y: cy }], colors[Math.min(4, 2 + (i % 3))]);
    }
  }
}

function drawTreeShadow(r, x, y, variant) {
  const z = r.zoom, ctx = r.base, foot = r.project(x, y);
  if(r.shadowScene) {
    // Contact darkening belongs to the tree, including trees inside a
    // procedural lot whose distant cast shadow is represented by the site.
    const contact=()=>{ctx.fillStyle='#24352336';ctx.beginPath();ctx.ellipse(foot.x,foot.y,2.3*z,1.1*z,0,0,Math.PI*2);ctx.fill();};
    if(x>=1 && y>=1 && x<=r.size-1 && y<=r.size-1)contact();else withGroundClip(r,contact);
    return;
  }
  const drop=treeHeight(x,y,variant)*.6,point=shadowPoint(x,y,drop),cast=r.project(point[0],point[1]);
  const paint = () => {
    // Contact shadow and a longer soft cast shadow underneath the trunk.
    ctx.fillStyle = '#24352328';
    ctx.beginPath(); ctx.ellipse(cast.x, cast.y, 9 * z, 3.4 * z, -0.12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#24352336';
    ctx.beginPath(); ctx.ellipse(foot.x, foot.y, 2.3 * z, 1.1 * z, 0, 0, Math.PI * 2); ctx.fill();
  };
  if (x >= 1 && y >= 1 && x <= r.size - 1 && y <= r.size - 1) paint();
  else withGroundClip(r, paint);
}

// A small atlas of deterministic crowns keeps forests cheap while panning.
// Cache belongs to the renderer and is discarded on scale/lighting changes.
const atlases = new WeakMap();
export function drawTree(r, x, y, variant = 0) {
  drawTreeShadow(r, x, y, variant);
  const sprite=treeSprite(r,x,y,variant);
  if(!sprite)return paintTree(r,x,y,variant);
  r.base.drawImage(sprite.canvas,sprite.x,sprite.y,sprite.w,sprite.h);
}

// Record natural trees even when the shaded scene atlas skips their draw
// callback. The foliage atlas supplies the same alpha silhouette in both paths.
export function recordTreePicks(r,t) {
  if(!r.pickables)return;
  for(const [x,y,variant] of naturalTrees(t)) {
    const sprite=treeSprite(r,x,y,variant);
    if(sprite)r.pickables.push({t,...sprite});
  }
}

function treeSprite(r,x,y,variant) {
  if(typeof document==='undefined')return null;
  const dpr = Math.max(2, r.dpr || 1), scale = 2;
  const key = `${scale}:${dpr}:${!!r.night}:${r.rotation || 0}`;
  const owner = r.atlasOwner || r;
  let atlas = atlases.get(owner);
  if (!atlas || atlas.key !== key) { atlas = { key, sprites: new Map() }; atlases.set(owner, atlas); }
  const species = ((variant % 3) + 3) % 3;
  const variation = Math.floor(random(x, y, variant) * 24), id = species * 24 + variation;
  let sprite = atlas.sprites.get(id);
  if (!sprite) {
    const canvas = document.createElement('canvas');
    const width = 44 * scale, height = 58 * scale;
    canvas.width = Math.ceil(width * dpr); canvas.height = Math.ceil(height * dpr);
    const base = canvas.getContext('2d'); base.scale(dpr, dpr);
    const proxy = Object.assign(Object.create(r), { base, zoom: scale });
    proxy.project = (_x, _y, z = 0) => ({ x: 22 * scale, y: (46 - z) * scale });
    paintTree(proxy, variation + 0.25, species + 0.5, species);
    sprite = { canvas, width: canvas.width / dpr, height: canvas.height / dpr };
    atlas.sprites.set(id, sprite);
  }
  const p = r.project(x, y);
  const ratio = r.zoom / scale, snap = value => Math.round(value * dpr) / dpr;
  return {canvas:sprite.canvas,x:snap(p.x-22*r.zoom),y:snap(p.y-46*r.zoom),w:sprite.width*ratio,h:sprite.height*ratio};
}
