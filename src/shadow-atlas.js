// A single bounded atlas reuses finished shadow composites while the camera
// pans. It never retains source images outside their loader's memory budget.
const CELL=64,MAX_SIZE=2048,atlases=new WeakMap();
export class AtlasSlots {
 constructor(size){this.side=size/CELL;this.rows=new Uint32Array(this.side);}
 allocate(w,h) {
  if(!Number.isFinite(w+h) || w<=0 || h<=0)return null;
  const cols=Math.ceil(w/CELL),rows=Math.ceil(h/CELL);
  if(cols>this.side || rows>this.side)return null;
  for(let y=0;y<=this.side-rows;y++)for(let x=0;x<=this.side-cols;x++) {
   const mask=((cols===32?0xffffffff:2**cols-1)<<x)>>>0;
   let fits=true;for(let yy=y;yy<y+rows;yy++)if(this.rows[yy]&mask){fits=false;break;}
   if(!fits)continue;
   for(let yy=y;yy<y+rows;yy++)this.rows[yy]=(this.rows[yy]|mask)>>>0;
   return {x:x*CELL,y:y*CELL,w,h,mask,rows};
  }
  return null;
 }
 release(slot){for(let y=slot.y/CELL;y<slot.y/CELL+slot.rows;y++)this.rows[y]=(this.rows[y]&~slot.mask)>>>0;}
}
function atlas(r,city) {
 const key=[city.revision,r.rotation,r.zoom,r.dpr,r.artRevision || 0,r.corners];
 let a=atlases.get(r);
 const size=Math.min(MAX_SIZE,Math.max(256,2**Math.ceil(Math.log2(Math.max(r.w,r.h)*(r.dpr || 1)))));
 if(!a || a.tiles!==city.tiles || a.size!==size || key.some((v,i)=>v!==a.key[i])) {
  const canvas=a?.canvas || document.createElement('canvas');canvas.width=canvas.height=size;
  a={canvas,size,key,tiles:city.tiles,slots:new AtlasSlots(size),entries:new Map(),epoch:-1};atlases.set(r,a);
 }
 const epoch=r.paintEpoch || 0;
 if(a.epoch!==epoch) {
  for(const [tile,entry] of a.entries)if(entry.seen<epoch-1){a.slots.release(entry.slot);a.entries.delete(tile);}
  a.epoch=epoch;
 }
 return a;
}
const phase=(p,dpr)=>`${((p.x*dpr%1+1)%1).toFixed(5)}:${((p.y*dpr%1+1)%1).toFixed(5)}`;
export function drawFromShadowAtlas(r,t,city,anchor) {
 const a=atlas(r,city),entry=a.entries.get(t),dpr=r.dpr || 1;
 if(!entry || entry.phase!==phase(anchor,dpr))return false;
 const {slot}=entry,x=anchor.x+entry.dx,y=anchor.y+entry.dy,w=slot.w/dpr,h=slot.h/dpr;
 r.base.drawImage(a.canvas,slot.x,slot.y,slot.w,slot.h,x,y,w,h);
 if(t.lot && r.pickables)r.pickables.push({t,x,y,w,h,canvas:a.canvas,source:{x:slot.x,y:slot.y,w:slot.w,h:slot.h}});
 entry.seen=r.paintEpoch || 0;return true;
}
export function rememberShadow(r,t,city,anchor,canvas,bounds,crop) {
 const a=atlas(r,city),dpr=r.dpr || 1;
 const sx=Math.max(0,Math.floor((crop.x-bounds.x)*dpr)),sy=Math.max(0,Math.floor((crop.y-bounds.y)*dpr));
 const width=Math.min(bounds.width-sx,Math.ceil(crop.w*dpr)+1),height=Math.min(bounds.height-sy,Math.ceil(crop.h*dpr)+1);
 if(width<=0 || height<=0)return;
 const prior=a.entries.get(t);if(prior){a.slots.release(prior.slot);a.entries.delete(t);}
 const slot=a.slots.allocate(width,height);if(!slot)return; // Working set overflow stays uncached.
 const ctx=a.canvas.getContext('2d');ctx.clearRect(slot.x,slot.y,slot.w,slot.h);
 ctx.drawImage(canvas,sx,sy,width,height,slot.x,slot.y,width,height);
 a.entries.set(t,{slot,dx:bounds.x+sx/dpr-anchor.x,dy:bounds.y+sy/dpr-anchor.y,phase:phase(anchor,dpr),seen:r.paintEpoch || 0});
}
export function shadowAtlasStats(r) {
 const a=atlases.get(r);return {entries:a?.entries.size || 0,bytes:a?a.size*a.size*4:0,maxBytes:MAX_SIZE*MAX_SIZE*4};
}
