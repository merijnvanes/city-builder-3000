import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:850}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/?play');await page.waitForFunction(()=>!!window.civic?.agent);
 const initial=await page.evaluate(()=>{
  civic.agent.newCity({size:32,starter:false,layout:'plains',hills:0,seed:12});const c=civic.city;
  c.money=1e7;for(const t of c.tiles)Object.assign(t,{terrain:'grass',waterLevel:null,elev:1,trees:0});
  for(let x=10;x<14;x++)for(let y=0;y<c.size;y++)Object.assign(c.tiles[y*c.size+x],{terrain:'water',waterLevel:.75,elev:0});
  c.revision++;civic.renderer.focusOn(12,16,1.7);return c.money;
 });
 await page.keyboard.press('r');await page.waitForTimeout(100);
 const drag=async()=>{const points=await page.evaluate(()=>[civic.renderer.project(9.5,16.5),civic.renderer.project(14.5,16.5)]);await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[1].x,points[1].y,{steps:15});await page.mouse.up();};
 await drag();await page.getByRole('dialog',{name:'Build bridge?'}).waitFor();await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>civic.city.money),initial);assert.equal(await page.evaluate(()=>civic.city.transportStructures.length),0);
 await drag();await page.getByRole('dialog',{name:'Build bridge?'}).getByRole('button',{name:/Build ·/}).click();await page.waitForFunction(()=>civic.city.transportStructures.length===1);
 assert.ok(await page.evaluate(()=>civic.city.money)<initial);await page.evaluate(()=>civic.agent.undo());assert.equal(await page.evaluate(()=>civic.city.transportStructures.length),0);
 const api=await page.evaluate(()=>{const quote=civic.agent.build('rail',9,16,14,16);const result=civic.agent.build('rail',9,16,14,16,{confirmStructures:true,maxCost:quote.quote});return {quote,result};});
 assert.ok(api.quote.requiresConfirmation);assert.ok(api.result.ok);
 for(let rotation=0;rotation<4;rotation++)await page.evaluate(rotation=>{civic.renderer.rotation=rotation;civic.renderer.dirty=true;civic.renderer.render(civic.city,1000);},rotation);
 await page.evaluate(()=>{
  const c=civic.city;civic.agent.newCity({size:32,starter:false,layout:'plains',hills:0,seed:12});const d=civic.city;d.money=1e7;
  for(const t of d.tiles)Object.assign(t,{terrain:'grass',waterLevel:null,elev:1,trees:0});
  for(const [y,length] of [[9,4],[14,8],[19,12]]) {
   for(let x=8;x<8+length;x++)Object.assign(d.tiles[y*d.size+x],{terrain:'water',waterLevel:.75,elev:0});
   const q=civic.agent.build('road',7,y,8+length,y);const r=civic.agent.build('road',7,y,8+length,y,{confirmStructures:true,maxCost:q.quote});if(!r.ok)throw new Error(JSON.stringify(r));
  }
  d.revision++;civic.renderer.rotation=0;civic.renderer.focusOn(13,14,1.3);
 });
 await page.waitForTimeout(200);await page.screenshot({path:'artifacts/bridge-styles.png'});assert.deepEqual(errors,[]);
 await page.evaluate(()=>{
  civic.agent.newCity({size:32,starter:false,layout:'plains',hills:0,seed:12});const c=civic.city;c.money=1e7;
  for(const t of c.tiles)Object.assign(t,{terrain:'grass',waterLevel:null,elev:t.x>=10 && t.x<=17?4:1,trees:0});
  c.revision++;civic.renderer.focusOn(10,16,1.7);
 });
 await page.keyboard.press('j');await page.waitForTimeout(100);
 const entrance=await page.evaluate(()=>civic.renderer.project(9.5,16.5));
 await page.mouse.click(entrance.x,entrance.y);await page.getByRole('dialog',{name:'Bore tunnel?'}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal(await page.evaluate(()=>civic.city.transportStructures.length),0);
 await page.mouse.click(entrance.x,entrance.y);await page.getByRole('dialog',{name:'Bore tunnel?'}).getByRole('button',{name:/Build ·/}).click();await page.waitForFunction(()=>civic.city.transportStructures.length===1);
 assert.equal(await page.evaluate(()=>civic.city.tiles[16*civic.city.size+13].tunnel),1);assert.deepEqual(errors,[]);
 console.log('Bridge and tunnel dialogs, cancellation, acceptance, undo, API quotes, artwork and four rotations passed.');
}finally{await browser.close();}
