import {NIGHT_EXPOSURE,shadeHex} from './art-colors.js';

export const isUnderConstruction=t=>!!t.lot && !t.abandoned && t.age===0 && ['residential','commercial','industrial'].includes(t.type);

// A separate site replaces the finished building for its construction month.
// All members have physical supports; no scaffold is painted over a sprite.
export function drawConstructionSite(r,t,height) {
 const {x,y,w,h}=t.lot,points=[],rise=height+10;
 // Rotate the whole layout so the crane keeps its clearance from the frame.
 // Saved lot coordinates and variant keep the choice stable across views.
 let seed=Math.imul(x+1,73856093)^Math.imul(y+1,19349663)^Math.floor((t.variant || 0)*65536);
 seed=Math.imul(seed^(seed>>>16),2246822507);
 const side=(seed^(seed>>>13))&3;
 const turn=(a,b)=>side===0?[a,b]:side===1?[1-b,a]:side===2?[1-a,1-b]:[b,1-a];
 const viewDepth=(a,b)=>{const [u,v]=turn(a,b),p=r.orient(x+u*w,y+v*h);return p.x+p.y;};
 const tone=c=>r.night?shadeHex(c,NIGHT_EXPOSURE):c;
 const project=(a,b,z=0)=>{const [u,v]=turn(a,b),p=r.project(x+u*w,y+v*h,z);points.push(p);return p;};
 const line=(a,b,z,c,d,zz,color,width=1)=>r.line(project(a,b,z),project(c,d,zz),tone(color),width);
 const box=(a,b,ww,hh,z,depth,color)=>{
  for(const xx of [a,a+ww])for(const yy of [b,b+hh])for(const zz of [z,z+depth])project(xx,yy,zz);
  const [u,v]=turn(a,b),[uu,vv]=turn(a+ww,b+hh);
  r.box(x+Math.min(u,uu)*w,y+Math.min(v,vv)*h,Math.abs(uu-u)*w,Math.abs(vv-v)*h,depth,tone(color),z);
 };
 r.flat(x+.02*w,y+.02*h,.96*w,.96*h,0,tone('#9c9278'));
 for(const a of [.02,.98])for(const b of [.02,.98])project(a,b);
 const frame=()=>{
  box(.12,.26,.58,.6,0,2,'#aaa797');
  const top=Math.max(8,height*.6),floors=Math.max(1,Math.min(6,Math.ceil(top/12))),step=top/floors;
  for(let floor=0;floor<floors;floor++) {
   const columns=[];
   for(const a of [.14,.4,.65])for(const b of [.28,.54,.8])columns.push([a,b]);
   columns.sort((a,b)=>viewDepth(...a)-viewDepth(...b));
   for(const [a,b] of columns)box(a,b,.035,.035,2+floor*step,step,'#9a9c96');
   box(.12,.26,.58,.6,2+(floor+1)*step,1.6,'#c3c0af');
  }
 };
 const crane=()=>{
  box(.79,.09,.12,.12,0,3,'#737971');
  for(const a of [.82,.88])line(a,.15,3,a,.15,rise,'#d6b64b',1.5);
  for(let z=3;z<rise;z+=6) {
   line(.82,.15,z,.88,.15,Math.min(rise,z+6),'#bc9940',.8);
   line(.88,.15,z,.82,.15,Math.min(rise,z+6),'#bc9940',.8);
  }
  for(const z of [rise-3,rise])line(.25,.15,z,.97,.15,z,'#d6b64b',1.5);
  for(let a=.25;a<.96;a+=.09)line(a,.15,rise-3,Math.min(.97,a+.09),.15,rise,'#bc9940',.8);
  box(.91,.11,.06,.08,rise-6,3,'#696d68');
  line(.32,.15,rise-3,.32,.15,rise*.55,'#555c59',.7);
  box(.28,.11,.08,.08,rise*.55-3,3,'#929b95');
 };
 const parts=[[.41,.56,frame],[.85,.15,crane],[.8,.72,()=>{
  box(.76,.6,.14,.18,0,2,'#755c40');
  box(.77,.61,.12,.16,2,3,'#bb8e65');
 }]];
 parts.sort((a,b)=>viewDepth(a[0],a[1])-viewDepth(b[0],b[1]));
 for(const [,,draw] of parts)draw();
 return {x:Math.min(...points.map(p=>p.x))-3,y:Math.min(...points.map(p=>p.y))-3,
  w:Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))+6,
  h:Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))+6,canvas:null};
}
