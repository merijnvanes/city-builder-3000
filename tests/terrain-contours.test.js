import test from 'node:test';
import assert from 'node:assert/strict';
import {sandLattice,sandAt,nearSand,beachPolygons,meshFan,SUBDIVISIONS,SAND_THRESHOLD} from '../src/terrain-contours.js';
import {waterGeometry,fanValueAt} from '../src/water-geometry.js';
import {terrainPalette,drawTerrainSurface} from '../src/terrain-art.js';
import {shadeHex} from '../src/art-colors.js';
import {CityRenderer} from '../src/renderer.js';
import {ELEV_PX} from '../src/render-scale.js';

// A small map: water on the north row, a sand strip below it, grass beyond.
// The land stands two levels up with the water settled between, so every
// shore tile has a bank above the waterline and a bed below it.
function shore({sandRows=[1],size=8,seed=3,elev=2,waterLevel=1.5}={}) {
 const tiles=[];
 for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
  const water=y===0;
  tiles.push({x,y,terrain:water?'water':sandRows.includes(y)?'sand':'grass',elev:water?0:elev,waterLevel:water?waterLevel:null,type:'empty'});
 }
 return {size,seed,revision:1,tiles};
}
const renderer=city=>{const r=Object.create(CityRenderer.prototype);r.size=city.size;r.buildCorners(city);return r;};
const at=(c,x,y)=>c.tiles[y*c.size+x];
const area=polygon=>Math.abs(polygon.reduce((sum,[x,y],i)=>{const [nx,ny]=polygon[(i+1)%polygon.length];return sum+x*ny-nx*y;},0))/2;
const areaOf=polygons=>polygons.reduce((sum,p)=>sum+area(p),0);
// The beach of a tile as the painter sees it: the fan the tile is drawn
// with, its dry pieces, and the sandy part of those.
function beach(r,c,t) {
 const geometry=waterGeometry(r,t),fan=geometry || meshFan(r,t),pieces=geometry?geometry.dry:fan.pieces;
 return {geometry,fan,pieces,...(nearSand(c,t)?beachPolygons(c,sandLattice(c),t,pieces):{full:false,polygons:[]})};
}
const sandArea=b=>b.full?areaOf(b.pieces):areaOf(b.polygons);

test('the beach reaches the waterline and fades into the grass with a contour',()=>{
 const c=shore(),r=renderer(c);
 for(let x=1;x<c.size-1;x++) {
  const sand=beach(r,c,at(c,x,1)),grass=beach(r,c,at(c,x,2)),far=beach(r,c,at(c,x,3));
  assert.ok(sandArea(sand)>areaOf(sand.pieces)*0.5,`the sand tile at ${x} is mostly sand above the waterline`);
  assert.ok(sandArea(grass)<0.5,`the grass tile beside it is mostly grass: ${sandArea(grass)}`);
  assert.equal(sandArea(far),0,'grass two tiles from the beach carries no sand');
  assert.equal(nearSand(c,at(c,x,3)),false);
 }
});

test('sand keeps to the dry side of the shore and stands at the height of the ground',()=>{
 const c=shore(),r=renderer(c),level=1.5*ELEV_PX;
 let clipped=0;
 for(const t of c.tiles) {
  const b=beach(r,c,t);
  if(b.geometry?.wet.length && b.polygons.length)clipped++;
  for(const polygon of b.polygons)for(const [x,y,z] of polygon) {
   assert.ok(x>=t.x-1e-9 && x<=t.x+1+1e-9 && y>=t.y-1e-9 && y<=t.y+1+1e-9,`point inside tile ${t.x},${t.y}`);
   if(b.geometry)assert.ok(z>=level-1e-7,`sand above the waterline at ${x},${y}: ${z}`);
   const ground=b.geometry?fanValueAt(b.geometry,x,y):r.meshZ(x,y);
   assert.ok(Math.abs(z-ground)<1e-7,`sand on the ground at ${x},${y}: ${z} vs ${ground}`);
  }
  assert.ok(sandArea(b)<=areaOf(b.pieces)+1e-9,'no more sand than there is dry ground');
 }
 assert.ok(clipped>0,'some shore tiles have sand cut by the waterline');
});

// With the water a little lower, the vertices between the water row and the
// land stand above the waterline and every water tile has a bank.
const banked=options=>shore({waterLevel:.75,...options});

test('the bank of a water tile is sand where a beach meets it and land elsewhere',()=>{
 const c=banked({sandRows:[]}),r=renderer(c);
 at(c,3,1).terrain='sand';at(c,4,1).terrain='sand';
 const beside=beach(r,c,at(c,3,0)),away=beach(r,c,at(c,7,0));
 assert.ok(beside.pieces.length>0 && away.pieces.length>0,'both water tiles have a bank above the waterline');
 assert.ok(sandArea(beside)>0,'the bank beside the beach carries sand');
 assert.equal(nearSand(c,at(c,7,0)),false);
 assert.equal(sandArea(away),0,'a bank far from any beach is plain land');
});

