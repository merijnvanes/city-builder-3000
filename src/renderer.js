import {shadowScene} from './shadow-scene.js';
import {drawTerrainShadows,drawShadedArchitecture} from './shadow-paint.js';
import {sceneItems} from './scene-items.js';
import {recordTreePicks} from './foliage.js';
import {naturalTrees} from './tree-layout.js';
import {shadowPoint,faceLight} from './sunlight.js';
import {terrainVertexHeight,drawLotFoundation,hitFoundation} from './lot-foundations.js';
import {TILE_W,TILE_H,ELEV_PX} from './render-scale.js';
import {pickMapSurface} from './surface-picking.js';
import {deckKind,lotPlatform} from './deck-geometry.js';
import {drawDeck,buildDeckTrafficMask,beginDeckTraffic,compositeDeckTraffic} from './deck-scene.js';
import {drawTraffic,drawTrains} from './traffic-art.js';
import {drawFires,drawHazards} from './disaster-art.js';
import {drawMapLabels} from './map-labels.js';
import {waterSurface} from './sim/surface-water.js';
import {waterGeometry,waterHeightAt,isWaterPoint,waterPath} from './water-geometry.js';
import {drawRail} from './rail-art.js';
import {withGroundClip} from './ground-effects.js';
import {drawMapBackdrop,drawBoat,drawOutageMarkers,drawAirplane} from './scene-art.js';
import {hitUncachedArchitecture} from './architecture-cache.js';
import {drawZoneMarker,heightOf,random} from './building-art.js';
import {BUILDINGS,PORT_TYPES,ROAD_TYPES,ZONED_TYPES} from './sim/catalog.js';
import {drawTree} from './foliage.js';
import {drawTerrainSurface} from './terrain-art.js';
import {drawStreet,hasStreetLamp,drawStreetLamp,tunnelPortal,drawTunnelMouth} from './street-art.js';

// Isometric Canvas 2D renderer. The static picture is two cached layers, see
// scene-items.js: the ground (terrain, water, streets, markings, shadows) and
// the ordered scene items above it. Both repaint when the city revision or
// the camera changes. Vehicles, water sparkle, hazards and the construction
// preview are drawn every frame on top.

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const parseHex=hex=>{const n=parseInt(hex.slice(1,7),16);return [n>>16,(n>>8)&255,n&255];};
const shade=(hex,k)=>'rgb('+parseHex(hex).map(v=>clamp(v*k,0,255)|0).join(',')+')';
const blend=(c,[r,g,b],amount)=>[c[0]+(r-c[0])*amount,c[1]+(g-c[1])*amount,c[2]+(b-c[2])*amount];
// The fills the ground cache receives at night and under a data map.
const NIGHT_TINT={color:[16,40,66],alpha:0x88/255},OVERLAY_TINT={color:[26,34,42],alpha:0x55/255};
const ZONE_TINT={
  residential:{fill:'#7ed05a77',edge:'#dcf7b0'},
  commercial:{fill:'#5aa0e077',edge:'#c8e4ff'},
  industrial:{fill:'#e0c04a77',edge:'#fff0b0'},
  airport:{fill:'#9aa2b077',edge:'#dfe4ec'},
  seaport:{fill:'#4fa8b077',edge:'#c4ecef'},
};

export const OVERLAYS=['none','power','water','landvalue','pollution','crime','traffic','police','fire','health','education','garbage'];

