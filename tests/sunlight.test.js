import test from 'node:test';
import assert from 'node:assert/strict';
import {SUN,shadowPoint,shadowPlanes,clipShadow,groundQuad} from '../src/sunlight.js';
import {CityRenderer} from '../src/renderer.js';
const caster={x:4,y:4,w:2,d:2,z:0,h:80},planes=shadowPlanes(caster);
const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
test('shadow volume reaches nearby lower roofs but never roofs above the caster',()=>{
 assert.ok(area(clipShadow(groundQuad(6,3,2,2,10),planes))>0);
 assert.equal(clipShadow(groundQuad(6,3,2,2,90),planes).length,0);
 assert.equal(clipShadow(groundQuad(1,6,2,2,0),planes).length,0);
});
test('world shadow endpoints survive camera rotation, zoom and elevation changes',()=>{
 const p=shadowPoint(4,4,80,16);assert.deepEqual(p,[4+SUN.x*64,4+SUN.y*64,16]);
 const r=Object.assign(Object.create(CityRenderer.prototype),{size:32,w:1200,h:800,zoom:1.4,panX:30,panY:71,platform:0});
 const screen=[];
 for(let rotation=0;rotation<4;rotation++){r.rotation=rotation;screen.push(r.project(...p));assert.deepEqual(shadowPoint(4,4,80,16),p);}
 assert.equal(new Set(screen.map(p=>JSON.stringify(p))).size,4);
});
test('vertical receiver clipping accounts for facade height rather than using a ground decal',()=>{
 const wall=[[6.5,3,0],[6.5,5,0],[6.5,5,120],[6.5,3,120]],result=clipShadow(wall,planes);
 assert.ok(result.length>=3);assert.ok(result.every(p=>p[2]>=0 && p[2]<=80));
 assert.ok(Math.max(...result.map(p=>p[2]))<80);
});
test('shadow intersections remain inside both the receiving tile and the light volume',()=>{
 for(let y=0;y<10;y++)for(let x=0;x<10;x++) {
  const result=clipShadow(groundQuad(x,y,1,1,0),planes);
  for(const p of result){assert.ok(p[0]>=x-1e-7 && p[0]<=x+1+1e-7);assert.ok(p[1]>=y-1e-7 && p[1]<=y+1+1e-7);assert.equal(p[2],0);}
 }
});

test('scene geometry survives view changes but invalidates after construction and demolition',async()=>{
 const {shadowScene}=await import('../src/shadow-scene.js');
 const r=Object.assign(Object.create(CityRenderer.prototype),{size:16,w:900,h:700,zoom:1,panX:0,panY:0,platform:null});
 const city={size:16,revision:1,tiles:Array.from({length:256},(_,i)=>({x:i%16,y:Math.floor(i/16),type:'empty',terrain:'grass',elev:0,trees:0}))};
 const t=city.tiles[8*16+6];Object.assign(t,{type:'commercial',density:3,level:4,lot:{x:6,y:8,w:1,h:1}});
 r.buildCorners(city);const initial=shadowScene(r,city);
 assert.ok(initial.candidates(7,7).some(c=>c.owner===t),'off-screen buildings still cast into receiving tiles');
 r.rotation=2;r.zoom=2;r.panX=300;assert.equal(shadowScene(r,city),initial);
 t.lot=null;t.type='empty';city.revision++;r.buildCorners(city);const cleared=shadowScene(r,city);
 assert.notEqual(cleared,initial);assert.equal(cleared.casters.length,0);
});

test('retaining walls receive height-aware shadows in the views where they are visible',async()=>{
 const {drawTerrainShadows}=await import('../src/shadow-paint.js');
 const r=Object.assign(Object.create(CityRenderer.prototype),{size:12,w:900,h:700,zoom:1,panX:0,panY:0,platform:null,night:false});
 const city={size:12,revision:1,tiles:Array.from({length:144},(_,i)=>({x:i%12,y:Math.floor(i/12),terrain:'grass',elev:2,type:'empty'}))};
 for(let y=3;y<6;y++)for(let x=3;x<8;x++)Object.assign(city.tiles[y*12+x],{elev:x<6?3:2,lot:x<6?{x:3,y:3,w:3,h:3}:{x:6,y:3,w:2,h:3}});
 r.buildCorners(city);r.base={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){}};
 const volume={planes:shadowPlanes({x:4,y:6,w:2,d:2,z:0,h:100})};
 r.shadowScene={candidates:()=>[volume]};const t=city.tiles[4*12+5];
 for(let rotation=0;rotation<4;rotation++) {
  r.rotation=rotation;drawTerrainShadows(r,t,city);
  const polygons=r.shadowScene.terrainPolygons[rotation].get(t);
  const wall=polygons.some(p=>p.every(v=>v[0]===6) && p.some(v=>v[2]<24));
  assert.equal(wall,rotation<2);
 }
});
