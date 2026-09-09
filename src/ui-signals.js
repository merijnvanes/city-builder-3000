// Presentation bands only. Simulation and agent values stay precise.
import {BUILDINGS,ZONE_TYPES,PORT_TYPES,ROAD_TYPES} from './sim/catalog.js';
const SIGNALS = {
  happiness: { label:'City mood', icon:'park', bands:[30,60,80], words:['Unhappy','Unsettled','Content','Thriving'] },
  unemployment: { label:'Finding work', icon:'industrial', bands:[10,25,50], words:['Plenty of work','Some searching','Hard to find','Jobs crisis'], reverse:true },
  pollution: { label:'Air quality', icon:'park', bands:[20,40,70], words:['Fresh air','Hazy','Smoggy','Choking'], reverse:true },
  waterPollution: { label:'Water quality', icon:'water', bands:[20,40,70], words:['Clean','Cloudy','Polluted','Unsafe'], reverse:true },
  crime: { label:'Neighbourhood safety', icon:'police', bands:[20,40,70], words:['Peaceful','Uneasy','Troubled','Dangerous'], reverse:true },
  traffic: { label:'Getting around', icon:'road', bands:[20,40,70], words:['Easy going','Getting busy','Congested','Gridlocked'], reverse:true },
  garbage: { label:'Clean streets', icon:'landfill', bands:[20,40,70], words:['Tidy','Some litter','Piling up','Overwhelmed'], reverse:true },
  landValue: { label:'Local appeal', icon:'residential', bands:[25,50,75], words:['Overlooked','Modest','Desirable','Sought after'], neutral:true },
  lifeExpectancy: { label:'Healthy lives', icon:'hospital', bands:[50,65,80], words:['At risk','Needs care','Healthy','Long lived'] },
  eq: { label:'Learning', icon:'school', bands:[45,65,90], words:['Falling behind','Finding its feet','Well educated','Flourishing'], max:150 },
  workforceShare: { label:'Working age residents', icon:'industrial', bands:[.25,.4,.6], words:['Small share','Mixed ages','Large share','Most residents'], max:1, neutral:true },
  flammability: { label:'Fire safety', icon:'fire', bands:[25,50,75], words:['Low risk','Some risk','High risk','Severe risk'], reverse:true },
  powerOutput: { label:'Power production', icon:'power', bands:[1,50,90], words:['Offline','Limited','Steady','Full output'] },
  waterOutput: { label:'Water production', icon:'water', bands:[1,50,90], words:['Offline','Limited','Steady','Full output'] },
  storage: { label:'Landfill space', icon:'landfill', bands:[25,60,90], words:['Plenty of room','Filling up','Getting tight','Nearly full'], reverse:true },
};

export function citySignal(key, value) {
  const spec=SIGNALS[key];
  if (!spec) return null;
  const {label,icon,neutral}=spec;
  if (!Number.isFinite(value)) return {label,icon,neutral,word:'Unknown',tone:'unknown',level:0};
  const band=spec.bands.filter(limit=>value>=limit).length;
  const tone=spec.reverse ? (band===0?'good':band===3?'bad':'watch') : (band===0?'bad':band===1?'watch':'good');
  const amount=Math.max(0,Math.min(100,value/(spec.max || 100)*100));
  return {label,icon,neutral,word:spec.words[band],tone:neutral?'calm':tone,level:spec.reverse?100-amount:amount};
}

export function placeServices(tile) {
  if (!tile || tile.type==='empty' || ROAD_TYPES.has(tile.type)) return [];
  const b=BUILDINGS[tile.type] || {}, zone=ZONE_TYPES.has(tile.type), port=PORT_TYPES.has(tile.type);
  return [
    {label:'Power',icon:'power',ready:tile.powered,required:zone || port || b.powerUse>0},
    {label:'Water',icon:'water',ready:tile.watered,required:(zone && (tile.density>=2 || tile.level>=3)) || port || b.waterUse>0},
    {label:'Road',icon:'road',ready:tile.roadAccess,required:zone || port || b.beside==='road' || b.garbage>0 || b.recycles>0 || tile.type==='landfill'},
  ].filter(service=>service.ready || service.required);
}

// Adapt the existing query-card lines at the UI boundary; the API retains them.
export function inspectNote(detail) {
  if (/^(No |Not |Waiting on |Contaminated |Conditions: Not met|OVERLOADED|Overcrowded:|ON FIRE)/.test(detail)) return {kind:'urgent',text:detail};
  const output=detail.match(/^(Power|Water) output: ([\d,]+) of ([\d,]+)/);
  if (output) return {kind:'signal',key:output[1].toLowerCase()+'Output',value:100*Number(output[2].replaceAll(',',''))/Number(output[3].replaceAll(',',''))};
  const storage=detail.match(/^Buried here: ([\d,]+) of ([\d,]+)/);
  if (storage) return {kind:'signal',key:'storage',value:100*Number(storage[1].replaceAll(',',''))/Number(storage[2].replaceAll(',',''))};
  const coverage=detail.match(/^(\w+) coverage radius/);
  if (coverage) return {kind:'primary',text:`${coverage[1][0].toUpperCase()+coverage[1].slice(1)} service for nearby neighbourhoods`};
  if (/^Grade: /.test(detail)) return {kind:/[DF]$/.test(detail)?'urgent':'primary',text:detail.replace('Grade:','Service grade:')};
  return {kind:/^(Residents:|Jobs:|Upkeep:)/.test(detail) || !/\d/.test(detail)?'primary':'more',text:detail};
}

export function demandSignal(value) {
  if (!Number.isFinite(value)) return 'Unknown';
  return value < -25 ? 'Oversupply' : value < -10 ? 'Cooling' : value <= 10 ? 'Balanced' : value < 40 ? 'Growing' : 'In demand';
}
