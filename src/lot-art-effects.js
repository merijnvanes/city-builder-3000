import { NIGHT_EXPOSURE, shadeHex } from './art-colors.js';
import { random } from './architecture-variation.js';

// Shared by authored and fallback artwork. Construction remains a temporary
// overlay, without baking another sprite matrix or allocating per-lot canvases.
export function drawLotEffects(r, t, height) {
  const { x, y, w, h } = t.lot;
  const k=(t.abandoned ? 0.55 : 1)*(r.night?NIGHT_EXPOSURE:1);
  const tone=color=>k===1?color:shadeHex(color,k);
  const project = (a,b,z=0) => r.project(x+a*w,y+b*h,z);
  if (t.abandoned) {
    for (let i=0;i<4;i++) r.flat(x+(.1+random(t.x,t.y,i)*.7)*w,y+(.1+random(t.y,t.x,i+3)*.7)*h,.12*w,.08*h,.5,tone('#6b6a4c'));
    return null;
  }
  if (t.age !== 0 || !['residential','commercial','industrial'].includes(t.type)) return null;
  const rise=height+10, points=[];
  const line=(a,b,z,c,d,zz,color,width)=>{
    const p=project(a,b,z),q=project(c,d,zz);points.push(p,q);r.line(p,q,tone(color),width);
  };
  line(.85,.15,0,.85,.15,rise,'#d9c24a',1.4);
  line(.85,.15,rise,.3,.15,rise,'#d9c24a',1.2);
  line(.45,.15,rise,.45,.15,rise*.55,'#d9c24a',.7);
  r.box(x+.42*w,y+.12*h,.06*w,.06*h,3,tone('#8a8a80'),rise*.55-3);
  for (let z=4;z<Math.min(rise-6,30);z+=6) line(.06,.94,z,.94,.94,z,'#c9c4a8',.6);
  for(const a of [.42,.48])for(const b of [.12,.18])for(const z of [rise*.55-3,rise*.55])points.push(project(a,b,z));
  return {left:Math.min(...points.map(p=>p.x))-3,top:Math.min(...points.map(p=>p.y))-3,right:Math.max(...points.map(p=>p.x))+3,bottom:Math.max(...points.map(p=>p.y))+3};
}
