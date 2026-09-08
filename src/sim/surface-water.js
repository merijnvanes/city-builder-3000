// Instantaneous hydrostatic settling on a closed map. A depression hierarchy
// keeps water behind its spill elevation; only surplus can enter another basin.
// Terrain and volume are separate, so carving a bed never tilts the waterline.
// Simplified fill/spill model: https://doi.org/10.5194/esurf-9-105-2021
export const WATER_EPSILON = 1e-8;
export const INITIAL_DEPTH = .75;
export const MIN_WATER_DEPTH = .1;
export const waterSurface = t => Number.isFinite(t.waterLevel) ? t.waterLevel : t.elev - .25;
export const bedElevation = t => t.terrain === 'water' && !Number.isFinite(t.waterLevel) ? t.elev - 1 : t.elev;
export const waterVolume = t => Number.isFinite(t.waterLevel) || t.terrain === 'water' ? Math.max(0, waterSurface(t) - bedElevation(t)) : 0;

export function settleSurfaceWater(beds, volumes, size, salts = []) {
  const n=beds.length;
  if(!Number.isInteger(size) || size<1 || n!==size*size || volumes.length!==n) throw new Error('Surface water needs a square grid and matching volumes.');
  const parent=new Int32Array(n).fill(-1), roots=new Int32Array(n), nodes=[];
  const order=Array.from({length:n},(_,i)=>i).sort((a,b)=>beds[a]-beds[b] || a-b);
  const find=i=>{let root=i;while(parent[root]!==root)root=parent[root];while(i!==root){const next=parent[i];parent[i]=root;i=next;}return root;};
  for(const i of order) {
    parent[i]=i;roots[i]=nodes.length;
    nodes.push({tile:i,height:beds[i],area:1,sum:beds[i],volume:volumes[i],salt:salts[i]?volumes[i]:0});
    const x=i%size,y=Math.floor(i/size);
    for(const j of [x?i-1:-1,x+1<size?i+1:-1,y?i-size:-1,y+1<size?i+size:-1]) {
      if(j<0 || parent[j]===-1)continue;
      const a=find(i),b=find(j);if(a===b)continue;
      const left=roots[a],right=roots[b],l=nodes[left],r=nodes[right];
      parent[b]=a;roots[a]=nodes.length;
      nodes.push({left,right,leftEntry:i,rightEntry:j,height:beds[i],area:l.area+r.area,sum:l.sum+r.sum,volume:l.volume+r.volume,salt:l.salt+r.salt});
    }
  }
  const levels=new Array(n).fill(null),saline=new Uint8Array(n);
  const root=roots[find(0)],rank=new Int32Array(n),walk=[[root,false]];
  let next=0;
  while(walk.length) {
    const [id,done]=walk.pop(),node=nodes[id];
    if(done){node.end=next;continue;}
    node.start=next;
    if(node.tile!==undefined){rank[node.tile]=next++;node.end=next;}
    else walk.push([id,true],[node.right,false],[node.left,false]);
  }
  const todo=[[root,nodes[root].volume,nodes[root].salt,[]]];
  while(todo.length) {
    const [id,volume,salt,incoming]=todo.pop(),node=nodes[id];
    const capacity=node.height*node.area-node.sum;
    if(node.tile!==undefined || volume>=capacity-WATER_EPSILON) {
      const level=(node.sum+volume)/node.area,leaves=[id];
      while(leaves.length) {
        const leaf=nodes[leaves.pop()];
        if(leaf.tile===undefined){leaves.push(leaf.left,leaf.right);continue;}
        if(level>beds[leaf.tile]+WATER_EPSILON){levels[leaf.tile]=level;saline[leaf.tile]=salt>WATER_EPSILON?1:0;}
      }
      continue;
    }
    const l=nodes[node.left],r=nodes[node.right];
    const lc=node.height*l.area-l.sum,rc=node.height*r.area-r.sum;
    let lv=l.volume,rv=r.volume,ls=l.salt,rs=r.salt;
    const li=[],ri=[];
    for(const flow of incoming) {
      if(rank[flow.tile]>=l.start && rank[flow.tile]<l.end){li.push(flow);lv+=flow.volume;ls+=flow.salt;}
      else{ri.push(flow);rv+=flow.volume;rs+=flow.salt;}
    }
    // A spill enters at the actual neighboring tile across this saddle.
    // Carry that pour point down the receiving branch; a lower internal
    // saddle cannot be crossed until its nearer basin has filled.
    if(lv>lc){const excess=lv-lc,s=ls*excess/lv;lv=lc;ls-=s;rv+=excess;rs+=s;ri.push({tile:node.rightEntry,volume:excess,salt:s});}
    else if(rv>rc){const excess=rv-rc,s=rs*excess/rv;rv=rc;rs-=s;lv+=excess;ls+=s;li.push({tile:node.leftEntry,volume:excess,salt:s});}
    todo.push([node.left,lv,ls,li],[node.right,rv,rs,ri]);
  }
  return {levels,saline};
}

