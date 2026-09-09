import { constructionDialog } from './construction-dialog.js';
import { quoteConnection, CONNECTION_TYPES } from './sim/neighbor-links.js';
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
import { saveStore, AUTOSAVE_SLOT, RESCUE_SLOT, slotLabel } from "./save-store.js";
import { installCrashGuard } from "./crash-guard.js";
import { registerServiceWorker } from "./service-worker-client.js";

const MONTH_MS = 2500;

// The four fields the save dialog prints. They travel with the city so listing
// the slots never has to parse a megabyte of stored JSON back out.
const metaOf = (c) => ({ name: c.name, population: c.population, money: c.money, month: c.month, startYear: c.startYear });

// A throw inside frame() ends the render loop, because the loop reschedules
// itself on its last line. The city is still in memory at that moment, so it is
// written to a slot of its own and offered back as a file before the player
// reloads the page and loses it.
//
// The guard goes up before anything else runs. A failure while the interface is
// still being built is the one the player can make least sense of, and it is
// also the one that would otherwise reach nobody, so it gets a plain message
// with no game behind it.
installCrashGuard({
  target: window,
  report: ({ message, stack, source }) => {
    // Every step here stands alone. Whatever broke may be the thing this
    // handler is about to touch, and the parts that still work should run.
    try { setSpeed(0); } catch { /* the clock is the least of it */ }
    let text = null;
    try { text = sim.serialize(city); } catch { /* the city itself may be what broke */ }
    const stored = text ? rescue(text) : Promise.resolve({ ok: false });
    try {
      if (ui?.showCrash) { ui.showCrash({ message, stack, source, text, stored }); return; }
    } catch { /* fall through to the plain message */ }
    bareCrashNotice(message, source, text);
  },
});

// Keep the first rescued city. A second crash, or a crash in another tab, must
// not overwrite one the player has not collected yet; the newer city is still
// in the dialog to download.
async function rescue(text) {
  try {
    if ((await saveStore.read(RESCUE_SLOT)).ok) return { ok: true, kept: true };
    return await saveStore.write(RESCUE_SLOT, text, (() => { try { return metaOf(city); } catch { return null; } })());
  } catch { return { ok: false }; }
}

// The interface never got built, or it is what broke. This owes the player two
// things: what happened, and their city.
function bareCrashNotice(message, source, text) {
  try {
    const notice = document.createElement("div");
    notice.id = "boot-failure";
    notice.setAttribute("role", "alert");
    notice.append(Object.assign(document.createElement("h1"), { textContent: "The game stopped" }));
    notice.append(Object.assign(document.createElement("p"), { textContent: source ? `${message} (${source})` : message }));
    if (text) {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      link.download = "city-rescued.json";
      link.textContent = "Download this city";
      notice.append(link);
    }
    document.body.appendChild(notice);
  } catch { /* there is nothing left to tell the player with */ }
}

// Set while a city is being read back, so nothing writes over the slot the
// player is in the middle of loading from.
let loading = false;
// A slot whose city this build could not read. Its bytes are the player's only
// copy until they download them, so nothing writes there by itself.
let unreadableSlot = null;

// One place that writes a city and says what happened. Every caller reports the
// failure: a save that quietly did not happen is how a long game disappears.
// The autosave stands between a closed tab and a lost afternoon. It runs every
// January, once a minute while the city is being played, and again when the
// page is put away. The minute matters most: closing a desktop tab kills the
// page before an IndexedDB write can commit, so the honest guarantee is not
// "nothing is lost" but "no more than the last minute of it".
//
// `city.revision` counts every change the simulation makes and only ever climbs,
// so a city that has not moved is never written twice. The city as it arrived —
// at boot, or from a load, or as a new city — counts as already stored. A
// player who opens the game, looks at a new city and leaves must not have their
// autosave replaced by the empty map they were looking at.
const AUTOSAVE_EVERY_MS = 60_000;
// A floor under the automatic triggers, so a fast clock cannot turn a big city
// into a write every few seconds. Putting the page away ignores it.
const AUTOSAVE_FLOOR_MS = 5_000;
let savedRevision = -1, lastAutosaveAt = -Infinity, autosaving = false, autosaveQueued = false;

