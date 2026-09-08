import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1000,height:800}});
 await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173/?play');
 await page.waitForFunction(()=>!!window.civic?.renderer);
 const results=await page.evaluate(async()=>{
  const {drawLotFoundation,foundationEdges}=await import('/src/lot-foundations.js');
  const results=[],t={x:0,y:0,elev:3,terrain:'grass',lot:{x:0,y:0,w:1,h:1}};
  for(let rotation=0;rotation<4;rotation++)for(const [cx,cy] of [[0,0],[1,0],[1,1],[0,1]]) {
   const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;
   const base=canvas.getContext('2d',{willReadFrequently:true});
   const r=Object.assign(Object.create(civic.renderer),{base,size:1,w:320,h:240,panX:0,panY:50,zoom:3,rotation,platform:0,
    meshZ:(x,y)=>x===cx && y===cy?0:24});
   drawLotFoundation(r,t,t);
   const actual=base.getImageData(0,0,320,240).data;
   const mask=document.createElement('canvas');mask.width=320;mask.height=240;
   const ctx=mask.getContext('2d',{willReadFrequently:true});
   let wrong=0,checked=0;
   for(const {a,b,top,facing,shade} of foundationEdges(r,t,t)) {
    if(!facing)continue;
    ctx.clearRect(0,0,320,240);
    r.poly([r.project(a[0],a[1],top),r.project(b[0],b[1],top),r.project(...b),r.project(...a)],shade,null,ctx);
    ctx.globalCompositeOperation='destination-out';
    r.poly([[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>r.project(x,y,24)),'#000',null,ctx);
    ctx.globalCompositeOperation='source-over';
    const expected=ctx.getImageData(0,0,320,240).data;
    for(let y=2;y<238;y++)for(let x=2;x<318;x++) {
     const i=(y*320+x)*4;
     // Compare face interiors, excluding antialiased perimeter pixels.
     if(![i,i-8,i+8,i-2560,i+2560].every(j=>expected[j+3]===255))continue;
     checked++;
     if([0,1,2,3].some(k=>actual[i+k]!==expected[i+k]))wrong++;
    }
   }
   results.push({rotation,corner:[cx,cy],checked,wrong});
  }
  return results;
 });
 console.log(results);
 assert.ok(results.reduce((n,r)=>n+r.checked,0)>1000);
 for(const r of results)assert.equal(r.wrong,0,`A rear wall paints through the visible face: ${JSON.stringify(r)}`);
 console.log('Visible retaining faces have one continuous shade at every corner and rotation.');
}finally{await browser.close();}
