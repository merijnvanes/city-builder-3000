import {surfacePlatform} from './deck-geometry.js';
import {waterGeometry} from './water-geometry.js';
import {MIN_ELEVATION,MAX_ELEVATION} from './sim/terrain.js';
import {TILE_W,TILE_H,ELEV_PX,BRIDGE_LIFT,VIADUCT_HEIGHT} from './render-scale.js';

// Height moves the flat inverse projection along the isometric diagonal.
// The legal elevation range bounds this search independently of map size or
// the number of decks. Screen-X rejection leaves only the ray's tiles.
const RADIUS=Math.ceil((Math.max(Math.abs(MIN_ELEVATION),MAX_ELEVATION+1)*ELEV_PX+Math.max(BRIDGE_LIFT,VIADUCT_HEIGHT))/(2*TILE_H))+1;
const CORNERS=[[0,0],[1,0],[1,1],[0,1]];
function surfaceHit(r,t,sx,sy,platform) {
  const old=r.platform;r.platform=platform;
  let points;
  try {points=CORNERS.map(([dx,dy])=>r.project(t.x+dx,t.y+dy));}
  finally {r.platform=old;}
  let inside=false;
  for(let i=0,j=3;i<4;j=i++) {
    const a=points[i],b=points[j];
    if((a.y>sy)!==(b.y>sy) && sx<(b.x-a.x)*(sy-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
function waterHit(r,geometry,sx,sy) {
 const old=r.platform;r.platform=0;
 try {
  return [...geometry.wet,...geometry.dry].some(polygon=>{
   const points=polygon.map(p=>r.project(...p));let inside=false;
   for(let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if((a.y>sy)!==(b.y>sy) && sx<(b.x-a.x)*(sy-a.y)/(b.y-a.y)+a.x)inside=!inside;
   }
   return inside;
  });
 } finally {r.platform=old;}
}
// `decks` includes elevated surfaces in the pick; underground tools ignore them.
export function pickMapSurface(r,sx,sy,decks=true) {
  const flat=r.pickFlat(sx,sy);
  let best=null,depth=-Infinity;
  for(let y=Math.max(0,flat.y-RADIUS);y<=Math.min(r.size-1,flat.y+RADIUS);y++) {
    for(let x=Math.max(0,flat.x-RADIUS);x<=Math.min(r.size-1,flat.x+RADIUS);x++) {
      const t=r.tiles?.[y*r.size+x];if(!t)continue;
      const p=r.orient(x+.5,y+.5),centerX=r.cx+r.panX+(p.x-p.y)*TILE_W*r.zoom;
      if(Math.abs(sx-centerX)>TILE_W*r.zoom)continue;
      const key=p.x+p.y;
      if(key<depth)continue;
      const deck=decks?surfacePlatform(r,t):null;
      const coast=waterGeometry(r,t);
      if(deck!==null && surfaceHit(r,t,sx,sy,deck) || (coast?waterHit(r,coast,sx,sy):surfaceHit(r,t,sx,sy,null))) {
        best={x,y};depth=key;
      }
    }
  }
  // Match terrain paint order, including stable row-major ties, rather than
  // letting a background approach intercept a foreground hill or span.
  return best;
}