async function autosave({ urgent = false } = {}) {
  if (!urgent && performance.now() - lastAutosaveAt < AUTOSAVE_FLOOR_MS) return { ok: true, skipped: true };
  // A save already writing holds the city as it was when it started. An urgent
  // request arriving behind it has newer changes, so it waits its turn rather
  // than being dropped: the page going away is exactly when that matters.
  if (autosaving) { autosaveQueued = autosaveQueued || urgent; return { ok: true, queued: urgent }; }
  if (city.revision === savedRevision) return { ok: true, skipped: true };
  autosaving = true;
  const revision = city.revision;
  let result;
  try {
    result = await storeCity(AUTOSAVE_SLOT, { quiet: true });
    if (result.ok) { savedRevision = revision; lastAutosaveAt = performance.now(); }
  } finally { autosaving = false; }
  if (autosaveQueued) { autosaveQueued = false; return autosave({ urgent: true }); }
  return result;
}

async function storeCity(slot, { quiet = false, force = false } = {}) {
  if (loading) return { ok: false, message: "A city is being loaded." };
  if (slot === unreadableSlot && !force) return { ok: false, message: `${slotLabel(slot)} holds a city this version could not read. Download it first, or save over it from the save dialog.` };
  const result = await saveStore.write(slot, sim.serialize(city), metaOf(city));
  if (!result.ok) ui?.notify(result.message);
  else if (!quiet) ui?.notify(slot === AUTOSAVE_SLOT ? "City autosaved." : `City saved to ${slotLabel(slot).toLowerCase()}.`);
  return result;
}

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
  ui?.setSelection({ ...sim.inspectTile(city, selection.x, selection.y), tile: city.tiles[selection.y * city.size + selection.x], night: renderer.night, rotation: renderer.rotation });
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
  // A city that has just arrived is a city nobody has played yet. It counts as
  // stored until something changes it, so looking at a new map and leaving does
  // not replace the autosave with it.
  savedRevision = city.revision;
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

// Hand the player a file. The only way out of the browser for a city, whether
// it is being exported on purpose or rescued from a save that will not load.
function downloadText(name, text) {
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return true;
  } catch { return false; }
}

function loadFrom(raw, message, slot = null) {
  try {
    city = sim.deserialize(raw);
    if (!city.scenario) startScenario(city, "sandbox");
    restore();
    lookAtCity();
    ui.notify(message);
    if (slot === unreadableSlot) unreadableSlot = null;
    return { ok: true };
  } catch (err) {
    // The city is still in there; this build just cannot read it. Offer the
    // bytes back, and stop writing to that slot until the player has them: the
    // next January would otherwise autosave over their only copy.
    if (slot !== null) unreadableSlot = slot;
    ui.offerRescue?.(raw, err.message);
    return { ok: false, message: `That save could not be loaded: ${err.message}` };
  }
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
    message:`Connect ${CONNECTION_TYPES[link.route].label.toLowerCase()} to ${city._connections[link.side].name} for $${quote.cost.toLocaleString()}?`,
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
  if (city.month % 12 === 0) void autosave();
  return [result.disaster, goal].filter(Boolean);
}

