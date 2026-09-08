import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173/?play');
 await page.waitForFunction(()=>!!window.civic?.agent);
 await page.evaluate(async()=>{
  const {assignLot}=await import('/src/sim/lots.js');
  civic.agent.newCity({size:32,starter:false,layout:'plains',hills:0,seed:12});
  const c=civic.city,r=civic.renderer;c.money=1e7;c.speed=0;
  for(const t of c.tiles)Object.assign(t,{terrain:'grass',elev:t.x<16?2:1,trees:0});
  for(let x=10;x<23;x++)c.tiles[16*32+x].type='road';
  for(const [x,y,type,w,h,elev] of [[12,14,'police',2,2,2],[15,14,'residential',2,2,2],[18,14,'commercial',2,2,1],[12,17,'school',3,3,2],[16,17,'residential',2,2,1]]) {
   for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)Object.assign(c.tiles[yy*32+xx],{type,elev,density:2,powered:true});
   assignLot(c,{x,y,w,h},3,.4);
  }
  c.revision++;r.buildCorners(c);
  for(let rotation=0;rotation<4;rotation++) {
   r.rotation=rotation;r.focusOn(16,16,1.8);r.dirty=true;r.render(c,1000);
   const t=c.tiles[14*32+12];
   r.platform=null;const p=r.project(13,16);r.platform=t.elev*8;const pad=r.project(13,16);r.platform=null;
   if(Math.abs(p.y-pad.y)>.001)throw new Error('Road/lot seam differs');
  }
  r.rotation=0;r.focusOn(16,16,2.2);r.dirty=true;r.render(c,1000);
 });
 await page.waitForTimeout(2000);
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/lot-foundations.png'});
 assert.deepEqual(errors,[]);console.log('Graded civic and zoned sites render beside roads and terraced neighbors in all rotations.');
}finally{await browser.close();}
