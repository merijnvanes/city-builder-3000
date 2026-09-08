import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173/?play');await page.waitForFunction(()=>!!window.civic?.agent);
 const results=await page.evaluate(()=>{
  civic.agent.newCity({size:16,starter:false,layout:'plains',hills:0,seed:12});const c=civic.city,r=civic.renderer;
  for(const t of c.tiles){t.elev=3;t.terrain='grass';t.waterLevel=null;t.trees=0;}
  for(let y=6;y<=8;y++)for(let x=6;x<=8;x++)Object.assign(c.tiles[y*c.size+x],{terrain:'water',elev:1,waterLevel:2.25});
  const out=[];for(let rotation=0;rotation<4;rotation++){
   r.rotation=rotation;r.focusOn(7,7,2);c.revision++;r.paint(c);
   for(let y=6;y<=8;y++)for(let x=6;x<=8;x++){
    const p=r.project(x+.5,y+.5);out.push({rotation,height:r.groundZ(x+.5,y+.5),picked:r.pick(p.x,p.y),expected:{x,y}});
   }
  }
  return out;
 });
 for(const r of results){assert.equal(r.height,18);assert.deepEqual(r.picked,r.expected,JSON.stringify(r));}
 await page.screenshot({path:'artifacts/level-water.png'});assert.deepEqual(errors,[]);console.log('Browser water surfaces and picking stay level beside hills in all four rotations.');
}finally{await browser.close();}