const actions = {
  selectTool: choose, setSpeed, setDensity, undo: undoLast, connectNeighbor,
  clearSelection: () => { selection = null; ui?.setSelection(null); },
  getSpeed: () => speed,
  build: (tool, start, end, options) => commit(planConstruction(city, start, end, tool, options), options),
  stepMonths: (n) => { const events = []; for (let i = 0; i < n; i++) events.push(...stepMonth()); lastTick = performance.now(); return events; },
  setTax: (n) => { for (const key of ["residential", "commercial", "industrial"]) sim.setPolicy(city, `tax.${key}`, Number(n)); refresh(); },
  setPolicy: policy,
  renameCity: (name) => policy("name", name),
  // Saving from the dialog is a deliberate act, so it may write over a slot the
  // game refuses to autosave into.
  save: (slot = 1) => storeCity(slot, { force: true }),
  load: async (slot = 1) => {
    // The clock stops before the read, not after it. Reading a city takes long
    // enough for a month to tick over, and a January tick during that gap would
    // autosave the city being replaced over the one being loaded.
    setSpeed(0);
    loading = true;
    try {
      const result = await saveStore.read(slot);
      if (!result.ok) { ui.notify(result.message); return result; }
      return loadFrom(result.text, "Saved city restored. Simulation paused.", slot);
    } finally { loading = false; }
  },
  clearSave: async (slot) => {
    const result = await saveStore.remove(slot);
    if (result.ok && slot === unreadableSlot) unreadableSlot = null;
    ui.notify(result.ok ? `${slotLabel(slot)} cleared.` : result.message);
    return result;
  },
  listSaves: async () => (await saveStore.list()).map((s) => (
    s.empty || s.damaged ? s : { ...s, date: sim.dateOf(s.month, s.startYear) }
  )),
  exportSave: () => {
    const name = `${city.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "city"}-${sim.dateOf(city.month, city.startYear).replace(" ", "-")}.json`;
    if (downloadText(name, sim.serialize(city))) ui.notify("City exported.");
    else ui.notify("Export failed in this browser.");
  },
  downloadRescue: (text) => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    if (downloadText(`city-unreadable-${stamp}.json`, text)) ui.notify("Saved city downloaded.");
    else ui.notify("Download failed in this browser.");
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
// The city as the page booted counts as already saved, so switching away from
// an untouched tab never overwrites the autosave with the sample town.
savedRevision = city.revision;

// Putting the page away is the last certain moment to write. `visibilitychange`
// is the one to trust: on a phone it fires as the tab goes to the background,
// while the page is still running and IndexedDB can still commit. `pagehide`
// covers closing a desktop tab, where the write may or may not finish; it is a
// second chance, not the plan.
document.addEventListener("visibilitychange", () => {
  lastTick = performance.now(); previousTime = lastTick;
  if (document.hidden) void autosave({ urgent: true });
});
window.addEventListener("pagehide", () => { void autosave({ urgent: true }); });

// Offline play, and artwork that survives a cleared browser cache. Only in a
// built site: a worker left registered by a dev server outlives the session and
// answers with yesterday's code.
if (import.meta.env?.PROD) {
  registerServiceWorker({
    // Taking the update reloads the page, which ends the session. The city goes
    // to the autosave first and the reload waits for the write to commit: this
    // is a deliberate reload, so there is no reason to gamble on pagehide.
    onUpdateReady: (accept) => ui?.offerUpdate?.(async () => {
      await autosave({ urgent: true });
      accept();
    }),
  });
}


function frame(now) {
  const delta = Math.min(100, now - previousTime);
  previousTime = now;
  if (speed) animationTime += delta * speed;
  if (speed && !document.hidden && now - lastTick > MONTH_MS / speed) { stepMonth(); lastTick = now; }
  // Closing a desktop tab kills the page before an IndexedDB write can commit,
  // so the exposure has to be bounded while the tab is still open rather than
  // patched at the moment it closes.
  if (!document.hidden && now - lastAutosaveAt > AUTOSAVE_EVERY_MS) void autosave();
  if (!document.hidden) { input.update(delta); renderer.render(city, animationTime); minimap.update(city); }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.civic = {
  get city() { return city; },
  get renderer() { return renderer; },
  getStats: () => sim.getStats(city),
  sim,
  saveStore,
  // Machine-facing command surface. Start with civic.agent.help().
  agent: createAgentAPI({ getCity: () => city, actions, renderer, ui, undo }),
};
