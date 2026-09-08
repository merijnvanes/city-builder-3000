import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1000,height:800}});
 await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173/?play');
 await page.waitForFunction(()=>!!window.civic?.agent);
 const results=await page.evaluate(async()=>{
  const {assignLot}=await import('/src/sim/lots.js');
  const {foundationEdges}=await import('/src/lot-foundations.js');
  const results=[];
  for(const [lx,ly] of [[12,12],[17,12],[17,17],[12,17],[17,14],[14,17],[12,14],[14,12]]) {
   civic.agent.newCity({size:32,starter:false,layout:'plains',hills:0,seed:12});
   const c=civic.city,r=civic.renderer;c.speed=0;
   for(const t of c.tiles)Object.assign(t,{terrain:'grass',elev:0,trees:0});
   for(const [x,y,w,h,elev,type] of [[14,14,3,3,3,'school'],[lx,ly,2,2,0,'police']]) {
    for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)Object.assign(c.tiles[yy*32+xx],{type,elev,powered:true});
    assignLot(c,{x,y,w,h},3,.4);
   }
   c.revision++;r.buildCorners(c);r.tool='road';
   // Disable cast shadows so the final ground cache can be compared to
   // each wall's material color. Terrain, grid and tile order remain real.
   // Use the renderer's scene even when Vite gives its imported module a
   // hot-reload URL that differs from a direct test import.
   r.paint(c);r.shadowScene.bins.clear();
   r.shadowScene.terrainPolygons=undefined;r.shadowScene.buildingPolygons=undefined;r.shadowScene.waterPolygons=undefined;
   for(let rotation=0;rotation<4;rotation++) {
    r.rotation=rotation;r.focusOn(15.5,15,2.2);r.dirty=true;r.render(c,1000);
    const actual=r.ground.getContext('2d').getImageData(0,0,1000,800).data;
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=800;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}),old=r.platform;r.platform=0;
    let checked=0,wrong=0;
    for(const {a,b,top,facing,shade} of foundationEdges(r,c.tiles[14*32+14])) {
     if(!facing)continue;
     ctx.clearRect(0,0,1000,800);
     r.poly([r.project(a[0],a[1],top),r.project(b[0],b[1],top),r.project(...b),r.project(...a)],shade,null,ctx);
     const expected=ctx.getImageData(0,0,1000,800).data;
     for(let y=3;y<797;y++)for(let x=3;x<997;x++) {
      const i=(y*1000+x)*4;
      if(![i,i-12,i+12,i-12000,i+12000].every(j=>expected[j+3]===255))continue;
      checked++;
      if([0,1,2,3].some(k=>actual[i+k]!==expected[i+k]))wrong++;
     }
    }
    r.platform=old;results.push({neighbor:[lx,ly],rotation,checked,wrong});
   }
  }
  return results;
 });
 assert.ok(results.reduce((n,r)=>n+r.checked,0)>1000);
 for(const r of results)assert.equal(r.wrong,0,`City terrain or rear faces cross the wall: ${JSON.stringify(r)}`);
 console.log('Continuous wall colors pass through the city renderer for eight neighboring lot layouts in every rotation.');
}finally{await browser.close();}
