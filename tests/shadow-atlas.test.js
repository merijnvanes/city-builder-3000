import test from 'node:test';
import assert from 'node:assert/strict';
import {AtlasSlots} from '../src/shadow-atlas.js';
test('atlas allocations are disjoint, bounded and reusable after eviction',()=>{
 const slots=new AtlasSlots(256),allocated=[];
 for(let i=0;i<16;i++){const slot=slots.allocate(60,60);assert.ok(slot);allocated.push(slot);}
 assert.equal(slots.allocate(1,1),null);
 assert.equal(new Set(allocated.map(s=>`${s.x},${s.y}`)).size,16);
 slots.release(allocated[5]);const replacement=slots.allocate(63,61);
 assert.equal(replacement.x,allocated[5].x);assert.equal(replacement.y,allocated[5].y);
 assert.equal(slots.allocate(300,60),null);
});
test('full-width allocations handle the high bit without overlapping another row',()=>{
 const slots=new AtlasSlots(2048),a=slots.allocate(2048,64),b=slots.allocate(2048,64);
 assert.equal(a.y,0);assert.equal(b.y,64);slots.release(a);
 const c=slots.allocate(2048,64);assert.equal(c.y,0);
});
