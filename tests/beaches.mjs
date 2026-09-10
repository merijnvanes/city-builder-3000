// Beaches in the rendered picture. Two maps: a lake ringed with sand, and a
// natural coast with its scattered sand patches. On each, in every rotation:
//  - the bank of a water tile beside a beach is painted sand, not water;
//  - where two sand tiles meet, the pixels on their shared edge are sand
//    right through, with no hairline of the grass beneath.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173/?play');
 await page.waitForFunction(()=>!!window.civic?.agent);
 await mkdir('artifacts',{recursive:true});
 for(const scene of [{layout:'lakes',seed:7,ring:true},{layout:'coast',seed:12,ring:false}]) {
  const focus=await page.evaluate(scene=>{
   civic.agent.newCity({size:32,starter:false,layout:scene.layout,hills:1,seed:scene.seed});
   const c=civic.city;c.speed=0;
   for(const t of c.tiles)t.trees=0;
   if(scene.ring)for(const t of c.tiles) {
    if(t.terrain==='water')continue;
    const wet=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>c.tiles[(t.y+dy)*c.size+t.x+dx]?.terrain==='water' && t.x+dx>=0 && t.x+dx<c.size);
    if(wet)t.terrain='sand';
   }
   c.revision++;civic.renderer.tool='inspect';
   // Look at the sandiest neighbourhood of the map.
   let best=null;
   for(let y=4;y<c.size-4;y++)for(let x=4;x<c.size-4;x++) {
    let sand=0;for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++)if(c.tiles[(y+dy)*c.size+x+dx].terrain==='sand')sand++;
    if(!best || sand>best.sand)best={x,y,sand};
   }
   return best;
  },scene);
  for(let rotation=0;rotation<4;rotation++) {
   const result=await page.evaluate(async ({focus,rotation})=>{
    const {waterGeometry,fanValueAt}=await import('/src/water-geometry.js');
    const {sandLattice,sandAt,nearSand,beachPolygons,meshFan,SAND_THRESHOLD}=await import('/src/terrain-contours.js');
    const c=civic.city,r=civic.renderer,lattice=sandLattice(c);
    r.rotation=rotation;r.focusOn(focus.x+.5,focus.y+.5,2);r.dirty=true;r.render(c,1000);
    const ctx=r.ground.getContext('2d');
    const at=(x,y)=>x>=0 && y>=0 && x<c.size && y<c.size?c.tiles[y*c.size+x]:null;
    const pixel=(px,py)=>ctx.getImageData(Math.round(px*r.dpr),Math.round(py*r.dpr),1,1).data;
    const onScreen=p=>p.x>4 && p.y>4 && p.x<r.w-5 && p.y<r.h-5;
    const sandy=([R,G,B])=>G-R<=8 && R-B>=30;
    const project=(x,y,z)=>{const old=r.platform;r.platform=0;try{return r.project(x,y,z);}finally{r.platform=old;}};
    const fanOf=t=>{const g=waterGeometry(r,t);return {geometry:g,fan:g || meshFan(r,t),pieces:g?g.dry:meshFan(r,t).pieces};};
    const sandOf=(t,x,y)=>nearSand(c,t)?sandAt(c,lattice,x,y):0;
    const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
    let banks=0,seams=0;const failures=[];
    for(const t of c.tiles) {
     if(Math.abs(t.x-focus.x)>6 || Math.abs(t.y-focus.y)>6)continue;
     // Banks of water tiles beside a beach.
     if(t.terrain==='water' && [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>at(t.x+dx,t.y+dy)?.terrain==='sand')) {
      const {geometry,pieces}=fanOf(t);
      const {full,polygons}=beachPolygons(c,lattice,t,pieces);
      for(const polygon of full?pieces:polygons) {
       if(area(polygon)<.03)continue;
       const x=polygon.reduce((s,p)=>s+p[0],0)/polygon.length,y=polygon.reduce((s,p)=>s+p[1],0)/polygon.length,z=fanValueAt(geometry,x,y);
       // Clear of the pale shore line drawn along the waterline.
       if(z<geometry.level+2)continue;
       const p=project(x,y,z);if(!onScreen(p))continue;
       const px=pixel(p.x,p.y);banks++;
       if(!sandy(px))failures.push(`bank of water tile ${t.x},${t.y} at ${x.toFixed(2)},${y.toFixed(2)} is ${px.slice(0,3)}`);
      }
     }
     // Shared edges between two sand tiles, where both sides are well inside the sand and dry.
     if(t.terrain!=='sand')continue;
     for(const [dx,dy] of [[1,0],[0,1]]) {
      const n=at(t.x+dx,t.y+dy);if(n?.terrain!=='sand')continue;
      for(const f of [.25,.5,.75]) {
       const x=dx?t.x+1:t.x+f,y=dy?t.y+1:t.y+f;
       if(sandOf(t,x,y)<SAND_THRESHOLD+.15 || sandOf(n,x,y)<SAND_THRESHOLD+.15)continue;
       // Well above the waterline on both sides: the water's own antialiased
       // edge blends with the sand there, and that is not a seam.
       if([t,n].some(tile=>{const g=fanOf(tile).geometry;return g && fanValueAt(g,x,y)<g.level+2;}))continue;
       const p=project(x,y,r.groundZ(x,y));if(!onScreen(p))continue;
       seams++;
       for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++) {
        const px=pixel(p.x+ox,p.y+oy);
        if(!sandy(px)){failures.push(`seam between sand tiles ${t.x},${t.y} and ${n.x},${n.y} at ${x},${y}: ${px.slice(0,3)}`);ox=oy=2;}
       }
      }
     }
    }
    return {banks,seams,failures:failures.slice(0,8),count:failures.length};
   },{focus,rotation});
   await page.screenshot({path:`artifacts/beaches-${scene.layout}-${rotation}.png`});
   assert.equal(result.count,0,`${scene.layout} view ${rotation}: ${result.failures.join('; ')}`);
   assert.ok(result.banks>3 && result.seams>10,`${scene.layout} view ${rotation} checked too little: ${JSON.stringify(result)}`);
  }
 }
 assert.deepEqual(errors,[]);
 console.log('Beaches keep their banks and meet seam-free in every rotation on a lake and a coast.');
} finally {await browser.close();}