// Where two tiles share an edge, the stretches of that edge covered by sand
// agree, whether the neighbours are drawn with four-corner fans (land) or
// eight-corner fans (water), and whether the edge is cut by the waterline or
// not. The polygons may split the edge differently; the cover must not.
function coveredOn(b,axis,line,s) {
 return (b.full?b.pieces:b.polygons).some(polygon=>polygon.some((p,i)=>{
  const q=polygon[(i+1)%polygon.length];
  if(Math.abs(p[axis]-line)>1e-7 || Math.abs(q[axis]-line)>1e-7)return false;
  const lo=Math.min(p[1-axis],q[1-axis]),hi=Math.max(p[1-axis],q[1-axis]);
  return s>=lo-1e-7 && s<=hi+1e-7;
 }));
}
test('the contour crosses every shared edge at the same point on both sides',()=>{
 const c=shore({sandRows:[1,2]}),r=renderer(c);
 let compared=0,covered=0,bare=0;
 for(const t of c.tiles)for(const [dx,dy] of [[1,0],[0,1]]) {
  if(t.x+dx>=c.size || t.y+dy>=c.size)continue;
  const n=at(c,t.x+dx,t.y+dy);
  const a=beach(r,c,t),b=beach(r,c,n);
  if(!a.polygons.length && !a.full && !b.polygons.length && !b.full)continue;
  const axis=dx?0:1,line=dx?t.x+1:t.y+1,from=dx?t.y:t.x;
  for(let f=.0125;f<1;f+=.025) {
   const mine=coveredOn(a,axis,line,from+f),theirs=coveredOn(b,axis,line,from+f);
   assert.equal(mine,theirs,`shared edge between ${t.x},${t.y} and ${n.x},${n.y} at ${from+f}`);
   if(mine)covered++;else bare++;
  }
  compared++;
 }
 assert.ok(compared>10 && covered>0 && bare>0);
});

test('an isolated sand tile becomes a rounded patch rather than a square',()=>{
 const c=shore({sandRows:[]}),r=renderer(c);
 at(c,4,4).terrain='sand';
 const b=beach(r,c,at(c,4,4));
 assert.equal(b.full,false);
 const covered=sandArea(b);
 assert.ok(covered>0.2 && covered<1,`a patch, not the whole tile: ${covered}`);
 assert.equal(nearSand(c,at(c,6,4)),false);
});

test('rock keeps hard edges and a deep beach is solid sand',()=>{
 const c=shore({sandRows:[1,2,3]}),r=renderer(c);
 assert.equal(beach(r,c,at(c,4,2)).full,true);
 at(c,4,5).terrain='rock';
 assert.equal(nearSand(c,at(c,4,5)),false);
 assert.deepEqual(beachPolygons(c,sandLattice(c),at(c,4,5),meshFan(r,at(c,4,5)).pieces),{full:false,polygons:[]});
});

test('coverage is deterministic for a seed and changes with it',()=>{
 const a=shore({seed:5}),b=shore({seed:5}),d=shore({seed:9});
 assert.deepEqual(sandLattice(a),sandLattice(b));
 assert.notEqual(sandAt(a,sandLattice(a),3.3,2.4),sandAt(d,sandLattice(d),3.3,2.4));
 const ra=renderer(a),rb=renderer(b);
 assert.deepEqual(beach(ra,a,at(a,3,2)).polygons,beach(rb,b,at(b,3,2)).polygons);
});

test('the field is one smooth function of the map, and the contour follows it finer than the tile',()=>{
 const c=shore({sandRows:[1,2]}),r=renderer(c),lattice=sandLattice(c);
 // Continuous: tiny steps never jump, including across tile edges.
 for(let x=1.5;x<6;x+=.05)for(const y of [2.5,3,3.5]) {
  const step=Math.abs(sandAt(c,lattice,x+1e-4,y)-sandAt(c,lattice,x,y));
  assert.ok(step<2e-3,`smooth at ${x},${y}: ${step}`);
 }
 // A straight beach's contour runs near the tile edge between the last sand
 // row and the grass, wandering a little, never near the row centres.
 for(let x=1.5;x<6;x+=.25) {
  assert.ok(sandAt(c,lattice,x,2.5)>SAND_THRESHOLD+.15,'the sand row is sand');
  assert.ok(sandAt(c,lattice,x,3.5)<SAND_THRESHOLD-.15,'the grass row is grass');
 }
 // The polyline has vertices on the sub-grid, not only on tile edges and spokes.
 const b=beach(r,c,at(c,3,3));
 const fine=b.polygons.flat().filter(([x,y])=>{const fx=(x-3)*SUBDIVISIONS,fy=(y-3)*SUBDIVISIONS;return (Math.abs(fx-Math.round(fx))<1e-9 && fx%SUBDIVISIONS!==0) || (Math.abs(fy-Math.round(fy))<1e-9 && fy%SUBDIVISIONS!==0);});
 assert.ok(fine.length>0,'sub-grid vertices');
});

