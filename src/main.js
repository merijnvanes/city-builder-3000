import { constructionDialog } from './construction-dialog.js';
import { quoteConnection } from './sim/neighbor-links.js';
import "./style.css";
import * as sim from "./sim.js";
import { mountUI } from "./ui.js";
import { CityRenderer } from "./renderer.js";
import { createMinimap } from "./minimap.js";
import { planConstruction, applyConstruction, createUndoManager, planConnectionOffers } from "./construction.js";
import { attachInput } from "./input.js";
import { CityAudio } from "./audio.js";
import { SCENARIOS, startScenario, updateScenario } from "./scenarios.js";
import { createAgentAPI } from "./agent-api.js";

const SAVE_KEY = "city-builder-3000-save-v3";
const MONTH_MS = 2500;
const SLOTS = 3;
const slotKey = (slot) => (slot === 0 ? `${SAVE_KEY}-autosave` : slot === 1 ? SAVE_KEY : `${SAVE_KEY}-slot${slot}`);

let city = startScenario(sim.createCity(42, true));
let tool = "inspect", density = 1, speed = 0;
let lastTick = performance.now(), animationTime = 0, previousTime = performance.now();
const undo = createUndoManager(20);
const audio = new CityAudio();
const canvas = document.querySelector("#city-canvas");
const renderer = new CityRenderer(canvas);
let ui, input, selection = null;

// Start the camera on the built-up centre of the city (or the map centre).
function lookAtCity() {
  renderer.size = city.size;
  renderer.buildCorners(city);
  let sx = 0, sy = 0, n = 0;
  for (const t of city.tiles) if (t.type !== "empty") { sx += t.x; sy += t.y; n++; }
  if (n) renderer.focusOn(sx / n, sy / n, 0.85);
  else renderer.focusOn(city.size / 2, city.size / 2, 0.7);
}
lookAtCity();

function refreshSelection() {
  if (!selection || tool !== "inspect") return;
  ui?.setSelection({ ...sim.inspectTile(city, selection.x, selection.y), night: renderer.night, rotation: renderer.rotation });
}

function refresh() {
  const stats = sim.getStats(city);
  ui?.update(city, stats);
  refreshSelection();
  audio.setAmbience({ traffic: stats.traffic, population: stats.population, night: renderer.night });
  return stats;
}

function choose(id) {
  input?.cancel();
  tool = id;
  if (id !== "inspect") selection = null;
  renderer.tool = id;
  renderer.dirty = true;
  ui?.setTool(id);
  canvas.style.cursor = id === "inspect" ? "default" : "crosshair";
  audio.effect();
}

function setSpeed(n) {
  speed = Number(n);
  lastTick = performance.now();
  ui?.setSpeed?.(speed);
}

function restore() {
  input?.cancel();
  undo.clear();
  setSpeed(0);
  renderer.size = city.size;
  renderer.dirty = true;
  selection = null;
  ui?.setSelection(null);
  refresh();
}

function undoLast() {
  input?.cancel();
  if (!undo.undo(city)) { ui.notify("Nothing to undo since the last simulation step."); return false; }
  renderer.dirty = true;
  refresh();
  ui.notify("Construction undone.");
  return true;
}

function setDensity(n) {
  density = [1, 2, 3].includes(Number(n)) ? Number(n) : 1;
  ui?.setDensity?.(density);
  if (renderer.hover && !input?.dragging) renderer.preview = planConstruction(city, renderer.hover, renderer.hover, tool, { density });
}

function policy(key, value) {
  const result = sim.setPolicy(city, key, value);
  if (!result.ok) { ui.notify(result.message); return result; }
  renderer.dirty = true;
  refresh();
  if (result.message) ui.notify(result.message);
  return result;
}

// First-city tips: each fires once, when the previous step is done.
const TIPS = [
  { when: (c) => true, text: "Welcome, Mayor. Start with a road: open Transport, pick Road and drag a line across the land." },
  { when: (c) => c.tiles.some((t) => t.type === "road"), text: "Zone next to the road: open Zones, pick Residential and drag a rectangle. Lots need a road within three tiles." },
  { when: (c) => c.tiles.some((t) => t.type === "residential"), text: "Power it: build a plant (Power group) and drag a power line to your zone. Power hops across a single street on its own." },
  { when: (c) => c.tiles.some((t) => sim.BUILDINGS[t.type]?.powerOut), text: "Add industry and commerce for jobs, then press 1 to run time. Watch the R C I bars: green means people want in." },
  { when: (c) => c.tiles.some((t) => t.type === "industrial") && c.tiles.some((t) => t.type === "commercial"), text: "Water lets medium and high density grow: a pump beside water, pipes under the streets (each pipe serves six tiles around it)." },
  { when: (c) => c.tiles.some((t) => sim.BUILDINGS[t.type]?.waterOut) && c.tiles.some((t) => t.pipe), text: "You are on your way. Check the Budget every January, keep an eye on the advisors, and connect a road to the map edge for trade." },
];
let tipIndex = -1;
function advanceTips() {
  if (tipIndex >= TIPS.length) return;
  while (tipIndex + 1 < TIPS.length && TIPS[tipIndex + 1].when(city)) tipIndex++;
  if (tipIndex >= 0) ui.tip(TIPS[tipIndex].text);
  if (tipIndex === TIPS.length - 1) tipIndex = TIPS.length;
}

