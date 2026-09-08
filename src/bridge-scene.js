import {bridgePlatform,drawBridgeFrame} from './bridge-art.js';
import {drawStreet} from './street-art.js';
import {drawRail} from './rail-art.js';
import {drawTerrainShadows} from './shadow-paint.js';
import {drawArchitecture} from './building-art.js';
import {ELEV_PX,BRIDGE_LIFT,TILE_H,TILE_W} from './render-scale.js';
import {MIN_ELEVATION,MAX_ELEVATION} from './sim/terrain.js';
import {waterGeometry} from './water-geometry.js';
import {drawLotFoundation} from './lot-foundations.js';

const radius=Math.ceil(((MAX_ELEVATION-MIN_ELEVATION)*ELEV_PX+36)/(2*TILE_H))+2;
function foregroundTerrain(r,t,bounds) {
 const polygons=[],center=r.orient(t.x+.5,t.y+.5),proxy=Object.assign(Object.create(r),{platform:0});
 const add=points=>{if(points.some(p=>p.y>=bounds.y) && points.some(p=>p.y<=bounds.bottom))polygons.push(points);};
 for(let y=Math.max(0,t.y-radius);y<=Math.min(r.size-1,t.y+radius);y++)for(let x=Math.max(0,t.x-radius);x<=Math.min(r.size-1,t.x+radius);x++) {
  const p=r.orient(x+.5,y+.5);
  if(p.x<center.x || p.y<center.y || p.x===center.x && p.y===center.y)continue;
  const screen=proxy.project(x+.5,y+.5);
  if(screen.x+TILE_W*r.zoom<bounds.x || screen.x-TILE_W*r.zoom>bounds.right)continue;
  const tile=r.tiles[y*r.size+x];
  if(tile.lot) {
   const anchor=r.tiles[tile.lot.y*r.size+tile.lot.x];
   const capture=Object.assign(Object.create(proxy),{poly:add});
   drawLotFoundation(capture,anchor,tile);
  } else {
   const g=waterGeometry(r,tile);
   if(g)for(const poly of [...g.wet,...g.dry])add(poly.map(p=>proxy.project(...p)));
   else add([[x,y],[x+1,y],[x+1,y+1],[x,y+1]].map(([x,y])=>proxy.project(x,y,r.meshZ(x,y))));
  }
 }
 return polygons;
}

// Bridges are elevated solids. Keep their alpha silhouette in the same
// ordered list as buildings, for both painting and picking.
export function drawBridgeSolid(r,t,city) {
 const platform=bridgePlatform(r,t),proxy=Object.assign(Object.create(r),{platform});
 const points=[];
 const foot=(t.terrain==='water'?(t.waterLevel ?? t.elev):t.elev)*ELEV_PX-t.structure.elevation*ELEV_PX-BRIDGE_LIFT;
 for(const x of [t.x,t.x+1])for(const y of [t.y,t.y+1])for(const z of [Math.min(-4,foot-4),36])points.push(proxy.project(x,y,z));
 const x=Math.max(0,Math.floor(Math.min(...points.map(p=>p.x))-6*r.zoom)),y=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y))-6*r.zoom));
 const right=Math.min(r.w,Math.ceil(Math.max(...points.map(p=>p.x))+6*r.zoom)),bottom=Math.min(r.h,Math.ceil(Math.max(...points.map(p=>p.y))+6*r.zoom));
 if(right<=x || bottom<=y)return;
 const pool=r.bridgeSprites ||= [],index=r.bridgeSpriteIndex++,dpr=r.dpr || 1;
 const entry=pool[index] ||= {canvas:document.createElement('canvas'),occluded:document.createElement('canvas')};
 const {canvas,occluded}=entry,width=Math.ceil((right-x)*dpr),height=Math.ceil((bottom-y)*dpr);
 for(const c of [canvas,occluded]) {
  if(c.width!==width || c.height!==height){c.width=width;c.height=height;}
  const ctx=c.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);ctx.globalCompositeOperation='source-over';ctx.setTransform(dpr,0,0,dpr,-x*dpr,-y*dpr);
 }
 const base=canvas.getContext('2d');proxy.base=base;
 if(t.type==='rail')drawRail(proxy,t,city);else drawStreet(proxy,t,city);
 drawBridgeFrame(proxy,t);
 base.globalCompositeOperation='source-atop';drawTerrainShadows(proxy,t,city);base.globalCompositeOperation='source-over';
 if(r.night || r.overlay!=='none') {
  base.globalCompositeOperation='source-atop';base.fillStyle=r.night?'#10284288':'#1a222a55';base.fillRect(x,y,right-x,bottom-y);
 }
 if(r.overlay!=='none') {const color=r.heatColor(t);if(color)proxy.flat(t.x,t.y,1,1,.5,color);}
 const cover=foregroundTerrain(r,t,{x,y,right,bottom});
 // Reveal the ground cache where nearer terrain hides this bridge, rather
 // than revealing a rear building through a transparent hole in the bridge.
 const mask=occluded.getContext('2d');
 for(const polygon of cover)r.poly(polygon,'#fff',null,mask);
 mask.globalCompositeOperation='source-in';mask.drawImage(canvas,x,y,width/dpr,height/dpr);
 r.base.save();r.base.globalAlpha=1;r.base.globalCompositeOperation='destination-out';r.base.drawImage(occluded,x,y,width/dpr,height/dpr);r.base.restore();
 r.pickables.push({t,canvas:occluded,x,y,w:width/dpr,h:height/dpr,ground:true});
 base.globalCompositeOperation='destination-out';
 for(const polygon of cover)r.poly(polygon,'#fff',null,base);
 const hit={t,canvas,x,y,w:canvas.width/dpr,h:canvas.height/dpr,bridge:true,cover};
 r.base.drawImage(canvas,x,y,hit.w,hit.h);r.pickables.push(hit);
}

