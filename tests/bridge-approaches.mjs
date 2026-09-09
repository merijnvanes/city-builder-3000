import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173/?play');await page.waitForFunction(()=>!!window.civic?.agent);
 const checks=await page.evaluate(async()=>{
  const {bridgePlatform}=await import('/src/bridge-art.js');
  const {VIADUCT_HEIGHT}=await import('/src/render-scale.js');
  civic.agent.newCity({size:32,starter:false,layout:'plains',hills:0,seed:12});const c=civic.city,r=civic.renderer;c.money=1e7;
  for(const t of c.tiles)Object.assign(t,{terrain:t.x>=12 && t.x<=19?'water':'grass',elev:t.x>=12 && t.x<=19?0:1,waterLevel:t.x>=12 && t.x<=19?.75:null,trees:0});
  for(const [tool,y] of [['road',11],['rail',16],['highway',21]]) {
   const quote=civic.agent.build(tool,8,y,23,y);const built=civic.agent.build(tool,8,y,23,y,{confirmStructures:true,maxCost:quote.quote});if(!built.ok)throw new Error(JSON.stringify(built));
  }
  const out=[];
  for(let rotation=0;rotation<4;rotation++) {
   r.rotation=rotation;r.focusOn(16,16,1.4);r.render(c,1000);
   for(const s of c.transportStructures)for(const t of [c.tiles[s.from.y*c.size+s.from.x],c.tiles[s.to.y*c.size+s.to.x]]) {
    const low=t.x===s.from.x,edgeX=t.x+(low?0:1),y=t.y+.5;
    // A road or track meets the ground at the bank; a highway meets its own viaduct.
    r.platform=s.route==='highway'?(x,y)=>r.meshZ(x,y)+VIADUCT_HEIGHT:null;const land=r.project(edgeX,y,.5);r.platform=bridgePlatform(r,t);const ramp=r.project(edgeX,y,.5),center=r.project(t.x+.5,y);r.platform=null;
    out.push({land,ramp,picked:r.pick(center.x,center.y),expected:{x:t.x,y:t.y}});
   }
  }
  r.rotation=0;r.focusOn(16,16,1.6);r.dirty=true;r.render(c,1000);return out;
 });
 for(const check of checks){assert.deepEqual(check.ramp,check.land);assert.deepEqual(check.picked,check.expected);}
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/bridge-approaches.png'});
 assert.deepEqual(errors,[]);console.log('Connected road, rail and highway ramps meet both banks and remain pickable in four rotations.');
}finally{await browser.close();}
