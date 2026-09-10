import {waterSurface,bedElevation} from './sim/surface-water.js';
import {ELEV_PX} from './render-scale.js';

const EPS=1e-7;
export function clipAtLevel(polygon,level,below=true) {
 if(!polygon.length)return [];
 const result=[];
 let a=polygon.at(-1),da=(a[2]-level)*(below?-1:1);
 for(const b of polygon) {
  const db=(b[2]-level)*(below?-1:1);
  if((da>=0)!==(db>=0)) {
   const f=da/(da-db);result.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,level]);
  }
  if(db>=0)result.push(b);
  a=b;da=db;
 }
 const unique=result.filter((p,i)=>!i || p.some((v,k)=>Math.abs(v-result[i-1][k])>EPS));
 if(unique.length>1 && unique[0].every((v,k)=>Math.abs(v-unique.at(-1)[k])<EPS))unique.pop();
 return unique;
}
const area=p=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0))/2;

// Clip a terrain fan against level water. Collinear pieces on the chosen
// terrain diagonal retain a straight contour; excavated pits keep their bed.
export function splitWaterTile(corners,center,level) {
 const wet=[],dry=[],shelf=[],shore=[],triangles=[],boundary=[];
 const count=corners.length,levels=Array.isArray(level)?level:Array(count).fill(level);
 for(let i=0;i<count;i++) {
  const level=levels[i];
  const triangle=[center,corners[i],corners[(i+1)%count]];triangles.push(triangle);
  const a=corners[i],b=corners[(i+1)%count];
  boundary.push([a[0],a[1],level===null?a[2]:Math.max(a[2],level)]);
  if(level===null){dry.push(triangle);continue;}
  if((a[2]<level)!==(b[2]<level)) {
   const f=(level-a[2])/(b[2]-a[2]);boundary.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,level]);
  }
  const below=clipAtLevel(triangle,level),above=clipAtLevel(triangle,level,false);
  if(area(below)>EPS)wet.push(below.map(([x,y])=>[x,y,level]));
  if(area(above)>EPS && triangle.some(p=>p[2]>level+EPS))dry.push(above);
  const band=clipAtLevel(below,level-1.5,false);
  if(below.length && area(band)>EPS)shelf.push(band.map(([x,y])=>[x,y,level]));
  if(triangle.some(p=>p[2]>level+EPS)) {
   const points=below.filter(p=>Math.abs(p[2]-level)<EPS);
   const unique=points.filter((p,i)=>!points.slice(0,i).some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<EPS));
   if(unique.length===2)shore.push(unique);
  }
 }
 // A contour can coincide with the chosen diagonal. The dry-side triangle
 // then has no water level, but its shared edge still borders a wet face.
 for(let i=0;i<count;i++)if(levels[i]===null) {
  for(const [j,shared,other,wetOther] of [[(i+count-1)%count,i,(i+1)%count,(i+count-1)%count],[(i+1)%count,(i+1)%count,i,(i+2)%count]]) {
   const l=levels[j];
   if(l!==null && Math.abs(center[2]-l)<EPS && Math.abs(corners[shared][2]-l)<EPS && corners[other][2]>l+EPS && corners[wetOther][2]<l-EPS)shore.push([center,corners[shared]]);
  }
 }
 if(!dry.length && levels[0]!==null && levels.every(l=>l===levels[0])) {
  wet.splice(0,wet.length,corners.filter((_,i)=>count===4 || i%2===0).map(([x,y])=>[x,y,levels[0]]));
 }
 return {wet,dry,shelf,shore,triangles,level:Math.max(...levels.filter(v=>v!==null)),levels,center,corners,boundary};
}

