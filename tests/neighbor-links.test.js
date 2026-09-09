import test from 'node:test';
import assert from 'node:assert/strict';
import {createCity,place,connectNeighbor,refresh,serialize,deserialize} from '../src/sim/index.js';
import {SAVE_VERSION} from '../src/sim/city.js';
import {connectionOffers,quoteConnection,CONNECTION_FEES} from '../src/sim/neighbor-links.js';
import {planConstruction,applyConstruction,createUndoManager} from '../src/construction.js';
import {streetConnections} from '../src/street-art.js';
import {dealAvailable} from '../src/sim/neighbors.js';
const town=()=>createCity({starter:false,layout:'plains',hills:0,seed:12,startYear:2000});
const at=(c,x,y)=>c.tiles[y*c.size+x];
for(const [route,resource,flag] of [['powerline','power','powerline'],['pipe','water','pipe']]) {
 test(`${route} requires payment, survives saves and undo, and is lost when removed`,()=>{
  const c=town();
  const build=applyConstruction(c,planConstruction(c,{x:0,y:20},{x:5,y:20},route));
  assert.ok(build.ok);assert.equal(build.connectionOffers.length,1);
  const link=build.connectionOffers[0];
  assert.equal(link.cost,CONNECTION_FEES[route]);
  assert.equal(dealAvailable(c._connections,resource,'northwest'),false);
  assert.equal(deserialize(serialize(c))._connections.northwest[resource],0);
  c.money=link.cost-1;const short=c.money;
  assert.equal(connectNeighbor(c,link).ok,false);assert.equal(c.money,short);
  c.money=10000;const undo=createUndoManager();undo.record(c);
  assert.ok(connectNeighbor(c,link).ok);assert.equal(c.money,10000-link.cost);
  assert.equal(dealAvailable(c._connections,resource,'northwest'),true);
  assert.ok(connectNeighbor(c,link).noop);assert.equal(c.money,10000-link.cost);
  const saved=deserialize(serialize(c));assert.equal(saved._connections.northwest[resource],1);
  undo.undo(c);assert.equal(c._connections.northwest[resource],0);assert.equal(c.money,10000);
  at(saved,0,20)[flag]=false;refresh(saved);
  assert.equal(saved._connections.northwest[resource],0);
  assert.equal(connectNeighbor(saved,link).ok,false);
 });
}
test('utility layers require separate purchases and legacy saves retain automatic links once',()=>{
 const c=town();place(c,0,20,'powerline');place(c,0,20,'pipe');
 assert.equal(connectionOffers(c,[at(c,0,20)]).length,2);
 connectNeighbor(c,{x:0,y:20,side:'northwest',route:'powerline'});
 assert.equal(c._connections.northwest.power,1);assert.equal(c._connections.northwest.water,0);
 const raw=JSON.parse(serialize(c));raw.version=7;raw.transportConnections=[];
 const legacy=deserialize(JSON.stringify(raw));
 assert.equal(legacy._connections.northwest.power,1);assert.equal(legacy._connections.northwest.water,1);
 const saved=JSON.parse(serialize(legacy));assert.equal(saved.version,SAVE_VERSION);assert.equal(saved.transportConnections.length,2);
 assert.equal(deserialize(JSON.stringify(saved)).transportConnections.length,2);
});
test('an unpurchased border road remains a dead end and quotes do not mutate the city',()=>{
 const c=town(),before=c.money;
 const result=applyConstruction(c,planConstruction(c,{x:0,y:20},{x:5,y:20},'road'));
 assert.ok(result.ok);assert.equal(c._connections.northwest.road,0);
 assert.equal(result.connectionOffers.length,1);assert.equal(result.connectionOffers[0].cost,CONNECTION_FEES.road);
 assert.equal(c.money,before-result.cost);assert.equal(streetConnections(at(c,0,20),c)[2],false);
 const snapshot=serialize(c);quoteConnection(c,result.connectionOffers[0]);assert.equal(serialize(c),snapshot);
});
test('buying a connection charges once, marks the route, survives save and can be undone',()=>{
 const c=town();place(c,0,20,'road');const link=connectionOffers(c,[at(c,0,20)])[0],before=c.money;
 const undo=createUndoManager();undo.record(c);assert.ok(connectNeighbor(c,link).ok);
 assert.equal(c.money,before-CONNECTION_FEES.road);assert.equal(c._connections.northwest.road,1);
 assert.equal(streetConnections(at(c,0,20),c)[2],true);
 assert.ok(connectNeighbor(c,link).noop);assert.equal(c.money,before-CONNECTION_FEES.road);
 const saved=deserialize(serialize(c));assert.equal(saved._connections.northwest.road,1);
 undo.undo(c);assert.equal(c._connections.northwest.road,0);assert.equal(c.money,before);
});
test('each county and transport layer needs its own connection and stale offers fail',()=>{
 const c=town();place(c,0,0,'road');place(c,0,0,'rail');
 const offers=connectionOffers(c,[at(c,0,0)]);assert.equal(offers.length,4);
 const northRail=offers.find(o=>o.side==='northeast'&&o.route==='rail');connectNeighbor(c,northRail);
 assert.equal(c._connections.northeast.rail,1);assert.equal(c._connections.northwest.rail,0);assert.equal(c._connections.northeast.road,0);
 place(c,0,0,'bulldoze');assert.equal(c._connections.northeast.rail,1);
 place(c,0,0,'bulldoze');assert.equal(c.transportConnections.length,0);
 assert.equal(connectNeighbor(c,northRail).ok,false);
 place(c,0,0,'rail');assert.equal(c._connections.northeast.rail,0);
});
test('the county stays connected until its last purchased route is removed',()=>{
 const c=town();for(const y of [20,21]){place(c,0,y,'road');connectNeighbor(c,{x:0,y,side:'northwest',route:'road'});}
 place(c,0,20,'bulldoze');assert.equal(c._connections.northwest.road,1);
 place(c,0,21,'bulldoze');assert.equal(c._connections.northwest.road,0);
});
test('unaffordable, malformed and interior connections cannot charge money',()=>{
 const c=town();place(c,0,20,'road');c.money=1;
 for(const link of [{x:0,y:20,side:'northwest',route:'road'},{x:0,y:20,side:'northeast',route:'road'},{x:1,y:20,side:'northwest',route:'road'},{x:0,y:20,side:'northwest',route:'__proto__'}])assert.equal(connectNeighbor(c,link).ok,false);
 assert.equal(c.money,1);assert.deepEqual(c.transportConnections,[]);
});
test('legacy saves retain old links; explicit empty lists stay disconnected and corrupt links are rejected',()=>{
 const c=town();place(c,0,20,'road');const raw=JSON.parse(serialize(c));
 assert.equal(deserialize(JSON.stringify(raw))._connections.northwest.road,0);
 delete raw.transportConnections;assert.equal(deserialize(JSON.stringify(raw))._connections.northwest.road,1);
 raw.transportConnections=[{x:1,y:20,side:'northwest',route:'road'}];assert.throws(()=>deserialize(JSON.stringify(raw)),/county connection/);
});
test('border-parallel strokes do not prompt for every tile, and existing endpoints still prompt',()=>{
 const c=town();
 const parallel=applyConstruction(c,planConstruction(c,{x:0,y:10},{x:0,y:30},'road'));
 assert.deepEqual(parallel.connectionOffers,[]);
 const approach=applyConstruction(c,planConstruction(c,{x:5,y:20},{x:0,y:20},'road'));
 assert.equal(approach.connectionOffers.length,1);assert.equal(approach.connectionOffers[0].side,'northwest');
});
test('two purchased crossing layers preserve lower-road customers without adding jobs',()=>{
 const c=town();place(c,0,20,'road');place(c,0,20,'highway');
 connectNeighbor(c,{x:0,y:20,side:'northwest',route:'road'});
 place(c,1,21,'commercial');refresh(c);assert.ok(at(c,1,21).reach>=0,'customers enter on the purchased lower road');
 const jobs=c._traffic.jobs,employed=c._traffic.employed;
 connectNeighbor(c,{x:0,y:20,side:'northwest',route:'highway'});
 assert.equal(c._connections.northwest.road,2);assert.equal(c._traffic.jobs,jobs);assert.equal(c._traffic.employed,employed);
 assert.equal(c._connections.northwest.roadLinks.length,2);
});
