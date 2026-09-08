import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173/?play');await page.waitForFunction(()=>!!window.civic?.agent);
 const result=await page.evaluate(()=>{
  civic.agent.newCity({size:32,starter:false,layout:'plains',hills:0,seed:12});const c=civic.city;c.money=1e7;
  for(const t of c.tiles)Object.assign(t,{terrain:'grass',waterLevel:null,elev:1,trees:0});c.revision++;
  const lines=civic.agent.build('powerline',9,16,15,16),road=civic.agent.build('road',12,14,12,18);
  const blocked=civic.agent.build('powerline',12,16),removed=!c.tiles[16*c.size+12].powerline;
  const saved=civic.sim.serialize(c);civic.agent.undo();const restored=c.tiles[16*c.size+12].powerline;
  civic.agent.build('road',12,14,12,18);civic.renderer.focusOn(12,16,1.7);return {lines,road,blocked,removed,restored,loadLine:civic.sim.deserialize(saved).tiles[16*c.size+12].powerline};
 });
 assert.ok(result.lines.ok && result.road.ok);assert.equal(result.blocked.ok,false);assert.ok(result.removed && result.restored);assert.equal(result.loadLine,false);
 await page.waitForTimeout(200);await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/powerline-occupancy.png'});assert.deepEqual(errors,[]);
 console.log('Power-line browser checks passed: road replacement, occupied placement refusal, undo and load.');
}finally{await browser.close();}