function loadFrom(raw, message) {
  try {
    city = sim.deserialize(raw);
    if (!city.scenario) startScenario(city, "sandbox");
    restore();
    lookAtCity();
    ui.notify(message);
  } catch (err) { ui.notify(`That save could not be loaded: ${err.message}`); }
}

// Commit a construction plan. The mouse and the agent API both land here, so
// pricing, undo, tips and the notice line behave the same either way.
function commit(plan, options) {
  const before = structuredClone(city);
  const result = applyConstruction(city, plan, options);
  if (result.ok) {
    undo.record(before);
    renderer.dirty = true;
    refresh();
    advanceTips();
    audio.effect("build");
    ui.notify(`${result.changed} tile${result.changed === 1 ? "" : "s"} · $${Math.round(result.cost).toLocaleString()}`);
  } else {
    audio.effect("error");
    ui.notify(result.message || "Nothing to build here.");
  }
  return result;
}

function connectNeighbor(link) {
  const before=structuredClone(city),result=sim.connectNeighbor(city,link);
  if(result.ok && !result.noop) { undo.record(before);renderer.dirty=true;refresh(); }
  ui.notify(result.message);
  return result;
}
function offerConnections(offers, owner=city) {
  if(owner!==city || !offers.length) return;
  const [link,...rest]=offers,quote=quoteConnection(city,link);
  if(!quote.ok || quote.noop) return offerConnections(rest,owner);
  constructionDialog({title:'Connect to neighboring county?',
    message:`Connect the ${link.route} at (${link.x}, ${link.y}) to ${city._connections[link.side].name} on the ${link.side} border for $${quote.cost.toLocaleString()}?`,
    acceptLabel:`Connect · $${quote.cost.toLocaleString()}`,cancelLabel:'Keep dead end',
    accept:()=>{if(owner===city) connectNeighbor(link);offerConnections(rest,owner);},
    cancel:()=>offerConnections(rest,owner)});
}
function commitFromPointer(plan) {
  if(plan.requiresConfirmation && plan.valid) {
    const owner=city;
    return constructionDialog({title:plan.bridge?'Build bridge?':'Bore tunnel?',
      message:`${plan.bridge ? `${plan.bridge.length}-tile ${plan.tool} bridge` : `${plan.tiles.length-2}-tile tunnel`}. Total construction cost: $${plan.cost.toLocaleString()}.`,
      acceptLabel:`Build · $${plan.cost.toLocaleString()}`,
      accept:()=>{if(owner!==city)return;const result=commit(plan,{confirmStructures:true,maxCost:plan.cost});if(result.ok)offerConnections(result.connectionOffers || []);}});
  }
  if(!plan.count) {
    const offers=planConnectionOffers(city,plan);
    if(offers.length) return offerConnections(offers);
  }
  const result=commit(plan);
  if(result.ok) offerConnections(result.connectionOffers || []);
}

// One simulated month. The clock in frame() and the agent's run() share it so
// neither can drift from the other.
function stepMonth() {
  undo.clear();
  const result = sim.tick(city);
  const stats = refresh();
  const goal = updateScenario(city, stats);
  if (result.disaster) { ui.notify(result.disaster); audio.effect(/fire|riot/i.test(result.disaster) ? "siren" : "disaster"); }
  if (goal) { ui.notify(goal); audio.effect("cash"); }
  // Autosave every January.
  if (city.month % 12 === 0) { try { localStorage.setItem(slotKey(0), sim.serialize(city)); } catch { /* storage full or blocked */ } }
  return [result.disaster, goal].filter(Boolean);
}

