import {drawBridgeFrame} from './bridge-art.js';
import {drawStreet,drawStreetRailings,drawViaduct,drawRamp,streetConnections} from './street-art.js';
import {drawRail} from './rail-art.js';
import {drawDeckShadows} from './shadow-paint.js';
import {drawArchitecture} from './building-art.js';
import {deckKind,surfacePlatform,lotPlatform} from './deck-geometry.js';

// Elevated decks are scene items. Each is painted on an isolated surface so
// the night and data-map tints the ground received apply to the deck alone,
// and its alpha silhouette serves both picking and the traffic mask.
export function drawDeck(r,t,city) {
 const kind=deckKind(t),platform=surfacePlatform(r,t,city),proxy=Object.assign(Object.create(r),{platform});
 const points=[];
 for(const x of [t.x,t.x+1])for(const y of [t.y,t.y+1]) {
  proxy.platform=null;points.push(proxy.project(x,y,-4));
  proxy.platform=platform;points.push(proxy.project(x,y,36));
 }
 const x=Math.max(0,Math.floor(Math.min(...points.map(p=>p.x))-6*r.zoom)),y=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y))-6*r.zoom));
 const right=Math.min(r.w,Math.ceil(Math.max(...points.map(p=>p.x))+6*r.zoom)),bottom=Math.min(r.h,Math.ceil(Math.max(...points.map(p=>p.y))+6*r.zoom));
 if(right<=x || bottom<=y)return;
 const pool=r.deckSprites ||= [],index=r.deckSpriteIndex++,dpr=r.dpr || 1;
 const entry=pool[index] ||= {canvas:document.createElement('canvas')};
 const {canvas}=entry,width=Math.ceil((right-x)*dpr),height=Math.ceil((bottom-y)*dpr);
 if(canvas.width!==width || canvas.height!==height){canvas.width=width;canvas.height=height;}
 const base=canvas.getContext('2d');
 base.setTransform(1,0,0,1,0,0);base.clearRect(0,0,width,height);base.globalCompositeOperation='source-over';base.setTransform(dpr,0,0,dpr,-x*dpr,-y*dpr);
 proxy.base=base;
 if(kind==='bridge') {
  if(t.type==='rail')drawRail(proxy,t,city);else drawStreet(proxy,t,city,{elevated:true});
  drawBridgeFrame(proxy,t);
 } else if(kind==='viaduct')drawViaduct(proxy,t,city,platform);
 else drawRamp(proxy,t,city,platform);
 base.globalCompositeOperation='source-atop';
 drawDeckShadows(proxy,t,city,platform);
 if(r.night || r.overlay!=='none') {
  base.fillStyle=r.night?'#10284288':'#1a222a55';base.fillRect(x,y,right-x,bottom-y);
 }
 base.globalCompositeOperation='source-over';
 if(r.overlay!=='none') {const color=r.heatColor(t);if(color)proxy.flat(t.x,t.y,1,1,.5,color);}
 const hit={t,canvas,x,y,w:width/dpr,h:height/dpr,deck:true};
 r.base.drawImage(canvas,x,y,hit.w,hit.h);
 r.pickables?.push(hit);
}

function surface(r,name) {
 const canvas=r[name] ||= document.createElement('canvas');
 if(canvas.width!==r.canvas.width || canvas.height!==r.canvas.height){canvas.width=r.canvas.width;canvas.height=r.canvas.height;}
 const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.imageSmoothingEnabled=r.base.imageSmoothingEnabled;ctx.imageSmoothingQuality=r.base.imageSmoothingQuality;
 ctx.setTransform(r.dpr,0,0,r.dpr,0,0);return ctx;
}

// Replay opaque silhouettes in scene order. Vehicles can then animate above
// the cached decks while remaining behind nearer solids and railings.
export function buildDeckTrafficMask(r,city) {
 if(r.deckSprites)r.deckSprites.length=r.deckSpriteIndex;
 if(!r.hasDecks)return;
 const ctx=surface(r,'deckTrafficMask'),proxy=Object.assign(Object.create(r),{base:ctx,pickables:null});
 let active=false;
 for(const hit of r.pickables) {
  if(!active && !hit.deck)continue;
  active=true;
  ctx.globalCompositeOperation='destination-out';
  if(hit.polygons)for(const p of hit.polygons)r.poly(p,'#fff',null,ctx);
  else if(hit.canvas) {
   const s=hit.source || {x:0,y:0,w:hit.canvas.width,h:hit.canvas.height};
   ctx.drawImage(hit.canvas,s.x,s.y,s.w,s.h,hit.x,hit.y,hit.w,hit.h);
  } else {proxy.platform=lotPlatform(hit.t);drawArchitecture(proxy,hit.t);}
  if(hit.deck) {
   proxy.platform=surfacePlatform(r,hit.t,city);ctx.globalCompositeOperation='source-over';
   proxy.flat(hit.t.x,hit.t.y,1,1,.5,'#fff');
   ctx.globalCompositeOperation='destination-out';
   if(deckKind(hit.t)==='bridge')drawBridgeFrame(proxy,hit.t);
   else drawStreetRailings(proxy,hit.t,streetConnections(hit.t,city));
  }
 }
 ctx.globalCompositeOperation='source-over';
}

export function beginDeckTraffic(r) {
 return r.hasDecks?surface(r,'deckTraffic'):null;
}
export function compositeDeckTraffic(r) {
 if(!r.hasDecks || !r.deckTrafficMask)return;
 const ctx=r.deckTraffic.getContext('2d');ctx.setTransform(1,0,0,1,0,0);
 ctx.globalCompositeOperation='destination-in';ctx.drawImage(r.deckTrafficMask,0,0);ctx.globalCompositeOperation='source-over';
 r.ctx.drawImage(r.deckTraffic,0,0,r.w,r.h);
}
