import {bridgePlatform} from './bridge-art.js';
import {waterSurface} from './sim/surface-water.js';
import {MIN_ELEVATION,MAX_ELEVATION} from './sim/terrain.js';
import {TILE_W,TILE_H,ELEV_PX,BRIDGE_LIFT} from './render-scale.js';

// Height moves the flat inverse projection along the isometric diagonal.
// The legal elevation range bounds this search independently of map size or
// the number of bridges. Screen-X rejection leaves only the ray's tiles.
const RADIUS=Math.ceil((Math.max(Math.abs(MIN_ELEVATION),MAX_ELEVATION+1)*ELEV_PX+BRIDGE_LIFT)/(2*TILE_H))+1;
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
export function pickTransportSurface(r,sx,sy) {
  const flat=r.pickFlat(sx,sy);
  let best=null,depth=-Infinity;
  for(let y=Math.max(0,flat.y-RADIUS);y<=Math.min(r.size-1,flat.y+RADIUS);y++) {
    for(let x=Math.max(0,flat.x-RADIUS);x<=Math.min(r.size-1,flat.x+RADIUS);x++) {
      const t=r.tiles?.[y*r.size+x];if(!t)continue;
      const p=r.orient(x+.5,y+.5),centerX=r.cx+r.panX+(p.x-p.y)*TILE_W*r.zoom;
      if(Math.abs(sx-centerX)>TILE_W*r.zoom)continue;
      const key=p.x+p.y;
      if(key<depth)continue;
      const deck=bridgePlatform(r,t),ground=t.terrain==='water'?waterSurface(t)*ELEV_PX:null;
      if(deck!==null && surfaceHit(r,t,sx,sy,deck) || surfaceHit(r,t,sx,sy,ground)) {
        best={x,y};depth=key;
      }
    }
  }
  // Match terrain paint order, including stable row-major ties, rather than
  // letting a background approach intercept a foreground hill or span.
  return best;
}
