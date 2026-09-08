import test from 'node:test';
import assert from 'node:assert/strict';
import {drawBridgeFrame} from '../src/bridge-art.js';
function lines(s,t){const out=[];drawBridgeFrame({project:(x,y,z)=>({x,y,z}),line:(...a)=>out.push(a)},{...t,structure:s});return out;}
for(const axis of ['x','y'])test(`suspension cables and piers match for both drag directions on ${axis}`,()=>{
 const from={x:5,y:5},to={...from,[axis]:18},s={kind:'bridge',route:'road',from,to,elevation:2,length:12};
 for(let i=0;i<14;i++) {
  const t={x:5,y:5,[axis]:5+i,terrain:'water',waterLevel:1.5,elev:1};
  assert.deepEqual(lines(s,t),lines({...s,from:to,to:from},t));
 }
});
