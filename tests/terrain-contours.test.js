import test from 'node:test';
import assert from 'node:assert/strict';
import {sandCoverage,nearSand} from '../src/terrain-contours.js';

// A small map: water on the north row, a sand strip below it, grass beyond.
function shore({sandRows=[1],size=8,seed=3}={}) {
 const tiles=[];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)tiles.push({x,y,terrain:y===0?'water':sandRows.includes(y)?'sand':'grass',elev:0});
 return {size,seed,revision:1,tiles};
}
const at=(c,x,y)=>c.tiles[y*c.size+x];
const area=polygon=>Math.abs(polygon.reduce((sum,[x,y],i)=>{const [nx,ny]=polygon[(i+1)%polygon.length];return sum+x*ny-nx*y;},0))/2;
const coveredArea=coverage=>coverage.full?1:coverage.polygons.reduce((sum,p)=>sum+area(p),0);

test('the beach reaches the waterline and fades into the grass with a contour',()=>{
 const c=shore();
 for(let x=1;x<c.size-1;x++) {
  const sand=sandCoverage(c,at(c,x,1)),grass=sandCoverage(c,at(c,x,2)),far=sandCoverage(c,at(c,x,3));
  const sandArea=coveredArea(sand),grassArea=coveredArea(grass);
  assert.ok(sandArea>0.5,`the sand tile at ${x} is mostly sand: ${sandArea}`);
  assert.ok(grassArea<0.5,`the grass tile beside it is mostly grass: ${grassArea}`);
  assert.equal(coveredArea(far),0,'grass two tiles from the beach carries no sand');
  assert.equal(nearSand(c,at(c,x,3)),false);
 }
});

test('polygons stay inside their tile and the contour is continuous across tiles',()=>{
 const c=shore({sandRows:[1,2]});
 for(const t of c.tiles) {
  const coverage=sandCoverage(c,t);
  for(const polygon of coverage.polygons)for(const [x,y] of polygon) {
   assert.ok(x>=t.x-1e-9 && x<=t.x+1+1e-9 && y>=t.y-1e-9 && y<=t.y+1+1e-9,`point inside tile ${t.x},${t.y}`);
  }
 }
 // Where two tiles share an edge, the sand crossing points on that edge agree.
 for(let x=1;x<c.size-1;x++) {
  const upper=sandCoverage(c,at(c,x,2)),lower=sandCoverage(c,at(c,x,3));
  // A fully sandy tile owns its whole edge; otherwise the crossing points.
  const onEdge=coverage=>coverage.full?[String(x),String(x+1)]:coverage.polygons.flat().filter(([,y])=>Math.abs(y-3)<1e-9).map(([px])=>String(+px.toFixed(6)));
  assert.deepEqual([...new Set(onEdge(upper))].sort(),[...new Set(onEdge(lower))].sort(),`shared edge at x=${x}`);
 }
});

test('an isolated sand tile becomes a rounded patch rather than a square',()=>{
 const c=shore({sandRows:[]});
 at(c,4,4).terrain='sand';
 const coverage=sandCoverage(c,at(c,4,4));
 assert.equal(coverage.full,false);
 const covered=coveredArea(coverage);
 assert.ok(covered>0.2 && covered<1,`a patch, not the whole tile: ${covered}`);
 assert.ok(sandCoverage(c,at(c,5,4)).polygons.length>=0);
 assert.equal(nearSand(c,at(c,6,4)),false);
});

test('rock keeps hard edges and a deep beach is solid sand',()=>{
 const c=shore({sandRows:[1,2,3]});
 assert.equal(sandCoverage(c,at(c,4,2)).full,true);
 at(c,4,5).terrain='rock';
 assert.deepEqual(sandCoverage(c,at(c,4,5)),{full:false,polygons:[]});
});

test('coverage is deterministic for a seed and changes with it',()=>{
 const a=shore({seed:5}),b=shore({seed:5}),d=shore({seed:9});
 assert.deepEqual(sandCoverage(a,at(a,3,2)),sandCoverage(b,at(b,3,2)));
 assert.notDeepEqual(sandCoverage(a,at(a,3,2)),sandCoverage(d,at(d,3,2)));
});
