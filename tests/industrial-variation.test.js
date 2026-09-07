import test from 'node:test';
import assert from 'node:assert/strict';
import {spriteVariant} from '../src/architecture-variation.js';
import {blankCity,serialize,deserialize} from '../src/sim/city.js';
import {assignLot} from '../src/sim/lots.js';
const breaks=[0,.2,1/3,.4,.6,2/3,.8,1];
const models=[{warehouse:false,palette:0},{warehouse:false,palette:1},{warehouse:true,palette:1},{warehouse:true,palette:2},{warehouse:true,palette:3},{warehouse:false,palette:3},{warehouse:false,palette:4}];

test('industrial medium art retains the union of warehouse and cargo-color boundaries',()=>{
 const seeds=new Set([0,1,.9994,.9996]);
 for(const b of breaks.slice(1,-1))for(const delta of [-Number.EPSILON,0,Number.EPSILON])seeds.add(b+delta);
 for(let i=0;i<=1000;i++)seeds.add(i/1000);
 for(const seed of seeds){
  const v=spriteVariant({type:'industrial',density:2,variant:seed},7);
  assert.deepEqual(models[v],{warehouse:Math.floor(seed*3)===1,palette:Math.floor(seed*5)%5});
 }
});

test('farm, workshop and heavy-plant palettes retain normalized ranges including terminal wrap',()=>{
 for(const [density,size,count] of [[1,3,4],[1,1,5],[3,1,5],[3,2,5],[3,3,5]])for(let i=0;i<=100;i++){
  const seed=i/100,tile={type:'industrial',density,lot:{w:size,h:size},variant:seed};
  assert.equal(spriteVariant(tile,count),Math.floor(seed*count)%count);
 }
});

test('industrial state and palette survive real save/load in all architectural branches',()=>{
 const seeds=[...breaks.slice(0,-1).map((b,i)=>(b+breaks[i+1])/2),1,.9996,.9994];
 for(const [density,size,count] of [[1,3,4],[1,1,5],[2,2,7],[3,3,5]])for(const seed of seeds){
  const city=blankCity({size:64,hills:0}),x=8,y=8;
  for(let yy=y;yy<y+size;yy++)for(let xx=x;xx<x+size;xx++)Object.assign(city.tiles[yy*64+xx],{type:'industrial',density,terrain:'grass',elev:0,trees:0});
  assignLot(city,{x,y,w:size,h:size},4,seed);
  const t=deserialize(serialize(city)).tiles[y*64+x];
  const variant=spriteVariant(t,count);
  if(density===2)assert.deepEqual(models[variant],{warehouse:Math.floor(t.variant*3)===1,palette:Math.floor(t.variant*5)%5});
  else assert.equal(variant,Math.floor(t.variant*count)%count);
  assert.equal(t.lot.w,size);assert.equal(t.level,4);
 }
});
