export {shadowAtlasStats} from './shadow-atlas.js';
import {drawFromShadowAtlas,rememberShadow} from './shadow-atlas.js';
import {foundationEdges} from './lot-foundations.js';
import {clipShadow,boxFaces,groundQuad,SHADOW_ALPHA} from './sunlight.js';
import {drawCachedArchitecture} from './architecture-cache.js';
import {lotBody} from './shadow-scene.js';
import {bridgePlatform} from './bridge-art.js';
import {waterSurface} from './sim/surface-water.js';
import {ELEV_PX,VIADUCT_HEIGHT} from './render-scale.js';

function path(r,ctx,polygon) {
 polygon.forEach((p,i)=>{const q=r.project(...p);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});ctx.closePath();
}
function intersections(receiver,casters) {
 return casters.map(c=>clipShadow(receiver,c.planes)).filter(p=>p.length>=3);
}
function shadows(r,ctx,polygons) {
 if(!polygons.length)return;
 ctx.beginPath();for(const polygon of polygons)path(r,ctx,polygon);
 ctx.fill(); // One union fill: overlapping casters never multiply darkness.
}
export function drawTerrainShadows(r,t,city) {
 if(r.night || !r.shadowScene)return;
 const scene=r.shadowScene;
 scene.terrainPolygons ??= Array.from({length:4},()=>new Map());
 const cache=scene.terrainPolygons[t.lot?(r.rotation || 0):0];
 let polygons=cache.get(t);
 if(!polygons) {
  const owner=t.lot?city.tiles[t.lot.y*city.size+t.lot.x]:(t.structure?.kind==='bridge' || (t.type==='highway' && t.under)?t:null),casters=scene.candidates(t.x,t.y,1,1,owner),bridge=bridgePlatform(r,t);
  const height=(x,y)=>bridge!==null?(typeof bridge==='function'?bridge(x,y):bridge):t.lot?owner.elev*ELEV_PX:t.terrain==='water'?waterSurface(t)*ELEV_PX:r.meshZ(x,y)+(t.type==='highway' && t.under?VIADUCT_HEIGHT:0);
  const points=[[t.x,t.y],[t.x+1,t.y],[t.x+1,t.y+1],[t.x,t.y+1]].map(([x,y])=>[x,y,height(x,y)]);
  polygons=intersections(points,casters);
  if(t.lot)for(const {a,b,top} of foundationEdges(r,owner,t)) {
    polygons.push(...intersections([[a[0],a[1],top],[b[0],b[1],top],b,a],casters));
  }
  cache.set(t,polygons);
 }
 if(!polygons.length)return;
 const old=r.platform,ctx=r.base;r.platform=0;ctx.save();
 try {ctx.fillStyle=`rgba(21,35,45,${SHADOW_ALPHA})`;shadows(r,ctx,polygons);}
 finally {ctx.restore();r.platform=old;}
}

