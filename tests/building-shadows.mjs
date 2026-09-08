import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173/?play');await page.waitForFunction(()=>window.civic);
 const results=await page.evaluate(async()=>{
  const {CityRenderer}=await import('/src/renderer.js');
  const {preloadCivicSprites,civicSpriteKey}=await import('/src/civic-sprites.js');
  const {drawCachedArchitecture}=await import('/src/architecture-cache.js');
  const {drawShadedArchitecture,shadowAtlasStats}=await import('/src/shadow-paint.js');
  const {lotBody}=await import('/src/shadow-scene.js');
  const {shadowPlanes}=await import('/src/sunlight.js');
  civic.renderer.resizeObserver.disconnect();civic.renderer.render=()=>{};
  document.body.replaceChildren();document.documentElement.style.cssText='height:auto;overflow:visible';document.body.style.cssText='display:grid;grid-template-columns:repeat(4,300px);height:auto;overflow:visible;background:#9aad99';
  const result=[];
  for(const kind of ['imported','procedural','tree'])for(let rotation=0;rotation<4;rotation++) {
   const imported=kind==='imported',tree=kind==='tree';
   const canvas=document.createElement('canvas');canvas.width=600;canvas.height=700;canvas.style.cssText='width:300px;height:350px';document.body.append(canvas);
   const r=Object.assign(Object.create(CityRenderer.prototype),{base:canvas.getContext('2d'),size:32,w:600,h:700,zoom:2.5,minZoom:.3,maxZoom:2.8,dpr:1,panX:0,panY:0,rotation,platform:0,pickables:[],night:false,paintEpoch:1});
   const t={x:10,y:8,elev:0,type:'residential',density:1,level:1,age:10,variant:.2,powered:true,lot:{x:10,y:8,w:imported?1:2,h:1}};
   if(tree){t.type='empty';t.lot=null;t.trees=1;}
   r.focusOn(10.5,8.5,2.5);
   const city={size:32,tiles:[t],revision:1};
   if(imported)await preloadCivicSprites({types:[civicSpriteKey(t)],rotations:[0,1,2,3],owner:r});
   const body=tree?{x:10,y:8,w:1,d:1,z:0,h:22}:lotBody(t),caster={x:8,y:9,w:2,d:3,z:0,h:160};caster.planes=shadowPlanes(caster);caster.owner={lot:{}};
   r.shadowScene={bodies:new Map([[t,body]]),candidates:()=>[caster]};
   let paintCalls=0;const paint=()=>{paintCalls++;return tree?r.tree(10.5,8.5,0):drawCachedArchitecture(r,t,city);};
   paint();const before=r.base.getImageData(0,0,600,700).data;
   r.base.clearRect(0,0,600,700);r.pickables=[];
   paintCalls=0;drawShadedArchitecture(r,t,city,paint);const after=r.base.getImageData(0,0,600,700).data;
   let darkened=0,escaped=0,alphaChanged=0;
   for(let i=0;i<before.length;i+=4){if(before[i+3]===0 && after[i+3])escaped++;if(Math.abs(before[i+3]-after[i+3])>1)alphaChanged++;if(before[i+3]>240 && before[i]+before[i+1]+before[i+2]-(after[i]+after[i+1]+after[i+2])>15)darkened++;}
   const entries=r.pickables.length;
   r.base.clearRect(0,0,600,700);r.pickables=[];r.panX+=1;
   drawShadedArchitecture(r,t,city,paint);
   const cached=r.base.getImageData(0,0,600,700).data;let cacheDifferences=0;
   for(let y=0;y<700;y++)for(let x=0;x<599;x++)for(let c=0;c<4;c++)if(Math.abs(after[(y*600+x)*4+c]-cached[(y*600+x+1)*4+c])>1)cacheDifferences++;
   let pickOK=true;
   if(!tree) {
    const pixel=after.findIndex((v,i)=>i%4===3 && v===255)/4;
    r.dirty=false;const hit=r.pickObject(Math.floor(pixel%600)+1,Math.floor(pixel/600));
    pickOK=hit.x===t.x && hit.y===t.y && !!r.pickables[0]?.source;
   }
   const atlas=shadowAtlasStats(r),reused=paintCalls===1;
   r.artRevision=(r.artRevision || 0)+1;r.base.clearRect(0,0,600,700);r.pickables=[];
   drawShadedArchitecture(r,t,city,paint);const invalidated=paintCalls===2;
   result.push({kind,rotation,darkened,escaped,alphaChanged,entries,cacheDifferences,pickOK,atlas,reused,invalidated});
   r.base.fillStyle='#182f3c';r.base.font='16px sans-serif';r.base.fillText(`${kind} · view ${rotation}`,130,70);
  }
  return result;
 });
 for(const r of results){assert.ok(r.darkened>100,JSON.stringify(r));assert.equal(r.escaped,0,JSON.stringify(r));assert.equal(r.alphaChanged,0,JSON.stringify(r));assert.equal(r.entries,r.kind==='tree'?0:1);assert.equal(r.cacheDifferences,0,JSON.stringify(r));assert.ok(r.pickOK && r.reused && r.invalidated,JSON.stringify(r));assert.ok(r.atlas.entries===1 && r.atlas.bytes<=r.atlas.maxBytes,JSON.stringify(r));}
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/building-shadows.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
