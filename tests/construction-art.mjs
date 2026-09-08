import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1080,height:1280}});
 await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173/?play');
 await page.waitForFunction(()=>!!window.civic?.renderer);
 const result=await page.evaluate(async()=>{
  const {drawCivicSprite}=await import('/src/civic-sprites.js');
  const {isUnderConstruction}=await import('/src/construction-art.js');
  const parent=civic.renderer,gallery=document.createElement('div');
  gallery.style.cssText='display:grid;grid-template-columns:repeat(3,360px);background:#c4cbaa';
  document.body.replaceChildren(gallery);document.body.style.margin='0';
  let checked=0;
  for(let rotation=0;rotation<4;rotation++)for(const [type,density,w] of [['residential',1,1],['commercial',2,2],['industrial',3,3]]) {
   const canvas=document.createElement('canvas');canvas.width=360;canvas.height=320;gallery.append(canvas);
   const base=canvas.getContext('2d'),r=Object.assign(Object.create(parent),{base,w:360,h:320,dpr:1,size:1,zoom:1.3,rotation,panX:0,panY:60,platform:0,night:rotation===3,pickables:[]});
   const t={x:0,y:0,type,density,level:1,variant:.3,age:0,elev:0,powered:true,lot:{x:0,y:0,w,h:w}};
   const center=r.project(w/2,w/2);r.panX+=180-center.x;r.panY+=220-center.y;
   base.drawImage=()=>{throw Error('Construction drew a finished sprite');};
   const bounds=drawCivicSprite(r,t);
   if(!bounds || bounds.canvas)throw Error('Construction must use its own bounds');
   const pixels=base.getImageData(0,0,360,320).data;
   if(!pixels.some((v,i)=>i%4===3 && v>0))throw Error('Construction site is empty');
   for(let y=0;y<320;y++)for(let x=0;x<360;x++)if(pixels[(y*360+x)*4+3]>24 && (x<bounds.x || y<bounds.y || x>bounds.x+bounds.w || y>bounds.y+bounds.h))throw Error('Construction bounds miss artwork');
   t.age=1;if(isUnderConstruction(t))throw Error('Completed site still under construction');
   t.age=0;t.abandoned=true;if(isUnderConstruction(t))throw Error('Abandoned site has a crane');
   checked++;
  }
  return checked;
 });
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/construction-art.png'});
 assert.equal(result,12);console.log('Construction replaces finished sprites and has complete bounds in every view.');
}finally{await browser.close();}
