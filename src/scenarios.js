import {random} from './building-art.js';
export const SCENARIOS={
 sandbox:{name:'Open city',description:'Build at your own pace. No deadline.'},
 growth:{name:'A town of your own',description:'Build a town of 5,000 residents with a balanced budget within ten years.'},
 recovery:{name:'Riverton renewal',description:'Recover a struggling city: achieve 65% happiness and a positive monthly balance within five years.'},
};
export function startScenario(city,id='sandbox'){
 if(!SCENARIOS[id])id='sandbox';
 city.scenario={id,name:SCENARIOS[id].name,description:SCENARIOS[id].description,startMonth:city.month,deadline:id==='growth'?120:id==='recovery'?60:null,status:'active'};
 if(id==='recovery'){city.money=18000;city.debt=10000;for(const t of city.tiles){if(t.type==='industrial'&&random(t.x,t.y,3)>.5)t.level=Math.min(4,(t.level||1)+1);if(t.type==='park')t.type='empty';}city.revision++;}
 return city;
}
export function updateScenario(city,stats){
 const goal=city.scenario;if(!goal||goal.status!=='active'||goal.id==='sandbox')return null;
 const won=goal.id==='growth'?stats.population>=5000&&stats.balance>=0:stats.happiness>=65&&stats.balance>=0;
 if(won){goal.status='won';return goal.name+' completed. Your city can keep growing.';}
 if(city.month-goal.startMonth>=goal.deadline){goal.status='missed';return 'The deadline passed. Continue improving your city in open play.';}
 return null;
}
export function triggerDisaster(city,id='fire'){
 const candidates=city.tiles.filter(t=>['residential','commercial','industrial'].includes(t.type)&&t.level>0);
 if(!candidates.length)return 'There are no developed buildings to affect.';
 const index=Math.floor(random(city.seed,city.month,city.revision)*candidates.length),center=candidates[index];
 if(id==='earthquake'){
  for(const t of city.tiles){const d=Math.abs(t.x-center.x)+Math.abs(t.y-center.y);if(d<5&&random(t.x,t.y,city.month)>.4){if(['residential','commercial','industrial'].includes(t.type))t.level=Math.max(0,t.level-2);else if(t.type==='road')t.type='empty';}}
  city.revision++;return 'Earthquake near '+center.x+', '+center.y+'. Inspect damaged roads and disconnected neighborhoods.';
 }
 center.fire=3;city.revision++;return 'Fire reported at '+center.x+', '+center.y+'. Nearby funded fire stations can contain the damage.';
}
export function advanceDisasters(city){
 let damaged=0;
 for(const t of city.tiles){if(!t.fire)continue;const station=city.tiles.some(s=>s.type==='fire'&&s.powered&&Math.abs(s.x-t.x)+Math.abs(s.y-t.y)<=8);const funding=city.funding?.fire??100;
  if(station&&funding>=70)t.fire=0;
  else{t.fire--;if(t.level>0){t.level--;damaged++;}}
 }
 return damaged?'Fire damaged '+damaged+' building'+(damaged===1?'':'s')+'. Restore fire protection.':null;
}
