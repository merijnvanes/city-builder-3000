import test from 'node:test';
import assert from 'node:assert/strict';
import {splitWaterTile,waterBedHeight,waterGeometry,waterHeightAt,isWaterPoint} from '../src/water-geometry.js';
import {CityRenderer} from '../src/renderer.js';
import {shadowScene} from '../src/shadow-scene.js';
import {naturalTrees,treeHeight} from '../src/tree-layout.js';
const area=p=>Math.abs(p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a[0]*b[1]-b[0]*a[1];},0))/2;
const corners=heights=>[[0,0],[1,0],[1,1],[0,1]].map(([x,y],i)=>[x,y,heights[i]]);
test('bank tree shadows start at the rendered ground and submerged roots cast no shadow',()=>{
 const city={size:8,revision:1,tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),type:'empty',elev:2,terrain:'grass',trees:3}))};
 for(let y=2;y<5;y++)for(let x=2;x<5;x++)Object.assign(city.tiles[y*8+x],{terrain:'water',elev:0,waterLevel:1.5});
 const r=Object.create(CityRenderer.prototype);r.size=8;r.buildCorners(city);
 const scene=shadowScene(r,city);let checked=0,submerged=0;
 for(const t of city.tiles) {
  const geometry=waterGeometry(r,t);if(!geometry)continue;
  const expected=naturalTrees(t).filter(([x,y])=>!isWaterPoint(r,x,y));
  submerged+=naturalTrees(t).length-expected.length;
  const actual=scene.casters.filter(c=>c.owner===t);
  assert.equal(actual.length,expected.length);
  expected.forEach(([x,y,v],i)=>{
   assert.ok(Math.abs(actual[i].z-waterHeightAt(geometry,x,y)-treeHeight(x,y,v)*.35)<1e-7);checked++;
  });
 }
 assert.ok(checked>0 && submerged>0);
});
test('all corner classifications partition the tile without raising land or tilting water',()=>{
 for(let code=0;code<81;code++) {
  const heights=Array.from({length:4},(_,i)=>Math.floor(code/3**i)%3-1);
  const geometry=splitWaterTile(corners(heights),[.5,.5,heights.reduce((a,b)=>a+b)/4],0);
  assert.ok(Math.abs([...geometry.wet,...geometry.dry].reduce((sum,p)=>sum+area(p),0)-1)<1e-7,`${heights}`);
  assert.ok(geometry.wet.flat().every(p=>p[2]===0));
  assert.ok(geometry.dry.flat().every(p=>p[2]>=0));
  assert.ok(geometry.shore.flat().every(p=>p[2]===0));
 }
});
test('one submerged corner and opposite raised corner produce the exact diagonal waterline',()=>{
 const g=splitWaterTile(corners([-1,0,1,0]),[.5,.5,0],0);
 assert.equal(g.wet.reduce((sum,p)=>sum+area(p),0),.5);
 assert.ok(g.shore.length>0);
 assert.ok(g.shore.flat().every(([x,y,z])=>Math.abs(x+y-1)<1e-7 && z===0));
 assert.equal(waterBedHeight(g,.25,.25),-.5);
 assert.equal(waterBedHeight(g,.75,.75),.5);
});
test('a single excavated pond remains partly wet below four raised boundary vertices',()=>{
 const g=splitWaterTile(corners([2,2,2,2]),[.5,.5,-2],0);
 const wet=g.wet.reduce((sum,p)=>sum+area(p),0);
 assert.ok(wet>0 && wet<1);assert.equal(g.shore.length,4);
 assert.equal(waterBedHeight(g,.5,.5),-2);assert.equal(waterBedHeight(g,0,0),2);
});
test('water geometry is independent of rotation and refreshes for terrain and water changes',()=>{
 const t={x:0,y:0,elev:0,waterLevel:1,terrain:'water'},r={corners:{},meshZ:()=>16};
 const a=waterGeometry(r,t);r.rotation=1;assert.equal(waterGeometry(r,t),a);
 t.waterLevel=1.5;const b=waterGeometry(r,t);assert.notEqual(b,a);assert.equal(b.level,12);
 r.corners={};r.meshZ=()=>8;assert.notEqual(waterGeometry(r,t),b);
});

