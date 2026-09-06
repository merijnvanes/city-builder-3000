import "./style.css";
import * as sim from "./sim.js";
import { mountUI } from "./ui.js";
import { CityRenderer } from "./renderer.js";
import { createMinimap } from "./minimap.js";
import { planConstruction, applyConstruction, createUndoManager } from "./construction.js";
import { attachInput } from "./input.js";
import { CityAudio } from "./audio.js";
import { startScenario, updateScenario } from "./scenarios.js";

const SAVE_KEY = "city-builder-3000-save-v3";
const MONTH_MS = 2500;

let city = startScenario(sim.createCity(42, true));
let tool = "inspect", density = 1, speed = 0;
let lastTick = performance.now(), animationTime = 0, previousTime = performance.now(), lastFrame = 0;
const undo = createUndoManager(20);
const audio = new CityAudio();
const canvas = document.querySelector("#city-canvas");
const renderer = new CityRenderer(canvas);
let ui, input;

// Start the camera on the built-up centre of the city (or the map centre).
function lookAtCity() {
  renderer.size = city.size;
  let sx = 0, sy = 0, n = 0;
  for (const t of city.tiles) if (t.type !== "empty") { sx += t.x; sy += t.y; n++; }
  if (n) renderer.focusOn(sx / n, sy / n, 0.85);
  else renderer.focusOn(city.size / 2, city.size / 2, 0.7);
}
lookAtCity();

function refresh() {
  const stats = sim.getStats(city);
  ui?.update(city, stats);
  return stats;
}

function choose(id) {
  input?.cancel();
  tool = id;
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
  ui?.setSelection(null);
  refresh();
}

function undoLast() {
  input?.cancel();
  if (undo.undo(city)) { renderer.dirty = true; refresh(); ui.notify("Construction undone."); }
  else ui.notify("Nothing to undo since the last simulation step.");
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

const actions = {
  selectTool: choose, setSpeed, setDensity, undo: undoLast,
  setTax: (n) => { for (const key of ["residential", "commercial", "industrial"]) sim.setPolicy(city, `tax.${key}`, Number(n)); refresh(); },
  setPolicy: policy,
  renameCity: (name) => policy("name", name),
  save: () => {
    try {
      localStorage.setItem(SAVE_KEY, sim.serialize(city));
      ui.notify("City saved in this browser.");
    } catch { ui.notify("Unable to save: browser storage is unavailable or full."); }
  },
  load: () => {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { ui.notify("No saved city yet."); return; }
    try {
      city = sim.deserialize(raw);
      if (!city.scenario) startScenario(city, "sandbox");
      restore();
      lookAtCity();
      ui.notify("Saved city restored. Simulation paused.");
    } catch (err) { ui.notify(`That save could not be loaded: ${err.message}`); }
  },
  newCity: (options = {}) => {
    const scenario = options?.scenario || "sandbox";
    const seed = Number.isFinite(options?.seed) ? options.seed : Math.floor(Math.random() * 100000);
    city = startScenario(sim.createCity({ seed, starter: scenario === "recovery" || options?.starter === true, layout: options?.layout, size: options?.size, name: options?.name }), scenario);
    restore();
    lookAtCity();
    ui.notify(scenario === "recovery" ? "Riverton needs you. Fix the budget and win back the residents." : "New city. Lay roads and power, then zone near the roads.");
  },
  setOverlay: (id) => { renderer.overlay = id; renderer.dirty = true; ui?.setOverlay(id); },
  zoom: (d) => renderer.zoomAt(d * 0.18),
  home: () => lookAtCity(),
  rotate: (d) => { input?.cancel(); renderer.rotate(d); },
  toggleDay: () => { renderer.night = !renderer.night; renderer.dirty = true; },
  toggleSound: async () => {
    try { const enabled = await audio.toggle(); ui.notify(enabled ? "Soundtrack on." : "Sound muted."); return enabled; }
    catch { ui.notify("Audio could not start in this browser."); return false; }
  },
  setDisaster: (id) => {
    undo.clear();
    const message = sim.disaster(city, id);
    renderer.dirty = true;
    refresh();
    ui.notify(message);
  },
};

ui = mountUI(actions);
input = attachInput(canvas, renderer, {
  getCity: () => city, getTool: () => tool, getDensity: () => density, getTools: () => sim.TOOLS,
  onChoose: choose, onSpeed: setSpeed, onUndo: undoLast, onHome: actions.home, onRotate: actions.rotate,
  onPreview: (plan) => ui.setBuildPreview?.(plan || { count: 0, cost: 0, valid: true, message: "" }),
  onInspect: (tile) => ui.setSelection(sim.inspectTile(city, tile.x, tile.y)),
  onCommit: (plan) => {
    const before = structuredClone(city);
    const result = applyConstruction(city, plan);
    if (result.ok) {
      undo.record(before);
      renderer.dirty = true;
      refresh();
      audio.effect("build");
      ui.notify(`${result.changed} tile${result.changed === 1 ? "" : "s"} · $${Math.round(result.cost).toLocaleString()}`);
    } else {
      audio.effect("error");
      ui.notify(result.message || "Nothing to build here.");
    }
  },
}, planConstruction);
const minimap = createMinimap(renderer);
refresh(); choose("inspect"); setDensity(1); setSpeed(0);
document.addEventListener("visibilitychange", () => { lastTick = performance.now(); previousTime = lastTick; });

function frame(now) {
  const delta = Math.min(100, now - previousTime);
  previousTime = now;
  if (speed) animationTime += delta * speed;
  if (speed && !document.hidden && now - lastTick > MONTH_MS / speed) {
    undo.clear();
    const result = sim.tick(city);
    lastTick = now;
    const stats = refresh();
    const goal = updateScenario(city, stats);
    if (result.disaster) ui.notify(result.disaster);
    if (goal) ui.notify(goal);
  }
  if (now - lastFrame > 32) { renderer.render(city, animationTime); minimap.update(city); lastFrame = now; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.civic = { get city() { return city; }, get renderer() { return renderer; }, getStats: () => sim.getStats(city), sim };
