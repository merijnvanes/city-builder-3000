import test from 'node:test';
import assert from 'node:assert/strict';
import {CityRenderer} from '../src/renderer.js';
import {orderScene} from '../src/scene-order.js';

test('trees beside the far half of a large lot follow the separating side in every view',()=>{
 const r=Object.assign(Object.create(CityRenderer.prototype),{size:32});
 const lot={t:{x:14,y:14,lot:{w:3,h:3}}};
 for(let rotation=0;rotation<4;rotation++) {
  r.rotation=rotation;
  for(const [x,y] of [[17,14],[14,17],[13,16],[16,13]]) {
   const tree={t:{x,y}},items=[lot,tree];
   items.sort((a,b)=>r.depthKey(a.t.x,a.t.y,a.t.lot?.w,a.t.lot?.h)-r.depthKey(b.t.x,b.t.y,b.t.lot?.w,b.t.lot?.h));
   const center=r.orient(15.5,15.5),p=r.orient(x+.5,y+.5);
   const treeInFront=p.x>center.x+1.5 || p.y>center.y+1.5;
   assert.deepEqual(orderScene(items,r),treeInFront?[lot,tree]:[tree,lot]);
  }
 }
});
