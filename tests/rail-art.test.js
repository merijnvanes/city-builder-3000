import test from 'node:test';
import assert from 'node:assert/strict';
import { railPaths, railConnections, drawRail } from '../src/rail-art.js';
const edgeIndex=p=>p.x===1?0:p.y===1?1:p.x===0?2:p.y===0?3:-1;
test('all sixteen rail connection masks end only at actual connected edges',()=>{
  for(let mask=0;mask<16;mask++) {
    const joins=Array.from({length:4},(_,i)=>!!(mask&(1<<i))), ends=new Set();
    for(const path of railPaths(joins)) {
      for(const p of path) assert.ok(p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1);
      for(const p of [path[0],path.at(-1)]) if(edgeIndex(p)>=0) ends.add(edgeIndex(p));
    }
    assert.deepEqual([...ends].sort(),joins.flatMap((yes,i)=>yes?[i]:[]),`mask ${mask}`);
  }
});
test('adjacent rail arms form a continuous bend with parallel tangent approaches',()=>{
  for(const mask of [3,6,12,9]) {
    const joins=Array.from({length:4},(_,i)=>!!(mask&(1<<i)));
    const [p]=railPaths(joins); assert.equal(railPaths(joins).length,1);
    assert.ok(p.length>9); assert.notDeepEqual(p[8],{x:.5,y:.5});
    for(const [end,next] of [[p[0],p[1]],[p.at(-1),p.at(-2)]]) {
      const axis=edgeIndex(end)%2;
      const dx=Math.abs(end.x-next.x),dy=Math.abs(end.y-next.y);
      assert.ok(axis===0?dx>dy*10:dy>dx*10);
    }
  }
});
test('rail art recognizes level crossings and viaduct tracks without row wrap',()=>{
  const city={size:3,tiles:Array.from({length:9},()=>({type:'empty'}))};
  city.tiles[5]={type:'road',under:2}; city.tiles[7]={type:'highway',under:2};
  assert.deepEqual(railConnections({x:1,y:1},city),[true,true,false,false]);
  city.tiles[3]={type:'rail'};
  assert.equal(railConnections({x:2,y:0},city)[0],false);
});
test('curved sleepers and rails render finite coordinates and preserve crossing asphalt',()=>{
  const city={size:3,tiles:Array.from({length:9},()=>({type:'empty'}))}; city.tiles[5].type=city.tiles[7].type='rail';
  let lines=0,flats=0;
  const r={project:(x,y,z)=>({x,y,z}),flat:()=>flats++,line:(a,b)=>{assert.ok([a.x,a.y,a.z,b.x,b.y,b.z].every(Number.isFinite));lines++;}};
  drawRail(r,{x:1,y:1,type:'road',under:2},city,{crossing:true}); assert.equal(flats,0);assert.ok(lines>30);
});
test('train positions follow the same curved centerline instead of a phantom straight',async()=>{
  const {railPosition}=await import('../src/rail-art.js');
  const [path]=railPaths([true,true,false,false]);
  const p=railPosition(path,.5);
  assert.equal(p.x,.625);assert.equal(p.y,.625);
  assert.ok(p.dx<0&&p.dy>0);
  assert.equal(railPosition(path,0).x,1);assert.equal(railPosition(path,1).y,1);
});
