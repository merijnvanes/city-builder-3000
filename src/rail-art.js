import { carriesRoute } from './sim/catalog.js';

const DIRECTIONS = [[1,0],[0,1],[-1,0],[0,-1]];
export function railConnections(t, city) {
  return DIRECTIONS.map(([dx,dy]) => {
    const x=t.x+dx, y=t.y+dy;
    return x>=0 && y>=0 && x<city.size && y<city.size && carriesRoute(city.tiles[y*city.size+x], 'rail');
  });
}

// Centerlines end only at connected edges. A two-arm bend has tangent-aligned
// approaches, so sleepers and both rails follow the same continuous curve.
export function railPaths(joins) {
  const arms = DIRECTIONS.filter((_,i)=>joins[i]);
  const edge = ([dx,dy]) => ({x:.5+dx*.5,y:.5+dy*.5});
  const center = {x:.5,y:.5};
  const line = (a,b) => Array.from({length:9},(_,i)=>({x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8}));
  if (!arms.length) return [line({x:.32,y:.5},{x:.68,y:.5})];
  if (arms.length===1) return [line(center,edge(arms[0]))];
  if (arms.length===2) {
    const [a,b]=arms.map(edge);
    if (arms[0][0]+arms[1][0]===0 && arms[0][1]+arms[1][1]===0) return [line(a,b)];
    return [Array.from({length:17},(_,i)=>{
      const u=i/16,v=1-u;
      return {x:v*v*a.x+2*v*u*center.x+u*u*b.x,y:v*v*a.y+2*v*u*center.y+u*u*b.y};
    })];
  }
  return arms.map(a=>line(center,edge(a)));
}

export function drawRail(r,t,city,{crossing=false}={}) {
  const {x,y}=t, joins=railConnections(t,city);
  if (!crossing) {
    r.flat(x+.015,y+.015,.97,.97,.3,'#857f67');
    r.flat(x+.1,y+.1,.8,.8,.4,'#736e5c');
  }
  for(const points of railPaths(joins)) {
    const rails=[[],[]];
    let sleeperDistance=0;
    for(let i=0;i<points.length;i++) {
      const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
      const length=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;
      for(let side=0;side<2;side++) {
        const sign=side?1:-1;
        rails[side].push(r.project(x+p.x+nx*.18*sign,y+p.y+ny*.18*sign,1));
      }
      if(i) sleeperDistance+=Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y);
      if(i===0 || sleeperDistance>=.12) {
        r.line(r.project(x+p.x-nx*.28,y+p.y-ny*.28,.6),r.project(x+p.x+nx*.28,y+p.y+ny*.28,.6),'#514c3f',2);
        sleeperDistance=0;
      }
    }
    for(const rail of rails) for(let i=1;i<rail.length;i++) r.line(rail[i-1],rail[i],'#b5b7a5',1);
  }
  if(t.terrain==='water') {
    const alongX=joins[0] || joins[2];
    for(const side of [.055,.94]) r.line(r.project(x+(alongX?0:side),y+(alongX?side:0),4),r.project(x+(alongX?1:side),y+(alongX?side:1),4),'#b9bda8',1.7);
  }
}

export function railPosition(points, fraction) {
  const offset=Math.max(0,Math.min(1,fraction))*(points.length-1);
  const i=Math.min(points.length-2,Math.floor(offset)), u=offset-i;
  const a=points[i],b=points[i+1],length=Math.hypot(b.x-a.x,b.y-a.y);
  return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,dx:(b.x-a.x)/length,dy:(b.y-a.y)/length};
}

export function drawTrain(r,t,city,fraction) {
  const paths=railPaths(railConnections(t,city));
  const p=railPosition(paths[(t.x+t.y)%paths.length],fraction), ctx=r.ctx;
  const corners=[[-.11,-.055],[.11,-.055],[.11,.055],[-.11,.055]].map(([along,across])=>({x:t.x+p.x+p.dx*along-p.dy*across,y:t.y+p.y+p.dy*along+p.dx*across}));
  const bottom=corners.map(q=>r.project(q.x,q.y,1)),top=corners.map(q=>r.project(q.x,q.y,4));
  for(let i=0;i<4;i++) { const j=(i+1)%4; r.poly([bottom[i],bottom[j],top[j],top[i]],'#78694d',null,ctx); }
  r.poly(top,'#d0ab54',null,ctx);
}
