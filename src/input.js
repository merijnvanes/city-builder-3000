// Pointer gestures preview first and commit once, on release. Multi-touch and
// cancellation never leave partially constructed strokes behind.
export function attachInput(canvas,renderer,actions,planConstruction){
 const held = new Set();
 const moves = {arrowleft:[1,0],arrowright:[-1,0],arrowup:[0,1],arrowdown:[0,-1],a:[1,0],d:[-1,0],w:[0,1],s:[0,-1]};

 const pointers=new Map();let stroke=null,gesture=null,space=false;
 const point=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
 const pickTile=p=>['inspect','bulldoze'].includes(actions.getTool())?renderer.pickObject(p.x,p.y):renderer.pick(p.x,p.y);
 const gestureInfo=()=>{const [a,b]=[...pointers.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};};
 const showPreview=tile=>{
  if(actions.getTool()==='inspect'){renderer.preview=null;actions.onPreview(null);return;}
  const start=stroke&&!stroke.pan?stroke.start:tile;
  const plan=planConstruction(actions.getCity(),start,tile,actions.getTool(),{density:actions.getDensity()});
  renderer.preview=plan;actions.onPreview(plan);
 };
 function cancel(){stroke=null;gesture=null;renderer.preview=null;pointers.clear();actions.onPreview(null);}
 canvas.addEventListener('pointerdown',e=>{
  if(![0,1,2].includes(e.button))return;
  const p=point(e);pointers.set(e.pointerId,p);canvas.setPointerCapture(e.pointerId);
  if(pointers.size>=2){gesture=gestureInfo();stroke=null;renderer.preview=null;actions.onPreview(null);return;}
  const tile=pickTile(p);
  stroke={id:e.pointerId,start:tile,end:tile,p,origin:p,moved:0,pan:e.button!==0||space||(e.pointerType==='touch'&&actions.getTool()==='inspect')};
  if(!stroke.pan)showPreview(tile);
 });
 canvas.addEventListener('pointermove',e=>{
  const p=point(e);if(pointers.has(e.pointerId))pointers.set(e.pointerId,p);
  if(gesture&&pointers.size>=2){const next=gestureInfo();renderer.pan(next.x-gesture.x,next.y-gesture.y);renderer.zoomAt(Math.log(next.d/gesture.d),next.x,next.y);gesture=next;return;}
  const tile=pickTile(p);renderer.hover=tile;
  if(stroke&&stroke.id===e.pointerId){stroke.moved=Math.max(stroke.moved,Math.hypot(p.x-stroke.origin.x,p.y-stroke.origin.y));if(stroke.pan)renderer.pan(p.x-stroke.p.x,p.y-stroke.p.y);else{stroke.end=tile;showPreview(tile);}stroke.p=p;}
  else if(!pointers.size)showPreview(tile);
 });
 canvas.addEventListener('pointerup',e=>{
  const current=stroke;const multi=!!gesture;pointers.delete(e.pointerId);stroke=null;gesture=null;
  if(!multi&&current&&current.id===e.pointerId&&!e.shiftKey){
   if(actions.getTool()==='inspect'&&current.moved<6)actions.onInspect(current.end);
   else if(!current.pan&&actions.getTool()!=='inspect'){
    const plan=planConstruction(actions.getCity(),current.start,current.end,actions.getTool(),{density:actions.getDensity()});actions.onCommit(plan);
   }
  }
  renderer.preview=null;actions.onPreview(null);
 });
 canvas.addEventListener('pointercancel',cancel);
 canvas.addEventListener('lostpointercapture',e=>{pointers.delete(e.pointerId);if(stroke?.id===e.pointerId)cancel();});
 canvas.addEventListener('pointerleave',()=>{if(!stroke&&!gesture){renderer.hover=null;renderer.preview=null;actions.onPreview(null);}});
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('wheel',e=>{e.preventDefault();const p=point(e);renderer.zoomAt(-e.deltaY*.001,p.x,p.y);},{passive:false});
 window.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea,select,[contenteditable="true"]')||document.querySelector('dialog[open]'))return;
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();cancel();actions.onUndo();return;}
  if(e.key==='Escape'){if(stroke||gesture){cancel();return;}actions.onChoose('inspect');renderer.preview=null;return;}
  if(e.code==='Space'){if(e.target.matches('button'))return;space=true;e.preventDefault();return;}
  if(['0','1','2','3'].includes(e.key)){actions.onSpeed(Number(e.key));return;}
  const key=e.key.toLowerCase();
  if(moves[key]){held.add(key);e.preventDefault();return;}
  const tool=actions.getTools().find(t=>t.shortcut?.toLowerCase()===key);if(tool){actions.onChoose(tool.id);return;}
  if(key==='+'||key==='=')renderer.zoomAt(.15);else if(key==='-')renderer.zoomAt(-.15);else if(key==='h')actions.onHome();else if(key==='[')actions.onRotate(-1);else if(key===']')actions.onRotate(1);
 });
 window.addEventListener('keyup',e=>{held.delete(e.key.toLowerCase());if(e.code==='Space')space=false;});
 window.addEventListener('blur',()=>{held.clear();space=false;cancel();});
 return {cancel,update(delta){
  if(!held.size)return;
  if(document.hidden||document.querySelector('dialog[open]')||document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')){held.clear();return;}
  let x=0,y=0;for(const key of held){x+=moves[key][0];y+=moves[key][1];}
  const length=Math.hypot(x,y);if(length)renderer.pan(x/length*delta*.48,y/length*delta*.48);
 },get dragging(){return !!stroke||!!gesture;}};
}