const actions = {
  selectTool: choose, setSpeed, setDensity, undo: undoLast, connectNeighbor,
  getSpeed: () => speed,
  build: (tool, start, end, options) => commit(planConstruction(city, start, end, tool, options), options),
  stepMonths: (n) => { const events = []; for (let i = 0; i < n; i++) events.push(...stepMonth()); lastTick = performance.now(); return events; },
  setTax: (n) => { for (const key of ["residential", "commercial", "industrial"]) sim.setPolicy(city, `tax.${key}`, Number(n)); refresh(); },
  setPolicy: policy,
  renameCity: (name) => policy("name", name),
  save: (slot = 1) => {
    try {
      localStorage.setItem(slotKey(slot), sim.serialize(city));
      ui.notify(slot === 1 ? "City saved in this browser." : `City saved to slot ${slot}.`);
    } catch { ui.notify("Unable to save: browser storage is unavailable or full."); }
  },
  load: (slot = 1) => {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) { ui.notify("No saved city yet."); return; }
    loadFrom(raw, "Saved city restored. Simulation paused.");
  },
  listSaves: () => Array.from({ length: SLOTS + 1 }, (_, slot) => {
    const label = slot === 0 ? "Autosave" : `Slot ${slot}`;
    try {
      const raw = localStorage.getItem(slotKey(slot));
      if (!raw) return { slot, label, empty: true };
      const d = JSON.parse(raw);
      return { slot, label, empty: false, name: d.name, population: d.population, money: d.money, date: sim.dateOf(d.month, d.startYear) };
    } catch { return { slot, label, empty: true }; }
  }),
  exportSave: () => {
    try {
      const blob = new Blob([sim.serialize(city)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${city.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "city"}-${sim.dateOf(city.month, city.startYear).replace(" ", "-")}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      ui.notify("City exported.");
    } catch { ui.notify("Export failed in this browser."); }
  },
  importSave: (text) => loadFrom(text, "City imported. Simulation paused."),
  newCity: (options = {}) => {
    const scenario = options?.scenario || "sandbox";
    const seed = Number.isFinite(options?.seed) ? options.seed : Math.floor(Math.random() * 100000);
    const def = SCENARIOS[scenario] || SCENARIOS.sandbox;
    city = sim.createCity({ seed, starter: def.starter || options?.starter === true, layout: options?.layout, size: options?.size, name: options?.name, startYear: options?.startYear, hills: options?.hills });
    if (Number.isFinite(options?.money) && !def.setup) city.money = options.money;
    startScenario(city, scenario);
    restore();
    lookAtCity();
    ui.notify(def.setup || def.won ? `${def.name}: ${def.description}` : "New city. Lay roads and power, then zone near the roads.");
    tipIndex = city.population > 0 ? TIPS.length : -1;
    ui.tip(null);
    advanceTips();
  },
  explore: () => { ui.notify("Welcome to New Riverton. Press 1 to run time, or click a tool to build."); },
  setOverlay: (id) => { renderer.overlay = id; renderer.dirty = true; ui?.setOverlay(id); },
  zoom: (d) => renderer.zoomAt(d * 0.18),
  home: () => lookAtCity(),
  rotate: (d) => { input?.cancel(); renderer.rotate(d); refreshSelection(); },
  toggleDay: () => { renderer.night = !renderer.night; renderer.dirty = true; audio.setAmbience({ night: renderer.night }); refreshSelection(); },
  toggleSound: async () => {
    try { const enabled = await audio.toggle(); ui.notify(enabled ? "Soundtrack on." : "Sound muted."); return enabled; }
    catch { ui.notify("Audio could not start in this browser."); return false; }
  },
  setDisaster: (id) => {
    undo.clear();
    const message = sim.disaster(city, id);
    renderer.dirty = true;
    refresh();
    audio.effect(id === "fire" || id === "riot" ? "siren" : "disaster");
    ui.notify(message);
  },
};

ui = mountUI(actions);
input = attachInput(canvas, renderer, {
  getCity: () => city, getTool: () => tool, getDensity: () => density, getTools: () => sim.TOOLS,
  onChoose: choose, onSpeed: setSpeed, onUndo: undoLast, onHome: actions.home, onRotate: actions.rotate,
  onPreview: (plan) => ui.setBuildPreview?.(plan || { count: 0, cost: 0, valid: true, message: "" }),
  onInspect: (tile) => { selection = { x: tile.x, y: tile.y }; refreshSelection(); },
  onCommit: commitFromPointer,
}, planConstruction);
const minimap = createMinimap(renderer);
refresh(); choose("inspect"); setDensity(1); setSpeed(0);
tipIndex = TIPS.length; // the starter town needs no walkthrough
if (!new URLSearchParams(location.search).has("play")) ui.showTitle();
document.addEventListener("visibilitychange", () => { lastTick = performance.now(); previousTime = lastTick; });

function frame(now) {
  const delta = Math.min(100, now - previousTime);
  previousTime = now;
  if (speed) animationTime += delta * speed;
  if (speed && !document.hidden && now - lastTick > MONTH_MS / speed) { stepMonth(); lastTick = now; }
  if (!document.hidden) { input.update(delta); renderer.render(city, animationTime); minimap.update(city); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.civic = {
  get city() { return city; },
  get renderer() { return renderer; },
  getStats: () => sim.getStats(city),
  sim,
  // Machine-facing command surface. Start with civic.agent.help().
  agent: createAgentAPI({ getCity: () => city, actions, renderer, ui, undo }),
};
