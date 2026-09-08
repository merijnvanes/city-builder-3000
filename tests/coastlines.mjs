import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173/?play');
 await page.waitForFunction(()=>!!window.civic?.agent);
 await page.evaluate(()=>{
  civic.agent.newCity({size:24,starter:false,layout:'plains',hills:0,seed:12});
  const c=civic.city;c.speed=0;
  for(const t of c.tiles)Object.assign(t,{terrain:'grass',elev:2,waterLevel:null,trees:0});
  for(let y=4;y<12;y++)for(let x=4;x<12;x++)if(x+y<18)Object.assign(c.tiles[y*24+x],{terrain:'water',elev:0,waterLevel:1.5});
  Object.assign(c.tiles[6*24+6],{terrain:'grass',elev:2,waterLevel:null});
  for(let y=16;y<22;y++)for(let x=16;x<22;x++)c.tiles[y*24+x].elev=5;
  Object.assign(c.tiles[18*24+18],{terrain:'water',elev:3,waterLevel:4.5});
  c.revision++;civic.renderer.tool='inspect';
 });
 await mkdir('artifacts',{recursive:true});
 for(let rotation=0;rotation<4;rotation++) {
  const result=await page.evaluate(async rotation=>{
   const {waterGeometry,waterHeightAt}=await import('/src/water-geometry.js');
   const c=civic.city,r=civic.renderer,saved=JSON.stringify(c.tiles);
   r.rotation=rotation;r.focusOn(8,8,1.7);r.dirty=true;r.render(c,1000);
   const ctx=r.ground.getContext('2d');let wet=0,dry=0;
   for(const t of c.tiles) {
    if(t.x<3 || t.x>12 || t.y<3 || t.y>12)continue;
    const g=waterGeometry(r,t);if(!g || !g.dry.length)continue;
    for(const [kind,polygons] of [['wet',g.wet],['dry',g.dry]])for(const polygon of polygons) {
     const area=Math.abs(polygon.reduce((s,a,i)=>{const b=polygon[(i+1)%polygon.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
     if(area<.045)continue;
     const x=polygon.reduce((s,p)=>s+p[0],0)/polygon.length,y=polygon.reduce((s,p)=>s+p[1],0)/polygon.length;
     const old=r.platform;r.platform=0;const p=r.project(x,y,waterHeightAt(g,x,y));r.platform=old;
     if(p.x<2 || p.y<2 || p.x>r.w-3 || p.y>r.h-3)continue;
     const picked=r.pick(p.x,p.y);
     if(picked.x!==t.x || picked.y!==t.y)throw Error(`Wrong ${kind} shore pick in view ${rotation}: ${JSON.stringify({t:[t.x,t.y],picked})}`);
     const pixel=ctx.getImageData(Math.round(p.x*r.dpr),Math.round(p.y*r.dpr),1,1).data;
     if(kind==='wet') {if(pixel[2]<=pixel[0])throw Error(`Dry pixel inside water in view ${rotation}: ${pixel}`);wet++;}
     else {if(pixel[2]>=pixel[0])throw Error(`Water covers exposed land in view ${rotation}: ${pixel}`);dry++;}
    }
   }
   if(JSON.stringify(c.tiles)!==saved)throw Error('Rendering changed the saved terrain');
   return {wet,dry};
  },rotation);
  assert.ok(result.wet>10 && result.dry>10,JSON.stringify(result));
  await page.screenshot({path:`artifacts/coastlines-${rotation}.png`});
 }
 const opaque=await page.evaluate(async()=>{
  const {waterPath}=await import('/src/water-geometry.js');
  const canvas=document.createElement('canvas');canvas.width=canvas.height=100;
  const ctx=canvas.getContext('2d'),polygon=[[10,10,0],[90,10,0],[90,90,0],[10,90,0]];
  waterPath({project:(x,y)=>({x,y})},ctx,[polygon,[...polygon].reverse()]);ctx.fill();
  return ctx.getImageData(50,50,1,1).data[3];
 });
 assert.equal(opaque,255,'Overlapping bank faces must stay opaque');
 const canalBoat=await page.evaluate(async()=>{
  const {drawBoat}=await import('/src/scene-art.js');
  const c=civic.city,r=civic.renderer;
  for(const t of c.tiles)Object.assign(t,{terrain:'grass',elev:4,waterLevel:null,trees:0});
  for(let y=2;y<22;y++)Object.assign(c.tiles[y*c.size+10],{terrain:'water',elev:0,waterLevel:1.5});
  c.revision++;r.focusOn(10.5,10.5,2);r.dirty=true;r.render(c,1000);
  const canvas=document.createElement('canvas');canvas.width=r.w*r.dpr;canvas.height=r.h*r.dpr;
  const ctx=canvas.getContext('2d');ctx.scale(r.dpr,r.dpr);
  const old=r.ctx;r.ctx=ctx;
  try {drawBoat(r,10.5,10.5,Math.PI/2,1000);}finally{r.ctx=old;}
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let painted=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i])painted++;
  return painted;
 });
 assert.ok(canalBoat>20,`A boat that fits a one-tile canal must be visible: ${canalBoat}`);
 assert.deepEqual(errors,[]);console.log('Partial shores render and pick wet and dry regions in every rotation without changing saved tiles.');
}finally{await browser.close();}
