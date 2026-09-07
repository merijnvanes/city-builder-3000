// Exercise actual power exports through the shared runtime, including tall
// one-tile rotor picking and inspection portraits at every rotation/state.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 800 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173'}/civic-gallery.html?family=power`);
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 8);
  const result = await page.evaluate(async () => {
    const { CityRenderer } = await import('/src/renderer.js');
    const { preloadCivicSprites, civicSpriteStats } = await import('/src/building-art.js');
    const { drawCachedArchitecture } = await import('/src/architecture-cache.js');
    const { CIVIC_SPRITES } = await import('/src/civic-sprite-manifest.js');
    const { BUILDINGS } = await import('/src/sim/catalog.js');
    const { createPortrait } = await import('/src/portrait.js');
    const power = Object.entries(BUILDINGS).filter(([, spec]) => spec.group === 'utilities' && spec.powerOut > 0);
    const canvas = document.createElement('canvas');canvas.width = canvas.height = 800;
    const r = Object.assign(Object.create(CityRenderer.prototype), { base: canvas.getContext('2d'), w: 800, h: 800, size: 16, zoom: 1.75, minZoom: .3, maxZoom: 2.8, dpr: 2, panX: 0, panY: 0, platform: 0, pickables: [], rotation: 0 });
    r.pick = () => ({ miss: true });
    const portraitCanvas = document.createElement('canvas');portraitCanvas.style.cssText='width:200px;height:160px';document.body.append(portraitCanvas);
    const portrait = createPortrait(portraitCanvas);
    let frames = 0, picks = 0, portraits = 0, maxBytes = 0;
    for (const [type, spec] of power) {
      const hashes = new Set();
      for (const state of ['day','night','unpowered']) for (let rotation = 0; rotation < 4; rotation++) {
        const night = state !== 'day', powered = state !== 'unpowered';
        await preloadCivicSprites({types:[type],rotation,night,powered});
        Object.assign(r,{rotation,night,pickables:[]});r.focusOn(2+spec.w/2,2+spec.h/2,1.75);
        const tile={x:2,y:2,lot:{x:2,y:2,w:spec.w,h:spec.h},type,age:20,elev:0,powered};
        let blits=0;const draw=r.base.drawImage.bind(r.base);
        r.base.drawImage=(...args)=>{blits++;draw(...args);};
        drawCachedArchitecture(r,tile,{tiles:[]});r.base.drawImage=draw;
        r.dirty=false; // A completed paint enables the renderer's alpha picking.
        if(blits!==1)throw new Error(`${type} ${state} ${rotation}: expected one sprite blit`);
        const hit=r.pickables[0],frame=CIVIC_SPRITES[type].frames[`${state}-${rotation}`];
        if(!hit?.canvas || hit.canvas.width!==frame.width || hit.canvas.height!==frame.height)throw new Error(`${type}: fallback used instead of baked frame`);
        const pixels=hit.canvas.getContext('2d').getImageData(0,0,frame.width,frame.height).data;
        let hash=2166136261,first=-1;
        for(let i=0;i<pixels.length;i++)hash=Math.imul(hash^pixels[i],16777619)>>>0;
        for(let i=3;i<pixels.length;i+=4)if(pixels[i]>240){first=(i-3)/4;break;}
        hashes.add(hash);
        if(first<0)throw new Error(`${type}: empty artwork`);
        // The first opaque wind pixel belongs to an elevated rotor tip,
        // outside the ground diamond: exercise the actual alpha picking path.
        const px=hit.x+((first%frame.width)+.5)/frame.width*hit.w;
        const py=hit.y+(Math.floor(first/frame.width)+.5)/frame.height*hit.h;
        if(r.pickObject(px,py).x!==tile.x)throw new Error(`${type}: top silhouette is not pickable`);
        if(!r.pickObject(hit.x+.1,hit.y+.1).miss)throw new Error(`${type}: transparent corner blocks picking`);
        picks++;
        portrait.draw(tile,night,rotation);
        const w=portraitCanvas.width,h=portraitCanvas.height,p=portraitCanvas.getContext('2d').getImageData(0,0,w,h).data;
        let occupied=0;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(p[(y*w+x)*4+3]){
          occupied++;
          if(x<2||y<2||x>=w-2||y>=h-2)throw new Error(`${type}: portrait clips in ${state} ${rotation}`);
        }
        if(occupied<100)throw new Error(`${type}: missing portrait`);
        portraits++;frames++;
        const stats=civicSpriteStats();maxBytes=Math.max(maxBytes,stats.decodedBytes);
        if(stats.decodedBytes>stats.maxDecodedBytes)throw new Error('Combined sprite memory budget exceeded');
      }
      if(hashes.size!==12)throw new Error(`${type}: expected distinct artwork for all rotations and lighting states, got ${hashes.size}`);
    }
    return {frames,picks,portraits,maxBytes};
  });
  assert.equal(result.frames,96);assert.equal(result.picks,96);assert.equal(result.portraits,96);
  assert.deepEqual(errors,[]);
  console.log('Power sprites: all 96 frames, single blits, silhouette picking, portraits, lighting and shared memory pass.',result);
} finally { await browser.close(); }