const buffers=new WeakMap();
function buffer(r,width,height) {
 let entry=buffers.get(r);
 if(!entry){entry={art:document.createElement('canvas'),mask:document.createElement('canvas')};buffers.set(r,entry);}
 const capWidth=Math.ceil(r.w*(r.dpr || 1)),capHeight=Math.ceil(r.h*(r.dpr || 1));
 for(const canvas of [entry.art,entry.mask]) {
  if(canvas.width<width || canvas.width>capWidth)canvas.width=Math.min(Math.ceil(width/128)*128,capWidth);
  if(canvas.height<height || canvas.height>capHeight)canvas.height=Math.min(Math.ceil(height/128)*128,capHeight);
  canvas.getContext('2d').setTransform(1,0,0,1,0,0);canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
 }
 return entry;
}
// Composite on an isolated reusable surface. source-atop on the main city
// canvas would also darken previously painted neighbors through sprite holes.
export function drawShadedArchitecture(r,t,city,paint=()=>drawCachedArchitecture(r,t,city)) {
 const lot=t.lot || {x:t.x,y:t.y,w:1,h:1};
 if(r.night || !r.shadowScene)return paint();
 const scene=r.shadowScene;
 scene.buildingPolygons ??= new Map();
 let views=scene.buildingPolygons.get(t);if(!views)scene.buildingPolygons.set(t,views=[]);
 let geometry=views[r.rotation || 0];
 if(!geometry) {
  const body=scene.bodies.get(t) || lotBody(t),pad=groundQuad(lot.x,lot.y,lot.w,lot.h,t.elev*ELEV_PX),faces=boxFaces(body,r);
  const casters=scene.candidates(lot.x,lot.y,lot.w,lot.h,t).filter(c=>t.lot || c.owner?.lot);
  const groundShadows=intersections(pad,casters);
  for(const face of faces)face.shadows=intersections(face.points,casters);
  geometry={body,pad,faces,groundShadows,active:groundShadows.length || faces.some(f=>f.shadows.length)};
  views[r.rotation || 0]=geometry;
 }
 if(!geometry.active)return paint();
 const anchor=r.project(t.x,t.y);
 if(drawFromShadowAtlas(r,t,city,anchor))return;
 const {body,pad,faces,groundShadows}=geometry,main=r.base,old=r.platform,dpr=r.dpr || 1;
 r.platform=0;
 const projected=[...pad,...faces.flatMap(f=>f.points),...pad.map(([x,y,z])=>[x,y,z+body.h*2+70])].map(p=>r.project(...p));
 const margin=40*r.zoom;
 let left=Math.floor(Math.min(...projected.map(p=>p.x))-margin),top=Math.floor(Math.min(...projected.map(p=>p.y))-margin);
 let right=Math.ceil(Math.max(...projected.map(p=>p.x))+margin),bottom=Math.ceil(Math.max(...projected.map(p=>p.y))+margin);
 const complete=right-left<=r.w && bottom-top<=r.h;
 if(!complete){left=Math.max(0,left);top=Math.max(0,top);right=Math.min(r.w,right);bottom=Math.min(r.h,bottom);}
 r.platform=old;
 if(right<=left || bottom<=top)return paint();
 const width=Math.ceil((right-left)*dpr),height=Math.ceil((bottom-top)*dpr),entry=buffer(r,width,height);
 const art=entry.art.getContext('2d'),mask=entry.mask.getContext('2d');
 for(const ctx of [art,mask])ctx.setTransform(dpr,0,0,dpr,-left*dpr,-top*dpr);
 try {
  r.base=art;paint();r.platform=0;
  mask.fillStyle='#15232d';shadows(r,mask,groundShadows);
  for(const face of faces) {
   // A higher receiving face replaces the ground shadow behind it.
   mask.globalCompositeOperation='destination-out';mask.beginPath();path(r,mask,face.points);mask.fill();
   mask.globalCompositeOperation='source-over';shadows(r,mask,face.shadows);
  }
  mask.setTransform(1,0,0,1,0,0);mask.globalCompositeOperation='destination-in';mask.drawImage(entry.art,0,0,width,height,0,0,width,height);mask.globalCompositeOperation='source-over';
  art.setTransform(1,0,0,1,0,0);art.globalCompositeOperation='source-atop';art.globalAlpha=SHADOW_ALPHA;art.drawImage(entry.mask,0,0,width,height,0,0,width,height);art.globalAlpha=1;art.globalCompositeOperation='source-over';
 } finally {r.base=main;r.platform=old;}
 main.drawImage(entry.art,0,0,width,height,left,top,width/dpr,height/dpr);
 if(complete) {
  const pick=t.lot?r.pickables?.at(-1):null;
  const corners=[...pad,...faces.flatMap(f=>f.points)].map(p=>{const platform=r.platform;r.platform=0;const q=r.project(...p);r.platform=platform;return q;});
  const x=Math.min(...corners.map(p=>p.x))-12*r.zoom,y=Math.min(...corners.map(p=>p.y))-12*r.zoom;
  const crop=pick?.t===t?pick:{x,y,w:Math.max(...corners.map(p=>p.x))-x+12*r.zoom,h:Math.max(...corners.map(p=>p.y))-y+12*r.zoom};
  rememberShadow(r,t,city,anchor,entry.art,{x:left,y:top,width,height},crop);
 }
}
