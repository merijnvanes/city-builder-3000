import test from 'node:test';
import assert from 'node:assert/strict';
import {CityRenderer} from '../src/renderer.js';
import {bridgePlatform,bridgeSurfaceHeight} from '../src/bridge-art.js';
import {drawStreet} from '../src/street-art.js';
for(const axis of ['x','y'])for(const reverse of [false,true])test(`bridge approach seams and picking on ${axis}, reverse=${reverse}`,()=>{
 const from={x:5,y:5},to={...from,[axis]:14};
 const s={kind:'bridge',route:'road',from:reverse?to:from,to:reverse?from:to,elevation:3,length:8};
 const city={size:24,revision:1,transportStructures:[s],tiles:Array.from({length:24*24},(_,i)=>({x:i%24,y:Math.floor(i/24),type:'empty',terrain:'grass',elev:3,trees:0}))};
 // Cross-sloped banks exercise the actual shared mesh, rather than just the
 // nominal elevation stored on a bank tile.
 for(const t of city.tiles){const across=axis==='x'?t.y:t.x;if(across<5)t.elev=2;if(across>5)t.elev=4;}
 for(let i=4;i<=15;i++){const x=axis==='x'?i:5,y=axis==='y'?i:5,t=city.tiles[y*24+x];t.type='road';if(i>=5 && i<=14)t.structure=s;if(i>5 && i<14)Object.assign(t,{terrain:'water',waterLevel:1.75,elev:1});}
 const r=Object.assign(Object.create(CityRenderer.prototype),{size:24,w:1200,h:850,zoom:1.7,panX:0,panY:0,platform:null,tool:'inspect'});r.buildCorners(city);
 for(let rotation=0;rotation<4;rotation++) {
  r.rotation=rotation;
  for(const low of [true,false]) {
   const n=low?5:14,t=city.tiles[(axis==='y'?n:5)*24+(axis==='x'?n:5)];
   for(const v of [.14,.5,.86]) {
    const x=axis==='x'?n+(low?0:1):5+v,y=axis==='y'?n+(low?0:1):5+v;
    r.platform=null;const street=r.project(x,y,.5);r.platform=bridgePlatform(r,t);assert.deepEqual(r.project(x,y,.5),street,'bank edge meets the ordinary street');
    const ix=axis==='x'?n+(low?1:0):5+v,iy=axis==='y'?n+(low?1:0):5+v;
    assert.equal(bridgeSurfaceHeight(r,t,ix,iy),28,'inner edge meets the level span');
   }
   for(const u of [.15,.5,.85]) {
    r.platform=bridgePlatform(r,t);const p=r.project(t.x+(axis==='x'?u:.5),t.y+(axis==='y'?u:.5));r.platform=null;
    assert.deepEqual(r.pick(p.x,p.y),{x:t.x,y:t.y},'ramp can be selected');
   }
  }
 }
});
test('bridge asphalt uses the sloped approach separately from the ground layer',()=>{
 const s={kind:'bridge',route:'road',from:{x:2,y:3},to:{x:7,y:3},elevation:1,length:4};
 const tiles=Array.from({length:100},(_,i)=>({x:i%10,y:Math.floor(i/10),type:'empty',terrain:'grass',elev:1,trees:0}));
 for(let x=1;x<=8;x++){tiles[30+x].type='road';if(x>=2 && x<=7)tiles[30+x].structure=s;}
 const city={size:10,revision:1,transportStructures:[s],tiles};
 const r=Object.assign(Object.create(CityRenderer.prototype),{size:10,w:1200,h:850,zoom:1,panX:0,panY:0,platform:null,tool:'inspect',rotation:0});r.buildCorners(city);
 const polygons=[];r.poly=(points,color)=>polygons.push({points,color});r.line=()=>{};
 r.terrain(tiles[32],city);assert.equal(r.platform,null);
 assert.ok(!polygons.some(p=>p.color==='#525f63'),'terrain defers elevated asphalt to the solid scene');
 const expected=r.project(2,3.14,.5);
 r.platform=bridgePlatform(r,tiles[32]);drawStreet(r,tiles[32],city);r.platform=null;
 assert.ok(polygons.filter(p=>p.color==='#525f63').some(p=>p.points.some(q=>Math.abs(q.x-expected.x)<1e-8 && Math.abs(q.y-expected.y)<1e-8)),'actual asphalt reaches the land-road edge');
});
test('foreground terrain wins over an approach hidden behind it',()=>{
 const s={kind:'bridge',route:'road',from:{x:2,y:3},to:{x:7,y:3},elevation:1,length:4};
 const city={size:12,revision:1,transportStructures:[s],tiles:Array.from({length:144},(_,i)=>({x:i%12,y:Math.floor(i/12),terrain:'grass',type:'empty',elev:1,trees:0}))};
 for(let x=2;x<=7;x++)Object.assign(city.tiles[3*12+x],{type:'road',structure:s});
 const r=Object.assign(Object.create(CityRenderer.prototype),{size:12,w:1200,h:850,zoom:1.5,panX:0,panY:0,platform:null,tool:'inspect',rotation:0});r.buildCorners(city);
 const approach=city.tiles[3*12+2];r.platform=bridgePlatform(r,approach);const behind=r.project(2.5,3.5);r.platform=null;
 // This foreground hill face projects exactly over the background ramp.
 for(const [x,y] of [[3,4],[4,4],[3,5],[4,5]])r.corners[y*13+x]=42;
 assert.deepEqual(r.project(3.5,4.5),behind);
 assert.deepEqual(r.pick(behind.x,behind.y),{x:3,y:4});
});
test('overlapping bridge picking follows paint depth rather than creation order',()=>{
 const back={kind:'bridge',route:'road',from:{x:2,y:3},to:{x:7,y:3},elevation:1,length:4};
 const front={kind:'bridge',route:'road',from:{x:3,y:4},to:{x:8,y:4},elevation:5,length:4};
 const city={size:12,revision:1,transportStructures:[back,front],tiles:Array.from({length:144},(_,i)=>({x:i%12,y:Math.floor(i/12),terrain:'grass',type:'empty',elev:1,trees:0}))};
 for(const s of city.transportStructures)for(let x=s.from.x;x<=s.to.x;x++)Object.assign(city.tiles[s.from.y*12+x],{type:'road',structure:s});
 const r=Object.assign(Object.create(CityRenderer.prototype),{size:12,w:1200,h:850,zoom:1.5,panX:0,panY:0,platform:null,tool:'inspect',rotation:0});r.buildCorners(city);
 r.platform=bridgePlatform(r,city.tiles[3*12+2]);const p=r.project(2.5,3.5);r.platform=null;
 for(const [x,y] of [[3,4],[4,4],[3,5],[4,5]])r.corners[y*13+x]=40;
 assert.deepEqual(r.pick(p.x,p.y),{x:3,y:4});
 // A removed structure leaves no stale polygon to intercept future picks.
 for(let x=3;x<=8;x++)delete city.tiles[4*12+x].structure;
 assert.doesNotThrow(()=>r.pick(p.x,p.y));assert.equal(bridgePlatform(r,undefined),null);
});
