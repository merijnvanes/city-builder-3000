import test from 'node:test';
import assert from 'node:assert/strict';
import {spriteVariant,random} from '../src/architecture-variation.js';
import {zoneVariantFixture} from './zone-art-contract.mjs';
import {blankCity,serialize,deserialize} from '../src/sim/city.js';
import {assignLot} from '../src/sim/lots.js';

test('commercial low and medium densities retain five/seven seed ranges and terminal families',()=>{
 for(const [density,count,terminal] of [[1,5,2],[2,7,4]]){
  for(let i=0;i<count;i++){
   const tile={type:'commercial',density,x:4,y:6,variant:i/count};
   assert.equal(spriteVariant(tile,count),i);
   if(i)assert.equal(spriteVariant({...tile,variant:i/count-Number.EPSILON},count),i-1);
  }
  assert.equal(spriteVariant({type:'commercial',density,variant:1},count),terminal);
 }
});

test('commercial skyline retains the separate coordinate signature branch and seed thirds',()=>{
 const branches=new Set();
 for(let x=0;x<12;x++)for(let y=0;y<12;y++)for(const size of [1,2,3])for(const seed of [0,1/3-.0001,1/3,2/3-.0001,2/3,.999,1]){
  const signature=size>1&&random(x,y,37)<.45;branches.add(signature);
  const style=seed===1?(signature?2:0):Math.floor(seed*3);
  const tile={type:'commercial',density:3,x,y,variant:seed,lot:{x,y,w:size,h:size}};
  assert.equal(spriteVariant(tile,size===1?3:6),style+(signature?3:0));
 }
 assert.equal(branches.size,2);
 for(let variant=0;variant<6;variant++){
  const spec={tiles:3,zone:{type:'commercial',density:3}};
  const fixture=zoneVariantFixture(spec,variant);
  assert.equal(spriteVariant({...fixture,...spec.zone},6),variant);
 }
});

test('real commercial save/load preserves both skyline branches and terminal family',()=>{
 for(const variant of [0,1,2,3,4,5]){
  const city=blankCity({size:64,hills:0});
  const fixture=zoneVariantFixture({tiles:2,zone:{type:'commercial',density:3}},variant,8,8);
  const {x,y}=fixture;
  for(let yy=y;yy<y+2;yy++)for(let xx=x;xx<x+2;xx++)Object.assign(city.tiles[yy*64+xx],{type:'commercial',density:3,terrain:'grass',elev:0,trees:0});
  assignLot(city,{x,y,w:2,h:2},4,fixture.variant);
  const t=deserialize(serialize(city)).tiles[y*64+x];
  assert.equal(spriteVariant(t,6),variant);
 }
});

test('real commercial saves retain raw and rounded terminal architectural choices',()=>{
 for(const [density,size,branch] of [[1,1,0],[2,2,0],[3,1,0],[3,2,0],[3,2,3]])for(const seed of [1,.9996,.9994]){
  const city=blankCity({size:64,hills:0});
  const count=density===1?5:density===2?7:size===1?3:6;
  const spec={tiles:size,zone:{type:'commercial',density}};
  const {x,y}=zoneVariantFixture(spec,branch,8,8);
  for(let yy=y;yy<y+size;yy++)for(let xx=x;xx<x+size;xx++)Object.assign(city.tiles[yy*64+xx],{type:'commercial',density,terrain:'grass',elev:0,trees:0});
  assignLot(city,{x,y,w:size,h:size},4,seed);
  const saved=deserialize(serialize(city)).tiles[y*64+x];
  const terminal=saved.variant===1;
  const expected=density===1?(terminal?2:4):density===2?(terminal?4:6):branch+(terminal&&branch===0?0:2);
  assert.equal(spriteVariant(saved,count),expected);
 }
});
