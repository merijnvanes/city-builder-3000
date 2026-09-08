import test from 'node:test';
import assert from 'node:assert/strict';
import {createCity,place,evaluate,serialize,deserialize,refresh} from '../src/sim/index.js';
import {planConstruction,applyConstruction,createUndoManager} from '../src/construction.js';
import {MAX_BRIDGE_SPAN,bridgeStyle,surfaceStep} from '../src/sim/structures.js';
import {assignLot} from '../src/sim/lots.js';
import {updateTraffic} from '../src/sim/traffic.js';
import {streetConnections,tunnelPortal} from '../src/street-art.js';
import {railConnections} from '../src/rail-art.js';
const at=(c,x,y)=>c.tiles[y*c.size+x];
function city(){const c=createCity({size:64,starter:false,layout:'plains',hills:0,startYear:2000,seed:12});c.money=1e7;for(const t of c.tiles)Object.assign(t,{terrain:'grass',waterLevel:null,elev:1,trees:0});return c;}
function river(c,n=4){for(let x=10;x<10+n;x++)for(let y=0;y<c.size;y++)Object.assign(at(c,x,y),{terrain:'water',elev:0,waterLevel:.75});}
const plan=(c,tool='road',a={x:9,y:20},b={x:14,y:20})=>planConstruction(c,a,b,tool);
const accept=(c,p)=>applyConstruction(c,p,{confirmStructures:true,maxCost:p.cost});
const put=(c,x,y,type)=>{const r=place(c,x,y,type,{deferRefresh:true});assert.ok(r.ok,r.message);};
function lot(c,x,y,type){put(c,x,y,type);assignLot(c,{x,y,w:1,h:1},2,.5);}
for(const route of ['road','rail','highway'])test(`${route} bridge quotes, persists, undoes and demolishes as a unit`,()=>{
 const c=city();river(c);const p=plan(c,route),before=serialize(c);assert.ok(p.valid);assert.ok(p.requiresConfirmation);
 assert.equal(applyConstruction(c,p).requiresConfirmation,true);assert.equal(serialize(c),before);
 const undo=createUndoManager();undo.record(c);assert.ok(accept(c,p).ok);assert.equal(c.transportStructures.length,1);
 const d=deserialize(serialize(c));assert.equal(serialize(d),serialize(c));assert.equal(at(d,12,20).structure,at(d,9,20).structure);
 assert.equal(evaluate(d,12,20,route==='rail'?'road':'rail').ok,false);
 put(d,12,20,'bulldoze');assert.equal(d.transportStructures.length,0);for(let x=9;x<=14;x++)assert.equal(at(d,x,20).type,'empty');
 undo.undo(c);assert.equal(c.transportStructures.length,0);assert.equal(at(c,12,20).type,'empty');
});
test('bridges require straight, clear land-to-land routes with a bounded span',()=>{
 const c=city();river(c);for(const [a,b] of [[{x:10,y:20},{x:14,y:20}],[{x:9,y:20},{x:13,y:20}],[{x:9,y:20},{x:14,y:21}]])assert.equal(plan(c,'road',a,b).valid,false);
 assert.equal(place(c,10,20,'road').ok,false);at(c,14,20).elev=2;assert.equal(plan(c).valid,false);at(c,14,20).elev=1;
 river(c,MAX_BRIDGE_SPAN+1);assert.equal(plan(c,'road',{x:9,y:20},{x:27,y:20}).valid,false);
});
test('bridge cost grows faster than length and changes artwork',()=>{
 const quotes=[];for(const n of [4,8,12]){const c=city();river(c,n);quotes.push(plan(c,'road',{x:9,y:20},{x:10+n,y:20}).cost);}
 assert.ok(quotes[1]>quotes[0]*2);assert.ok(quotes[2]-quotes[1]>quotes[1]-quotes[0]);assert.deepEqual([4,8,12].map(bridgeStyle),['beam','truss','suspension']);
});
test('stale and unaffordable bridge acceptance never partly builds approaches',()=>{
 const c=city();river(c);const p=plan(c,'road',{x:7,y:20},{x:16,y:20});c.money=p.cost-1;assert.equal(accept(c,p).ok,false);assert.equal(at(c,7,20).type,'empty');
 c.money=1e7;at(c,14,20).type='park';assert.equal(accept(c,p).ok,false);assert.equal(at(c,7,20).type,'empty');
});
test('bridge connections stay on their axis and commute across water',()=>{
 const c=city();river(c);assert.ok(accept(c,plan(c)).ok);for(let x=5;x<=8;x++)put(c,x,20,'road');for(let x=15;x<=20;x++)put(c,x,20,'road');
 lot(c,5,21,'residential');lot(c,20,21,'industrial');refresh(c);updateTraffic(c);assert.ok(at(c,5,21).commute>0);
 assert.deepEqual(streetConnections(at(c,12,20),c),[true,false,true,false]);
 assert.equal(surfaceStep(at(c,12,20),at(c,12,21)),false);
});
function ridge(c,n=8){for(let x=10;x<10+n;x++)for(let y=10;y<=30;y++)at(c,x,y).elev=4;}
test('tunnels prompt, have no old 24-tile cap, save and remove their whole bore',()=>{
 const c=city();ridge(c,30);const p=plan(c,'railtunnel',{x:9,y:20},{x:9,y:20});assert.ok(p.valid);assert.equal(p.tiles.length,32);
 assert.equal(applyConstruction(c,p).requiresConfirmation,true);assert.equal(place(c,9,20,'railtunnel').requiresConfirmation,true);
 assert.ok(accept(c,p).ok);assert.deepEqual(tunnelPortal(at(c,9,20),c),{dx:1,dy:0,rail:true});assert.ok(railConnections(at(c,9,20),c)[0]);
 const d=deserialize(serialize(c));put(d,9,20,'bulldoze');assert.equal(at(d,20,20).tunnel,0);assert.equal(at(d,40,20).type,'empty');
});
test('tunnel route is separate from surface roads above it and cannot be crossed by another bore',()=>{
 const c=city();ridge(c);assert.ok(accept(c,plan(c,'tunnel',{x:9,y:20},{x:9,y:20})).ok);
 for(let x=4;x<9;x++)put(c,x,20,'road');for(let x=19;x<=30;x++)put(c,x,20,'road');
 lot(c,4,21,'residential');lot(c,30,21,'industrial');updateTraffic(c);assert.ok(at(c,4,21).commute>0);
 for(let y=10;y<=25;y++)put(c,14,y,'road');lot(c,15,10,'residential');updateTraffic(c);assert.equal(at(c,15,10).commute,0);
 assert.equal(evaluate(c,14,20,'lower').ok,false);assert.equal(evaluate(c,14,9,'tunnel').ok,false);
 put(c,9,20,'bulldoze');assert.equal(at(c,14,20).type,'road');assert.equal(at(c,14,20).tunnel,0);
});
test('tampered overlapping and bent saved structures are rejected',()=>{
 const c=city();river(c);accept(c,plan(c));const raw=JSON.parse(serialize(c));raw.transportStructures.push({...raw.transportStructures[0]});assert.throws(()=>deserialize(JSON.stringify(raw)),/transport structure/);
 raw.transportStructures.pop();raw.transportStructures[0].to.y++;assert.throws(()=>deserialize(JSON.stringify(raw)),/transport structure/);
});
test('rail tunnels carry passengers between stations',()=>{
 const c=city();ridge(c);assert.ok(accept(c,plan(c,'railtunnel',{x:9,y:20},{x:9,y:20})).ok);
 for(let x=5;x<=8;x++)put(c,x,20,'rail');for(let x=19;x<=25;x++)put(c,x,20,'rail');
 for(const x of [5,25]){put(c,x,21,'railstation');put(c,x,23,'road');}
 lot(c,5,24,'residential');lot(c,25,24,'industrial');refresh(c);const stats=updateTraffic(c);assert.ok(at(c,5,24).commute>0);assert.ok(stats.railRiders>0);
 put(c,9,20,'bulldoze');updateTraffic(c);assert.equal(at(c,5,24).commute,0);
});
test('legacy bores acquire explicit portal connections on load',()=>{
 const c=city();ridge(c);accept(c,plan(c,'tunnel',{x:9,y:20},{x:9,y:20}));const raw=JSON.parse(serialize(c));delete raw.transportStructures;
 const d=deserialize(JSON.stringify(raw));assert.equal(d.transportStructures.length,1);assert.equal(at(d,12,20).structure,at(d,9,20).structure);
});
test('the middle of a bridge supplies no street access to neighboring land',()=>{
 const c=city();river(c,12);
 assert.ok(accept(c,plan(c,'road',{x:9,y:20},{x:22,y:20})).ok);
 Object.assign(at(c,16,21),{terrain:'grass',waterLevel:null,elev:1});lot(c,16,21,'residential');lot(c,23,20,'industrial');
 refresh(c);updateTraffic(c);assert.equal(at(c,16,21).roadAccess,false);assert.equal(at(c,16,21).commute,0);
});
test('extending a route across its existing bridge does not buy it twice',()=>{
 const c=city();river(c);accept(c,plan(c));const p=plan(c,'road',{x:7,y:20},{x:16,y:20});assert.ok(p.valid);assert.equal(p.requiresConfirmation,false);
 const r=applyConstruction(c,p);assert.ok(r.ok);assert.equal(r.changed,4);assert.equal(c.transportStructures.length,1);
});
test('a tunnel quote cannot silently switch to a different bore at the same price',()=>{
 const c=city();ridge(c);const p=plan(c,'tunnel',{x:9,y:20},{x:9,y:20});assert.ok(p.valid);
 at(c,18,20).type='park';for(let y=21;y<=28;y++)at(c,9,y).elev=4;
 const before=serialize(c),r=accept(c,p);assert.equal(r.requiresConfirmation,true);assert.equal(serialize(c),before);
});
test('a bridge cannot cross a buried tunnel under an intermediate island',()=>{
 const c=city();for(let y=15;y<=22;y++)at(c,14,y).elev=4;
 const tunnel=plan(c,'tunnel',{x:14,y:14},{x:14,y:14});assert.ok(accept(c,tunnel).ok);
 for(let x=10;x<=17;x++)if(x!==14)Object.assign(at(c,x,20),{terrain:'water',elev:0,waterLevel:.75});
 at(c,9,20).elev=4;at(c,18,20).elev=4;assert.equal(plan(c,'road',{x:9,y:20},{x:18,y:20}).valid,false);
});
test('separate streams and islands require separate bridge drags',()=>{
 const c=city();river(c,12);at(c,16,20).terrain='grass';at(c,16,20).waterLevel=null;at(c,16,20).elev=1;
 const p=plan(c,'road',{x:9,y:20},{x:22,y:20});assert.equal(p.valid,false);assert.match(p.message,/separate drag/);
});
