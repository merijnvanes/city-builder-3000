import test from 'node:test';
import assert from 'node:assert/strict';
import { createCity, place, evaluate, serialize, deserialize, refresh, connectNeighbor } from '../src/sim/index.js';
import { assignLot } from '../src/sim/lots.js';
import { updateTraffic } from '../src/sim/traffic.js';
import { besideWhatItNeeds } from '../src/sim/siting.js';
import { streetConnections } from '../src/street-art.js';
const town = () => createCity({ starter:false, layout:'plains', hills:0, startYear:2000, seed:12 });
const at = (c,x,y) => c.tiles[y*c.size+x];
function put(c,x,y,tool) { c.money=1e7; const r=place(c,x,y,tool,{deferRefresh:true}); assert.ok(r.ok,r.message); }
function lot(c,x,y,type) { put(c,x,y,type); assignLot(c,{x,y,w:1,h:1},2,.5); }
for (const [a,b,surface,under] of [['road','rail','road',2],['rail','road','road',2],['road','highway','highway',1],['highway','road','highway',1],['rail','highway','highway',2],['highway','rail','highway',2]]) {
  test(`${a} then ${b} preserves both routes, saves and demolition`,()=>{
    const c=town(); put(c,20,20,a); put(c,20,20,b);
    assert.equal(at(c,20,20).type,surface); assert.equal(at(c,20,20).under,under);
    assert.equal(evaluate(c,20,20,a).noop,true); assert.equal(evaluate(c,20,20,b).noop,true);
    assert.equal(evaluate(c,20,20,'onramp').ok,false);
    const third=['road','rail','highway'].find(t=>t!==a&&t!==b);
    assert.equal(evaluate(c,20,20,third).ok,false);
    const d=deserialize(serialize(c)); assert.equal(at(d,20,20).under,under);
    put(d,20,20,'bulldoze'); assert.equal(at(d,20,20).type,under===2?'rail':'road');
  });
}
test('cars can cross rail without boarding it',()=>{
  const c=town();
  for(let x=10;x<=30;x++) put(c,x,20,'road');
  for(let y=10;y<=30;y++) put(c,20,y,'rail');
  lot(c,10,21,'residential'); lot(c,30,21,'industrial');
  updateTraffic(c); assert.ok(at(c,10,21).commute>0); assert.ok(at(c,20,20).traffic>0);
  // Sever the road; the crossing does not let cars use the rail to jobs.
  put(c,30,21,'bulldoze'); put(c,30,21,'bulldoze'); lot(c,21,30,'industrial');
  updateTraffic(c); assert.equal(at(c,10,21).commute,0);
});
test('trains cross a road and serve stations beside either crossing layer',()=>{
  const c=town();
  for(let x=10;x<=30;x++) put(c,x,20,'rail');
  for(let y=10;y<=30;y++) put(c,20,y,'road');
  put(c,9,21,'railstation'); put(c,29,21,'railstation');
  put(c,9,23,'road'); put(c,30,23,'road');
  lot(c,9,24,'residential'); lot(c,30,24,'industrial');
  updateTraffic(c); assert.ok(at(c,9,24).commute>0);
  at(c,20,20).under=0; updateTraffic(c); assert.equal(at(c,9,24).commute,0);
  at(c,20,20).under=2;
  assert.equal(streetConnections(at(c,20,19),c)[1],true);
  // A station can recognize a rail crossing even with no exposed rail beside it.
  const s={type:'railstation',x:19,y:20};
  for (const [x,y] of [[18,20],[19,19],[19,21]]) at(c,x,y).type='empty';
  assert.equal(besideWhatItNeeds(c,s),true);
});
test('underground utilities coexist with transport crossings',()=>{
  const c=town();
  for(const tool of ['pipe','subway','road','rail']) put(c,20,20,tool);
  assert.ok(at(c,20,20).pipe); assert.ok(at(c,20,20).subway);
  refresh(c); assert.equal(at(c,20,20).under,2);
});
test('a station touching a highway crossing does not substitute for an on-ramp',()=>{
  const c=town();
  for(let x=9;x<=12;x++) put(c,x,20,'rail');
  put(c,9,21,'railstation'); put(c,9,23,'road'); lot(c,9,24,'residential');
  for(let x=11;x<=30;x++) put(c,x,21,'highway');
  // Allocate both route bands at the tile beside the station.
  put(c,11,21,'rail');
  put(c,30,22,'road'); put(c,30,23,'road'); put(c,30,21,'onramp'); lot(c,30,24,'industrial');
  updateTraffic(c); assert.equal(at(c,9,24).commute,0);
});
test('bridge crossings are refused in both construction orders',()=>{
  for(const [a,b] of [['road','highway'],['highway','road'],['rail','highway'],['highway','rail'],['road','rail'],['rail','road']]) {
    const c=town(); at(c,20,20).terrain='water'; at(c,20,20).type=a; // Legacy water route.
    assert.equal(evaluate(c,20,20,b).ok,false);
  }
});
test('a ramp can join both decks from beside a viaduct',()=>{
  const c=town(); put(c,20,20,'road'); put(c,20,20,'highway');
  assert.equal(evaluate(c,20,21,'onramp').ok,true);
});
test('border highway crossings keep highway access to external jobs',()=>{
  for(const lower of ['road','rail']) {
    const c=town();
    for(let x=0;x<=20;x++) put(c,x,20,'highway');
    put(c,20,21,'road'); put(c,20,20,'onramp'); lot(c,20,22,'residential');
    put(c,0,20,lower); connectNeighbor(c,{x:0,y:20,side:'west',route:'highway'}); refresh(c);
    assert.ok(c._connections.west.road>0); assert.ok(at(c,20,22).commute>0);
  }
});
test('destroyed crossings leave loadable saves',async()=>{
  const { triggerDisaster }=await import('../src/sim/disasters.js');
  for(const disaster of ['earthquake','volcano']) {
    const c=town();
    for(let y=20;y<40;y++)for(let x=20;x<40;x++) { put(c,x,y,'road'); put(c,x,y,'rail'); }
    triggerDisaster(c,disaster,()=>.5);
    for(const t of c.tiles) if(t.type==='empty') assert.equal(t.under,0);
    assert.doesNotThrow(()=>deserialize(serialize(c)));
  }
});
