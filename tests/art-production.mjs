import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import {FAMILY_LAYOUT_COUNTS} from './art-families.mjs';
const base=(process.env.ART_PRODUCTION_URL||'http://127.0.0.1:4217/nested/').replace(/\/?$/, '/');
const expectedFrames=Object.values(FAMILY_LAYOUT_COUNTS).reduce((a,b)=>a+b,0)*12;
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],assets=new Set();
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().includes('/assets/')){if(r.status()>=400)errors.push(r.url());if(r.url().includes('/assets/civic/'))assets.add(r.url());}});
await page.goto(base);
await page.getByRole('button',{name:'Explore the sample town',exact:true}).click();
await page.waitForTimeout(500);
for (const [family,count] of Object.entries(FAMILY_LAYOUT_COUNTS)) {
await page.goto(`${base}civic-gallery.html?family=${family}`);
await page.waitForFunction(count=>document.querySelectorAll('.card').length===count,count);
for(const state of ['day','night','unpowered']){
 await page.locator(`[data-state="${state}"]`).click();
 for(let i=0;i<4;i++){
  await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode())));
  await page.locator('#rotate').click();
 }
}
assert.equal(await page.locator('#error').textContent(),'');
}
assert.deepEqual(errors,[]);
assert.ok([...assets].every(url=>url.startsWith(new URL('assets/',base).href)));
assert.equal([...assets].filter(url=>url.endsWith('.webp')).length,expectedFrames);
console.log(`Production ${base}: sample city, ${Object.keys(FAMILY_LAYOUT_COUNTS).length} galleries, all ${expectedFrames} frames and relative asset URLs pass.`);
} finally { await browser.close(); }
