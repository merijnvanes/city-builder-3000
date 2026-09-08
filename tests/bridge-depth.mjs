import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];
 await page.addInitScript(()=>{
  const getContext=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(type,options){return getContext.call(this,type,type==='2d'?{...options,willReadFrequently:true}:options);};
 });
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173/?play');
 await page.waitForFunction(()=>!!window.civic?.agent);
 const result=await page.evaluate(async()=>{
  const {assignLot}=await import('/src/sim/lots.js');
  const {preloadCivicSprites,civicSpriteKey,civicSpriteSpec}=await import('/src/building-art.js');
  const {bridgePlatform}=await import('/src/bridge-art.js');
  const {beginBridgeTraffic,compositeBridgeTraffic,drawBridgeSolid}=await import('/src/bridge-scene.js');
  const {drawVehicle}=await import('/src/street-art.js');
  // Compare opaque materials independently of cast-shadow atlas warmup.
  Object.defineProperty(civic.renderer,'shadowScene',{configurable:true,get:()=>null,set:()=>{}});
  let bridgeWins=0,buildingWins=0,cars=0;
  for(const [length,type] of [[3,'road'],[7,'rail'],[12,'highway']])for(const axis of ['x','y'])for(const size of [1,2,3]) {
   civic.agent.newCity({size:24,starter:false,layout:'plains',hills:0,seed:12});
   const c=civic.city,r=civic.renderer;c.speed=0;r.tool='inspect';
   for(const t of c.tiles)Object.assign(t,{terrain:'grass',elev:0,trees:0});
   const s={kind:'bridge',route:type,from:{x:5,y:6},to:{x:5,y:6},elevation:1,length};s.to[axis]+=length+1;
   c.transportStructures=[s];
   for(let i=0;i<length+2;i++) {
    const x=5+(axis==='x'?i:0),y=6+(axis==='y'?i:0);
    Object.assign(c.tiles[y*24+x],{terrain:i && i<length+1?'water':'grass',elev:i && i<length+1?0:1,waterLevel:.5,type,structure:s,traffic:100});
   }
   const hx=axis==='x'?5:5-size,hy=axis==='x'?6-size:6,house=c.tiles[hy*24+hx];
   for(let y=hy;y<hy+size;y++)for(let x=hx;x<hx+size;x++)Object.assign(c.tiles[y*24+x],{type:'residential',density:size,age:10,powered:true});
   assignLot(c,{x:hx,y:hy,w:size,h:size},1,.3);house.age=10;
   c.revision++;
   for(let rotation=0;rotation<4;rotation++) {
    r.rotation=rotation;r.focusOn(6,7,2.5);
    await preloadCivicSprites({types:[civicSpriteKey(house)],variant:Math.floor(house.variant*(civicSpriteSpec(house).variants?.length || 1)),rotation,owner:r});
    r.paint(c);
    const items=r.items;
    const pixels=()=>r.base.getImageData(0,0,r.canvas.width,r.canvas.height).data;
    r.items=items.filter(i=>i.kind==='bridge');r.paint(c);const bridge=pixels(),bridgePicks=r.pickables.filter(p=>p.bridge).reverse();
    r.items=items.filter(i=>i.kind==='lot');r.paint(c);const building=pixels();
    r.items=items;r.paint(c);const actual=pixels(),hc=r.orient(house.x+size/2,house.y+size/2);
    const visibility=r.bridgeTrafficMask.getContext('2d').getImageData(0,0,r.canvas.width,r.canvas.height).data;
    for(let y=2;y<r.h-2;y+=2)for(let x=2;x<r.w-2;x+=2) {
     const i=(y*r.w+x)*4;
     if(![i,i-4,i+4,i-r.w*4,i+r.w*4].every(j=>bridge[j+3]===255 && building[j+3]===255))continue;
     const hit=bridgePicks.find(p=>x>=p.x && x<p.x+p.w && y>=p.y && y<p.y+p.h && p.canvas.getContext('2d').getImageData(Math.floor((x+.5-p.x)*r.dpr),Math.floor((y+.5-p.y)*r.dpr),1,1).data[3]>24);
     if(!hit)continue;
     const bc=r.orient(hit.t.x+.5,hit.t.y+.5),front=bc.x-.5>=hc.x+size/2 || bc.y-.5>=hc.y+size/2;
     const expected=front?bridge:building;
     if(!front && visibility[i+3]>1)throw Error(`Traffic mask exposes a vehicle through a foreground building: ${JSON.stringify({length,axis,size,rotation,x,y,alpha:visibility[i+3]})}`);
     if([0,1,2,3].some(k=>Math.abs(actual[i+k]-expected[i+k])>3))throw Error(`Wrong overlap: ${JSON.stringify({length,axis,size,rotation,x,y,front})}`);
     const picked=r.pickObject(x+.5,y+.5),owner=front?hit.t:house;
     if(picked.x!==owner.x || picked.y!==owner.y)throw Error(`Overlap picks the hidden object: ${JSON.stringify({length,axis,rotation,x,y,picked,expected:[owner.x,owner.y]})}`);
     if(front)bridgeWins++;else buildingWins++;
    }
    // Test deck visibility separately from intentional building occlusion.
    r.items=items.filter(i=>i.kind==='bridge');r.paint(c);
    const pooled=r.bridgeSprites[0].canvas;r.paint(c);
    if(r.bridgeSprites[0].canvas!==pooled)throw Error('Bridge paint allocated a new canvas for an unchanged view');
    const ctx=r.ctx,traffic=beginBridgeTraffic(r),t=c.tiles[s.from.y*24+s.from.x+(axis==='x'?2:48)];
    r.ctx=traffic;r.platform=bridgePlatform(r,t);drawVehicle(r,t.x+.5,t.y+.5,axis==='y',false,'#ff00ff');r.platform=null;r.ctx=ctx;
    ctx.clearRect(0,0,r.w,r.h);compositeBridgeTraffic(r);
    const car=ctx.getImageData(0,0,r.canvas.width,r.canvas.height).data;
    if(car.some((v,i)=>i%4===3 && v>128))cars++;
    if(length===3 && axis==='x' && size===1 && rotation===0) {
     r.platform=bridgePlatform(r,t);const p=r.project(t.x+.5,t.y+.32,.5);r.platform=null;
     const sample=()=>Array.from(r.base.getImageData(Math.round(p.x),Math.round(p.y),1,1).data);
     const day=sample();r.overlay='traffic';r.paint(c);const heat=sample();
     if(heat[0]<heat[1]+20)throw Error('Traffic overlay does not color the elevated deck');
     r.overlay='none';r.night=true;r.paint(c);const night=sample();
     if(night[0]+night[1]+night[2]>=day[0]+day[1]+day[2])throw Error('Bridge ignores night lighting');
     r.night=false;
    }
    r.items=items;
   }
   r.items=undefined;r.itemRevision=-1;r.render(c,1000);
  }
  // A higher foreground hill must hide a lower ramp, including its pick.
  const r=civic.renderer;
  civic.agent.newCity({size:16,starter:false,layout:'plains',hills:0,seed:12});const c=civic.city;c.speed=0;
  for(const t of c.tiles)Object.assign(t,{terrain:'grass',type:'empty',elev:1,trees:0});
  const s={kind:'bridge',route:'road',from:{x:2,y:3},to:{x:7,y:3},elevation:1,length:4};c.transportStructures=[s];
  for(let x=2;x<=7;x++)Object.assign(c.tiles[3*c.size+x],{type:'road',structure:s});
  c.revision++;r.rotation=0;r.focusOn(3,4,2);r.buildCorners(c);
  r.platform=bridgePlatform(r,c.tiles[3*c.size+2]);const behind=r.project(2.5,3.5);r.platform=null;
  for(const [x,y] of [[3,4],[4,4],[3,5],[4,5]])r.corners[y*(c.size+1)+x]=42;
  r.paint(c);const pick=r.pickObject(behind.x,behind.y);
  if(pick.x!==3 || pick.y!==4)throw Error(`Foreground hill reveals bridge: ${JSON.stringify(pick)}`);
  const canvas=document.createElement('canvas');canvas.width=r.canvas.width;canvas.height=r.canvas.height;
  const base=canvas.getContext('2d');base.fillStyle='#ff00ff';base.fillRect(0,0,canvas.width,canvas.height);
  const proxy=Object.assign(Object.create(r),{base,bridgeSprites:[],bridgeSpriteIndex:0,pickables:[]});
  drawBridgeSolid(proxy,c.tiles[3*c.size+2],c);
  if(base.getImageData(Math.round(behind.x),Math.round(behind.y),1,1).data[3]>1)throw Error('A hill cutout reveals a rear solid through the bridge');
  return {bridgeWins,buildingWins,cars};
 });
 assert.ok(result.bridgeWins>50 && result.buildingWins>50,JSON.stringify(result));
 assert.equal(result.cars,72,JSON.stringify(result));
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/bridge-depth.png'});
 assert.deepEqual(errors,[]);console.log('Bridge/building overlap pixels, picking and visible traffic pass for both axes, three styles and four views.',result);
}finally{await browser.close();}
