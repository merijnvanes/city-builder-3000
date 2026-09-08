import lighting from './sunlight-config.json' with {type:'json'};
// World-space displacement per pixel of vertical drop. Model X maps to game
// X, model Y to -game Y; the sun never depends on camera rotation.
const MODEL_Z_PX=Math.sqrt(3/4)*32/(4/Math.sqrt(2));
export const SUN = Object.freeze({x:-lighting.key[0]/(lighting.key[2]*4*MODEL_Z_PX),y:lighting.key[1]/(lighting.key[2]*4*MODEL_Z_PX)});
export function faceLight(nx,ny,nz=0) {
 const light=[lighting.key[0],-lighting.key[1],lighting.key[2]],length=Math.hypot(...light);
 return .72+.38*Math.max(0,(nx*light[0]+ny*light[1]+nz*light[2])/length);
}
export const SHADOW_ALPHA = .24;
export function shadowPoint(x,y,z,receiverZ=0) {
 const drop=Math.max(0,z-receiverZ);
 return [x+SUN.x*drop,y+SUN.y*drop,receiverZ];
}
const value=(plane,p)=>plane[0]*p[0]+plane[1]*p[1]+plane[2]*p[2]+plane[3];
// Eliminate the ray parameter from ray/box intersection. Every lower bound
// must be <= every upper bound. This gives the half-spaces of the complete
// shadow volume, including its height cap, rather than a ground-only decal.
export function shadowPlanes(box) {
 const lower=[[0,0,0,0]],upper=[],planes=[],direction=[-SUN.x,-SUN.y,1];
 const lo=[box.x,box.y,box.z],hi=[box.x+box.w,box.y+box.d,box.z+box.h];
 for(let axis=0;axis<3;axis++) {
  const d=direction[axis];
  if(!d) {const a=[0,0,0,-lo[axis]],b=[0,0,0,hi[axis]];a[axis]=1;b[axis]=-1;planes.push(a,b);continue;}
  const a=[0,0,0,(d>0?lo[axis]:hi[axis])/d],b=[0,0,0,(d>0?hi[axis]:lo[axis])/d];
  a[axis]=b[axis]=-1/d;lower.push(a);upper.push(b);
 }
 for(const a of lower)for(const b of upper)planes.push(b.map((v,i)=>v-a[i]));
 return planes;
}
export function clipShadow(polygon,planes) {
 let out=polygon;
 for(const plane of planes) {
  if(!out.length)break;
  const input=out;out=[];
  let a=input.at(-1),da=value(plane,a);
  for(const b of input) {
   const db=value(plane,b),insideA=da>=-1e-7,insideB=db>=-1e-7;
   if(insideA!==insideB) {const t=da/(da-db);out.push(a.map((v,i)=>v+(b[i]-v)*t));}
   if(insideB)out.push(b);
   a=b;da=db;
  }
 }
 return out;
}
export const groundQuad=(x,y,w,d,z)=>[[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z]];
export function boxFaces(box,r) {
 const {x,y,z,w,d,h}=box,top=z+h;
 const faces=[
  {normal:[0,-1,0],points:[[x,y,z],[x+w,y,z],[x+w,y,top],[x,y,top]]},
  {normal:[1,0,0],points:[[x+w,y,z],[x+w,y+d,z],[x+w,y+d,top],[x+w,y,top]]},
  {normal:[0,1,0],points:[[x+w,y+d,z],[x,y+d,z],[x,y+d,top],[x+w,y+d,top]]},
  {normal:[-1,0,0],points:[[x,y+d,z],[x,y,z],[x,y,top],[x,y+d,top]]},
 ];
 const origin=r.orient(0,0);
 return [...faces.filter(f=>{const p=r.orient(f.normal[0],f.normal[1]);return p.x+p.y>origin.x+origin.y;}),{normal:[0,0,1],points:groundQuad(x,y,w,d,top)}];
}
