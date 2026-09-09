import { allowsDirection } from './structures.js';
import { carriesRoute } from './catalog.js';

const transport = route => (tile, direction) => carriesRoute(tile,route) && allowsDirection(tile,...direction);
// Each border endpoint is bought separately. These are local balance values,
// not verified SimCity 3000 prices. Add a type here to reuse quotes, payment,
// construction prompts, pruning and save validation for its infrastructure.
export const CONNECTION_TYPES = {
  road: { label:'Road', cost:500, matches:transport('road') },
  rail: { label:'Rail', cost:750, matches:transport('rail') },
  highway: { label:'Highway', cost:1000, matches:transport('highway') },
  powerline: { label:'Electricity', cost:500, matches:tile=>!!tile.powerline },
  pipe: { label:'Water', cost:500, matches:tile=>!!tile.pipe },
};
export const CONNECTION_FEES = Object.fromEntries(Object.entries(CONNECTION_TYPES).map(([type,definition])=>[type,definition.cost]));
export const EDGE_DIRECTIONS = { northeast:[0,-1], southeast:[1,0], southwest:[0,1], northwest:[-1,0] };
export function edgeSides(size,x,y) {
  return Object.keys(EDGE_DIRECTIONS).filter(side=>side==='northeast'?y===0:side==='southwest'?y===size-1:side==='northwest'?x===0:x===size-1);
}
const key = link => `${link.x},${link.y},${link.side},${link.route}`;
function onEdge(size,x,y,side) {
  return side==='northeast'?y===0:side==='southwest'?y===size-1:side==='northwest'?x===0:side==='southeast'?x===size-1:false;
}
export function validLink(city,link) {
  return !!link && Number.isSafeInteger(link.x) && Number.isSafeInteger(link.y) && link.x>=0 && link.y>=0 && link.x<city.size && link.y<city.size &&
    Object.hasOwn(CONNECTION_TYPES,link.route) && onEdge(city.size,link.x,link.y,link.side) && CONNECTION_TYPES[link.route].matches(city.tiles[link.y*city.size+link.x],EDGE_DIRECTIONS[link.side]);
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
  if(!validLink(city,link)) return {ok:false,cost:0,message:'Matching infrastructure must reach that county border.'};
  if(linked(city,link.x,link.y,link.side,link.route)) return {ok:true,noop:true,cost:0,message:'Already connected.'};
  return {ok:true,cost:CONNECTION_FEES[link.route],message:`Connect ${CONNECTION_TYPES[link.route].label.toLowerCase()} to the ${link.side} county`};
}
export function establishConnection(city,link) {
  const quote=quoteConnection(city,link);
  if(!quote.ok || quote.noop) return quote;
  if(city.money<quote.cost) return {...quote,ok:false,cost:0,message:'Insufficient funds for the county connection.'};
  const {x,y,side,route}=link;
  // Retain the save field name for compatibility; it now holds all link types.
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
  if(!Array.isArray(raw) || raw.length>city.size*4*Object.keys(CONNECTION_TYPES).length) throw new Error('Invalid save: bad county connections.');
  const seen=new Set();
  return raw.map(link=>{
    if(!validLink(city,link) || seen.has(key(link))) throw new Error('Invalid save: bad county connection.');
    seen.add(key(link)); const {x,y,side,route}=link;return {x,y,side,route};
  });
}

export function outwardConnection(city,t,dx,dy,route) {
  const side=dx===1?'southeast':dx===-1?'northwest':dy===1?'southwest':'northeast';
  return linked(city,t.x,t.y,side,route);
}
