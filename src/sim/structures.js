// Straight engineered routes. The registry is saved; tile references are a
// derived index shared by construction, transport and artwork.
import { tileAt } from './grid.js';
import { BUILDINGS, carriesRoute } from './catalog.js';
import { waterSurface } from './surface-water.js';
export const MAX_BRIDGE_SPAN = 16;
export const bridgeStyle = length => length <= 4 ? 'beam' : length <= 10 ? 'truss' : 'suspension';
export const structureCost = (kind, route, length) => kind === 'bridge'
  ? BUILDINGS[route].cost * (length + 2 + 2 * length * length)
  : BUILDINGS[route === 'rail' ? 'railtunnel' : 'tunnel'].cost * length + BUILDINGS[route].cost * length * length;
export function structureTiles(city,s) {
  const dx=Math.sign(s.to.x-s.from.x),dy=Math.sign(s.to.y-s.from.y),distance=Math.abs(s.to.x-s.from.x)+Math.abs(s.to.y-s.from.y);
  return Array.from({length:distance+1},(_,i)=>tileAt(city,s.from.x+dx*i,s.from.y+dy*i));
}
export const isPortal = (t,s=t?.structure) => !!s && (t.x===s.from.x && t.y===s.from.y || t.x===s.to.x && t.y===s.to.y);
export const providesAccess = t => t?.structure?.kind!=='bridge' || isPortal(t);
export function allowsDirection(t,dx,dy) {
  const s=t?.structure;
  if(!s || s.kind==='tunnel' && !isPortal(t,s))return true;
  return s.from.x===s.to.x ? dx===0 : dy===0;
}
export function surfaceStep(a,b) {
  return allowsDirection(a,b.x-a.x,b.y-a.y) && allowsDirection(b,a.x-b.x,a.y-b.y);
}
export function bridgeQuote(city,coords,route) {
  const tiles=coords.map(p=>tileAt(city,p.x,p.y));
  const water=tiles.map((t,i)=>t?.terrain==='water'?i:-1).filter(i=>i>=0);
  if(!water.length)return null;
  const fail=error=>({error});
  if(tiles.some(t=>!t) || coords.some(p=>p.x!==coords[0].x) && coords.some(p=>p.y!==coords[0].y))return fail('Bridges must run straight from dry land to dry land.');
  const first=water[0]-1,last=water.at(-1)+1;
  if(first<0 || last>=tiles.length)return fail('Drag from dry land to dry land to build a bridge.');
  const span=tiles.slice(first,last+1),length=span.length-2;
  if(water.length!==length)return fail('Cross one continuous stretch of water per bridge. Use a separate drag for each crossing.');
  if(length>MAX_BRIDGE_SPAN)return fail(`Bridges can span at most ${MAX_BRIDGE_SPAN} tiles.`);
  const [a,b]=[span[0],span.at(-1)];
  const existing=a.structure;
  if(existing?.kind==='bridge' && existing.route===route && existing.length===length && span.every(t=>t.structure===existing))return {structure:existing,cost:0,tiles:span,existing:true};
  if(a.elev!==b.elev)return fail('Bridge banks must be at the same height. Level the approaches first.');
  if(span.some((t,i)=>t.structure || t.tunnel || t.under || t.lot || (i===0 || i===span.length-1 ? t.type!=='empty' && t.type!==route : t.type!=='empty')))
    return fail('The bridge would cross an existing structure or occupied tile.');
  if(span.slice(1,-1).some(t=>waterSurface(t)>=a.elev+.5))return fail('The bridge needs clearance above the water.');
  const structure={kind:'bridge',route,from:{x:a.x,y:a.y},to:{x:b.x,y:b.y},elevation:a.elev,length};
  return {structure,cost:structureCost('bridge',route,length),tiles:span};
}
export function installStructure(city,s) {
  (city.transportStructures ||= []).push(s);
  const tiles=structureTiles(city,s);
  for(const t of tiles) {
    t.structure=s;
    if(s.kind==='bridge' || isPortal(t,s)) { t.type=s.route;t.under=0;t.trees=0;t.powerline=false;t.density=0;t.level=0; }
    else t.tunnel=s.route==='rail'?2:1;
  }
}
export function removeStructure(city,s) {
  for(const t of structureTiles(city,s)) {
    if(!t)continue;
    if(s.kind==='bridge' || isPortal(t,s)) {t.type='empty';t.under=0;t.trees=0;t.fire=0;}
    else t.tunnel=0;
    delete t.structure;
  }
  city.transportStructures=(city.transportStructures || []).filter(n=>n!==s);
}
export function restoreStructures(city,raw) {
  city.transportStructures=[];
  if(raw===undefined) {
    // Recover old straight bores from their two matching portals. Ambiguous
    // orphaned bores stay inert rather than linking unrelated surface roads.
    for(const t of city.tiles)if(['road','rail'].includes(t.type) && !t.structure)for(const [dx,dy] of [[1,0],[0,1]]) {
      const buried=[];let end;
      for(let step=1;step<city.size;step++) {
        const n=tileAt(city,t.x+dx*step,t.y+dy*step);
        if(n?.tunnel===(t.type==='rail'?2:1) && !n.structure){buried.push(n);continue;}
        end=n;break;
      }
      if(buried.length>=6 && end?.type===t.type && end.elev===t.elev && !end.structure && buried.every(n=>n.elev>t.elev)) {
        const s={kind:'tunnel',route:t.type,from:{x:t.x,y:t.y},to:{x:end.x,y:end.y},elevation:t.elev,length:buried.length};
        city.transportStructures.push(s);for(const n of [t,...buried,end])n.structure=s;
      }
    }
    return;
  }
  if(!Array.isArray(raw) || raw.length>city.tiles.length)throw new Error('Invalid save: bad transport structures.');
  for(const s of raw) {
    if(!s || !['bridge','tunnel'].includes(s.kind) || !['road','rail','highway'].includes(s.route) || s.kind==='tunnel' && s.route==='highway' ||
      ![s.from?.x,s.from?.y,s.to?.x,s.to?.y,s.elevation,s.length].every(Number.isSafeInteger) ||
      s.from.x!==s.to.x && s.from.y!==s.to.y || s.length<1 || s.length!==Math.abs(s.to.x-s.from.x)+Math.abs(s.to.y-s.from.y)-1 || s.length>city.size-2 ||
      s.kind==='bridge' && s.length>MAX_BRIDGE_SPAN)throw new Error('Invalid save: bad transport structure.');
    const tiles=structureTiles(city,s);
    if(tiles.some(t=>!t || t.structure) || tiles.some(t=>s.kind==='bridge' || isPortal(t,s) ? !carriesRoute(t,s.route) || t.under : t.tunnel!==(s.route==='rail'?2:1) || t.elev<=s.elevation) ||
      tiles[0].terrain==='water' || tiles.at(-1).terrain==='water' || tiles[0].elev!==s.elevation || tiles.at(-1).elev!==s.elevation)throw new Error('Invalid save: broken transport structure.');
    city.transportStructures.push(s);for(const t of tiles)t.structure=s;
  }
}
export function pruneStructures(city) {
  for(const s of [...city.transportStructures || []]) {
    if(structureTiles(city,s).some(t=>!t || (s.kind==='bridge' || isPortal(t,s) ? !carriesRoute(t,s.route) : !t.tunnel)))removeStructure(city,s);
  }
}