function surface(r,name) {
 const canvas=r[name] ||= document.createElement('canvas');
 if(canvas.width!==r.canvas.width || canvas.height!==r.canvas.height){canvas.width=r.canvas.width;canvas.height=r.canvas.height;}
 const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.imageSmoothingEnabled=r.base.imageSmoothingEnabled;ctx.imageSmoothingQuality=r.base.imageSmoothingQuality;
 ctx.setTransform(r.dpr,0,0,r.dpr,0,0);return ctx;
}

// Replay opaque silhouettes in scene order. Traffic can then animate above
// the cached bridge deck while remaining behind nearer solids and trusses.
export function buildBridgeTrafficMask(r) {
 if(r.bridgeSprites)r.bridgeSprites.length=r.bridgeSpriteIndex;
 if(!r.hasBridges)return;
 const ctx=surface(r,'bridgeTrafficMask'),proxy=Object.assign(Object.create(r),{base:ctx,pickables:null});
 let active=false;
 for(const hit of r.pickables) {
  if(!active && !hit.bridge)continue;
  active=true;
  ctx.globalCompositeOperation='destination-out';
  if(hit.polygons)for(const p of hit.polygons)r.poly(p,'#fff',null,ctx);
  else if(hit.canvas) {
   const s=hit.source || {x:0,y:0,w:hit.canvas.width,h:hit.canvas.height};
   ctx.drawImage(hit.canvas,s.x,s.y,s.w,s.h,hit.x,hit.y,hit.w,hit.h);
  } else {proxy.platform=hit.t.elev*8;drawArchitecture(proxy,hit.t);}
  if(hit.bridge) {
   proxy.platform=bridgePlatform(r,hit.t);ctx.globalCompositeOperation='source-over';
   proxy.flat(hit.t.x,hit.t.y,1,1,.5,'#fff');
   ctx.globalCompositeOperation='destination-out';drawBridgeFrame(proxy,hit.t);
   for(const polygon of hit.cover)r.poly(polygon,'#fff',null,ctx);
  }
 }
 ctx.globalCompositeOperation='source-over';
}

export function beginBridgeTraffic(r) {
 return r.hasBridges?surface(r,'bridgeTraffic'):null;
}
export function compositeBridgeTraffic(r) {
 if(!r.hasBridges || !r.bridgeTrafficMask)return;
 const ctx=r.bridgeTraffic.getContext('2d');ctx.setTransform(1,0,0,1,0,0);
 ctx.globalCompositeOperation='destination-in';ctx.drawImage(r.bridgeTrafficMask,0,0);ctx.globalCompositeOperation='source-over';
 r.ctx.drawImage(r.bridgeTraffic,0,0,r.w,r.h);
}