test('neighboring bank and water meshes share their actual shoreline without changing tile rules',()=>{
 const city={size:8,tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),elev:2,terrain:'grass'}))};
 for(let y=2;y<5;y++)for(let x=2;x<5;x++)Object.assign(city.tiles[y*8+x],{terrain:'water',elev:0,waterLevel:1.5});
 const saved=JSON.stringify(city),r=Object.create(CityRenderer.prototype);r.size=8;r.buildCorners(city);
 let hybrid=0;
 for(const t of city.tiles) {
  const geometry=waterGeometry(r,t);if(t.terrain!=='water' && geometry?.wet.length && geometry?.dry.length)hybrid++;
  for(const [dx,dy] of [[1,0],[0,1]]) {
   if(t.x+dx>=8 || t.y+dy>=8)continue;
   const neighbor=city.tiles[(t.y+dy)*8+t.x+dx],other=waterGeometry(r,neighbor);
   for(const f of [.1,.3,.5,.7,.9]) {
    const x=t.x+(dx?1:f),y=t.y+(dy?1:f);
    const a=geometry?waterHeightAt(geometry,x,y):r.meshZ(x,y),b=other?waterHeightAt(other,x,y):r.meshZ(x,y);
    assert.ok(Math.abs(a-b)<1e-6,`Crack at ${x},${y}: ${a}/${b}`);
   }
  }
 }
 assert.ok(hybrid>0);assert.equal(JSON.stringify(city),saved);
 assert.ok(isWaterPoint(r,3.5,3.5));assert.equal(isWaterPoint(r,0.5,0.5),false);
});

test('separate pools retain distinct surfaces across a dry ridge',()=>{
 const city={size:8,tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),elev:8,terrain:'grass'}))};
 Object.assign(city.tiles[3*8+2],{terrain:'water',elev:0,waterLevel:1});
 Object.assign(city.tiles[3*8+5],{terrain:'water',elev:2,waterLevel:3});
 const r=Object.create(CityRenderer.prototype);r.size=8;r.buildCorners(city);
 assert.equal(r.groundZ(2.5,3.5),8);assert.equal(r.groundZ(5.5,3.5),24);
 assert.equal(isWaterPoint(r,4,3.5),false);
});

test('the actual bank mesh joins two waterline corners with one straight diagonal',()=>{
 const tiles=Array.from({length:9},(_,i)=>({x:i%3,y:Math.floor(i/3),terrain:'grass',elev:2}));
 Object.assign(tiles[3],{terrain:'water',elev:0,waterLevel:1.5});
 const heights={'1,1':4,'2,1':12,'2,2':16,'1,2':12};
 const r={size:3,tiles,corners:{},meshZ:(x,y)=>heights[`${x},${y}`]};
 const g=waterGeometry(r,tiles[4]);assert.ok(g.shore.length>0);
 assert.ok(g.shore.flat().every(([x,y,z])=>Math.abs(x+y-3)<1e-7 && z===12));
});

test('water-level edits refresh cached banks even when bed vertices have identical values',()=>{
 const city={size:8,revision:1,tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),elev:2,terrain:'grass'}))};
 for(let y=2;y<5;y++)for(let x=2;x<5;x++)Object.assign(city.tiles[y*8+x],{terrain:'water',elev:0,waterLevel:1.5});
 const r=Object.create(CityRenderer.prototype);r.size=8;r.buildCorners(city);
 const bank=city.tiles[3*8+1],before=waterGeometry(r,bank),oldCorners=r.corners;
 for(const t of city.tiles)if(t.terrain==='water')t.waterLevel=1.75;
 city.revision++;r.buildCorners(city);
 assert.deepEqual(r.corners,oldCorners);assert.notEqual(r.corners,oldCorners);
 const after=waterGeometry(r,bank);assert.notEqual(after,before);assert.equal(after.level,14);
 assert.ok(after.wet.reduce((s,p)=>s+area(p),0)>before.wet.reduce((s,p)=>s+area(p),0));
});

test('one-tile channels remain connected between high banks and rising water expands a pit',()=>{
 const city={size:8,tiles:Array.from({length:64},(_,i)=>({x:i%8,y:Math.floor(i/8),elev:8,terrain:'grass'}))};
 for(let x=1;x<7;x++)Object.assign(city.tiles[3*8+x],{terrain:'water',elev:1,waterLevel:1.75});
 const r=Object.create(CityRenderer.prototype);r.size=8;r.buildCorners(city);
 for(let x=1.5;x<=6.5;x+=.25) {assert.ok(isWaterPoint(r,x,3.5));assert.equal(r.groundZ(x,3.5),14);}
 let previous=0;const tile=city.tiles[3*8+1];
 for(const level of [1.1,1.5,2,3,4,5,6,7]) {
  tile.waterLevel=level;const wet=waterGeometry(r,tile).wet.reduce((s,p)=>s+area(p),0);
  assert.ok(wet>=previous-1e-7);previous=wet;
 }
});
