// Painter's order for scene items by their ground footprints.
//
// A footprint is an axis-aligned rectangle on the map. Item A must be painted
// before item B when A lies entirely on the far side of a grid line that B
// touches: A.maxU <= B.minU or A.maxV <= B.minV in camera-oriented tile
// coordinates. Only items whose screen columns overlap need an edge, and for
// such pairs exactly one direction holds, so the relation is acyclic and a
// depth-first topological sort yields a correct order. A tall building's
// front corner alone cannot order trees beside its far half; the separating
// axis can.
export function orderScene(items,r) {
 const nodes=items.map((item,index)=>{
  const {x,y,w=1,h=1}=item;
  const points=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([x,y])=>r.orient(x,y));
  const u=points.map(p=>p.x),v=points.map(p=>p.y);
  const minU=Math.min(...u),maxU=Math.max(...u),minV=Math.min(...v),maxV=Math.max(...v);
  return {item,index,minU,maxU,minV,maxV,left:minU-maxV,right:maxU-minV,before:[],state:0};
 });
 const active=[];
 for(const b of [...nodes].sort((a,b)=>a.left-b.left || a.index-b.index)) {
  for(let i=active.length-1;i>=0;i--)if(active[i].right<=b.left)active.splice(i,1);
  for(const a of active) {
   if(a.maxU<=b.minU || a.maxV<=b.minV)b.before.push(a);
   else if(b.maxU<=a.minU || b.maxV<=a.minV)a.before.push(b);
  }
  active.push(b);
 }
 const ordered=[];
 const visit=node=>{
  if(node.state)return;
  node.state=1;
  for(const other of node.before)visit(other);
  node.state=2;ordered.push(node.item);
 };
 for(const node of nodes)visit(node);
 return ordered;
}
