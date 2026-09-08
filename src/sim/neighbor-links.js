import { carriesRoute } from './catalog.js';

export const CONNECTION_FEES = { road:500, rail:750, highway:1000 };
export const EDGE_DIRECTIONS = { north:[0,-1], east:[1,0], south:[0,1], west:[-1,0] };
export function edgeSides(size,x,y) {
  return Object.keys(EDGE_DIRECTIONS).filter(side=>side==='north'?y===0:side==='south'?y===size-1:side==='west'?x===0:x===size-1);
}
const key = link => `${link.x},${link.y},${link.side},${link.route}`;
function onEdge(size,x,y,side) {
  return side==='north'?y===0:side==='south'?y===size-1:side==='west'?x===0:side==='east'?x===size-1:false;
}
export function validLink(city,link) {
  return !!link && Number.isSafeInteger(link.x) && Number.isSafeInteger(link.y) && link.x>=0 && link.y>=0 && link.x<city.size && link.y<city.size &&
    Object.hasOwn(CONNECTION_FEES,link.route) && onEdge(city.size,link.x,link.y,link.side) && carriesRoute(city.tiles[link.y*city.size+link.x],link.route);
}
export function linked(city,x,y,side,route) {
  return (city.transportConnections || []).some(link=>link.x===x && link.y===y && link.side===side && link.route===route && validLink(city,link));
}
export function connectionOffers(city,tiles) {
  const offers=[],seen=new Set();
  for(const t of tiles) for(const side of edgeSides(city.size,t.x,t.y)) for(const route of Object.keys(CONNECTION_FEES)) {
    const link={x:t.x,y:t.y,side,route};
    if(!validLink(city,link) || linked(city,t.x,t.y,side,route) || seen.has(key(link))) continue;
    seen.add(key(link)); offers.push({...link,cost:CONNECTION_FEES[route]});
  }
  return offers;
}
export function quoteConnection(city,link) {
  if(!validLink(city,link)) return {ok:false,cost:0,message:'A matching transport route must reach that county border.'};
  if(linked(city,link.x,link.y,link.side,link.route)) return {ok:true,noop:true,cost:0,message:'Already connected.'};
  return {ok:true,cost:CONNECTION_FEES[link.route],message:`Connect ${link.route} to the ${link.side} county`};
}
export function establishConnection(city,link) {
  const quote=quoteConnection(city,link);
  if(!quote.ok || quote.noop) return quote;
  if(city.money<quote.cost) return {...quote,ok:false,cost:0,message:'Insufficient funds for the county connection.'};
  const {x,y,side,route}=link;
  (city.transportConnections ||= []).push({x,y,side,route});
  city.money-=quote.cost;city.revision++;
  return quote;
}
export function pruneConnections(city) {
  city.transportConnections=(city.transportConnections || []).filter(link=>validLink(city,link));
}
export function parseConnections(city,raw) {
  // Older saves already enjoyed automatic links. Preserve those existing
  // connections once, while newly built endpoints always require purchase.
  if(raw===undefined) return connectionOffers({...city,transportConnections:[]},city.tiles).map(({cost,...link})=>link);
  if(!Array.isArray(raw) || raw.length>city.size*24) throw new Error('Invalid save: bad county connections.');
  const seen=new Set();
  return raw.map(link=>{
    if(!validLink(city,link) || seen.has(key(link))) throw new Error('Invalid save: bad county connection.');
    seen.add(key(link)); const {x,y,side,route}=link;return {x,y,side,route};
  });
}

export function outwardConnection(city,t,dx,dy,route) {
  const side=dx===1?'east':dx===-1?'west':dy===1?'south':'north';
  return linked(city,t.x,t.y,side,route);
}
