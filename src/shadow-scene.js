import {heightOf} from './building-art.js';
import {bridgePlatform} from './bridge-art.js';
import {ELEV_PX,VIADUCT_HEIGHT} from './render-scale.js';
import {shadowPlanes,shadowPoint} from './sunlight.js';
import {naturalTrees,treeHeight} from './tree-layout.js';
import {MIN_ELEVATION} from './sim/terrain.js';

// Deliberately coarse shadow geometry: a solid body rather than every window,
// gutter and leaf. All artwork providers share the same receiver contract.
export function lotBody(t) {
 const {x,y,w,h}=t.lot,inset=Math.min(w,h)*.12;
 return {x:x+inset,y:y+inset,w:w-inset*2,d:h-inset*2,z:t.elev*ELEV_PX,h:heightOf(t)};
}
const scenes=new WeakMap();
export function shadowScene(r,city) {
 const prior=scenes.get(r);
 if(prior?.tiles===city.tiles && prior.revision===city.revision && prior.corners===r.corners)return prior;
 const bins=new Map(),bodies=new Map(),casters=[],floor=MIN_ELEVATION*ELEV_PX;
 const add=(body,owner)=>{
  if(body.h<=0)return;
  const caster={...body,owner,planes:shadowPlanes(body)};casters.push(caster);
  const a=shadowPoint(body.x,body.y,body.z+body.h,floor),b=shadowPoint(body.x+body.w,body.y+body.d,body.z+body.h,floor);
  const minX=Math.max(0,Math.floor(Math.min(body.x,a[0]))),maxX=Math.min(city.size-1,Math.floor(Math.max(body.x+body.w,b[0])));
  const minY=Math.max(0,Math.floor(Math.min(body.y,a[1]))),maxY=Math.min(city.size-1,Math.floor(Math.max(body.y+body.d,b[1])));
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++) {
   const key=y*city.size+x;let bucket=bins.get(key);if(!bucket)bins.set(key,bucket=[]);bucket.push(caster);
  }
 };
 for(const t of city.tiles) {
  if(t.lot?.x===t.x && t.lot?.y===t.y) {const body=lotBody(t);bodies.set(t,body);add(body,t);}
  else if(t.type==='empty' && !t.lot && t.trees) {
   let top=-Infinity;
   for(const [x,y,v] of naturalTrees(t)) {
    const height=treeHeight(x,y,v),radius=v===1?.09:.15,z=r.meshZ(x,y);
    add({x:x-radius,y:y-radius,w:radius*2,d:radius*2,z:z+height*.35,h:height*.65},t);
    top=Math.max(top,z+height);
   }
   bodies.set(t,{x:t.x,y:t.y,w:1,d:1,z:t.elev*ELEV_PX,h:Math.max(1,top-t.elev*ELEV_PX)});
  }
  if(t.powerline)add({x:t.x+.48,y:t.y+.48,w:.04,d:.04,z:r.meshZ(t.x+.5,t.y+.5),h:24},t);
  const bridge=bridgePlatform(r,t);
  const deck=bridge!==null?(typeof bridge==='function'?bridge(t.x+.5,t.y+.5):bridge):t.type==='highway' && t.under?r.meshZ(t.x+.5,t.y+.5)+VIADUCT_HEIGHT:null;
  if(deck!==null)add({x:t.x+.06,y:t.y+.06,w:.88,d:.88,z:deck-2,h:2},t);
 }
 const scene={tiles:city.tiles,revision:city.revision,corners:r.corners,bins,bodies,casters,
  candidates(x,y,w=1,h=1,exclude=null) {
   const out=new Set();
   for(let yy=Math.max(0,Math.floor(y));yy<Math.min(city.size,Math.ceil(y+h));yy++)for(let xx=Math.max(0,Math.floor(x));xx<Math.min(city.size,Math.ceil(x+w));xx++) {
    for(const c of bins.get(yy*city.size+xx) || [])if(c.owner!==exclude)out.add(c);
   }
   return [...out];
  }};
 scenes.set(r,scene);return scene;
}
