import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();
 await page.route('**/zone-lifecycle',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
 await page.goto(`${process.env.CIVIC_TEST_URL||'http://127.0.0.1:4173'}/zone-lifecycle`);
 const result=await page.evaluate(async()=>{
  const {CityRenderer}=await import('/src/renderer.js');
  const {drawCachedArchitecture}=await import('/src/architecture-cache.js');
  const {civicSpriteSpec,civicSpriteKey,preloadCivicSprites,civicSpriteStats}=await import('/src/building-art.js');
  const {CIVIC_SPRITES}=await import('/src/civic-sprite-manifest.js');
  const {zoneVariantFixture}=await import('/tests/zone-art-contract.mjs');
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1000;
  const r=Object.assign(Object.create(CityRenderer.prototype),{base:canvas.getContext('2d'),w:1200,h:1000,zoom:1.5,minZoom:.3,maxZoom:2.8,dpr:1,size:64,panX:0,panY:0,rotation:0,night:false,platform:0,pickables:[],paintEpoch:1});
  r.pick=()=>({miss:true});r.focusOn(2.5,2.5,1.5);
  let requests=0;const loaded=[];const desc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
  Object.defineProperty(HTMLImageElement.prototype,'src',{...desc,set(value){requests++;loaded.push(value);desc.set.call(this,value);}});
  const tile={x:2,y:2,type:'residential',elev:0,density:1,level:1,variant:.3,age:10,powered:true,lot:{x:2,y:2,w:1,h:1}};
  const paint=t=>{r.pickables=[];drawCachedArchitecture(r,t,{tiles:[]});r.dirty=false;return r.pickables[0];};
  const warm=async t=>preloadCivicSprites({types:[civicSpriteKey(t)],variant:Math.floor(t.variant*(civicSpriteSpec(t).variants?.length||1)),night:r.night,powered:t.powered!==false&&!t.abandoned,owner:r});
  paint(tile);await warm(tile);const original=paint(tile).canvas;
  tile.level=4;paint(tile);await warm(tile);const grown=paint(tile).canvas;
  if(original===grown)throw new Error('Growth reused the previous stage');
  tile.age=0;const construction=paint(tile);
  if(construction.canvas)throw new Error('Construction must use exact pixel picking for overlay bounds');
  const h=civicSpriteSpec(tile).height+10;
  const tip=r.project(tile.x+.85,tile.y+.15,h);
  if(r.pickObject(tip.x,tip.y).x!==tile.x)throw new Error('Construction crane cannot be picked');
  tile.age=10;tile.abandoned=true;r.night=true;const abandonStart=loaded.length;await warm(tile);const abandoned=paint(tile);
  const unpowered=civicSpriteSpec(tile).frames['unpowered-0-v1'];
  if(loaded.slice(abandonStart).some(url=>!url.endsWith(unpowered.file)))throw new Error('Abandoned night artwork requested powered windows');
  // Frames decode at the resolution this viewer draws, so the canvas is a
  // fraction of the export. Which frame was chosen is already proven by the
  // requested file above; this checks the unpowered export is what decoded.
  const drawn=Math.ceil(unpowered.width*Math.min(1,(r.zoom*(r.dpr||1))/civicSpriteSpec(tile).scale));
  if(abandoned.canvas.width!==drawn)throw new Error('Abandoned art did not use the unpowered frame');
  // Stress a mixed city with every authored zone layout and all fixed types.
  r.zoom=.5;r.dpr=2;r.night=false;r.paintEpoch+=3;r.pickables=[];
  const fixtures=[];
  for(const [key,spec] of Object.entries(CIVIC_SPRITES))for(let v=0;v<(spec.zone?spec.variants.length:1);v++){
   const size=spec.tiles??spec.footprint.w;
   const placement=zoneVariantFixture(spec,v);
   fixtures.push({key,v,t:{...placement,type:key,...spec.zone,elev:0,age:10,powered:true,lot:{x:placement.x,y:placement.y,w:size,h:spec.footprint?.h??size}}});
  }
  requests=0;
  let peak=0;
  for(const f of fixtures){await preloadCivicSprites({types:[f.key],variant:f.v,owner:r});drawCachedArchitecture(r,f.t,{tiles:[]});const stats=civicSpriteStats();peak=Math.max(peak,stats.decodedBytes);if(stats.decodedBytes>stats.maxDecodedBytes)throw new Error('Mixed city exceeds cache cap');}
  const before=requests;r.paintEpoch++;r.pickables=[];
  for(const f of fixtures)drawCachedArchitecture(r,f.t,{tiles:[]});
  if(requests!==before)throw new Error('Mixed city reloads its visible working set');
  if(r.pickables.length!==fixtures.length)throw new Error('Mixed city lost picking coverage');
  return {fixtures:fixtures.length,requests,peak};
 });
 assert.ok(result.fixtures>=150);console.log('Zone growth, construction picking, abandonment and mixed-city working set pass.',result);
}finally{await browser.close();}
