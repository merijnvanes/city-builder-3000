import test from 'node:test';
import assert from 'node:assert/strict';
import {citySignal,demandSignal,placeServices,inspectNote} from '../src/ui-signals.js';
import {createCity,place,inspectTile} from '../src/sim/index.js';
test('quality meters improve as bad conditions fall, with readable warning bands',()=>{
  const clean=citySignal('pollution',0), dirty=citySignal('pollution',85);
  assert.equal(clean.word,'Fresh air');assert.equal(clean.tone,'good');assert.equal(clean.level,100);
  assert.equal(dirty.word,'Choking');assert.equal(dirty.tone,'bad');assert.equal(dirty.level,15);
  assert.equal(citySignal('happiness',30).word,'Unsettled');
  assert.equal(citySignal('happiness',80).word,'Thriving');
  assert.equal(citySignal('eq',150).level,100);
  assert.equal(citySignal('workforceShare',.5).level,50);
  assert.equal(citySignal('workforceShare',.2).tone,'calm');
});
test('service warnings follow the requirements of roads and low-density homes',()=>{
  for(const type of ['empty','road','rail','highway','onramp'])assert.deepEqual(placeServices({type}),[]);
  const home={type:'residential',density:1,level:2,powered:true,roadAccess:true,watered:false};
  assert.equal(placeServices(home).some(s=>s.label==='Water'),false);
  assert.equal(placeServices({...home,level:3}).find(s=>s.label==='Water').ready,false);
  assert.equal(placeServices({...home,density:2}).find(s=>s.label==='Water').ready,false);
});
test('real building queries keep their blockers and defining services visible',()=>{
  for(const [tool,expected] of [['school',/Service grade/],['bus',/Not beside a road/],['waterpump',/No fresh water/]]) {
    const c=createCity({starter:false,layout:'plains',hills:0,seed:12,startYear:2000});
    assert.equal(place(c,10,10,tool).ok,true);
    const notes=inspectTile(c,10,10).details.map(inspectNote);
    assert.ok(notes.some(n=>n.kind!=='more' && expected.test(n.text)),`${tool} must explain its condition`);
  }
  for(const text of ['No work within a reasonable commute: nothing will be built here.','Waiting on water.','Not big enough: needs 3×5 tiles.','Conditions: Not met'])assert.equal(inspectNote(text).kind,'urgent');
  assert.deepEqual(inspectNote('Power output: 1,000 of 2,000 (age 10 of 50 years)'),{kind:'signal',key:'powerOutput',value:50});
});
test('unknowns stay unknown and visual ranges are bounded',()=>{
  for(const value of [null,undefined,NaN,Infinity]) assert.equal(citySignal('happiness',value).word,'Unknown');
  assert.equal(citySignal('happiness',-20).level,0);
  assert.equal(citySignal('happiness',200).level,100);
  assert.equal(citySignal('pollution',-20).level,100);
  assert.equal(citySignal('pollution',200).level,0);
  assert.equal(demandSignal(-50),'Oversupply');assert.equal(demandSignal(0),'Balanced');assert.equal(demandSignal(60),'In demand');
});
