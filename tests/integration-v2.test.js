import test from 'node:test';
import assert from 'node:assert/strict';
import {createCity,place,setPolicy,serialize,deserialize,tick,getStats} from '../src/sim.js';

test('placement rejects inherited tool names and invalid density',()=>{
 const c=createCity(42,false),before=serialize(c);
 for(const tool of ['constructor','__proto__','toString'])assert.equal(place(c,1,1,tool).ok,false);
 assert.equal(place(c,1,1,'residential',{density:NaN}).ok,false);
 assert.equal(serialize(c),before);
 assert.equal(place(c,1,1,'road',null).ok,true);
});
test('bulk placement defers refresh and rezoning caps existing development',()=>{
 const c=createCity(42,false),revision=c.revision;
 assert.equal(place(c,1,1,'residential',{density:3,deferRefresh:true}).ok,true);
 assert.equal(c.revision,revision);
 c.tiles[41].level=4;
 assert.equal(place(c,1,1,'residential',{density:2}).ok,true);
 assert.equal(c.tiles[41].level,2);
});
test('debt cap, full repayment and small-balance payoff',()=>{
 const c=createCity(42,false);
 assert.equal(setPolicy(c,'loan',100000).ok,true);
 assert.equal(setPolicy(c,'loan',1).ok,false);
 assert.equal(setPolicy(c,'repayLoan',true).ok,true);
 assert.equal(c.debt,0);
 setPolicy(c,'loan',1);tick(c);assert.equal(c.debt,0);
});
test('new save fields are validated and legacy density preserves skyline',()=>{
 const c=createCity(),raw=JSON.parse(serialize(c));
 for(const mutate of [d=>d.debt=-1,d=>d.name={},d=>d.taxes={residential:'9'},d=>d.funding={police:1e20},d=>d.ordinances=[],d=>d._news=[{}],d=>d.tiles[0].density=8,d=>d.tiles[0].pipe='yes']){
  const bad=structuredClone(raw);mutate(bad);assert.throws(()=>deserialize(JSON.stringify(bad)));
 }
 for(const t of raw.tiles)delete t.density;
 const loaded=deserialize(JSON.stringify(raw));
 for(const t of loaded.tiles)assert.ok(t.level<=[0,1,2,4][t.density]);
});
test('ten years remains finite and saveable',()=>{
 const c=createCity();for(let i=0;i<120;i++)tick(c);
 const stats=getStats(c);
 for(const key of ['population','money','happiness','balance','pollution','crime','traffic'])assert.ok(Number.isFinite(stats[key]),key);
 assert.equal(c.history.length,120);
 assert.equal(deserialize(serialize(c)).month,120);
});
