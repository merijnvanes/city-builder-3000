import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CIVIC_TEST_URL||'http://127.0.0.1:4173');
 await page.getByRole('button',{name:'Explore the sample town',exact:true}).click();
 for(const night of [false,true])for(const rotation of [0,1,2,3]){
  const warmed=await page.evaluate(async({night,rotation})=>{
   const {civicSpriteKey,civicSpriteSpec,preloadCivicSprites,civicSpriteStats}=await import('/src/building-art.js');
   const {spriteVariant}=await import('/src/architecture-variation.js');
   const r=civic.renderer;r.night=night;r.rotate((rotation-r.rotation+4)%4);let count=0;
   for(const t of civic.city.tiles){
    if(t.lot?.x!==t.x||t.lot?.y!==t.y)continue;
    const spec=civicSpriteSpec(t);if(!spec)continue;
    await preloadCivicSprites({types:[civicSpriteKey(t)],variant:spriteVariant(t,spec.variants?.length||1),night,rotation,powered:t.powered!==false&&!t.abandoned,owner:r});count++;
   }
   r.dirty=true;const stats=civicSpriteStats();if(stats.decodedBytes>stats.maxDecodedBytes)throw new Error('Starter town exceeds sprite cap');return count;
  },{night,rotation});
  assert.ok(warmed>100);
  await page.waitForTimeout(250);await page.screenshot({path:`artifacts/starter-art-${night?'night':'day'}-${rotation}.png`});
 }
 assert.deepEqual(errors,[]);console.log('Actual starter town art passes all day/night rotations and bounded sprite memory.');
}finally{await browser.close();}
