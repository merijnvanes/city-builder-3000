// Place each zone family through actual zoning tools and lot assignment, then
// verify serialized state and inspect the city renderer in every day/night view.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {FAMILY_LAYOUT_COUNTS} from './art-families.mjs';
const family=process.env.ART_FAMILY||'commercial';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CIVIC_TEST_URL||'http://127.0.0.1:4173');
 await page.getByRole('button',{name:'Explore the sample town',exact:true}).click();
 let total=0;
 for(const density of [1,2,3]){
  total+=await page.evaluate(async({family,density})=>{
   const {expectedZoneEntries}=await import('/tests/zone-art-contract.mjs');
   const {assignLot}=await import('/src/sim/lots.js');
   const {spriteVariant}=await import('/src/architecture-variation.js');
   const {zoneVariantFixture}=await import('/tests/zone-art-contract.mjs');
   const {city,sim}=civic;city.money=1e9;
   for(let y=3;y<59;y++)for(let x=3;x<59;x++)if(city.tiles[y*city.size+x].lot)sim.place(city,x,y,'bulldoze',{deferRefresh:true});
   for(let y=3;y<59;y++)for(let x=3;x<59;x++)Object.assign(city.tiles[y*city.size+x],{type:'empty',density:0,industry:null,commerce:null,lot:null,level:0,terrain:'grass',elev:0,trees:0,fire:0});
   const slots=[];
   for(let row=0;row<13;row++){
    for(let x=4;x<58;x++)sim.place(city,x,7+row*4,'road',{deferRefresh:true});
    for(let col=0;col<13;col++)slots.push({x:5+col*4,roadY:7+row*4});
   }
   window.zoneSites=[];
   for(const entry of expectedZoneEntries().filter(e=>e.type===family&&e.density===density))for(let variant=0;variant<entry.variants;variant++){
    const fixture=zoneVariantFixture({tiles:entry.size,zone:{type:family,density},artVariants:entry.variants},variant);
    // Find an unused real lot with the required coordinate signature branch.
    const slotIndex=slots.findIndex(s=>spriteVariant({type:family,density,x:s.x,y:s.roadY-entry.size,variant:fixture.variant,lot:{w:entry.size}},entry.variants)===variant);
    if(slotIndex<0)throw new Error(`No lot position for ${entry.key} v${variant}`);
    const slot=slots.splice(slotIndex,1)[0],x=slot.x,y=slot.roadY-entry.size;
    for(let dy=0;dy<entry.size;dy++)for(let dx=0;dx<entry.size;dx++){
     const result=sim.place(city,x+dx,y+dy,family,{density,deferRefresh:true});if(!result.ok)throw new Error(result.message);
    }
    const t=assignLot(city,{x,y,w:entry.size,h:entry.size},entry.level,fixture.variant);t.age=10;t.powered=true;
    zoneSites.push({key:entry.key,variant,count:entry.variants,x,y});
   }
   sim.refresh(city);civic.renderer.buildCorners(city);
   const restored=sim.deserialize(sim.serialize(city));
   for(const site of zoneSites){
    const a=city.tiles[site.y*city.size+site.x],b=restored.tiles[site.y*city.size+site.x];
    if(a.level!==b.level||a.density!==b.density||a.lot.w!==b.lot.w||spriteVariant(b,site.count)!==site.variant)throw new Error('Zone layout changed across save');
   }
   return zoneSites.length;
  },{family,density});
  for(const night of [false,true])for(const rotation of [0,1,2,3]){
   await page.evaluate(async({night,rotation})=>{
    const {preloadCivicSprites}=await import('/src/building-art.js');
    const r=civic.renderer;r.night=night;r.rotation=rotation;r.focusOn(30,30,.42);
    for(const site of zoneSites){civic.city.tiles[site.y*civic.city.size+site.x].powered=true;await preloadCivicSprites({types:[site.key],variant:site.variant,night,rotation,owner:r});}
    r.dirty=true;
   },{night,rotation});
   await page.waitForTimeout(150);await page.screenshot({path:`artifacts/${family}-city-d${density}-${night?'night':'day'}-${rotation}.png`});
  }
 }
 assert.equal(total,FAMILY_LAYOUT_COUNTS[family]);assert.deepEqual(errors,[]);
 console.log(`${family}: ${total} real zoned layouts, save/load family identity and all-view city rendering pass.`);
}finally{await browser.close();}
