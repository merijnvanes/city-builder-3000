import test from 'node:test';
import assert from 'node:assert/strict';
import {drawConstructionSite} from '../src/construction-art.js';

function draw(t,rotation) {
 const boxes=[],lines=[];
 const orient=(x,y)=>rotation===0?{x,y}:rotation===1?{x:-y,y:x}:rotation===2?{x:-x,y:-y}:{x:y,y:-x};
 const r={night:false,orient,project:(x,y,z=0)=>{const p=orient(x,y);return {x:p.x-p.y,y:(p.x+p.y)/2-z};},
  flat(){},box(...args){boxes.push(args);},line(...args){lines.push(args);}};
 drawConstructionSite(r,t,40);
 return {boxes,lines,foot:boxes.find(b=>b[5]==='#737971')};
}

test('construction layouts use all four crane corners and stay fixed across camera rotations and reloads',()=>{
 const corners=new Set();
 for(let x=0;x<32;x++) {
  const t={variant:x/32,lot:{x,y:7,w:2,h:3}},a=draw(t,0);
  assert.deepEqual(draw(JSON.parse(JSON.stringify(t)),0),a);
  for(let rotation=1;rotation<4;rotation++)assert.deepEqual(draw(t,rotation).foot,a.foot);
  const order=b=>b.boxes.findIndex(p=>p[5]==='#737971')<b.boxes.findIndex(p=>p[5]==='#aaa797');
  assert.notEqual(order(a),order(draw(t,2)),'Crane and frame paint order must reverse in the opposite view');
  const [xx,yy]=a.foot;corners.add(`${xx-x<1},${yy-7<1.5}`);
  for(const [bx,by,w,h] of a.boxes) {
   assert.ok(bx>=x && by>=7 && bx+w<=x+2+1e-9 && by+h<=10+1e-9,'Rotated geometry stays within a rectangular lot');
  }
 }
 assert.equal(corners.size,4);
 const lot={x:4,y:5,w:1,h:1};
 assert.deepEqual(draw({lot},0),draw({lot,variant:0},0));
});
