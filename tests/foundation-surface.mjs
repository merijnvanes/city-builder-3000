import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
// The terrain buried under a graded site never shows: the pad and its
// retaining shell cover it in every view, and exterior terrain painted after
// the site never crosses a visible wall.
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1000,height:800}});
 await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173/?play');
 await page.waitForFunction(()=>!!window.civic?.agent);
 await mkdir('artifacts',{recursive:true});
 const results=await page.evaluate(async()=>{
  const {assignLot}=await import('/src/sim/lots.js');
  const {foundationEdges}=await import('/src/lot-foundations.js');
  civic.agent.newCity({size:32,starter:false,layout:'plains',hills:0,seed:12});
  const c=civic.city,r=civic.renderer;c.speed=0;
  for(const t of c.tiles)Object.assign(t,{terrain:'grass',elev:0,trees:0});
  for(const [x,y,w,h,elev] of [[14,14,3,3,3],[17,14,2,2,0]]) {
   for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)Object.assign(c.tiles[yy*32+xx],{type:'residential',elev,powered:true});
   assignLot(c,{x,y,w,h},3,.4);
  }
  c.revision++;r.buildCorners(c);r.tool='road';
  const paint=r.paintTerrain,results=[];
  const frame=()=>{r.dirty=true;r.render(c,1000);return r.ctx.getImageData(0,0,r.canvas.width,r.canvas.height).data;};
  for(let rotation=0;rotation<4;rotation++) {
   r.rotation=rotation;r.focusOn(15.5,15,2.2);
   const before=frame();
   // Change only buried terrain. Its fill may not show through the retaining
   // shell, including at corners facing away.
   r.paintTerrain=function(t,city) {
    if(t.lot)this.flat(t.x,t.y,1,1,0,'#ff00ff');
    else paint.call(this,t,city);
   };
   const after=frame();
   // The pad's antialiased outline blends with whatever lies beneath it, so
   // a change within a pixel or two of a foundation edge is fringe, not a leak.
   const edges=r.pickables.filter(hit=>hit.polygons).flatMap(hit=>hit.polygons.flatMap(points=>points.map((p,i)=>[p,points[(i+1)%points.length]])));
   const nearEdge=(x,y)=>edges.some(([a,b])=>{
    const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy || 1,u=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/len));
    return Math.hypot(x-(a.x+dx*u),y-(a.y+dy*u))<=2.5;
   });
   let changed=0;
   for(let i=0;i<before.length;i+=4)if([0,1,2].some(k=>Math.abs(before[i+k]-after[i+k])>2)) {
    const px=(i/4)%r.canvas.width/r.dpr,py=Math.floor(i/4/r.canvas.width)/r.dpr;
    if(!nearEdge(px,py))changed++;
   }
   r.paintTerrain=function(t,city) {
    if(!t.lot)this.flat(t.x,t.y,1,1,0,'#ff00ff','#00ffff');
    else paint.call(this,t,city);
   };
   const exterior=frame();
   const old=r.platform;r.platform=0;let wallChanges=0,wallSamples=0;
   for(const {a,b,top,facing} of foundationEdges(r,c.tiles[14*32+14])) {
    if(!facing)continue;
    // Stay inside the face, away from the antialiased ground contact edge.
    for(const f of [.25,.5,.75])for(const depth of [.4,.6]) {
     const z=a[2]+(b[2]-a[2])*f;
     const p=r.project(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,z+(top-z)*depth);
     const i=(Math.round(p.y*r.dpr)*r.canvas.width+Math.round(p.x*r.dpr))*4;
     if([0,1,2].some(k=>Math.abs(before[i+k]-exterior[i+k])>2))wallChanges++;
     wallSamples++;
    }
   }
   r.platform=old;
   results.push({rotation,changed,wallChanges,wallSamples});r.paintTerrain=paint;frame();
  }
  return results;
 });
 await page.screenshot({path:'artifacts/foundation-surface.png'});
 assert.ok(results.reduce((n,r)=>n+r.wallSamples,0)>0);
 for(const {rotation,changed,wallChanges} of results) {
  assert.equal(changed,0,`Buried terrain leaks through the foundation in view ${rotation}`);
  assert.equal(wallChanges,0,`Exterior terrain crosses the wall in view ${rotation}`);
 }
 console.log('Buried terrain and grid lines remain hidden in all four foundation views.');
}finally{await browser.close();}
