import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/park-variant-test',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));
  await page.goto(`${process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173'}/park-variant-test`);
  const result=await page.evaluate(async()=>{
    const {CityRenderer}=await import('/src/renderer.js');
    const {drawCachedArchitecture,architectureCacheStats}=await import('/src/architecture-cache.js');
    const {preloadCivicSprites,civicSpriteStats}=await import('/src/building-art.js');
    const canvas=document.createElement('canvas');canvas.width=canvas.height=600;
    const r=Object.assign(Object.create(CityRenderer.prototype),{base:canvas.getContext('2d'),zoom:1,dpr:1,w:600,h:600,size:4,panX:0,panY:70,platform:0,rotation:0,night:false,pickables:[],dirty:false});
    const tile={x:1,y:1,lot:{x:1,y:1,w:1,h:1},type:'park',age:20,variant:.5,powered:true};
    const city={tiles:[]};
    drawCachedArchitecture(r,tile,city);
    const cold=architectureCacheStats(r).entries;
    await preloadCivicSprites({types:['park'],variant:1});
    const invalidated=r.dirty,initialEntries=civicSpriteStats().entries;
    drawCachedArchitecture(r,tile,city);
    const released=architectureCacheStats(r).entries===0;
    const cache=new Set(),layoutCanvases=[];
    for(const variant of [.1,.5,.9]) {
      await preloadCivicSprites({types:['park'],variant:Math.floor(variant*3)});
      r.pickables=[];
      drawCachedArchitecture(r,{...tile,variant},city);
      const art=r.pickables[0].canvas;
      cache.add(art);layoutCanvases.push(art);
      r.pickables=[];
      drawCachedArchitecture(r,JSON.parse(JSON.stringify({...tile,variant})),city);
      if(r.pickables[0].canvas!==art)throw new Error(`Layout changes after saved tile roundtrip: ${variant}, ${art.width}x${art.height} vs ${r.pickables[0].canvas.width}x${r.pickables[0].canvas.height}, stats ${JSON.stringify(civicSpriteStats())}`);
      r.pickables=[];
      for(let i=0;i<150;i++)drawCachedArchitecture(r,{...tile,x:i,variant,lot:{x:i,y:1,w:1,h:1}},city);
      if(r.pickables.some(p=>p.canvas!==art))throw new Error('Same layout does not share its decoded canvas');
    }
    for(let y=0;y<8;y++)for(let x=0;x<8;x++) {
      const value=Math.sin(x*127.1+y*311.7)*43758.5453;
      const expected=Math.floor((value-Math.floor(value))*3);
      r.pickables=[];
      drawCachedArchitecture(r,{...tile,x,y,variant:undefined,lot:{x,y,w:1,h:1}},city);
      if(r.pickables[0].canvas!==layoutCanvases[expected])throw new Error('Coordinate-only park selects wrong layout');
    }
    // Explicit layout selection must not skip single-layout types in a batch.
    await preloadCivicSprites({types:['park','largepark'],variant:1});
    r.pickables=[];
    drawCachedArchitecture(r,{...tile,type:'largepark',lot:{x:1,y:1,w:3,h:3}},city);
    const {CIVIC_SPRITES}=await import('/src/civic-sprite-manifest.js');
    if(r.pickables[0].canvas.width!==CIVIC_SPRITES.largepark.frames['day-0'].width)throw new Error('Mixed preload omitted single-layout building');
    return {cold,invalidated,initialEntries,released,layouts:cache.size,stats:civicSpriteStats()};
  });
  assert.equal(result.initialEntries,1);assert.equal(result.cold,1);assert.equal(result.invalidated,true);assert.equal(result.released,true);
  assert.equal(result.layouts,3);assert.ok(result.stats.decodedBytes<=result.stats.maxDecodedBytes);
  assert.deepEqual(errors,[]);
  console.log('Park variants: cold fallback refresh, stable saved seeds, and 150 instances per layout share three canvases.',result);
} finally {await browser.close();}