export class CityRenderer {
  constructor(canvas) {
    this.canvas=canvas;
    this.ctx=canvas.getContext('2d');
    this.cache=document.createElement('canvas');
    this.ground=document.createElement('canvas');
    this.base=this.cache.getContext('2d');
    this.zoom=1;this.panX=0;this.panY=0;this.rotation=0;this.size=64;
    this.hover=null;this.preview=null;this.tool='inspect';this.overlay='none';this.night=false;
    this.dirty=true;this.lastRevision=-1;this.w=0;this.h=0;this.sorted=[];
    this.minZoom=0.3;this.maxZoom=2.8;
    // A city view can be turned, and each angle is a different set of sprites.
    // Say so, and the sprite cache warms the other three while the browser is
    // idle. Portraits and offscreen probes build renderers without this
    // constructor and stay lean, because they never rotate.
    this.warmRotations=true;
    this.corners=null;this.platform=null;this.tiles=null;
    this.resizeObserver=new ResizeObserver(()=>this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  get size() {return this._size || 64;}
  set size(value) {
    if(this._size!==value){this.corners=null;this.tiles=null;}
    this._size=value;
  }

  // Floating controls leave the city centered in the viewport.
  get cx() {return this.w*0.5;}
  get cy() {return this.h*0.5;}

  resize() {
    const rect=this.canvas.getBoundingClientRect();
    this.w=rect.width;this.h=rect.height;
    this.dpr=Math.min(devicePixelRatio || 1,2);
    for(const c of [this.canvas,this.cache,this.ground]){c.width=Math.round(this.w*this.dpr);c.height=Math.round(this.h*this.dpr);}
    this.dirty=true;
  }

  home() {
    const n=this.size || 64;
    this.zoom=clamp((this.w-220)/(n*TILE_W*1.15),0.45,1.1);
    this.panX=0;this.panY=0;this.dirty=true;
  }

  // ── Camera ────────────────────────────────────────────────────
  orient(x,y) {
    const n=this.size || 64;
    switch(this.rotation || 0) {
      case 1:return {x:n-y,y:x};
      case 2:return {x:n-x,y:n-y};
      case 3:return {x:y,y:n-x};
      default:return {x,y};
    }
  }
  unorient(x,y) {
    const n=this.size || 64;
    switch(this.rotation || 0) {
      case 1:return {x:y,y:n-x};
      case 2:return {x:n-x,y:n-y};
      case 3:return {x:n-y,y:x};
      default:return {x,y};
    }
  }
  // Terrain height in pixels (zoom 1) under map point (x, y). Ground is
  // interpolated between corner heights; while a platform is set, the point
  // stands on that surface (a graded pad, a deck) instead of the mesh.
  groundZ(x,y) {
    if(this.platform!=null)return typeof this.platform==='function'?this.platform(x,y):this.platform;
    const tx=Math.max(0,Math.min(this.size-1,Math.floor(x))),ty=Math.max(0,Math.min(this.size-1,Math.floor(y)));
    const tile=this.tiles?.[ty*this.size+tx];
    if(x>=0 && y>=0 && x<=this.size && y<=this.size && tile) {
      const geometry=waterGeometry(this,tile);if(geometry)return waterHeightAt(geometry,x,y);
    }
    return this.meshZ(x,y);
  }
  meshZ(x,y) {
    const c=this.corners;
    if(!c)return 0;
    const n=this.size || 64;
    const fx=Math.max(0,Math.min(n-1e-6,x)),fy=Math.max(0,Math.min(n-1e-6,y));
    const ix=Math.floor(fx),iy=Math.floor(fy),u=fx-ix,v=fy-iy;
    const w=n+1;
    const z00=c[iy*w+ix],z10=c[iy*w+ix+1],z01=c[(iy+1)*w+ix],z11=c[(iy+1)*w+ix+1];
    return (z00*(1-u)+z10*u)*(1-v)+(z01*(1-u)+z11*u)*v;
  }
  // Average the elevation of the tiles around every vertex.
  buildCorners(city) {
    const n=city.size,w=n+1;
    const c=new Float32Array(w*w);
    for(let vy=0;vy<=n;vy++) {
      for(let vx=0;vx<=n;vx++) {
        c[vy*w+vx]=terrainVertexHeight(city,vx,vy);
      }
    }
    const boundary=[];
    for(let i=0;i<=n;i++)boundary.push(c[i],c[n*w+i],c[i*w],c[i*w+n]);
    for(let i=0;i<n;i++)for(const index of [i,(n-1)*n+i,i*n,i*n+n-1]) {
      const t=city.tiles[index];boundary.push(t.terrain==='water'?waterSurface(t):t.elev);
    }
    const boundaryKey=boundary.join(',');
    if(boundaryKey!==this.terrainBoundaryKey)this.terrainBoundaryRevision=(this.terrainBoundaryRevision || 0)+1;
    this.terrainBoundaryKey=boundaryKey;
    this.corners=c;
    this.cornerRevision=city.revision;
    this.tiles=city.tiles;
    this.hasDecks=city.tiles.some(t=>deckKind(t));
    this.hasWater=city.tiles.some(t=>t.terrain==='water');
  }
  project(x,y,z=0) {
    const p=this.orient(x,y);
    return {x:this.cx+this.panX+(p.x-p.y)*TILE_W*this.zoom,y:this.cy+this.panY+(p.x+p.y-(this.size || 64))*TILE_H*this.zoom-(z+this.groundZ(x,y))*this.zoom};
  }
  projectGround(x,y) {
    const platform=this.platform;
    this.platform=null;
    try {return this.project(x,y);}
    finally {this.platform=platform;}
  }
  pickFlat(sx,sy) {
    const dx=(sx-this.cx-this.panX)/(TILE_W*this.zoom);
    const dy=(sy-this.cy-this.panY)/(TILE_H*this.zoom)+(this.size || 64);
    const p=this.unorient((dx+dy)/2,(dy-dx)/2);
    return {x:Math.floor(p.x),y:Math.floor(p.y)};
  }
  // Underground tools select the ground beneath a deck, never the deck.
  picksDecks() {
    return !!this.hasDecks && this.overlay!=='water' && !['pipe','subway','substation'].includes(this.tool);
  }
  // Hills lift tiles on screen, so refine the flat guess with the height
  // under it a few times.
  pick(sx,sy) {
    let p=this.pickFlat(sx,sy);
    if(!this.corners)return p;
    const decks=this.picksDecks();
    if(this.hasWater || decks) {
      const hit=pickMapSurface(this,sx,sy,decks);if(hit)return hit;
    }
    for(let i=0;i<3;i++) {
      const z=this.groundZ(p.x+0.5,p.y+0.5)*this.zoom;
      const q=this.pickFlat(sx,sy+z);
      if(q.x===p.x && q.y===p.y)break;
      p=q;
    }
    return p;
  }
  // Front-to-back alpha picking selects the visible roof or facade, rather
  // than the ground tile several blocks behind a tall building.
  pickObject(sx,sy) {
    if(this.dirty || !this.pickables || this.overlay==='water' || ['pipe','subway','substation'].includes(this.tool))return this.pick(sx,sy);
    for(let i=this.pickables.length-1;i>=0;i--) {
      const hit=this.pickables[i];
      if(sx<hit.x || sy<hit.y || sx>=hit.x+hit.w || sy>=hit.y+hit.h)continue;
      let opaque;
      if(hit.polygons)opaque=hitFoundation(hit.polygons,sx,sy);
      else if(hit.canvas) {
        const source=hit.source || {x:0,y:0,w:hit.canvas.width,h:hit.canvas.height};
        const px=source.x+Math.min(source.w-1,Math.floor((sx-hit.x)/hit.w*source.w));
        const py=source.y+Math.min(source.h-1,Math.floor((sy-hit.y)/hit.h*source.h));
        opaque=hit.canvas.getContext('2d').getImageData(px,py,1,1).data[3]>24;
      } else opaque=hitUncachedArchitecture(this,hit.t,sx,sy);
      if(opaque)return {x:hit.t.x,y:hit.t.y};
    }
    return this.pick(sx,sy);
  }

  zoomAt(delta,sx=this.cx,sy=this.cy) {
    const old=this.zoom;
    this.zoom=clamp(this.zoom*Math.exp(delta),this.minZoom,this.maxZoom);
    const k=this.zoom/old;
    this.panX=sx-this.cx-(sx-this.cx-this.panX)*k;
    this.panY=sy-this.cy-(sy-this.cy-this.panY)*k;
    this.dirty=true;
  }
  rotate(delta=1) {
    const p=this.pick(this.cx,this.cy);
    this.rotation=((this.rotation+delta)%4+4)%4;
    const target=this.project(p.x+0.5,p.y+0.5);
    this.pan(this.cx-target.x,this.cy-target.y);
    this.dirty=true;
  }
  pan(dx,dy) {this.panX+=dx;this.panY+=dy;this.dirty=true;}

  // Painter's key: the front-most corner of a tile or lot in the current orientation.
  depthKey(x,y,w=1,h=1) {
    let best=-Infinity;
    for(const [cx,cy] of [[x,y],[x+w-1,y],[x,y+h-1],[x+w-1,y+h-1]]) {
      const p=this.orient(cx+0.5,cy+0.5);
      if(p.x+p.y>best)best=p.x+p.y;
    }
    return best;
  }

  // ── Primitives (tile units, z in pixels at zoom 1) ────────────
  poly(points,fill,stroke,ctx=this.base) {
    ctx.beginPath();
    points.forEach((p,i)=>(i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)));
    ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    if(stroke){ctx.lineWidth=0.65*this.zoom;ctx.strokeStyle=stroke;ctx.stroke();}
  }
  flat(x,y,w,d,z,color,stroke,ctx=this.base) {
    this.poly([this.project(x,y,z),this.project(x+w,y,z),this.project(x+w,y+d,z),this.project(x,y+d,z)],color,stroke,ctx);
  }
  highlightTile(x,y,z,fill,stroke,ctx) {
    const t=this.tiles?.[y*this.size+x],geometry=t && waterGeometry(this,t);
    if(!geometry || this.platform!=null)return this.flat(x,y,1,1,z,fill,stroke,ctx);
    const old=this.platform;this.platform=0;
    try {
      if(fill){waterPath(this,ctx,[...geometry.wet,...geometry.dry].map(p=>p.map(([x,y,h])=>[x,y,h+z])));ctx.fillStyle=fill;ctx.fill();}
      this.poly(geometry.boundary.map(([x,y,h])=>this.project(x,y,h+z)),null,stroke,ctx);
    } finally {this.platform=old;}
  }
  faces(x,y,w,d,h,z=0) {
    const p=(a,b,c)=>this.project(a,b,c);
    const all={
      southwest:[p(x,y+d,z+h),p(x+w,y+d,z+h),p(x+w,y+d,z),p(x,y+d,z)],
      southeast:[p(x+w,y,z+h),p(x+w,y+d,z+h),p(x+w,y+d,z),p(x+w,y,z)],
      northeast:[p(x,y,z+h),p(x+w,y,z+h),p(x+w,y,z),p(x,y,z)],
      northwest:[p(x,y,z+h),p(x,y+d,z+h),p(x,y+d,z),p(x,y,z)],
    };
    return [['southwest','southeast'],['southeast','northeast'],['northeast','northwest'],['northwest','southwest']][this.rotation || 0].map((name)=>({name,points:all[name]}));
  }
  box(x,y,w,d,h,color,z=0) {
    for(const face of this.faces(x,y,w,d,h,z)) {
      const normal={southeast:[1,0],northwest:[-1,0],northeast:[0,-1],southwest:[0,1]}[face.name],exposure=faceLight(...normal);
      const top=Math.min(...face.points.map(p=>p.y)),bottom=Math.max(...face.points.map(p=>p.y));
      const light=this.base.createLinearGradient(0,top,0,Math.max(top+1,bottom));
      light.addColorStop(0,shade(color,exposure));
      light.addColorStop(1,shade(color,exposure*.78));
      this.poly(face.points,light);
    }
    this.flat(x,y,w,d,z+h,shade(color,1.09));
  }
  roof(x,y,w,d,z,h,color) {
    const p=(a,b,c)=>this.project(a,b,c);
    const a=p(x,y,z),b=p(x+w,y,z),c=p(x+w,y+d,z),e=p(x,y+d,z),r1=p(x+w/2,y,z+h),r2=p(x+w/2,y+d,z+h);
    const polys=[{p:[a,r1,r2,e],c:shade(color,0.82)},{p:[r1,b,c,r2],c:shade(color,1.12)},{p:[a,b,r1],c:shade(color,0.72)},{p:[e,c,r2],c:shade(color,0.92)}];
    polys.sort((m,n)=>m.p.reduce((s,q)=>s+q.y,0)/m.p.length-n.p.reduce((s,q)=>s+q.y,0)/n.p.length);
    for(const face of polys)this.poly(face.p,face.c);
  }
  // Hip roof: four faces rising to a short ridge (or an apex when ridge is 0).
  pyramid(x,y,w,d,z,h,color,ridge=0) {
    const p=(a,b,c)=>this.project(a,b,c);
    const a=p(x,y,z),b=p(x+w,y,z),c=p(x+w,y+d,z),e=p(x,y+d,z);
    const r1=p(x+w/2-ridge/2,y+d/2,z+h),r2=p(x+w/2+ridge/2,y+d/2,z+h);
    const faces=[{p:[a,b,r2,r1],c:shade(color,0.78)},{p:[b,c,r2],c:shade(color,1.1)},{p:[c,e,r1,r2],c:shade(color,0.95)},{p:[e,a,r1],c:shade(color,0.7)}];
    faces.sort((m,n)=>m.p.reduce((s,q)=>s+q.y,0)/m.p.length-n.p.reduce((s,q)=>s+q.y,0)/n.p.length);
    for(const f of faces)this.poly(f.p,f.c);
  }
  cylinder(x,y,radius,h,color,z=0) {
    const p=this.project(x,y,z+h),b=this.project(x,y,z),rx=radius*43*this.zoom,ry=radius*23*this.zoom,ctx=this.base;
    ctx.beginPath();ctx.ellipse(b.x,b.y,rx,ry,0,0,Math.PI);ctx.lineTo(p.x-rx,p.y);ctx.ellipse(p.x,p.y,rx,ry,0,Math.PI,0);ctx.closePath();
    const g=ctx.createLinearGradient(p.x-rx,0,p.x+rx,0);
    const origin=this.unorient(0,0);
    for(const f of [0,.25,.5,.75,1]) {
      const u=f*2-1,v=Math.sqrt(1-u*u),n=this.unorient((u+v)/Math.SQRT2,(v-u)/Math.SQRT2);
      g.addColorStop(f,shade(color,faceLight(n.x-origin.x,n.y-origin.y)));
    }
    ctx.fillStyle=g;ctx.fill();
    ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=shade(color,1.13);ctx.fill();
  }
  line(a,b,color,width=1,ctx=this.base) {
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=color;ctx.lineWidth=width*this.zoom;ctx.stroke();
  }
  fence(x,y,w,d,color) {
    this.line(this.project(x,y,3),this.project(x+w,y+d,3),color,0.8);
    for(let a=0;a<=1;a+=0.12)this.line(this.project(x+w*a,y+d*a),this.project(x+w*a,y+d*a,5),color,0.6);
  }
  tree(x,y,n=0) {drawTree(this,x,y,n);}
  windows(x,y,w,d,h,seed,glass=false,base=0,lit=true,floorHeight=8) {
    if(this.zoom<0.5)return;
    const faces=this.faces(x,y,w,d,h,base);
    const sill=Math.min(3,floorHeight*0.35),paneHeight=Math.min(3.3,floorHeight*0.5);
    const rows=Math.max(1,Math.floor((h-sill-paneHeight)/floorHeight)+1);
    for(const face of faces) {
      const alongX=face.name==='southwest' || face.name==='northeast',length=alongX?w:d,cols=Math.max(1,Math.min(7,Math.floor(length*7)));
      for(let row=0;row<rows;row++) {
        for(let col=0;col<cols;col++) {
          const z=base+sill+row*floorHeight,offset=0.055+col*(length-0.1)/cols,span=((length-0.12)/cols)*0.66;
          const a=alongX?x+offset:face.name==='southeast'?x+w+0.002:x-0.002;
          const b=alongX?(face.name==='southwest'?y+d+0.002:y-0.002):y+offset;
          const on=this.night && lit && random(seed+row,col)>0.35;
          const reflect=row/Math.max(1,rows-1);
          const color=on?(random(seed,row,col)>0.6?'#ffe5aa':'#d8b97c'):glass?shade('#85b2c1',(0.48+reflect*0.5+random(seed,col)*0.12)*(this.night?0.42:1)):this.night?'#223039':'#3d5359';
          const points=[this.project(a,b,z+paneHeight),this.project(a+(alongX?span:0),b+(alongX?0:span),z+paneHeight),this.project(a+(alongX?span:0),b+(alongX?0:span),z),this.project(a,b,z)];
          this.poly(points,color);
        }
      }
    }
  }

  // The tint a ground-like surface gets in the object layer, matching the
  // night and data-map fills painted over the ground cache.
  groundTone(color) {
    if((!this.night && this.overlay==='none') || typeof color!=='string' || color[0]!=='#')return color;
    let c=parseHex(color);
    if(this.night)c=blend(c,NIGHT_TINT.color,NIGHT_TINT.alpha);
    if(this.overlay!=='none')c=blend(c,OVERLAY_TINT.color,OVERLAY_TINT.alpha);
    return 'rgb('+c.map(v=>Math.round(v)).join(',')+')';
  }

  // ── Ground ────────────────────────────────────────────────────
  // Slope lighting: faces toward the northern key light are brighter.
  slopeShade(x,y) {
    const c=this.corners;
    if(!c)return 1;
    const w=(this.size || 64)+1,i=y*w+x;
    const ew=(c[i]+c[i+w])-(c[i+1]+c[i+w+1]);
    const ns=(c[i]+c[i+1])-(c[i+w]+c[i+w+1]);
    return clamp(1+(ew*0.5+ns*0.35)/ELEV_PX*0.11,0.8,1.2);
  }
  terrain(t,city) {
    const platform=this.platform;
    this.platform=null;
    try {this.paintTerrain(t,city);}
    finally {this.platform=platform;}
  }
  paintTerrain(t,city) {
    const {x,y}=t,water=t.terrain==='water';
    const coast=waterGeometry(this,t);
    // Land is lit by its slope, or brightened a little on high ground.
    let k=this.slopeShade(x,y);
    if(k===1 && !water && t.elev>=5)k=1+(t.elev-4)*0.03;
    drawTerrainSurface(this,t,city,k);
    // A graded site's pad covers this tile; see scene-items.js.
    if(t.lot && !water)return;
    if(!coast && !water && t.type==='empty' && !t.trees)for(let i=0;i<3;i++){const a=random(x,y,i+1),b=random(y,x,i+7);this.flat(x+a*0.85,y+b*0.85,0.1,0.045,0.05,'#a8ae642b');}
    if(this.tool!=='inspect' && !water && this.zoom>0.55) {
      if(coast) {
        const old=this.platform;this.platform=0;this.poly(coast.boundary.map(([x,y,z])=>this.project(x,y,z+.1)),null,'#344b2833');this.platform=old;
      } else this.flat(x,y,1,1,0.1,null,'#344b2833');
    }
    if(ZONED_TYPES.has(t.type) && !t.lot)drawZoneMarker(this,t);
    if(!ROAD_TYPES.has(t.type) || t.structure?.kind==='bridge')return;
    // A viaduct carries a street or track beneath it; the deck is a scene item.
    if(t.under===1){drawStreet(this,t,city,{as:'road'});return;}
    if(t.under===2) {
      if(t.type==='road'){drawStreet(this,t,city);drawRail(this,t,city,{crossing:true});}
      else drawRail(this,t,city);
      return;
    }
    if(deckKind(t))return;
    if(t.type==='rail')drawRail(this,t,city);else drawStreet(this,t,city);
  }

  powerline(t,city) {
    const {x,y}=t,p=this.project(x+0.5,y+0.5,24);
    this.line(this.project(x+0.5,y+0.5),p,'#615b47',1.8);
    this.line({x:p.x-5*this.zoom,y:p.y},{x:p.x+5*this.zoom,y:p.y},'#918a6e',1.2);
    for(const [dx,dy] of [[1,0],[0,1]]) {
      const other=city.tiles[(y+dy)*city.size+x+dx];
      if(x+dx>=city.size || y+dy>=city.size || !other?.powerline)continue;
      const q=this.project(x+dx+0.5,y+dy+0.5,24);
      for(const shift of [-2,2]) {
        const ctx=this.base;
        ctx.beginPath();ctx.moveTo(p.x+shift*this.zoom,p.y);
        ctx.quadraticCurveTo((p.x+q.x)/2+shift*this.zoom,(p.y+q.y)/2+5*this.zoom,q.x+shift*this.zoom,q.y);
        ctx.strokeStyle='#3f4940';ctx.lineWidth=0.6*this.zoom;ctx.stroke();
      }
    }
  }
  pipe(t,city) {
    const {x,y}=t,center=this.project(x+0.5,y+0.5,0.9);
    let any=false;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      if(x+dx<0 || y+dy<0 || x+dx>=city.size || y+dy>=city.size)continue;
      const n=city.tiles[(y+dy)*city.size+x+dx];
      if(!n.pipe && !BUILDINGS[n.type]?.waterOut)continue;
      any=true;
      this.line(center,this.project(x+0.5+dx*0.5,y+0.5+dy*0.5,0.9),t.watered?'#66d0ed':'#7598a9',4);
    }
    if(!any)this.flat(x+0.4,y+0.4,0.2,0.2,0.9,t.watered?'#66d0ed':'#7598a9');
  }
  subway(t,city) {
    const {x,y}=t,center=this.project(x+0.5,y+0.5,0.9);
    let any=false;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      if(x+dx<0 || y+dy<0 || x+dx>=city.size || y+dy>=city.size)continue;
      const n=city.tiles[(y+dy)*city.size+x+dx];
      if(!n.subway && n.type!=='substation')continue;
      any=true;
      this.line(center,this.project(x+0.5+dx*0.5,y+0.5+dy*0.5,0.9),'#e0a83a',5);
      this.line(center,this.project(x+0.5+dx*0.5,y+0.5+dy*0.5,0.9),'#5a4a2a',1.5);
    }
    if(!any)this.flat(x+0.35,y+0.35,0.3,0.3,0.9,'#e0a83a');
  }

  // Data maps: dim the world and tint only the tiles that carry a value.
  heatColor(t) {
    const o=this.overlay;
    if(t.terrain==='water' && !deckKind(t) && o!=='pollution')return null;
    if(o==='power')return t.powered?'#dbe64488':(t.lot || t.type!=='empty')?'#db5b40aa':null;
    if(o==='water')return t.watered?'#469bdbaa':(t.lot || t.type!=='empty')?'#bd7045aa':null;
    if(o==='landvalue')return 'hsla('+(t.landValue*1.2)+',65%,48%,.6)';
    // Contaminated ground reads as a sickly green wherever pollution is shown.
    if(o==='pollution' && t.radiation)return 'hsla(96,90%,45%,.75)';
    // Same red-to-green ramp as land value, so the two maps read alike.
    if(o==='aura')return 'hsla('+((t.aura ?? 50)*1.2)+',62%,50%,.55)';
    if(['police','fire','health','education'].includes(o)){const v=t.svc?.[o] || 0;return v?'hsla('+(60+v*0.6)+',70%,50%,'+(0.15+v/160)+')':null;}
    if(o==='transit'){const v=(t.svc?.rail || 0)+(t.svc?.bus || 0);return v?'hsla(200,70%,55%,'+(0.1+Math.min(1,v/100)*0.4)+')':null;}
    const value=t[o] || 0;
    if(value<=0)return null;
    return 'hsla('+(60-value*0.6)+',80%,50%,'+(0.25+value/160)+')';
  }

  // Centre the camera on a tile, optionally at a zoom level.
  focusOn(x,y,zoom) {
    if(zoom)this.zoom=clamp(zoom,this.minZoom,this.maxZoom);
    this.panX=0;this.panY=0;
    const p=this.project(x+0.5,y+0.5);
    this.panX=this.cx-p.x;
    this.panY=this.cy-p.y;
    this.dirty=true;
  }

  // ── Static layers ─────────────────────────────────────────────
  visible(x,y) {
    const p=this.project(x,y);
    return p.x>-260*this.zoom && p.x<this.w+260*this.zoom && p.y>-80*this.zoom && p.y<this.h+420*this.zoom;
  }
  paint(city) {
    this.paintEpoch=(this.paintEpoch || 0)+1;
    this.pickables=[];
    this.size=city.size;
    if(!this.corners || this.tiles!==city.tiles || city.revision!==this.cornerRevision)this.buildCorners(city);
    this.shadowScene=shadowScene(this,city);
    const ctx=this.base;
    ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
    ctx.clearRect(0,0,this.w,this.h);
    drawMapBackdrop(this,city);

    // Terrain order only depends on the grid and orientation, not camera motion.
    if(this.sortedTiles!==city.tiles || this.sortedRotation!==this.rotation) {
      this.sorted=city.tiles.map(t=>({t,k:this.depthKey(t.x,t.y)}))
        .sort((a,b)=>a.k-b.k).map(entry=>entry.t);
      this.sortedTiles=city.tiles;this.sortedRotation=this.rotation;
    }
    // The ground: every surface on the terrain mesh, in terrain paint order.
    for(const t of this.sorted)if(this.visible(t.x+0.5,t.y+0.5)) {
      this.terrain(t,city);
      if(!(t.lot && t.terrain!=='water'))drawTerrainShadows(this,t,city);
    }
    if(this.night) {
      ctx.fillStyle='#10284288';ctx.fillRect(0,0,this.w,this.h);
    }
    if(this.night && this.zoom>0.5)withGroundClip(this,()=>{
      for(const t of this.sorted)if(hasStreetLamp(t) && this.visible(t.x,t.y))drawStreetLamp(this,t,true);
    });

    if(this.overlay!=='none') {
      ctx.fillStyle='#1a222a55';
      ctx.fillRect(0,0,this.w,this.h);
      for(const t of this.sorted){const c=this.heatColor(t);if(c)this.flat(t.x,t.y,1,1,0.5,c);}
    }
    const showSubway=this.overlay==='transit' || this.tool==='subway' || this.tool==='substation';
    const showPipes=this.overlay==='water' || this.tool==='pipe' || showSubway;
    if(this.overlay==='water' || this.tool==='pipe')for(const t of this.sorted)if(t.pipe)this.pipe(t,city);
    if(showSubway)for(const t of this.sorted)if(t.subway || t.type==='substation')this.subway(t,city);

    const ground=this.ground.getContext('2d');
    ground.clearRect(0,0,this.ground.width,this.ground.height);
    ground.drawImage(this.cache,0,0);
    ctx.clearRect(0,0,this.w,this.h);
    if(showPipes)ctx.globalAlpha=0.3;

    // The scene items: everything that rises above the mesh, in footprint order.
    this.deckSpriteIndex=0;
    if(this.itemTiles!==city.tiles || this.itemRevision!==city.revision || this.itemRotation!==this.rotation) {
      this.items=sceneItems(this,city);
      const lots=this.items.filter(it=>it.kind==='lot').map(it=>it.t);
      this.flightAltitude=lots.reduce((height,t)=>Math.max(height,heightOf(t)*1.7+80+t.elev*ELEV_PX),210);
      this.outages=lots.filter(t=>!t.powered && !t.abandoned && (ZONE_TINT[t.type] || BUILDINGS[t.type]?.powerUse)).map(t=>({t,height:heightOf(t)}));
      this.itemTiles=city.tiles;this.itemRevision=city.revision;this.itemRotation=this.rotation;
    }
    for(const it of this.items)if(this.visible(it.x+it.w/2,it.y+it.h/2))this.paintItem(it,city);
    buildDeckTrafficMask(this,city);
    ctx.globalAlpha=1;
    this.lastRevision=city.revision;
    this.dirty=false;
  }
  paintItem(it,city) {
    const t=it.t;
    switch(it.kind) {
      case 'lot':this.paintLot(t,city);break;
      case 'deck':drawDeck(this,t,city);break;
      case 'portal':drawTunnelMouth(this,t,city,tunnelPortal(t,city));break;
      case 'trees':
        drawShadedArchitecture(this,t,city,()=>{for(const [x,y,variant] of naturalTrees(t))if(!isWaterPoint(this,x,y))this.tree(x,y,variant);});
        recordTreePicks(this,t);
        break;
      case 'lamp':if(this.zoom>0.5)drawStreetLamp(this,t);break;
      case 'pole':this.powerline(t,city);break;
    }
  }
  // A building and its graded site are one solid: the pad and retaining
  // walls first, the shadows they receive, then the architecture on top.
  paintLot(t,city) {
    const polygons=drawLotFoundation(this,t);
    if(polygons.length) {
      const points=polygons.flat(),x=Math.min(...points.map(p=>p.x)),y=Math.min(...points.map(p=>p.y));
      this.pickables.push({t,polygons,x,y,w:Math.max(...points.map(p=>p.x))-x,h:Math.max(...points.map(p=>p.y))-y});
      for(let yy=t.lot.y;yy<t.lot.y+t.lot.h;yy++)for(let xx=t.lot.x;xx<t.lot.x+t.lot.w;xx++)drawTerrainShadows(this,city.tiles[yy*city.size+xx],city);
    }
    this.platform=lotPlatform(t);
    try {drawShadedArchitecture(this,t,city);}
    finally {this.platform=null;}
  }

  // ── Frame ─────────────────────────────────────────────────────
  shakeOffset(city,now) {
    if(this.shakeCity!==city) {
      this.shakeCity=city;this.seenQuakes=new WeakSet();this.shakeUntil=0;
    }
    for(const effect of city.effects || []) {
      if(effect.type!=='earthquake' || this.seenQuakes.has(effect))continue;
      this.seenQuakes.add(effect);this.shakeUntil=now+900;
    }
    const k=Math.max(0,(this.shakeUntil-now)/900);
    return {x:Math.sin(now*0.09)*6*k,y:Math.cos(now*0.11)*4*k};
  }

  render(city,time,now=performance.now()) {
    if(this.dirty || city.revision!==this.lastRevision || this.size!==city.size || this.tiles!==city.tiles)this.paint(city);
    const ctx=this.ctx;
    // Shake the whole scene once, using real time even when the city is paused.
    const shake=this.shakeOffset(city,now);
    const dx=shake.x*this.dpr,dy=shake.y*this.dpr;
    ctx.setTransform(1,0,0,1,0,0);
    if(dx || dy) {
      ctx.fillStyle=this.night?'#233640':'#526c60';
      ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    }
    ctx.drawImage(this.ground,dx,dy);
    ctx.setTransform(this.dpr,0,0,this.dpr,dx,dy);

    this.waterSparkle(city,time);
    const deckTraffic=beginDeckTraffic(this);
    if(this.overlay!=='water' && this.tool!=='pipe')drawTraffic(this,city,time,deckTraffic);
    drawTrains(this,city,time,deckTraffic);
    const aircraft=this.portLife(city,time);

    ctx.drawImage(this.cache,0,0,this.w,this.h);
    compositeDeckTraffic(this);
    for(const plane of aircraft)drawAirplane(this,plane.p,plane.heading,time);

    drawMapLabels(this,city);
    drawFires(this,city,time);
    drawHazards(this,city,time);
    drawOutageMarkers(this,time);
    this.drawPreview(city);
  }

  waterSparkle(city,time) {
    const ctx=this.ctx;
    for(let i=0;i<city.tiles.length;i+=7) {
      const t=city.tiles[i];
      if(t.terrain!=='water' || ROAD_TYPES.has(t.type))continue;
      if(!isWaterPoint(this,t.x+.3,t.y+.5))continue;
      const p=this.project(t.x+0.3,t.y+0.5);
      if(p.x<-20 || p.x>this.w+20 || p.y<-20 || p.y>this.h+20)continue;
      ctx.globalAlpha=0.12+0.1*Math.sin(time*0.0008+i);
      const old=this.platform;this.platform=0;ctx.save();
      waterPath(this,ctx,waterGeometry(this,t).wet);ctx.clip();this.platform=old;
      this.line(p,{x:p.x+9*this.zoom,y:p.y-1*this.zoom},'#bed5c5',0.8,ctx);ctx.restore();
    }
    ctx.globalAlpha=1;
  }

  // A boat circles each seaport's freight shed on the water beside it; an
  // aircraft cruises above each runway and is returned to be drawn over the
  // whole skyline.
  portLife(city,time) {
    const ctx=this.ctx,aircraft=[];
    for(const t of city.tiles) {
      if(!t.lot || t.lot.x!==t.x || t.lot.y!==t.y || !PORT_TYPES.has(t.type) || t.abandoned)continue;
      if(t.type==='seaport') {
        if(t.part!=='warehouse')continue;
        const a=time*0.0004+t.x;
        const x=t.x+t.lot.w/2+Math.cos(a)*4,y=t.y+t.lot.h/2+Math.sin(a)*4;
        const tx=Math.floor(x),ty=Math.floor(y);
        const tile=tx>=0 && ty>=0 && tx<city.size && ty<city.size?city.tiles[ty*city.size+tx]:null;
        if(tile?.terrain==='water' && !ROAD_TYPES.has(tile.type) && !tile.lot)drawBoat(this,x,y,a+Math.PI/2,time,t.x);
      } else {
        // One flight per runway, keyed on the threshold nearest the origin.
        if(!/^threshold-/.test(t.part || ''))continue;
        const axis=t.part.endsWith('x')?[1,0]:[0,1],before=city.tiles[(t.y-axis[1])*city.size+t.x-axis[0]];
        if(t.x-axis[0]>=0 && t.y-axis[1]>=0 && before?.part && /-[xy]$/.test(before.part))continue;
        const a=time*0.00028+t.y;
        const x=t.x+2.5+Math.cos(a)*9,y=t.y+2+Math.sin(a)*6;
        const altitude=this.flightAltitude+Math.sin(a*2)*8;
        const p=this.project(x,y,altitude);
        const next=this.project(x-Math.sin(a)*0.09,y+Math.cos(a)*0.06,altitude);
        const cast=shadowPoint(x,y,this.groundZ(x,y)+altitude,this.groundZ(x,y));
        const shadow=this.project(cast[0],cast[1]);
        withGroundClip(this,()=>{ctx.fillStyle='#20333d22';ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,7*this.zoom,2.5*this.zoom,0,0,Math.PI*2);ctx.fill();},ctx);
        aircraft.push({p,heading:Math.atan2(next.y-p.y,next.x-p.x)});
      }
    }
    return aircraft;
  }

  // Construction preview or hover.
  drawPreview(city) {
    const ctx=this.ctx,preview=this.preview?.tiles;
    if(preview?.length) {
      const zone=ZONE_TINT[this.preview.tool];
      // Zoning: show the lot grid the zone will split into. A port takes the
      // whole block as one lot, so it gets no grid.
      const lot=zone && !PORT_TYPES.has(this.preview.tool)
        ?(this.preview.tool==='industrial' && this.preview.density===1?3:this.preview.density):1;
      for(const t of preview) {
        if(t.x<0 || t.y<0 || t.x>=city.size || t.y>=city.size)continue;
        const good=t.valid && !t.noop;
        const edge=t.noop?'#e8e6c0':good?(zone?(lot>1?zone.fill:zone.edge):'#ecf29a'):'#ffc4a7';
        this.highlightTile(t.x,t.y,1,t.noop?'#d9d9a944':good?(zone?zone.fill:'#aad74977'):'#db513c99',edge,ctx);
      }
      if(lot>1) {
        const good=preview.filter((t)=>t.valid && !t.noop);
        if(good.length) {
          const x0=Math.min(...good.map((t)=>t.x)),x1=Math.max(...good.map((t)=>t.x))+1;
          const y0=Math.min(...good.map((t)=>t.y)),y1=Math.max(...good.map((t)=>t.y))+1;
          for(let x=x0;x<=x1;x+=lot)this.line(this.project(x,y0,1.2),this.project(x,y1,1.2),zone.edge,1.8,ctx);
          for(let y=y0;y<=y1;y+=lot)this.line(this.project(x0,y,1.2),this.project(x1,y,1.2),zone.edge,1.8,ctx);
          if((x1-x0)%lot)this.line(this.project(x1,y0,1.2),this.project(x1,y1,1.2),zone.edge,1.8,ctx);
          if((y1-y0)%lot)this.line(this.project(x0,y1,1.2),this.project(x1,y1,1.2),zone.edge,1.8,ctx);
        }
      }
    } else if(this.hover && this.hover.x>=0 && this.hover.y>=0 && this.hover.x<city.size && this.hover.y<city.size) {
      const {x,y}=this.hover;
      const tile=city.tiles[y*city.size+x];
      if(this.tool==='inspect' && tile.lot) {
        this.platform=lotPlatform(city.tiles[tile.lot.y*city.size+tile.lot.x]);
        this.flat(tile.lot.x,tile.lot.y,tile.lot.w,tile.lot.h,1,null,'#fff0bd',ctx);
        this.platform=null;
      } else this.highlightTile(x,y,1,this.tool==='bulldoze'?'#d65e4166':'#e9e6ae33','#efecc0',ctx);
    }
  }
}
