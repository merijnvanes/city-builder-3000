import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { FAMILY_LAYOUT_COUNTS } from './art-families.mjs';
const family=process.env.ART_FAMILY||'residential';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${process.env.CIVIC_TEST_URL||'http://127.0.0.1:4173'}/civic-gallery.html?family=${family}`);
 await page.waitForFunction(n=>document.querySelectorAll('.card').length===n,FAMILY_LAYOUT_COUNTS[family]);
 for(const state of ['day','night']){
  await page.locator(`[data-state="${state}"]`).click();
  if(state==='night'){await page.locator('#rotate').click();await page.locator('#rotate').click();}
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  for(const density of [1,2,3])for(const level of [1,2,3,4]){
   await page.getByRole('combobox',{name:'Density',exact:true}).selectOption(String(density));
   await page.getByRole('combobox',{name:'Stage',exact:true}).selectOption(String(level));
   await page.evaluate(()=>Promise.all([...document.images].filter(i=>!i.closest('.card').hidden).map(i=>i.decode())));
   assert.ok(await page.locator('.card:visible').count()>0);
   await page.screenshot({path:`artifacts/${family}-gallery-d${density}-l${level}-${state}.png`,fullPage:true});
  }
 }
 assert.deepEqual(errors,[]);assert.equal(await page.locator('#error').textContent(),'');
 console.log(`${family}: all gallery layouts, density/stage contact sheets and night rear elevations pass.`);
}finally{await browser.close();}
