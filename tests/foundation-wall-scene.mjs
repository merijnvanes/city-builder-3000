import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
// Every visible retaining face keeps one continuous material colour in the
// finished frame, with a lower neighbour on each side and diagonal, in every
// view. Terrain, grid lines, rear faces and other items never cross it.
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
   // Disable cast shadows so the finished frame can be compared to each
   // wall's material colour. Terrain, grid and paint order remain real.
   r.paint(c);r.shadowScene.bins.clear();
   r.shadowScene.terrainPolygons=undefined;r.shadowScene.buildingPolygons=undefined;r.shadowScene.waterPolygons=undefined;r.shadowScene.deckPolygons=undefined;
   for(let rotation=0;rotation<4;rotation++) {
    r.rotation=rotation;r.focusOn(15.5,15,2.2);r.dirty=true;r.render(c,1000);
    const actual=r.ctx.getImageData(0,0,r.canvas.width,r.canvas.height).data,dpr=r.dpr,stride=r.canvas.width;
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=800;
    const ctx=canvas.getContext('2d',{willReadFrequently:true}),old=r.platform;r.platform=0;
    // A neighbour standing in front of the wall hides part of it, which is
    // right. Compare only wall pixels no later scene item covers.
    const school=c.tiles[14*32+14],later=r.pickables.slice(r.pickables.findIndex(hit=>hit.t===school && hit.polygons)+1).filter(hit=>hit.t!==school);
    const covered=(x,y)=>later.some(hit=>{
     if(x<hit.x || y<hit.y || x>=hit.x+hit.w || y>=hit.y+hit.h)return false;
     if(!hit.canvas)return true;
     const s=hit.source || {x:0,y:0,w:hit.canvas.width,h:hit.canvas.height};
     const px=s.x+Math.min(s.w-1,Math.floor((x-hit.x)/hit.w*s.w)),py=s.y+Math.min(s.h-1,Math.floor((y-hit.y)/hit.h*s.h));
     return hit.canvas.getContext('2d').getImageData(px,py,1,1).data[3]>0;
    });
    let checked=0,wrong=0;
    for(const {a,b,top,facing,shade} of foundationEdges(r,school)) {
     if(!facing)continue;
     ctx.clearRect(0,0,1000,800);
     r.poly([r.project(a[0],a[1],top),r.project(b[0],b[1],top),r.project(...b),r.project(...a)],shade,null,ctx);
     const expected=ctx.getImageData(0,0,1000,800).data;
     for(let y=3;y<797;y++)for(let x=3;x<997;x++) {
      const i=(y*1000+x)*4;
      if(![i,i-12,i+12,i-12000,i+12000].every(j=>expected[j+3]===255))continue;
      if([[x,y],[x-3,y],[x+3,y],[x,y-3],[x,y+3]].some(([px,py])=>covered(px+.5,py+.5)))continue;
      checked++;
      const j=(Math.round(y*dpr)*stride+Math.round(x*dpr))*4;
      if([0,1,2].some(k=>Math.abs(actual[j+k]-expected[i+k])>2))wrong++;
     }
    }
    r.platform=old;results.push({neighbor:[lx,ly],rotation,checked,wrong});
   }
  }
  return results;
 });
 assert.ok(results.reduce((n,r)=>n+r.checked,0)>1000);
 // Where a neighbour's antialiased outline meets the wall's, a couple of
 // blended pixels are expected; anything more is a face painted over.
 for(const r of results)assert.ok(r.wrong<=4,`City terrain, rear faces or other items cross the wall: ${JSON.stringify(r)}`);
 console.log('Continuous wall colours reach the finished frame for eight neighbouring lot layouts in every rotation.');
}finally{await browser.close();}
