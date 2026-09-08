import {ELEV_PX,BRIDGE_LIFT} from './render-scale.js';
import { bridgeStyle, isPortal } from './sim/structures.js';
// The water span stays level; each dry approach blends down to the exact
// terrain edge shared with the adjoining street, including its cross-slope.
export function bridgeSurfaceHeight(r,t,x,y) {
  const s=t.structure,deck=s.elevation*ELEV_PX+BRIDGE_LIFT;
  if(!isPortal(t,s))return deck;
  const alongX=s.from.y===s.to.y;
  const low=alongX?t.x===Math.min(s.from.x,s.to.x):t.y===Math.min(s.from.y,s.to.y);
  const u=alongX?x-t.x:y-t.y;
  const blend=Math.max(0,Math.min(1,low?u:1-u));
  const edge=alongX?r.meshZ(t.x+(low?0:1),y):r.meshZ(x,t.y+(low?0:1));
  return edge+(deck-edge)*blend;
}
export function bridgePlatform(r,t) {
  const s=t?.structure;
  if(s?.kind!=='bridge')return null;
  return isPortal(t,s)?(x,y)=>bridgeSurfaceHeight(r,t,x,y):s.elevation*ELEV_PX+BRIDGE_LIFT;
}
// Each span keeps a common level. Longer bridges add trusses, then towers
// and curved suspension cables; every piece is projected in world space.
export function drawBridgeFrame(r,t) {
  const s=t.structure,alongX=s.from.y===s.to.y;
  const index=alongX?t.x-Math.min(s.from.x,s.to.x):t.y-Math.min(s.from.y,s.to.y),total=s.length+2;
  const style=bridgeStyle(s.length);
  const p=(u,v,z)=>r.project(t.x+(alongX?u:v),t.y+(alongX?v:u),z);
  for(const side of [.04,.96]) {
    r.line(p(0,side,-1),p(1,side,-1),'#686d70',3);
    r.line(p(0,side,4),p(1,side,4),'#c1c8ba',1.6);
    if(style==='truss') {
      r.line(p(0,side,12),p(1,side,12),'#7b9392',2);
      r.line(p(0,side,1),p(.5,side,12),'#7b9392',2);
      r.line(p(.5,side,12),p(1,side,1),'#7b9392',2);
    }
    if(style==='suspension') {
      const height=u=>{
        const position=index+u,near=1.5,far=total-1.5;
        if(position<near)return 6+26*position/near;
        if(position>far)return 6+26*(total-position)/near;
        return 6+26*Math.pow(2*(position-near)/(far-near)-1,2);
      };
      for(let j=0;j<4;j++)r.line(p(j/4,side,height(j/4)),p((j+1)/4,side,height((j+1)/4)),'#b7bbb4',1.8);
      r.line(p(.5,side,3),p(.5,side,height(.5)),'#a9afa6',1);
      if(index===1 || index===total-2)r.line(p(.5,side,0),p(.5,side,32),'#8d9696',4);
    }
  }
  if(index>0 && index<total-1 && (style==='beam' || index%3===1)) {
    const deck=(s.elevation*ELEV_PX+BRIDGE_LIFT),base=t.terrain==='water' ? (t.waterLevel ?? t.elev)*ELEV_PX : t.elev*ELEV_PX;
    for(const side of [.14,.86])r.line(p(.5,side,base-deck),p(.5,side,-1),'#92958b',4);
  }
}