export function surfaceWaterPlan(city, earth = [], additions = new Map()) {
  // An excavated pond below every dry neighbor (or matching an existing
  // pool's level) cannot spill. Most hover/find candidates need only this.
  if(earth.length===1 && additions.size===1) {
    const {tile,elev}=earth[0],i=tile.y*city.size+tile.x,amount=additions.get(i);
    if(amount===-waterVolume(tile) && amount<0 && elev>=waterSurface(tile))return {changes:[{tile,elev,waterLevel:null,terrain:'sand',salt:false}]};
    if(amount===INITIAL_DEPTH && waterVolume(tile)===0) {
      const level=elev+amount,salts=[];
      let contained=true;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const x=tile.x+dx,y=tile.y+dy;
        if(x<0 || y<0 || x>=city.size || y>=city.size)continue;
        const other=city.tiles[y*city.size+x];
        if(waterVolume(other)>0){if(Math.abs(waterSurface(other)-level)>WATER_EPSILON)contained=false;salts.push(!!other.salt);}
        else if(bedElevation(other)<level)contained=false;
      }
      if(contained && salts.every(s=>s===salts[0]))return {changes:[{tile,elev,waterLevel:level,terrain:'water',salt:salts[0] || false}]};
    }
  }
  const beds=city.tiles.map(bedElevation),volumes=city.tiles.map(waterVolume);
  for(const {tile,elev} of earth) beds[tile.y*city.size+tile.x]=elev;
  for(const [i,amount] of additions) volumes[i]=Math.max(0,volumes[i]+amount);
  const {levels,saline}=settleSurfaceWater(beds,volumes,city.size,city.tiles.map(t=>t.salt));
  const changes=[];
  for(let i=0;i<city.tiles.length;i++) {
    const tile=city.tiles[i],wet=levels[i]!==null && levels[i]-beds[i]>=MIN_WATER_DEPTH-WATER_EPSILON;
    if(wet && tile.terrain!=='water' && (tile.type!=='empty' || tile.powerline || tile.pipe || tile.subway || tile.tunnel)) return {error:'That earthwork would flood occupied land. Clear the affected route or building first.'};
    const terrain=wet?'water':tile.terrain==='water'?'sand':tile.terrain;
    const salt=wet && !!saline[i];
    if(tile.elev!==beds[i] || tile.waterLevel!==levels[i] || tile.terrain!==terrain || tile.salt!==salt) changes.push({tile,elev:beds[i],waterLevel:levels[i],terrain,salt});
  }
  return {changes};
}
export function applySurfaceWater(plan) {
  for(const {tile,elev,waterLevel,terrain,salt} of plan.changes) {
    tile.elev=elev;tile.waterLevel=waterLevel;tile.terrain=terrain;tile.salt=salt;
    if(terrain==='water'){tile.trees=0;tile.fire=0;}
  }
}
