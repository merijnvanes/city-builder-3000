import {faceLight} from './sunlight.js';
import {shadeHex} from './art-colors.js';
import {ELEV_PX} from './render-scale.js';
import {waterSurface} from './sim/surface-water.js';

// A developed site owns its grade. Roads and open ground meet its perimeter
// instead of averaging a dip underneath the slab. At terraced lots, the lower
// pad owns the shared vertex and the higher pad supplies the retaining wall.
// Water remains level and shores retain a wall down to that waterline.
function vertexHeight(city,x,y,gradedOnly) {
  let pad=Infinity,water=Infinity,sum=0,count=0;
  for(const [dx,dy] of [[-1,-1],[0,-1],[-1,0],[0,0]]) {
    const tx=x+dx,ty=y+dy;
    if(tx<0 || ty<0 || tx>=city.size || ty>=city.size)continue;
    const t=city.tiles[ty*city.size+tx];
    sum+=(t.terrain==='water'?waterSurface(t):(t.elev || 0))*ELEV_PX;count++;
    if(t.lot) {
      const anchor=city.tiles[t.lot.y*city.size+t.lot.x];
      if(Number.isFinite(anchor?.elev))pad=Math.min(pad,anchor.elev*ELEV_PX);
    }
    if(t.terrain==='water')water=Math.min(water,waterSurface(t)*ELEV_PX);
  }
  return pad===Infinity?(gradedOnly?null:count?sum/count:0):Math.min(pad,water);
}

export const lotVertexHeight=(city,x,y)=>vertexHeight(city,x,y,true);
export const terrainVertexHeight=(city,x,y)=>vertexHeight(city,x,y,false);

export function foundationEdges(r,t,cell=null) {
  const {x,y,w,h}=t.lot,top=t.elev*ELEV_PX;
  const edges=[];
  const add=(ax,ay,bx,by,nx,ny)=> {
    const center=r.orient(ax,ay),out=r.orient(ax+nx,ay+ny);
    if(out.x+out.y<=center.x+center.y)return;
    const za=Math.min(top,r.meshZ(ax,ay)),zb=Math.min(top,r.meshZ(bx,by));
    if(top-za<.01 && top-zb<.01)return;
    edges.push({a:[ax,ay,za],b:[bx,by,zb],top,shade:shadeHex('#9c9480',faceLight(nx,ny))});
  };
  if(cell) {
    const {x:cx,y:cy}=cell;
    if(cy===y)add(cx,y,cx+1,y,0,-1);
    if(cy===y+h-1)add(cx,y+h,cx+1,y+h,0,1);
    if(cx===x)add(x,cy,x,cy+1,-1,0);
    if(cx===x+w-1)add(x+w,cy,x+w,cy+1,1,0);
    return edges;
  }
  // Follow every terrain vertex, including dips between a long edge's ends.
  for(let i=0;i<w;i++) {add(x+i,y,x+i+1,y,0,-1);add(x+i,y+h,x+i+1,y+h,0,1);}
  for(let i=0;i<h;i++) {add(x,y+i,x,y+i+1,-1,0);add(x+w,y+i,x+w,y+i+1,1,0);}
  return edges;
}

export function drawLotFoundation(r,t,cell=null) {
  const old=r.platform;
  try {
    r.platform=0;
    for(const {a,b,top,shade} of foundationEdges(r,t,cell)) {
      r.poly([r.project(a[0],a[1],top),r.project(b[0],b[1],top),r.project(...b),r.project(...a)],shade);
    }
    r.platform=t.elev*ELEV_PX;
    const {x,y,w,h}=cell?{x:cell.x,y:cell.y,w:1,h:1}:t.lot;
    r.flat(x,y,w,h,0,t.terrain==='sand'?'#b7b487':t.terrain==='rock'?'#615a53':'#7c914b');
  } finally {r.platform=old;}
}
