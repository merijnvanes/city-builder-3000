import test from 'node:test';
import assert from 'node:assert/strict';
import {CityRenderer} from '../src/renderer.js';
import {orderScene} from '../src/scene-order.js';

const camera=(rotation,size=32)=>Object.assign(Object.create(CityRenderer.prototype),{size,rotation});

test('trees beside the far half of a large lot follow the separating side in every view',()=>{
 const r=camera(0);
 const lot={kind:'lot',x:14,y:14,w:3,h:3};
 for(let rotation=0;rotation<4;rotation++) {
  r.rotation=rotation;
  for(const [x,y] of [[17,14],[14,17],[13,16],[16,13]]) {
   const tree={kind:'trees',x,y,w:1,h:1},items=[lot,tree];
   items.sort((a,b)=>r.depthKey(a.x,a.y,a.w,a.h)-r.depthKey(b.x,b.y,b.w,b.h));
   const center=r.orient(15.5,15.5),p=r.orient(x+.5,y+.5);
   const treeInFront=p.x>center.x+1.5 || p.y>center.y+1.5;
   assert.deepEqual(orderScene(items,r),treeInFront?[lot,tree]:[tree,lot]);
  }
 }
});

test('a deck directly in front of a building is painted after it in every view',()=>{
 // The crossing at (20,20) and a one-tile lot behind it at (20,19): in every
 // orientation the nearer footprint must come later, so its raised deck
 // covers the base of whatever stands behind rather than the reverse.
 for(let rotation=0;rotation<4;rotation++) {
  const r=camera(rotation,40);
  const deck={kind:'deck',x:20,y:20,w:1,h:1},tower={kind:'lot',x:20,y:19,w:1,h:1},aside={kind:'lot',x:19,y:20,w:1,h:1};
  const ordered=orderScene([deck,tower,aside],r);
  const key=item=>{const p=r.orient(item.x+.5,item.y+.5);return p.x+p.y;};
  for(let i=1;i<ordered.length;i++)assert.ok(key(ordered[i-1])<=key(ordered[i]),`view ${rotation}: ${ordered.map(o=>o.kind).join(' < ')}`);
 }
});

test('footprint ordering never produces a cycle on a dense mixed block',()=>{
 const r=camera(1,24),items=[];
 for(let y=2;y<20;y+=3)for(let x=2;x<20;x+=3)items.push({kind:'lot',x,y,w:1+(x+y)%3,h:1+(x*y)%3});
 for(let i=0;i<40;i++)items.push({kind:'trees',x:(i*7)%22,y:(i*11)%22,w:1,h:1});
 const ordered=orderScene(items,r);
 assert.equal(ordered.length,items.length);
 assert.equal(new Set(ordered).size,items.length,'every item is painted exactly once');
});
