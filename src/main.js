import './style.css';
import * as simulation from './sim.js';
import {mountUI} from './ui.js';
import {CityRenderer} from './renderer.js';
import {createMinimap} from './minimap.js';
import {planConstruction,applyConstruction,createUndoManager} from './construction.js';
import {attachInput} from './input.js';
import {CityAudio} from './audio.js';
import {startScenario,updateScenario,triggerDisaster,advanceDisasters} from './scenarios.js';
import {updateInfrastructure} from './infrastructure.js';

const {createCity,tick,getStats,inspectTile,serialize,deserialize,TOOLS}=simulation;
const SAVE_KEY='civic3000-save-v1';
let city=startScenario(createCity()),tool='inspect',density=1,speed=0,lastTick=performance.now(),animationTime=0,previousTime=performance.now();
const undo=createUndoManager(20),audio=new CityAudio(),canvas=document.querySelector('#city-canvas'),renderer=new CityRenderer(canvas);
renderer.home();
let ui,input;
function refresh(){const stats=getStats(city);city.population=stats.population;city.happiness=stats.happiness;city.demand={...stats.demand};ui?.update(city,stats);return stats;}
function choose(id){input?.cancel();tool=id;renderer.tool=id;renderer.dirty=true;ui?.setTool(id);canvas.style.cursor=id==='inspect'?'default':'crosshair';audio.effect();}
function setSpeed(n){speed=Number(n);lastTick=performance.now();ui?.setSpeed?.(speed);document.querySelectorAll('[data-speed]').forEach(el=>{const active=Number(el.dataset.speed)===speed;el.classList.toggle('active',active);el.setAttribute('aria-pressed',String(active));});}
function restore(){input?.cancel();undo.clear();setSpeed(0);renderer.dirty=true;ui?.setSelection(null);refresh();}
function undoLast(){input?.cancel();if(undo.undo(city)){renderer.dirty=true;refresh();ui.notify('Construction undone.');}else ui.notify('Nothing to undo since the last simulation step.');}
function setDensity(n){density=[1,2,3].includes(Number(n))?Number(n):1;ui?.setDensity?.(density);if(renderer.hover&&!input?.dragging)renderer.preview=planConstruction(city,renderer.hover,renderer.hover,tool,{density});}
const actions={
 selectTool:choose,setSpeed,setDensity,undo:undoLast,
 setTax:n=>{city.tax=Number(n);if(city.taxes)for(const key of ['residential','commercial','industrial'])city.taxes[key]=Number(n);refresh();},
 setPolicy:(key,value)=>{if(!simulation.setPolicy){ui.notify('The simulation update is still loading.');return;}const result=simulation.setPolicy(city,key,value);if(result?.ok===false){ui.notify(result.message);return;}renderer.dirty=true;refresh();if(result?.message)ui.notify(result.message);},
 renameCity:name=>{const text=String(name||'').trim().slice(0,40);if(text){city.name=text;refresh();}},
 save:()=>{try{const data=JSON.parse(serialize(city));data.scenario=city.scenario;data.fires=city.tiles.filter(t=>t.fire).map(t=>({x:t.x,y:t.y,remaining:t.fire}));localStorage.setItem(SAVE_KEY,JSON.stringify(data));ui.notify('City saved in this browser.');}catch{ui.notify('Unable to save: browser storage is unavailable or full.');}},
 load:()=>{try{const raw=localStorage.getItem(SAVE_KEY);if(!raw){ui.notify('No saved city yet.');return;}const restored=deserialize(raw),data=JSON.parse(raw);if(data.scenario&&['sandbox','growth','recovery'].includes(data.scenario.id)&&Number.isFinite(data.scenario.startMonth))restored.scenario=data.scenario;
  if(Array.isArray(data.fires))for(const fire of data.fires){if(Number.isInteger(fire.x)&&Number.isInteger(fire.y)&&fire.x>=0&&fire.y>=0&&fire.x<restored.size&&fire.y<restored.size&&Number.isInteger(fire.remaining)&&fire.remaining>=0&&fire.remaining<=3)restored.tiles[fire.y*restored.size+fire.x].fire=fire.remaining;}
  city=restored;restore();ui.notify('Saved city restored. Simulation paused.');}catch{ui.notify('That save could not be loaded. Your current city is unchanged.');}},
 newCity:(options={})=>{const scenario=options?.scenario||'sandbox';city=startScenario(createCity(Math.floor(Math.random()*100000),scenario==='recovery'),scenario);renderer.home();restore();ui.notify('New city. Lay roads and utilities, then drag a residential zone.');},
 setOverlay:id=>{renderer.overlay=id;renderer.dirty=true;ui?.setOverlay(id);},
 zoom:d=>renderer.zoomAt(d*.18),home:()=>renderer.home(),rotate:d=>{input?.cancel();renderer.rotate(d);},
 toggleDay:()=>{renderer.night=!renderer.night;renderer.dirty=true;},
 toggleSound:async()=>{try{const enabled=await audio.toggle();ui.notify(enabled?'Original city soundtrack enabled.':'Sound muted.');return enabled;}catch{ui.notify('Audio could not start in this browser.');return false;}},
 setDisaster:id=>{undo.clear();const message=triggerDisaster(city,id);updateInfrastructure(city);renderer.dirty=true;refresh();ui.notify(message);},
};
ui=mountUI(actions);
input=attachInput(canvas,renderer,{
 getCity:()=>city,getTool:()=>tool,getDensity:()=>density,getTools:()=>TOOLS,
 onChoose:choose,onSpeed:setSpeed,onUndo:undoLast,onHome:actions.home,onRotate:actions.rotate,
 onPreview:plan=>ui.setBuildPreview?.(plan||{count:0,cost:0,valid:true,message:''}),onInspect:tile=>ui.setSelection(inspectTile(city,tile.x,tile.y)),
 onCommit:plan=>{const before=structuredClone(city);const result=applyConstruction(city,plan);if(result.ok){undo.record(before);renderer.dirty=true;refresh();audio.effect('build');ui.notify(result.changed+' tile'+(result.changed===1?'':'s')+' built · '+(result.cost<0?'salvage $'+(-result.cost):'$'+result.cost));}else{audio.effect('error');ui.notify(result.message||'Nothing to build here.');}},
},planConstruction);
const minimap=createMinimap(renderer);
refresh();choose('inspect');setDensity(1);setSpeed(0);
document.addEventListener('visibilitychange',()=>{lastTick=performance.now();previousTime=lastTick;});
let lastFrame=0;
function frame(now){
 const delta=Math.min(100,now-previousTime);previousTime=now;if(speed)animationTime+=delta*speed;
 if(speed&&!document.hidden&&now-lastTick>2500/speed){
  undo.clear();const disasterMessage=advanceDisasters(city);tick(city);lastTick=now;const stats=refresh(),goalMessage=updateScenario(city,stats);if(disasterMessage||goalMessage)ui.notify(goalMessage||disasterMessage);
 }
 if(now-lastFrame>32){renderer.render(city,animationTime);minimap.update(city);lastFrame=now;}
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.civic={get city(){return city;},get renderer(){return renderer;},getStats:()=>getStats(city)};
