import test from 'node:test';
import assert from 'node:assert/strict';
import {settleSurfaceWater,waterVolume} from '../src/sim/surface-water.js';
import {createCity,place,evaluate,serialize,deserialize} from '../src/sim/index.js';
import {CityRenderer} from '../src/renderer.js';
import {waterGeometry} from '../src/water-geometry.js';
const at=(c,x,y)=>c.tiles[y*c.size+x],total=c=>c.tiles.reduce((sum,t)=>sum+waterVolume(t),0);
const town=()=>{const c=createCity({size:16,starter:false,layout:'plains',hills:0,seed:12});for(const t of c.tiles){t.elev=0;t.terrain='grass';t.waterLevel=null;t.trees=0;}return c;};
const pond=(c,x,y,w,h,bed=-1,level=-.25)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)Object.assign(at(c,xx,yy),{terrain:'water',elev:bed,waterLevel:level});};
test('basins keep different levels until overflow clears the intervening saddle',()=>{
 const beds=[8,8,8,1,3,0,8,8,8],volumes=new Array(9).fill(0);volumes[3]=1;volumes[5]=.25;
 let result=settleSurfaceWater(beds,volumes,3);assert.equal(result.levels[3],2);assert.equal(result.levels[5],.25);assert.equal(result.levels[4],null);
 volumes[3]=4;result=settleSurfaceWater(beds,volumes,3);assert.equal(result.levels[3],3);assert.equal(result.levels[5],2.25);assert.equal(result.levels[4],null);
 volumes[3]=7;result=settleSurfaceWater(beds,volumes,3);for(const i of [3,4,5])assert.equal(result.levels[i],3.75);
});
test('random terrain settling conserves volume, is stable and leaves connected water level',()=>{
 let seed=71;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
 for(let run=0;run<100;run++) {
  const beds=Array.from({length:64},()=>Math.floor(random()*7)-3),volumes=beds.map(()=>random()<.3?random()*3:0);
  const {levels}=settleSurfaceWater(beds,volumes,8),after=levels.map((h,i)=>h===null?0:h-beds[i]);
  assert.ok(Math.abs(volumes.reduce((a,b)=>a+b,0)-after.reduce((a,b)=>a+b,0))<1e-6);
  const again=settleSurfaceWater(beds,after,8).levels;
  for(let i=0;i<64;i++) {
   assert.ok(levels[i]===again[i] || Math.abs(levels[i]-again[i])<1e-7);
   for(const j of [i%8<7?i+1:-1,i+8<64?i+8:-1])if(j>=0 && levels[i]!==null && levels[j]!==null && Math.min(levels[i],levels[j])>Math.max(beds[i],beds[j])+1e-7)assert.ok(Math.abs(levels[i]-levels[j])<1e-7);
  }
 }
});
test('lowering a bank floods a new pit without creating water; raising a bed displaces water',()=>{
 const c=town();pond(c,5,5,3,3);const volume=total(c),old=at(c,5,5).waterLevel;
 assert.ok(place(c,4,6,'lower').ok);assert.equal(at(c,4,6).terrain,'water');assert.ok(at(c,5,5).waterLevel<old);assert.ok(Math.abs(total(c)-volume)<1e-7);
 const before=at(c,5,5).waterLevel;assert.ok(place(c,6,6,'raise').ok);assert.equal(at(c,6,6).terrain,'sand');assert.ok(at(c,5,5).waterLevel>before);assert.ok(Math.abs(total(c)-volume)<1e-7);
 const d=deserialize(serialize(c));assert.equal(serialize(d),serialize(c));assert.ok(Math.abs(total(d)-volume)<1e-7);
});
test('raising a narrow connection splits a body into separate pools',()=>{
 const c=town();pond(c,3,5,3,3);pond(c,7,5,3,3);pond(c,6,6,1,1);const volume=total(c);
 assert.ok(place(c,6,6,'raise').ok);assert.equal(at(c,6,6).terrain,'sand');assert.ok(Math.abs(total(c)-volume)<1e-7);
 const right=at(c,8,6).waterLevel;assert.ok(place(c,2,6,'lower').ok);assert.ok(Math.abs(at(c,8,6).waterLevel-right)<1e-7);assert.ok(at(c,4,6).waterLevel<right);
});
test('water surfaces are planar at all rotations beside high terrain',()=>{
 for(let rotation=0;rotation<4;rotation++) {
  const c=town();pond(c,5,5,1,1,1,1.75);at(c,6,5).elev=8;
  const r=Object.assign(Object.create(CityRenderer.prototype),{size:16,w:600,h:400,zoom:1.5,rotation,panX:0,panY:0});r.buildCorners(c);
  r.paintTerrain=t=>{
   const geometry=waterGeometry(r,t);assert.ok(geometry.dry.length>0);
   for(const polygon of geometry.wet) {
    const x=polygon.reduce((s,p)=>s+p[0],0)/polygon.length,y=polygon.reduce((s,p)=>s+p[1],0)/polygon.length;
    const p=r.project(x,y),o=r.orient(x,y);assert.ok(Math.abs((r.cy+(o.x+o.y-r.size)*16*r.zoom-p.y)/r.zoom-1.75*8)<1e-6);
   }
  };
  r.terrain(at(c,5,5),c);assert.equal(r.platform,undefined);
 }
});
test('earthworks refuse inundation of occupied land without mutation or a charge',()=>{
 const c=town();for(const t of c.tiles)t.elev=2;at(c,5,5).elev=1;at(c,6,5).elev=0;place(c,6,5,'road');
 const before=serialize(c),ev=evaluate(c,5,5,'makewater');assert.equal(ev.ok,false);assert.match(ev.message,/flood/);assert.equal(place(c,5,5,'makewater').ok,false);assert.equal(serialize(c),before);
});
test('water-level save data is validated and old water rows migrate once',()=>{
 const c=town();pond(c,5,5,1,1);const raw=JSON.parse(serialize(c));raw.tiles[85][26]=-2;assert.throws(()=>deserialize(JSON.stringify(raw)),/water level/);
 // Rows from before water levels (and port modules) stop at the viaduct field.
 const old=JSON.parse(serialize(c));for(const row of old.tiles){if(old.types[row[2]]==='empty' && row[0]===1)row[15]=0;row.length=26;}
 const migrated=deserialize(JSON.stringify(old));assert.equal(at(migrated,5,5).elev,-1);assert.equal(at(migrated,5,5).waterLevel,-.25);
});
test('overflow enters the nearer receiving basin before crossing its lower dry saddle',()=>{
 const size=5,beds=new Array(25).fill(8),volumes=new Array(25).fill(0);
 for(const [i,h]of[[10,0],[11,3],[12,0],[13,5],[14,0]])beds[i]=h;
 volumes[14]=6;const {levels}=settleSurfaceWater(beds,volumes,size);
 assert.equal(levels[14],5);assert.equal(levels[12],1);assert.equal(levels[10],null);assert.equal(levels[11],null);
});
test('shallow sheet water retains volume without turning flat maps into water or deleting trees',()=>{
 const c=town();pond(c,5,5,1,1);at(c,9,9).trees=3;const volume=total(c);
 assert.ok(place(c,5,5,'raise').ok);assert.equal(c.tiles.filter(t=>t.terrain==='water').length,0);assert.equal(at(c,9,9).trees,3);assert.ok(Math.abs(total(c)-volume)<1e-7);
 const d=deserialize(serialize(c));assert.ok(Math.abs(total(d)-volume)<1e-7);
});
test('water effects appear in construction previews and extinguish inundated ground fires',async()=>{
 const {planConstruction}=await import('../src/construction.js');const c=town();pond(c,5,5,3,3);at(c,4,6).fire=2;
 const plan=planConstruction(c,{x:4,y:6},{x:4,y:6},'lower');assert.ok(plan.tiles.some(t=>t.effect));
 assert.ok(place(c,4,6,'lower').ok);assert.equal(at(c,4,6).fire,0);
});
test('invalid basin grids fail explicitly instead of indexing out of bounds',()=>{
 assert.throws(()=>settleSurfaceWater([0,0],[1,0],3),/square grid/);
});
test('flat water does not pull neighboring high terrain vertices down to its level',()=>{
 const c=town();for(const t of c.tiles)t.elev=8;pond(c,5,5,1,1,1,1.75);
 const r=Object.assign(Object.create(CityRenderer.prototype),{size:16});r.buildCorners(c);
 assert.equal(r.meshZ(6,5),50);assert.equal(r.groundZ(5.5,5.5),14);
});
test('outer boundary water projection uses its surface, not the submerged bed',()=>{
 const c=town();pond(c,15,15,1,1,-3,-.25);
 const r=Object.assign(Object.create(CityRenderer.prototype),{size:16});r.buildCorners(c);
 for(const [x,y]of[[16,15.5],[15.5,16],[16,16]])assert.equal(r.groundZ(x,y),-2);
});
test('reclaiming a deep tile cascades its earthwork to valid slopes',()=>{
 const c=town();for(const t of c.tiles)t.elev=-3;pond(c,4,4,6,6,-3,-.25);
 const result=place(c,6,6,'makeland');assert.ok(result.ok,result.message);
 for(const t of c.tiles)for(const [dx,dy]of[[1,0],[0,1]]){const n=at(c,t.x+dx,t.y+dy);if(t.x+dx<c.size && t.y+dy<c.size)assert.ok(Math.abs(t.elev-n.elev)<=1);}
});
test('a volcano clears stored water on the rock it creates',async()=>{
 const {triggerDisaster}=await import('../src/sim/disasters.js');const c=town();pond(c,0,0,16,16,-3,2);
 triggerDisaster(c,'volcano',()=>.5);
 for(const t of c.tiles)if(t.terrain==='rock')assert.equal(t.waterLevel,null);
 assert.doesNotThrow(()=>deserialize(serialize(c)));
});
