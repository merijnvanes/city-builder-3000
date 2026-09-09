import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
// A building and its graded site are one scene item. The pad and retaining
// walls must cover trees and buildings behind the site, leave trees in front
// of it untouched, and picking must follow what is visible.
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173/?play');
 await page.waitForFunction(()=>!!window.civic?.agent);
 await page.evaluate(async()=>{
  const {assignLot}=await import('/src/sim/lots.js');
  const {preloadCivicSprites}=await import('/src/building-art.js');
  civic.agent.newCity({size:32,starter:false,layout:'plains',hills:0,seed:12});
  const c=civic.city,r=civic.renderer;c.speed=0;
  for(const t of c.tiles)Object.assign(t,{terrain:'grass',elev:0,trees:0});
  for(const [x,y,type,w,h,elev] of [[14,14,'school',3,3,6],[17,14,'police',2,2,0]]) {
   for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)Object.assign(c.tiles[yy*32+xx],{type,elev,powered:true,age:20});
   assignLot(c,{x,y,w,h},3,.4);
  }
  for(const [x,y] of [[13,14],[14,13],[17,16],[14,17],[16,17],[13,16],[16,13],[17,17]])c.tiles[y*32+x].trees=1;
  await preloadCivicSprites({types:['school','police'],owner:r});
  c.revision++;r.buildCorners(c);
 });
 await mkdir('artifacts',{recursive:true});
 let hiddenTotal=0,hiddenBuildings=0,wallsChecked=0;
 for(let rotation=0;rotation<4;rotation++) {
  const result=await page.evaluate(async rotation=>{
   const {preloadCivicSprites}=await import('/src/building-art.js');
   const {foundationEdges,drawLotFoundation,hitFoundation}=await import('/src/lot-foundations.js');
   const {drawShadedArchitecture}=await import('/src/shadow-paint.js');
   const {naturalTrees}=await import('/src/tree-layout.js');
   const r=civic.renderer;r.rotation=rotation;await preloadCivicSprites({types:['school','police'],rotation,owner:r});
   r.focusOn(15.5,15,2.2);r.dirty=true;r.render(civic.city,1000);r.paint(civic.city);
   const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=800;
   const base=canvas.getContext('2d',{willReadFrequently:true});
   const proxy=Object.assign(Object.create(r),{base,platform:0,pickables:[]});
   const t=civic.city.tiles[14*32+14],walls=foundationEdges(proxy,t);
   // Every visible retaining wall is painted, and the object layer shows
   // the wall rather than terrain at its far end.
   drawLotFoundation(proxy,t);
   const object=r.base.getImageData(0,0,1000,800).data;
   let checked=0;
   for(const wall of walls)for(const f of [.1,.5,.9]) {
    const [ax,ay,az]=wall.a,[bx,by,bz]=wall.b,z=az+(bz-az)*f;
    if(wall.top-z<4 || !wall.facing)continue;
    const p=proxy.project(ax+(bx-ax)*f,ay+(by-ay)*f,(wall.top+z)/2);
    if(p.x<1 || p.x>998 || p.y<1 || p.y>798)throw Error('Support test point outside the viewport');
    const x=Math.round(p.x),y=Math.round(p.y);
    if(base.getImageData(x,y,1,1).data[3]<250)throw Error(`Retaining wall not painted in view ${rotation}`);
    const pixel=object.slice((y*1000+x)*4,(y*1000+x)*4+4);
    if(pixel[3]<250 || pixel[1]>pixel[0]+2)throw Error(`Wall missing from the object layer at view ${rotation}, segment ${f}: ${Array.from(pixel)}`);
    checked++;
   }
   base.clearRect(0,0,1000,800);proxy.platform=null;proxy.pickables=[];
   const [tx,ty]=[[14,17],[17,16],[16,13],[13,14]][rotation],tree=civic.city.tiles[ty*32+tx];
   drawShadedArchitecture(proxy,tree,civic.city,()=>{for(const [x,y,variant] of naturalTrees(tree))proxy.tree(x,y,variant);});
   const expected=base.getImageData(0,0,1000,800).data,actual=object;
   const same=i=>actual[i+3]>=253 && Math.max(...[0,1,2].map(c=>Math.abs(expected[i+c]-actual[i+c])))<=2;
   let treePixels=0,covered=0;
   for(let i=0;i<expected.length;i+=4)if(expected[i+3]===255) {
    treePixels++;
    if(!same(i))covered++;
    if(i%80===0) {
     const pick=r.pickObject((i/4)%1000+.5,Math.floor(i/4/1000)+.5);
     if(pick.x!==tx || pick.y!==ty)throw Error('A foreground tree must select its own tile');
    }
   }
   if(!treePixels || covered)throw Error(`Front tree covered in view ${rotation}: ${covered}/${treePixels}`);
   const foundation=r.pickables.find(hit=>hit.t===t && hit.polygons);
   // Only the site itself may account for a covered rear pixel: skip pixels
   // that a tree or building in front of the site covers as well.
   const later=r.pickables.slice(r.pickables.indexOf(foundation)+1).filter(hit=>hit.t!==t);
   const coveredByLater=(x,y)=>later.some(hit=>{
    if(x<hit.x || y<hit.y || x>=hit.x+hit.w || y>=hit.y+hit.h)return false;
    if(hit.polygons)return hitFoundation(hit.polygons,x,y);
    if(!hit.canvas)return true;
    const s=hit.source || {x:0,y:0,w:hit.canvas.width,h:hit.canvas.height};
    const px=s.x+Math.min(s.w-1,Math.floor((x-hit.x)/hit.w*s.w)),py=s.y+Math.min(s.h-1,Math.floor((y-hit.y)/hit.h*s.h));
    return hit.canvas.getContext('2d').getImageData(px,py,1,1).data[3]>0;
   });
   let hidden=0;
   for(const item of r.items.slice(0,r.items.findIndex(item=>item.t===t)))if(item.kind==='trees') {
    base.clearRect(0,0,1000,800);
    for(const [x,y,variant] of naturalTrees(item.t))proxy.tree(x,y,variant);
    const rear=base.getImageData(0,0,1000,800).data;
    for(let i=0;i<rear.length;i+=4)if(rear[i+3]===255) {
     const x=(i/4)%1000+.5,y=Math.floor(i/4/1000)+.5;
     if(!hitFoundation(foundation.polygons,x,y) || coveredByLater(x,y))continue;
     if(actual[i+3]>=253 && Math.max(...[0,1,2].map(c=>Math.abs(rear[i+c]-actual[i+c])))<=2)throw Error(`A rear tree shows through the foundation in view ${rotation}`);
     const pick=r.pickObject(x,y);
     if(pick.x!==t.x || pick.y!==t.y)throw Error('Hidden tree area must select the foundation');
     hidden++;
    }
   }
   let hiddenBuilding=0;
   for(const hit of r.pickables.slice(0,r.pickables.indexOf(foundation)))if(hit.canvas && hit.t.lot && hit.t!==t) {
    const source=hit.source || {x:0,y:0,w:hit.canvas.width,h:hit.canvas.height};
    const pixels=hit.canvas.getContext('2d').getImageData(source.x,source.y,source.w,source.h).data;
    for(let y=Math.max(0,Math.ceil(hit.y));y<Math.min(800,hit.y+hit.h);y++)for(let x=Math.max(0,Math.ceil(hit.x));x<Math.min(1000,hit.x+hit.w);x++) {
     if(!hitFoundation(foundation.polygons,x+.5,y+.5) || coveredByLater(x+.5,y+.5))continue;
     const sx=Math.min(source.w-1,Math.floor((x-hit.x)/hit.w*source.w)),sy=Math.min(source.h-1,Math.floor((y-hit.y)/hit.h*source.h));
     const s=(sy*source.w+sx)*4;
     if(pixels[s+3]<250)continue;
     const i=(y*1000+x)*4;
     if(Math.max(...[0,1,2].map(c=>Math.abs(pixels[s+c]-actual[i+c])))<=2)continue;
     const pick=r.pickObject(x+.5,y+.5);
     if(pick.x!==t.x || pick.y!==t.y)throw Error('Invisible rear building selected through the foundation');
     hiddenBuilding++;
    }
   }
   return {rotation,checked,treePixels,hidden,hiddenBuilding};
  },rotation);
  wallsChecked+=result.checked;hiddenTotal+=result.hidden;hiddenBuildings+=result.hiddenBuilding;
  console.log(result);
  await page.screenshot({path:`artifacts/scene-depth-${rotation}.png`});
 }
 assert.ok(wallsChecked>0,'visible retaining walls were painted in the views that face them');
 assert.ok(hiddenTotal>0,'a real rear tree must be covered by the foundation');
 assert.ok(hiddenBuildings>0,'covered pixels of a real cached building must select the foundation');
 const corners=await page.evaluate(async()=>{
  const {preloadCivicSprites}=await import('/src/building-art.js');
  const {drawShadedArchitecture}=await import('/src/shadow-paint.js');
  const {naturalTrees}=await import('/src/tree-layout.js');
  const {hitFoundation}=await import('/src/lot-foundations.js');
  const c=civic.city,r=civic.renderer,school=c.tiles[14*32+14];
  for(const t of c.tiles){t.trees=0;if(t.type==='police')Object.assign(t,{type:'empty',lot:null});}
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=800;
  const base=canvas.getContext('2d',{willReadFrequently:true});let checked=0;
  for(let rotation=0;rotation<4;rotation++) {
   r.rotation=rotation;await preloadCivicSprites({types:['school'],rotation,owner:r});
   for(const [x,y] of [[13,13],[17,13],[13,17],[17,17]]) {
    const tree=c.tiles[y*32+x];tree.trees=3;c.revision++;
    r.buildCorners(c);r.focusOn(15.5,15,2.2);r.render(c,1000);r.paint(c);
    base.clearRect(0,0,1000,800);
    const proxy=Object.assign(Object.create(r),{base,platform:null,pickables:[]});
    drawShadedArchitecture(proxy,tree,c,()=>{for(const [x,y,variant] of naturalTrees(tree))proxy.tree(x,y,variant);});
    const expected=base.getImageData(0,0,1000,800).data,actual=r.base.getImageData(0,0,1000,800).data;
    const p=r.orient(x+.5,y+.5),center=r.orient(15.5,15.5),behind=p.x<center.x && p.y<center.y;
    const foundation=r.pickables.find(hit=>hit.t===school && hit.polygons);
    let opaque=0,covered=0;
    for(let i=0;i<expected.length;i+=4)if(expected[i+3]===255) {
     opaque++;
     const px=(i/4)%1000+.5,py=Math.floor(i/4/1000)+.5;
     const visible=actual[i+3]>=253 && Math.max(...[0,1,2].map(c=>Math.abs(expected[i+c]-actual[i+c])))<=2;
     if(!visible)covered++;
     // A rear tree is picked through only where the pad fully covers it; an
     // antialiased pad edge legitimately shows a blend of both.
     if(i%80===0 && (!behind || (!visible && hitFoundation(foundation.polygons,px,py)))) {
      const pick=r.pickObject(px,py);
      if(pick.x!==(behind?14:x) || pick.y!==(behind?14:y))throw Error(`Diagonal tree picking in view ${rotation} at ${x},${y}`);
     }
    }
    if(!opaque || (behind?covered===0:covered>0))throw Error(`Diagonal tree overlap in view ${rotation} at ${x},${y}: ${covered}/${opaque}`);
    tree.trees=0;checked++;
   }
  }
  return checked;
 });
 assert.equal(corners,16);
 assert.deepEqual(errors,[]);
 console.log('Graded sites cover rear trees and buildings, leave front trees whole and pick what is visible in every view.');
}finally{await browser.close();}
