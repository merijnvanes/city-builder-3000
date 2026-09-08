// A wide lot can extend behind an adjacent tree even when its front corner
// is nearer. Order overlapping screen columns by the separating world axis.
export function orderScene(items,r) {
 const nodes=items.map((item,index)=>{
  const {x,y}=item.t,{w=1,h=1}=item.t.lot || {};
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