// A recording canvas: every fill remembers its colour and how many points
// it was given, every stroke its segments.
function recorder() {
 const fills=[],strokes=[];let points=0,segments=[];
 const ctx={
  fillStyle:'#000',strokeStyle:'#000',lineWidth:1,lineCap:'butt',lineJoin:'miter',
  beginPath(){points=0;segments=[];},moveTo(){points++;segments.push(1);},lineTo(){points++;},closePath(){},
  fill(){fills.push({style:ctx.fillStyle,points});},stroke(){strokes.push({style:ctx.strokeStyle,segments:segments.length,width:ctx.lineWidth});},
  save(){},restore(){},clip(){throw new Error('the beach must not be clipped in the raster');},
 };
 return {ctx,fills,strokes};
}
function paintingRenderer(city) {
 const r=renderer(city);
 Object.assign(r,{w:800,h:600,panX:0,panY:0,zoom:1,platform:null});
 const {ctx,fills,strokes}=recorder();r.base=ctx;
 return {r,fills,strokes};
}

test('a water tile beside a beach paints its bank in sand, never in the water colour',()=>{
 const c=banked(),{r,fills}=paintingRenderer(c),t=at(c,3,0),index=t.y*c.size+t.x;
 const palette=terrainPalette(c),b=beach(r,c,t);
 assert.ok(b.pieces.length>0 && b.polygons.length+(b.full?1:0)>0,'the bank exists and carries sand');
 drawTerrainSurface(r,t,c,1);
 const water=fills.filter(f=>f.style===palette.water[index]);
 assert.equal(water.length,1,'the water colour fills the wet surface once');
 assert.equal(water[0].points,b.geometry.wet.flat().length);
 const bankStyle=b.full?palette.sand[index]:palette.ground[index];
 const bank=fills.find(f=>f.style===bankStyle && f.points===b.pieces.flat().length);
 assert.ok(bank,'the bank above the waterline is painted as land, in its own colour');
 if(!b.full)assert.ok(fills.some(f=>f.style===palette.sand[index]),'the beach is painted over the bank');
});

test('a water tile with a grass bank paints that bank as grass',()=>{
 const c=banked({sandRows:[]}),{r,fills}=paintingRenderer(c),t=at(c,3,0),index=t.y*c.size+t.x;
 const palette=terrainPalette(c),b=beach(r,c,t);
 assert.ok(b.pieces.length>0);
 drawTerrainSurface(r,t,c,1);
 assert.ok(fills.some(f=>f.style===palette.ground[index] && f.points===b.pieces.flat().length),'the bank is grass');
 assert.notEqual(palette.ground[index],palette.water[index]);
});

test('the slope shade applies to land and beach alike, and the beach is never raster clipped',()=>{
 const c=shore(),{r,fills,strokes}=paintingRenderer(c),t=at(c,3,2),index=t.y*c.size+t.x;
 const palette=terrainPalette(c),b=beach(r,c,t);
 assert.ok(b.polygons.length>0 && !b.full,'a contour crosses this tile');
 drawTerrainSurface(r,t,c,1.1);
 assert.ok(fills.some(f=>f.style===shadeHex(palette.ground[index],1.1)),'shaded ground');
 assert.ok(fills.some(f=>f.style===shadeHex(palette.sand[index],1.1) && f.points===b.polygons.flat().length),'shaded beach, all pieces in one path');
 // Only the polygon edges lying on the tile's own boundary are stroked.
 const onEdge=b.polygons.reduce((n,polygon)=>n+polygon.filter((a,i)=>{
  const q=polygon[(i+1)%polygon.length];
  return [[0,t.x],[0,t.x+1],[1,t.y],[1,t.y+1]].some(([axis,line])=>Math.abs(a[axis]-line)<1e-9 && Math.abs(q[axis]-line)<1e-9);
 }).length,0);
 assert.ok(onEdge>0,'this beach reaches the tile edge');
 assert.deepEqual(strokes.map(s=>[s.style,s.segments,s.width]),[[shadeHex(palette.sand[index],1.1),onEdge,1]]);
});

test('an inland tile that is all sand is painted sand outright, with no overlay',()=>{
 const c=shore({sandRows:[1,2,3]}),{r,fills,strokes}=paintingRenderer(c),t=at(c,4,2),index=t.y*c.size+t.x;
 const palette=terrainPalette(c);
 drawTerrainSurface(r,t,c,1);
 assert.deepEqual(fills.map(f=>f.style),[palette.sand[index]]);
 assert.equal(fills[0].points,4,'the tile diamond');
 assert.deepEqual(strokes,[]);
});