const cache=new WeakMap();
export function waterGeometry(r,t) {
 let entry=cache.get(r);
 if(!entry || entry.corners!==r.corners) {entry={corners:r.corners,tiles:new WeakMap()};cache.set(r,entry);}
 const level=t.terrain==='water'?waterSurface(t)*ELEV_PX:null,bed=(t.terrain==='water'?bedElevation(t):t.elev || 0)*ELEV_PX;
 if(entry.tiles.has(t)) {
  const prior=entry.tiles.get(t);
  if(level===null || prior?.level===level && prior.sourceBed===bed)return prior;
 }
 // A graded site replaces its ground; a pier over water keeps the water.
 if(t.lot && t.terrain!=='water'){entry.tiles.set(t,null);return null;}
 const neighbors=[];
 if(level===null)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
  const x=t.x+dx,y=t.y+dy;
  if(x<0 || y<0 || x>=r.size || y>=r.size)continue;
  const other=r.tiles?.[y*r.size+x];if(other?.terrain==='water')neighbors.push(other);
 }
 if(level===null && !neighbors.length){entry.tiles.set(t,null);return null;}
 let corners=[[t.x,t.y],[t.x+1,t.y],[t.x+1,t.y+1],[t.x,t.y+1]].map(([x,y])=>[x,y,r.meshZ(x,y)]);
 // Use the gentler diagonal of the corner mesh. In particular, two corners
 // on the waterline form one straight contour across a sloping tile.
 const diagonal=Math.abs(corners[0][2]-corners[2][2])<=Math.abs(corners[1][2]-corners[3][2])?0:1;
 let centerZ=(corners[diagonal][2]+corners[diagonal+2][2])/2;
 // Pits and narrow channels retain their sampled bottom. This depends on
 // terrain, not water level, so raising water cannot make a pond shrink.
 const cardinal=[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dy])=>{
  const x=t.x+dx,y=t.y+dy,n=x>=0 && y>=0 && x<r.size && y<r.size?r.tiles?.[y*r.size+x]:null;
  return n;
 });
 if(level!==null && cardinal.filter(n=>!n || bedElevation(n)*ELEV_PX>bed+EPS).length>=2)centerZ=Math.min(centerZ,bed);
 if(level!==null)corners=corners.flatMap((a,i)=>{
  const b=corners[(i+1)%4],n=cardinal[i];
  const mid=(a[2]+b[2])/2,z=n?.terrain==='water'?Math.min(mid,(bed+bedElevation(n)*ELEV_PX)/2):mid;
  return [a,[(a[0]+b[0])/2,(a[1]+b[1])/2,z]];
 });
 const center=[t.x+.5,t.y+.5,centerZ];
 const count=corners.length,levels=Array(count).fill(level);
 // A dry bank can have a submerged toe. Seed each wet component only from
 // an adjoining body, so a higher pool cannot jump across a dry ridge.
 if(level===null)for(const l of new Set(neighbors.map(n=>waterSurface(n)*ELEV_PX))) {
  const reached=new Set();
  for(let i=0;i<count;i++)if(corners[i][2]<l-EPS && neighbors.some(n=>Math.abs(waterSurface(n)*ELEV_PX-l)<EPS &&
   corners[i][0]>=n.x && corners[i][0]<=n.x+1 && corners[i][1]>=n.y && corners[i][1]<=n.y+1)) {reached.add(i);reached.add((i+count-1)%count);}
  for(let pass=0;pass<count;pass++)for(const i of [...reached])for(const j of [(i+1)%count,(i+count-1)%count]) {
   const corner=j===(i+1)%count?(i+1)%count:i;
   if(Math.min(center[2],corners[corner][2])<l-EPS)reached.add(j);
  }
  for(const i of reached)levels[i]=levels[i]===null?l:Math.max(levels[i],l);
 }
 let geometry=splitWaterTile(corners,center,levels);
 geometry.sourceBed=bed;
 if(!geometry.wet.length && level===null)geometry=null;
 entry.tiles.set(t,geometry);
 return geometry;
}

const sideAt=(geometry,x,y)=>{
 const u=x-geometry.center[0],v=y-geometry.center[1];
 const side=Math.abs(u)>Math.abs(v)?u>0?1:3:v>0?2:0;
 if(geometry.corners.length===4)return side;
 const f=side===0?u:side===1?v:side===2?-u:-v;
 return side*2+(f>0?1:0);
};
export function waterHeightAt(geometry,x,y) {
 const bed=waterBedHeight(geometry,x,y),level=geometry.levels[sideAt(geometry,x,y)];
 return level===null?bed:Math.max(bed,level);
}

// A value sampled at the vertices of a tile fan, read anywhere on the tile:
// linear within each sector, so it is continuous across sectors and along
// tile edges, where it depends only on the two edge vertices. Heights, the
// sand field and anything else cut into contours use this one rule, so their
// contours agree with one another and with the neighbouring tile's.
export function fanValueAt(fan,x,y) {
 const u=x-fan.center[0],v=y-fan.center[1],c=fan.corners;
 const side=sideAt(fan,x,y);
 const a=c[side],b=c[(side+1)%c.length],radius=2*Math.max(Math.abs(u),Math.abs(v));
 if(radius<EPS)return fan.center[2];
 const edgeX=fan.center[0]+u/radius,edgeY=fan.center[1]+v/radius;
 const f=Math.abs(b[0]-a[0])>EPS?(edgeX-a[0])/(b[0]-a[0]):(edgeY-a[1])/(b[1]-a[1]);
 return fan.center[2]*(1-radius)+(a[2]+(b[2]-a[2])*f)*radius;
}

export function waterBedHeight(geometry,x,y) {
 return fanValueAt(geometry,x,y);
}

export function isWaterPoint(r,x,y) {
 const tx=Math.floor(x),ty=Math.floor(y);
 if(tx<0 || ty<0 || tx>=r.size || ty>=r.size)return false;
 const t=r.tiles?.[ty*r.size+tx];if(!t)return false;
 const geometry=waterGeometry(r,t);if(!geometry)return false;
 const level=geometry.levels[sideAt(geometry,x,y)];
 return level!==null && waterBedHeight(geometry,x,y)<level-EPS;
}

export function waterPath(r,ctx,polygons) {
 ctx.beginPath();
 for(const polygon of polygons) {
  const points=polygon.map(p=>r.project(...p));
  const winding=points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a.x*b.y-b.x*a.y;},0);
  // Steep banks can fold in projection. Opposite windings must not cancel
  // one another and cut transparent holes through their opaque union.
  if(winding<0)points.reverse();
  points.forEach((q,i)=>{if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.closePath();
 }
}

// Extra vertices where a level water surface meets a sloped map edge.
export function groundEdgePoints(r,ax,ay,bx,by) {
 const x=Math.max(0,Math.min(r.size-1,Math.floor((ax+bx)/2))),y=Math.max(0,Math.min(r.size-1,Math.floor((ay+by)/2)));
 const t=r.tiles?.[y*r.size+x],geometry=t && waterGeometry(r,t),points=[[ax,ay],[bx,by]];
 if(geometry)for(const [x,y] of geometry.boundary) {
  const f=ax===bx?(y-ay)/(by-ay):(x-ax)/(bx-ax);
  if(f>EPS && f<1-EPS && Math.abs((x-ax)*(by-ay)-(y-ay)*(bx-ax))<EPS)points.push([x,y]);
 }
 return points.sort((a,b)=>ax===bx?(a[1]-b[1])/(by-ay):(a[0]-b[0])/(bx-ax));
}
