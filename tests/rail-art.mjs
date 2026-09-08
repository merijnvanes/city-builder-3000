import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:800}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
 await page.goto('http://127.0.0.1:4173');
 await page.evaluate(async()=>{
  const {CityRenderer}=await import('/src/renderer.js'),{drawRail,drawTrain}=await import('/src/rail-art.js');
  document.body.replaceChildren();document.body.style.cssText='display:grid;grid-template-columns:repeat(8,150px);background:#20313d;overflow:auto;height:auto;';
  for(let rotation=0;rotation<4;rotation++)for(const mask of [3,6,12,9,1,5,7,15]) {
   const canvas=document.createElement('canvas');canvas.width=150;canvas.height=180;document.body.append(canvas);
   const ctx=canvas.getContext('2d');const r=Object.assign(Object.create(CityRenderer.prototype),{base:ctx,ctx,w:150,h:180,size:3,zoom:2,rotation,panX:0,panY:0});
   const city={size:3,tiles:Array.from({length:9},()=>({type:'empty'}))};
   for(const [i,[dx,dy]] of [[1,0],[0,1],[-1,0],[0,-1]].entries())if(mask&(1<<i))city.tiles[(1+dy)*3+1+dx].type='rail';
   const t={x:1,y:1,type:'rail',terrain:'grass'};drawRail(r,t,city);drawTrain(r,t,city,.5);
   ctx.fillStyle='white';ctx.fillText(`rotation ${rotation}, mask ${mask}`,5,170);
  }
 });
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/rail-corners.png'});assert.deepEqual(errors,[]);
 console.log('Rail gallery rendered all bends and junctions in four orientations.');
}finally{await browser.close();}
