import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:850}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/?play');await page.waitForFunction(()=>!!window.civic?.agent);
 const built=await page.evaluate(()=>{
  civic.agent.newCity({starter:false,layout:'plains',hills:0,seed:12,money:50000});
  const result=civic.agent.build('road',0,20,5,20);civic.renderer.focusOn(1,20,1.5);return result;
 });
 assert.ok(built.ok);assert.equal(built.connectionOffers.length,1);
 assert.equal(await page.locator('dialog[open]').count(),0,'API returns quotes without opening UI');
 await page.keyboard.press('r');await page.waitForTimeout(100);
 const p=await page.evaluate(()=>civic.renderer.project(.5,20.5));
 await page.mouse.click(p.x,p.y);await page.getByRole('dialog',{name:'Connect to neighboring county?'}).waitFor();
 await page.getByRole('button',{name:'Keep dead end'}).click();
 assert.equal(await page.evaluate(()=>civic.city._connections.northwest.road),0);
 await page.mouse.click(p.x,p.y);await page.getByRole('button',{name:'Connect · $500',exact:true}).click();
 await page.waitForFunction(()=>civic.city._connections.northwest.road===1);
 const connected=await page.evaluate(()=>({money:civic.city.money,links:civic.agent.connections().established}));
 assert.equal(connected.money,built.money-500);assert.equal(connected.links.length,1);
 await page.evaluate(()=>civic.agent.undo());assert.equal(await page.evaluate(()=>civic.city._connections.northwest.road),0);
 const api=await page.evaluate(()=>civic.agent.connectNeighbor(0,20,'northwest','road'));assert.ok(api.ok);
 for(const [route,section,resource] of [['powerline','Electricity','power'],['pipe','Water','water']]) {
  const build=await page.evaluate(route=>{
   civic.agent.newCity({starter:false,layout:'plains',hills:0,seed:12,money:50000});
   const result=civic.agent.build(route,0,20,5,20);civic.renderer.focusOn(1,20,1.5);return result;
  },route);
  assert.ok(build.ok);assert.equal(build.connectionOffers.length,1);
  await page.getByRole('button',{name:'Utilities',exact:true}).click();
  await page.getByRole('tab',{name:section,exact:true}).click();
  await page.locator(`#flyout [data-tool="${route}"]`).click();
  const point=await page.evaluate(()=>civic.renderer.project(.5,20.5));
  await page.mouse.click(point.x,point.y);
  const dialog=page.getByRole('dialog',{name:'Connect to neighboring county?'});await dialog.waitFor();
  assert.match(await dialog.textContent(),route==='pipe'?/Connect water to/:/Connect electricity to/);
  await page.getByRole('button',{name:'Keep dead end'}).click();
  assert.equal(await page.evaluate(resource=>civic.city._connections.northwest[resource],resource),0);
  await page.mouse.click(point.x,point.y);
  await page.getByRole('button',{name:`Connect · $${build.connectionOffers[0].cost}`,exact:true}).click();
  await page.waitForFunction(resource=>civic.city._connections.northwest[resource]===1,resource);
  assert.equal(await page.evaluate(()=>civic.city.money),build.money-build.connectionOffers[0].cost);
  await page.evaluate(()=>civic.agent.undo());
  assert.equal(await page.evaluate(resource=>civic.city._connections.northwest[resource],resource),0);
 }
 assert.deepEqual(errors,[]);console.log('Transport, electricity and water connection UI: decline, accept, fees and undo passed.');
}finally{await browser.close();}
