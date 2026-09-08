import test from 'node:test';
import assert from 'node:assert/strict';
import {faceLight} from '../src/sunlight.js';
import {shadeHex} from '../src/art-colors.js';
import {CityRenderer} from '../src/renderer.js';
import {lotVertexHeight,foundationEdges} from '../src/lot-foundations.js';
function scene() {
 const city={size:12,revision:1,tiles:Array.from({length:144},(_,i)=>({x:i%12,y:Math.floor(i/12),elev:2,terrain:'grass'}))};
 const r=Object.assign(Object.create(CityRenderer.prototype),{size:12,w:900,h:700,zoom:1.7,panX:14,panY:-37,rotation:0,platform:null});
 return {city,r};
}
function lot(city,x,y,w,h,elev) {
 for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)Object.assign(city.tiles[yy*city.size+xx],{lot:{x,y,w,h},elev,type:'residential'});
 return city.tiles[y*city.size+x];
}
test('roads meet a graded building site exactly in all orientations without changing saved elevations',()=>{
 const {city,r}=scene();const t=lot(city,3,3,3,2,3),saved=JSON.stringify(city);
 r.buildCorners(city);
 for(let rotation=0;rotation<4;rotation++) {
  r.rotation=rotation;
  for(const [x,y] of [[3,3.2],[6,3.7],[4.2,3],[5.8,5]]) {
   r.platform=null;const ground=r.project(x,y);r.platform=24;
   assert.deepEqual(r.project(x,y),ground);
  }
  assert.equal(foundationEdges(r,t).length,0);
 }
 assert.equal(JSON.stringify(city),saved);
});
test('terraced lots use the lower shared grade and higher solid retaining walls',()=>{
 const {city,r}=scene();const high=lot(city,3,3,3,3,3);lot(city,6,3,2,3,2);r.buildCorners(city);
 assert.equal(lotVertexHeight(city,6,4),16);
 for(const rotation of [0,1]){r.rotation=rotation;const walls=foundationEdges(r,high).filter(e=>e.a[0]===6 && e.b[0]===6);assert.equal(walls.length,3);assert.ok(walls.every(e=>e.shade===shadeHex('#9c9480',faceLight(1,0))));assert.ok(walls.every(e=>e.top===24 && e.a[2]===16 && e.b[2]===16));}
 for(const rotation of [2,3]){r.rotation=rotation;const walls=foundationEdges(r,high).filter(e=>e.a[0]===6 && e.b[0]===6);assert.equal(walls.length,3);assert.ok(walls.every(e=>!e.facing));}
});
test('both sides seal a lowered terraced corner even when they face away',()=>{
 const {city,r}=scene(),high=lot(city,3,3,3,3,3);lot(city,6,3,2,2,1);r.buildCorners(city);
 for(let rotation=0;rotation<4;rotation++) {
  r.rotation=rotation;
  const edges=foundationEdges(r,high).filter(e=>[e.a,e.b].some(p=>p[0]===6 && p[1]===3));
  assert.equal(edges.length,2);
  assert.ok(edges.every(e=>e.top===24 && Math.min(e.a[2],e.b[2])===8));
 }
});
test('long retaining walls follow intervening dips and never produce inverted faces',()=>{
 const {city,r}=scene(),t=lot(city,3,3,3,3,3);r.buildCorners(city);r.corners[6*13+4]=8;
 const walls=foundationEdges(r,t);assert.equal(walls.length,2);
 assert.ok(walls.every(e=>Math.min(e.a[2],e.b[2])===8));
 r.corners[6*13+4]=40;assert.equal(foundationEdges(r,t).length,0);
});
test('coastal foundations meet the waterline and removal restores the original terrain',()=>{
 const {city,r}=scene(),t=lot(city,3,3,3,3,3);
 for(let y=3;y<6;y++)Object.assign(city.tiles[y*12+6],{terrain:'water',waterLevel:.75,elev:0});
 r.buildCorners(city);assert.equal(r.meshZ(6,4),6);
 assert.ok(foundationEdges(r,t).some(e=>e.a[2]===6 && e.top===24));
 for(const cell of city.tiles)cell.lot=null;
 r.buildCorners(city);assert.equal(lotVertexHeight(city,6,4),null);assert.equal(r.meshZ(6,4),12); // Average ground beds, not the water surface.
});

test('per-tile foundation pass covers each outer wall once without internal walls',()=>{
 const {city,r}=scene(),t=lot(city,3,3,3,3,3);lot(city,6,3,2,3,2);r.buildCorners(city);
 for(let rotation=0;rotation<4;rotation++) {
  r.rotation=rotation;const parts=[];
  for(let y=3;y<6;y++)for(let x=3;x<6;x++)parts.push(...foundationEdges(r,t,{x,y}));
  const key=e=>JSON.stringify(e),expected=foundationEdges(r,t).map(key).sort();
  assert.deepEqual(parts.map(key).sort(),expected);
  assert.equal(foundationEdges(r,t,{x:4,y:4}).length,0);
 }
});

test('a stale lot anchor cannot poison terrain vertices',()=>{
 const {city,r}=scene();city.tiles[3*12+3].lot={x:99,y:99,w:1,h:1};
 assert.equal(lotVertexHeight(city,3,3),null);r.buildCorners(city);
 assert.ok(r.corners.every(Number.isFinite));
});
