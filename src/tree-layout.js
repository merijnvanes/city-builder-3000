import {random} from './architecture-variation.js';
export const treeHeight=(x,y,variant)=>13+random(x,y,variant)*9;
export function naturalTrees(t) {
 const n=Math.floor(random(t.y,t.x)*3),jx=random(t.x,t.y,11)*.4,jy=random(t.x,t.y,12)*.4,out=[];
 if(t.trees>=1)out.push([t.x+.2+jx,t.y+.3+jy,n]);
 if(t.trees>=2)out.push([t.x+.55+jy*.8,t.y+.6+jx*.8,(n+1)%3]);
 if(t.trees>=3)out.push([t.x+.65-jx*.5,t.y+.15+jy*.5,(n+2)%3]);
 return out;
}
