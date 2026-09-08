import test from 'node:test';
import assert from 'node:assert/strict';
import {createCity,place,evaluate,refresh,serialize,deserialize} from '../src/sim/index.js';
import {BUILDINGS,ZONED_TYPES} from '../src/sim/catalog.js';
import {assignLot} from '../src/sim/lots.js';
import {planConstruction,applyConstruction,createUndoManager} from '../src/construction.js';
const at=(c,x,y)=>c.tiles[y*c.size+x];
function city(){const c=createCity({size:32,starter:false,layout:'plains',hills:0,startYear:2000,seed:12});c.money=1e7;for(const t of c.tiles)Object.assign(t,{terrain:'grass',waterLevel:null,elev:1,trees:0});return c;}
function put(c,x,y,tool){const r=place(c,x,y,tool,{deferRefresh:true});assert.ok(r.ok,r.message);return r;}
test('powerline previews and placement refuse every occupied surface type',()=>{
 const c=city();for(const type of [...Object.keys(BUILDINGS),...ZONED_TYPES]) {
  if(!['road','rail','highway','onramp',...ZONED_TYPES].includes(type) && (BUILDINGS[type]?.path || BUILDINGS[type]?.rect || BUILDINGS[type]?.bores || !BUILDINGS[type]?.effects && !BUILDINGS[type]?.powerOut && !BUILDINGS[type]?.waterOut))continue;
  const t=at(c,10,10);t.type=type;t.powerline=false;assert.equal(evaluate(c,10,10,'powerline').ok,false,type);assert.equal(place(c,10,10,'powerline').ok,false,type);assert.equal(t.powerline,false);
 }
});
for(const tool of ['road','rail','highway','residential','commercial','industrial','airport','seaport','tree'])test(`${tool} removes a pylon without a second charge`,()=>{
 const c=city();put(c,10,10,'powerline');const expected=evaluate(c,10,10,tool).cost,money=c.money;const r=put(c,10,10,tool);
 assert.equal(at(c,10,10).powerline,false);assert.equal(r.cost,expected);assert.equal(c.money,money-expected);
});
test('a multi-tile building clears every pylon in its footprint, and undo restores them',()=>{
 const c=city();for(let y=10;y<14;y++)for(let x=10;x<14;x++)put(c,x,y,'powerline');const before=c.money,undo=createUndoManager();undo.record(c);
 const p=planConstruction(c,{x:11,y:11},{x:11,y:11},'coal');assert.ok(applyConstruction(c,p).ok);
 for(let y=10;y<14;y++)for(let x=10;x<14;x++)assert.equal(at(c,x,y).powerline,false);
 const d=deserialize(serialize(c));assert.equal(at(d,11,11).powerline,false);undo.undo(c);assert.equal(c.money,before);assert.equal(at(c,11,11).powerline,true);
});
test('failed construction leaves the line and treasury untouched',()=>{
 const c=city();put(c,10,10,'powerline');c.money=0;const before=serialize(c);assert.equal(place(c,10,10,'road').ok,false);assert.equal(serialize(c),before);
});
test('powerline drags skip occupied tiles and charge only eligible tiles',()=>{
 const c=city();put(c,11,10,'road');put(c,13,10,'park');const p=planConstruction(c,{x:10,y:10},{x:14,y:10},'powerline');assert.equal(p.tiles.filter(t=>!t.valid).length,2);
 const r=applyConstruction(c,p);assert.ok(r.ok);assert.equal(r.changed,3);assert.equal(r.cost,BUILDINGS.powerline.cost*3);assert.equal(at(c,11,10).powerline,false);assert.equal(at(c,13,10).powerline,false);
});
test('subsurface utilities and pylons use distinct layers',()=>{
 const c=city();put(c,10,10,'pipe');put(c,10,10,'subway');put(c,10,10,'powerline');assert.ok(at(c,10,10).pipe && at(c,10,10).subway && at(c,10,10).powerline);
 put(c,10,10,'road');assert.equal(at(c,10,10).powerline,false);assert.ok(at(c,10,10).pipe && at(c,10,10).subway);
});
test('legacy occupied pylons are removed during load and zone growth clears stale pylons',()=>{
 const c=city();put(c,10,10,'road');at(c,10,10).powerline=true;const d=deserialize(serialize(c));assert.equal(at(d,10,10).powerline,false);
 put(c,12,12,'residential');at(c,12,12).powerline=true;assignLot(c,{x:12,y:12,w:1,h:1},1,.5);assert.equal(at(c,12,12).powerline,false);
});
test('power still crosses a single road after the middle pylon is removed',()=>{
 const c=city();put(c,3,8,'coal');for(let x=7;x<=14;x++)put(c,x,9,'powerline');put(c,15,9,'residential');assignLot(c,{x:15,y:9,w:1,h:1},1,.5);
 put(c,11,9,'road');refresh(c);assert.equal(at(c,11,9).powerline,false);assert.ok(at(c,15,9).powered);
 put(c,12,9,'road');refresh(c);assert.equal(at(c,15,9).powered,false,'two road tiles need a power route around the gap');
});
test('on-ramps clear pylons and tunnel construction clears both portals',()=>{
 const c=city();put(c,9,10,'road');put(c,11,10,'highway');put(c,10,10,'powerline');put(c,10,10,'onramp');assert.equal(at(c,10,10).powerline,false);
 for(let x=11;x<=18;x++)at(c,x,20).elev=4;for(const x of [10,14,19])put(c,x,20,'powerline');
 const p=planConstruction(c,{x:10,y:20},{x:10,y:20},'tunnel');assert.ok(applyConstruction(c,p,{confirmStructures:true,maxCost:p.cost}).ok);
 assert.equal(at(c,10,20).powerline,false);assert.equal(at(c,19,20).powerline,false);assert.equal(at(c,14,20).powerline,true);
});
test('new starter towns wire around occupied roads instead of laying pylons on them',()=>{
 const c=createCity({seed:42,starter:true});for(const t of c.tiles)if(t.powerline)assert.equal(t.type,'empty');
 const homes=c.tiles.filter(t=>t.type==='residential' && t.lot);assert.ok(homes.some(t=>t.powered));
});
for(const route of ['road','rail','highway'])test(`${route} bridges transmit power without surface pylons`,()=>{
 const c=city();for(const t of c.tiles)if(t.x>=12 && t.x<=15)Object.assign(t,{terrain:'water',elev:0,waterLevel:.75});
 put(c,3,8,'coal');for(let x=7;x<=10;x++)put(c,x,9,'powerline');for(let x=17;x<=22;x++)put(c,x,9,'powerline');put(c,23,9,'residential');assignLot(c,{x:23,y:9,w:1,h:1},1,.5);
 const p=planConstruction(c,{x:11,y:9},{x:16,y:9},route);assert.ok(applyConstruction(c,p,{confirmStructures:true,maxCost:p.cost}).ok);refresh(c);
 assert.equal(at(c,23,9).powered,true);for(let x=11;x<=16;x++)assert.equal(at(c,x,9).powerline,false);
 const d=deserialize(serialize(c));refresh(d);assert.equal(at(d,23,9).powered,true);
 // Migrate the same crossing as a legacy bridge with visible power lines.
 const legacy=JSON.parse(serialize(c));delete legacy.transportStructures;for(let x=12;x<=15;x++)legacy.tiles[9*c.size+x][13]=1;
 const migrated=deserialize(JSON.stringify(legacy));refresh(migrated);assert.equal(at(migrated,23,9).powered,true);assert.equal(at(migrated,13,9).powerline,false);
 put(c,13,9,'bulldoze');refresh(c);assert.equal(at(c,23,9).powered,false);
});
