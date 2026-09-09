import { connectionOffers, quoteConnection } from './sim/neighbor-links.js';
// agent-api.js — a machine-facing command surface for the running game.
//
// Every command adapts something the mouse and keyboard already drive.
// Building goes through the same planConstruction/applyConstruction path as a
// drag, so validity, pricing, funds and undo behave identically. Policy,
// speed, saves and disasters go through the `actions` object in main.js.
// Nothing is implemented twice, and the catalog stays the only place that
// knows what can be built.
//
// The map accessors are level-of-detail on purpose. overview() and field()
// cost the same whatever the map size; region() is bounded by the window you
// ask for; objects() scales with what is built rather than with map area.
// Nothing here ever returns the whole tile array.
import {
  TOOLS, TOOL_MAP, BUILDINGS, ZONE_TYPES, ZONED_TYPES, PORT_TYPES,
  ORDINANCES, DISASTERS, FUNDED_DEPARTMENTS, evaluate, getStats, inspectTile,
} from "./sim/index.js";
import { isAnchor, capacityOf } from "./sim/lots.js";
import { MAX_ELEVATION } from "./sim/terrain.js";

// One character per tile for region(). The alphabet is deliberately small:
// terrain, the three zones, the road network, and one letter per building
// group. Exact identity comes from objects(), so a new building in the
// catalog never needs an edit here.
const TERRAIN_CHAR = { water: "~", sand: ":", grass: "." };
const ZONE_CHAR = { residential: "r", commercial: "c", industrial: "i" };
const PORT_CHAR = { airport: "A", seaport: "K" };
const ROAD_CHAR = { road: "#", highway: "=", rail: "+", onramp: "^" };
const GROUP_CHAR = { transport: "T", utilities: "P", civic: "V", emergency: "E", landmark: "L", landscape: "*", special: "S" };

// Extra planes, asked for by name. Booleans render as +/-, numbers as a
// digit. Numeric layers are scaled against the window and report their range,
// so a digit always has a stated meaning.
const LAYERS = {
  elev: { get: (t) => t.elev, max: MAX_ELEVATION },
  density: { get: (t) => t.density, max: 3 },
  level: { get: (t) => t.level, max: 4 },
  pollution: { get: (t) => t.pollution },
  crime: { get: (t) => t.crime },
  traffic: { get: (t) => t.traffic },
  land: { get: (t) => t.landValue },
  aura: { get: (t) => t.aura ?? 0 },
  power: { get: (t) => t.powered },
  water: { get: (t) => t.watered },
  road: { get: (t) => t.roadAccess },
  powerline: { get: (t) => t.powerline },
  pipe: { get: (t) => t.pipe },
  subway: { get: (t) => t.subway },
  tunnel: { get: (t) => !!t.tunnel },
  fire: { get: (t) => t.fire > 0 },
  trees: { get: (t) => t.trees, max: 3 },
};

const SERVICES = ["police", "fire", "health", "education", "culture", "park", "bus", "rail"];

// overview() and field() always fold the map into at most this many chunks per
// side, so their output size does not grow with the map.
const CHUNKS = 16;
// region() refuses windows larger than this many tiles per layer.
const MAX_REGION = 4096;
const MAX_OBJECTS = 600;
const LOG_SIZE = 50;

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const int = (v) => (Number.isFinite(v) ? Math.round(v) : NaN);
// Save slots run 0..3 and 0 is a real slot (the January autosave), so a
// falsy-check default would silently retarget it.
const slotOf = (v) => (Number.isFinite(int(v)) ? clamp(int(v), 0, 3) : 1);
const round1 = (v) => Math.round(v * 10) / 10;

function charFor(t) {
  if (t.fire > 0) return "!";
  if (t.type === "empty") return t.terrain === "grass" && t.trees ? '"' : TERRAIN_CHAR[t.terrain] || "?";
  if (ZONE_TYPES.has(t.type)) {
    const c = ZONE_CHAR[t.type];
    // Uppercase means productive. Lowercase means zoned-and-empty or
    // abandoned; region().alerts names the abandoned ones exactly.
    return t.lot && t.level && !t.abandoned ? c.toUpperCase() : c;
  }
  if (PORT_TYPES.has(t.type)) return PORT_CHAR[t.type] || "A";
  if (ROAD_CHAR[t.type]) return ROAD_CHAR[t.type];
  return GROUP_CHAR[BUILDINGS[t.type]?.group] || "?";
}

// The legend for whatever actually appears in a window, so a response never
// carries the whole alphabet when the window is all grass.
function legendFor(chars) {
  const all = {
    ".": "empty land", '"': "trees", "~": "water", ":": "sand", "!": "on fire",
    r: "residential zone, empty or abandoned", R: "residential, developed",
    c: "commercial zone, empty or abandoned", C: "commercial, developed",
    i: "industrial zone, empty or abandoned", I: "industrial, developed",
    "#": "road", "=": "highway", "+": "rail", "^": "on-ramp",
    A: "airport", K: "seaport",
    T: "transport building", P: "power or water plant", V: "civic building",
    E: "emergency unit", L: "landmark", "*": "park or landscape", S: "special building",
    "?": "unknown type",
  };
  return Object.fromEntries([...chars].sort().filter((c) => all[c]).map((c) => [c, all[c]]));
}

// A zoned tile that is not yet a lot has no anchor, but it is exactly where an
// agent needs to hear about missing power or roads. Treat both as one plot.
const isPlot = (t) => isAnchor(t) || (ZONED_TYPES.has(t.type) && !t.lot);

// Sparse problem lists: an accurate count, and at most `cap` coordinates, so a
// whole unpowered district costs the same to report as a single lot.
function sparse(cap = 20) {
  const list = [];
  let count = 0;
  return { add(x, y) { count++; if (list.length < cap) list.push([x, y]); }, get count() { return count; },
    get where() { return list; }, get label() { return `${count}${count > cap ? ` (first ${cap} listed)` : ""}`; } };
}

// Every grid this file returns has one shape: two ruler rows for the x axis,
// then one y-labelled row per line. Labels are always tile coordinates, so a
// chunk grid reads the same way as a tile grid, with `step` tiles per cell.
function frame(x0, y0, w, h, cell, step = 1) {
  const pad = String(y0 + (h - 1) * step).length;
  const gutter = " ".repeat(pad + 1);
  const tens = [], ones = [];
  for (let i = 0; i < w; i++) { const x = x0 + i * step; tens.push(x % 10 === 0 ? String(Math.floor(x / 10) % 10) : " "); ones.push(String(x % 10)); }
  const rows = [`${gutter}${tens.join("")}`, `${gutter}${ones.join("")}`];
  for (let j = 0; j < h; j++) {
    let line = "";
    for (let i = 0; i < w; i++) line += cell(x0 + i * step, y0 + j * step);
    rows.push(`${String(y0 + j * step).padStart(pad)} ${line}`);
  }
  return rows;
}

// Bounding box of everything built, which is the window an agent almost
// always wants. Falls back to the whole map on an untouched one.
function builtBounds(city, margin = 3) {
  let x0 = city.size, y0 = city.size, x1 = -1, y1 = -1;
  for (const t of city.tiles) {
    if (t.type === "empty" && !t.powerline && !t.pipe && !t.subway) continue;
    if (t.x < x0) x0 = t.x; if (t.x > x1) x1 = t.x;
    if (t.y < y0) y0 = t.y; if (t.y > y1) y1 = t.y;
  }
  if (x1 < 0) return { x: 0, y: 0, w: city.size, h: city.size };
  x0 = clamp(x0 - margin, 0, city.size - 1); y0 = clamp(y0 - margin, 0, city.size - 1);
  x1 = clamp(x1 + margin, 0, city.size - 1); y1 = clamp(y1 + margin, 0, city.size - 1);
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function clampBox(city, box) {
  const x = clamp(int(box?.x ?? 0) || 0, 0, city.size - 1);
  const y = clamp(int(box?.y ?? 0) || 0, 0, city.size - 1);
  const w = clamp(int(box?.w ?? city.size) || 1, 1, city.size - x);
  const h = clamp(int(box?.h ?? city.size) || 1, 1, city.size - y);
  return { x, y, w, h };
}

export function createAgentAPI({ getCity, actions, renderer, ui, undo }) {
  const history = [];

  // Always-on visible log: the human sees a notice, the ticker sees a line,
  // and the camera moves to the work when it is off screen.
  function announce(summary, focus) {
    history.push({ at: new Date().toISOString(), ...summary });
    if (history.length > LOG_SIZE) history.shift();
    const city = getCity();
    ui?.notify?.(`Agent: ${summary.text}`);
    if (Array.isArray(city.news)) city.news.push(`Agent: ${summary.text}`);
    if (focus && renderer && !onScreen(focus.x, focus.y)) renderer.focusOn(focus.x, focus.y);
  }

  function onScreen(x, y) {
    if (!renderer?.project || !renderer.w) return true;
    const p = renderer.project(x + 0.5, y + 0.5);
    const inset = 60;
    return p.x > inset && p.x < renderer.w - inset && p.y > inset && p.y < renderer.h - inset;
  }

  // Numeric layers scale against the window they are drawn for, so a digit
  // always means something the caller was told.
  function layerRows(city, box, name) {
    const spec = LAYERS[name];
    if (!spec) return null;
    const at = (x, y) => spec.get(city.tiles[y * city.size + x]);
    const sample = at(box.x, box.y);
    if (typeof sample === "boolean") {
      return { rows: frame(box.x, box.y, box.w, box.h, (x, y) => (at(x, y) ? "+" : "-")), scale: "+ = yes, - = no" };
    }
    let lo = Infinity, hi = -Infinity;
    for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) { const v = at(x, y) || 0; if (v < lo) lo = v; if (v > hi) hi = v; }
    const max = spec.max ?? hi;
    if (spec.max != null) return { rows: frame(box.x, box.y, box.w, box.h, (x, y) => String(clamp(Math.round(at(x, y) || 0), 0, 9))), scale: `raw value, 0..${spec.max}` };
    const span = hi - lo || 1;
    return {
      rows: frame(box.x, box.y, box.w, box.h, (x, y) => String(clamp(Math.round((((at(x, y) || 0) - lo) / span) * 9), 0, 9))),
      scale: `0 = ${round1(lo)}, 9 = ${round1(hi)}`,
    };
  }

  // Horizontal runs of a 1x1 network type, so a 40-tile road is one entry.
  function runsOf(city, box, match, label) {
    const out = [];
    for (let y = box.y; y < box.y + box.h; y++) {
      let start = -1;
      for (let x = box.x; x <= box.x + box.w; x++) {
        const hit = x < box.x + box.w && match(city.tiles[y * city.size + x]);
        if (hit && start < 0) start = x;
        else if (!hit && start >= 0) { out.push({ type: label, x: start, y, w: x - start, h: 1 }); start = -1; }
      }
    }
    return out;
  }

  const api = {
    // ---- discovery ----------------------------------------------------

    // One call that tells an agent everything it may name. Generated from the
    // catalog, so it can never drift from what the game accepts.
    help() {
      return {
        commands: Object.keys(api).sort(),
        tools: TOOLS.map((t) => ({ id: t.id, label: t.label, cost: t.cost, group: t.group, w: t.w ?? 1, h: t.h ?? 1, description: t.description })),
        drag: { rect: [...ZONED_TYPES, "bulldoze", ...Object.keys(BUILDINGS).filter((k) => BUILDINGS[k].rect)], path: Object.keys(BUILDINGS).filter((k) => BUILDINGS[k].path) },
        densities: { 1: "low", 2: "medium", 3: "high" },
        policies: {
          "tax.residential | tax.commercial | tax.industrial": "0-20 percent",
          [`fund.${FUNDED_DEPARTMENTS.join(" | fund.")}`]: "0-150 percent",
          [`ordinance.${Object.keys(ORDINANCES).join(" | ordinance.")}`]: "true or false",
          name: "rename the city", loan: "take a loan",
        },
        ordinances: Object.fromEntries(Object.entries(ORDINANCES).map(([k, o]) => [k, o.description])),
        disasters: Object.keys(DISASTERS),
        layers: Object.keys(LAYERS),
        services: SERVICES,
        notes: [
          "build(tool, x1, y1, x2, y2) drags from the first corner to the second, exactly like the mouse.",
          "Bridges and tunnels return requiresConfirmation and quote without building. Repeat with {confirmStructures:true,maxCost:quote} as the sixth argument to accept.",
          "Rectangle tools fill the box. Path tools draw a Manhattan L. Everything else places one footprint centred on x2,y2.",
          "World corners: north=(0,0), east=(size,0), south=(size,size), west=(0,size). Default camera has north at the top. Camera rotation never changes world directions.",
          "Border sides: northeast=y:0, southeast=x:size-1, southwest=y:size-1, northwest=x:0. Use these full side names for deals and connectNeighbor.",
          "Border builds return connectionOffers. connections() lists offers; connectNeighbor(x,y,side,route) explicitly pays to establish one.",
          "region() is bounded; overview() and field() cost the same on any map size.",
          "Read objects() for exact building identity; the region grid only shows the group.",
        ],
      };
    },

    // ---- reading ------------------------------------------------------

    // Compact snapshot. No tiles: use overview, region, objects or field.
    state() {
      const city = getCity();
      const s = getStats(city);
      return {
        name: s.name, date: s.date, year: s.year, month: s.month,
        money: Math.round(s.money), debt: Math.round(s.debt), loans: s.loans.length,
        population: s.population, jobs: s.jobs, workers: s.workers, employed: s.employed,
        unemployment: round1(s.unemployment),
        demand: s.demand,
        budget: { income: Math.round(s.income), expenses: Math.round(s.expenses), balance: Math.round(s.balance), loanPayment: Math.round(s.loanPayment) },
        taxes: s.taxes, funding: s.funding,
        ordinances: Object.keys(s.ordinances).filter((k) => s.ordinances[k]),
        metrics: {
          pollution: round1(s.pollution), crime: round1(s.crime), traffic: round1(s.traffic),
          landValue: round1(s.landValue), health: round1(s.health), education: round1(s.education),
          happiness: round1(s.happiness), lifeExpectancy: round1(s.lifeExpectancy),
        },
        utilities: { power: s.power, water: s.water, garbage: { produced: Math.round(s.garbageProduced), capacity: Math.round(s.garbageCapacity) } },
        zones: s.zones, counts: s.counts, abandonedLots: s.abandonedLots,
        map: { size: city.size, built: builtBounds(city, 0) },
        advisors: s.advisors.filter((a) => a.mood !== "good").map((a) => ({ who: a.id ?? a.name, mood: a.mood, message: a.message })),
        advice: s.advice,
        petition: s.petition ? { id: s.petition.id, title: s.petition.title, body: s.petition.body } : null,
        scenario: city.scenario ?? null,
        news: s.news.slice(-6),
        available: Object.keys(s.available).filter((k) => s.available[k]),
        speed: actions.getSpeed?.() ?? null,
      };
    },

    // Whole-map orientation at fixed cost: the map folds into at most 16x16
    // chunks whatever its real size, each showing its dominant feature.
    overview() {
      const city = getCity();
      const step = Math.max(1, Math.ceil(city.size / CHUNKS));
      const n = Math.ceil(city.size / step);
      const chars = new Set();
      const cell = (x0, y0) => {
        const counts = new Map();
        for (let y = y0; y < Math.min(city.size, y0 + step); y++)
          for (let x = x0; x < Math.min(city.size, x0 + step); x++) {
            const c = charFor(city.tiles[y * city.size + x]);
            counts.set(c, (counts.get(c) || 0) + 1);
          }
        // Anything built outweighs bare ground, so a small settlement on a big
        // map still shows up instead of vanishing into the grass.
        let best = ".", bestN = -1;
        for (const [c, k] of counts) {
          const weight = '.~:"'.includes(c) ? k / 1000 : k;
          if (weight > bestN) { best = c; bestN = weight; }
        }
        chars.add(best);
        return best;
      };
      return { size: city.size, chunk: step, cell: `${step}x${step} tiles`, built: builtBounds(city, 0), rows: frame(0, 0, n, n, cell, step), legend: legendFor(chars) };
    },

    // Full detail for one window. Defaults to the built-up area. Extra planes
    // come back aligned to the same box, one row set per requested layer.
    region(x, y, w, h, opts = {}) {
      const city = getCity();
      const box = x == null ? builtBounds(city) : clampBox(city, { x, y, w, h });
      if (box.w * box.h > MAX_REGION) return { ok: false, error: `Window is ${box.w}x${box.h} = ${box.w * box.h} tiles; the limit is ${MAX_REGION}. Ask for a smaller box or use overview().` };
      const chars = new Set();
      const rows = frame(box.x, box.y, box.w, box.h, (px, py) => { const c = charFor(city.tiles[py * city.size + px]); chars.add(c); return c; });

      // Rare states go back as coordinates rather than as more characters.
      const found = { abandoned: sparse(), onFire: sparse(), unpowered: sparse(), unwatered: sparse(), noRoad: sparse() };
      for (let py = box.y; py < box.y + box.h; py++)
        for (let px = box.x; px < box.x + box.w; px++) {
          const t = city.tiles[py * city.size + px];
          if (t.fire > 0) found.onFire.add(px, py);
          if (!isPlot(t)) continue;
          if (t.abandoned) found.abandoned.add(px, py);
          if (!t.powered) found.unpowered.add(px, py);
          if (!t.watered && t.density >= 2) found.unwatered.add(px, py);
          if (!t.roadAccess) found.noRoad.add(px, py);
        }
      const alerts = Object.fromEntries(Object.entries(found).filter(([, s]) => s.count)
        .map(([k, s]) => [k, { count: s.count, where: s.where }]));

      const want = Array.isArray(opts.layers) ? opts.layers : [];
      const layers = {};
      for (const name of want) {
        const l = layerRows(city, box, name);
        if (l) layers[name] = l; else layers[name] = { error: `Unknown layer. Known: ${Object.keys(LAYERS).join(", ")}` };
      }
      return { box, rows, legend: legendFor(chars), alerts, ...(want.length ? { layers } : {}) };
    },

    // Everything built, once each. A 3x3 lot is one entry, not nine tiles, and
    // roads come back as runs. This scales with the city, not with the map.
    objects(filter = {}) {
      const city = getCity();
      const box = filter.box ? clampBox(city, filter.box) : { x: 0, y: 0, w: city.size, h: city.size };
      const wantType = filter.type ? new Set([].concat(filter.type)) : null;
      const wantGroup = filter.group ? new Set([].concat(filter.group)) : null;
      const inBox = (t) => t.x >= box.x && t.y >= box.y && t.x < box.x + box.w && t.y < box.y + box.h;
      const out = [];

      for (const t of city.tiles) {
        if (!isAnchor(t) || !inBox(t)) continue;
        const group = ZONED_TYPES.has(t.type) ? "zone" : BUILDINGS[t.type]?.group;
        if (wantType && !wantType.has(t.type)) continue;
        if (wantGroup && !wantGroup.has(group)) continue;
        const o = { type: t.type, group, x: t.x, y: t.y, w: t.lot.w, h: t.lot.h };
        if (ZONE_TYPES.has(t.type)) { o.density = t.density; o.level = t.level; o.capacity = capacityOf(t); }
        if (t.abandoned) o.abandoned = true;
        if (t.fire > 0) o.onFire = true;
        if (!t.powered) o.unpowered = true;
        if (!t.watered) o.unwatered = true;
        if (!t.roadAccess) o.noRoad = true;
        out.push(o);
      }

      // 1x1 network tiles have no lot, so they are grouped into runs instead.
      const nets = [
        ["road", (t) => t.type === "road"], ["highway", (t) => t.type === "highway"],
        ["rail", (t) => t.type === "rail"], ["onramp", (t) => t.type === "onramp"],
      ];
      for (const [label, match] of nets) {
        if (wantType && !wantType.has(label)) continue;
        if (wantGroup && !wantGroup.has("transport")) continue;
        out.push(...runsOf(city, box, match, label));
      }
      if (filter.networks) {
        for (const [label, match] of [["powerline", (t) => t.powerline], ["pipe", (t) => t.pipe], ["subway", (t) => t.subway]])
          out.push(...runsOf(city, box, match, label));
      }

      const list = filter.problem ? out.filter((o) => o.abandoned || o.unpowered || o.noRoad || o.onFire) : out;
      const limit = clamp(int(filter.limit ?? MAX_OBJECTS) || MAX_OBJECTS, 1, MAX_OBJECTS);
      return { box, count: list.length, truncated: list.length > limit, objects: list.slice(0, limit) };
    },

    // One numeric layer for the whole map, folded to the same chunk grid as
    // overview(). Chunk values are means, so this reads as a heat map.
    field(name, opts = {}) {
      const city = getCity();
      const spec = name === "service" ? null : LAYERS[name];
      const svc = name === "service" ? (SERVICES.includes(opts.kind) ? opts.kind : null) : undefined;
      if (!spec && svc === undefined) return { ok: false, error: `Unknown field "${name}". Known: ${Object.keys(LAYERS).join(", ")}, service (with kind: ${SERVICES.join(" | ")}).` };
      if (svc === null) return { ok: false, error: `field("service") needs kind: one of ${SERVICES.join(", ")}.` };
      const at = svc ? (t) => t.svc?.[svc] ?? 0 : (t) => { const v = spec.get(t); return typeof v === "boolean" ? (v ? 1 : 0) : v || 0; };

      const step = Math.max(1, Math.ceil(city.size / CHUNKS));
      const n = Math.ceil(city.size / step);
      const mean = (x0, y0) => {
        let sum = 0, k = 0;
        for (let y = y0; y < Math.min(city.size, y0 + step); y++)
          for (let x = x0; x < Math.min(city.size, x0 + step); x++) { sum += at(city.tiles[y * city.size + x]); k++; }
        return k ? sum / k : 0;
      };
      let lo = Infinity, hi = -Infinity;
      for (let y = 0; y < n * step; y += step) for (let x = 0; x < n * step; x += step) { const m = mean(x, y); if (m < lo) lo = m; if (m > hi) hi = m; }
      const span = hi - lo || 1;
      return {
        field: svc ? `service.${svc}` : name, chunk: step, cell: `${step}x${step} tiles`,
        scale: `0 = ${round1(lo)}, 9 = ${round1(hi)}`,
        rows: frame(0, 0, n, n, (x, y) => String(clamp(Math.round(((mean(x, y) - lo) / span) * 9), 0, 9)), step),
      };
    },

    // Everything the inspect tool shows, plus the raw tile for exact numbers.
    query(x, y) {
      const city = getCity();
      const px = int(x), py = int(y);
      if (!Number.isFinite(px) || !Number.isFinite(py)) return { ok: false, error: "query(x, y) needs two integers." };
      const info = inspectTile(city, px, py);
      const t = city.tiles[py * city.size + px];
      if (!t) return info;
      return {
        ...info,
        tile: {
          x: t.x, y: t.y, type: t.type, terrain: t.terrain, elev: t.elev, waterLevel: t.waterLevel, trees: t.trees, salt: t.salt,
          density: t.density, level: t.level, abandoned: t.abandoned, lot: t.lot, fire: t.fire,
          powered: t.powered, watered: t.watered, roadAccess: t.roadAccess,
          powerline: t.powerline, pipe: t.pipe, subway: t.subway, tunnel: t.tunnel, structure:t.structure || null, under: t.under, countyConnections: (city.transportConnections || []).filter(link=>link.x===t.x && link.y===t.y),
          pollution: round1(t.pollution), crime: round1(t.crime), traffic: round1(t.traffic),
          landValue: round1(t.landValue), aura: round1(t.aura ?? 0), reach: t.reach,
          svc: t.svc, industry: t.industry, commerce: t.commerce,
        },
      };
    },

    // Where can this actually go? Uses the sim's own evaluate(), so a spot it
    // returns is a spot the game accepts.
    find(tool, opts = {}) {
      const city = getCity();
      if (!Object.hasOwn(TOOL_MAP, String(tool))) return { ok: false, error: `Unknown tool "${tool}". See help().tools.` };
      const box = opts.box ? clampBox(city, opts.box) : { x: 0, y: 0, w: city.size, h: city.size };
      const density = [1, 2, 3].includes(opts.density) ? opts.density : 1;
      const limit = clamp(int(opts.limit ?? 10) || 10, 1, 100);
      const near = opts.near && Number.isFinite(opts.near.x) ? opts.near : null;
      const hits = [];
      const candidates=[];
      for(let y=box.y;y<box.y+box.h;y++)for(let x=box.x;x<box.x+box.w;x++)candidates.push({x,y});
      if(['makewater','makeland'].includes(tool) && near)candidates.sort((a,b)=>(Math.abs(a.x-near.x)+Math.abs(a.y-near.y))-(Math.abs(b.x-near.x)+Math.abs(b.y-near.y)));
      let searched=0;
      for(const {x,y} of candidates) {
        searched++;
        const ev = evaluate(city, x, y, tool, { density });
        if (!ev.ok || ev.noop) continue;
        hits.push({ x, y, cost: ev.cost, d: near ? Math.abs(x - near.x) + Math.abs(y - near.y) : 0 });
        // Water tools return the nearest requested valid sites without
        // running basin simulations for every other tile on the map.
        if(['makewater','makeland'].includes(tool) && hits.length>=limit)break;
      }
      hits.sort((a, b) => a.d - b.d || a.cost - b.cost);
      return { tool, density, found: hits.length, exhaustive: searched===candidates.length, spots: hits.slice(0, limit).map(({ x, y, cost }) => ({ x, y, cost })) };
    },

    // What is wrong right now, worst first. Advisor lines come from the sim,
    // so this stays in step with what the human sees on screen.
    problems() {
      const city = getCity();
      const s = getStats(city);
      const out = [];
      const push = (severity, kind, message, where) => out.push({ severity, kind, message, ...(where ? { where } : {}) });

      const burning = sparse(), unpowered = sparse(), unwatered = sparse(), noRoad = sparse(), abandoned = sparse();
      for (const t of city.tiles) {
        if (t.fire > 0) burning.add(t.x, t.y);
        if (!isPlot(t)) continue;
        if (t.abandoned) abandoned.add(t.x, t.y);
        if (!t.powered) unpowered.add(t.x, t.y);
        if (!t.watered && t.density >= 2) unwatered.add(t.x, t.y);
        if (!t.roadAccess) noRoad.add(t.x, t.y);
      }
      if (burning.count) push(3, "fire", `${burning.label} tiles are burning.`, burning.where);
      if (s.money < 0) push(3, "bankrupt", `Treasury is $${Math.round(s.money).toLocaleString()}.`);
      else if (s.balance < 0 && s.money + s.balance * 12 < 0) push(3, "deficit", `Losing $${Math.round(-s.balance).toLocaleString()} a month with $${Math.round(s.money).toLocaleString()} left.`);
      else if (s.balance < 0) push(1, "deficit", `Running a deficit of $${Math.round(-s.balance).toLocaleString()} a month.`);
      // getStats() reports power and water as a coverage percent, which the
      // unpowered and unwatered lists above already say more precisely. A
      // capacity shortfall is a separate problem, and only the utility pass
      // carries the supply and demand figures it needs.
      for (const kind of ["power", "water"]) {
        const u = city._util?.[kind];
        if (!u || !(u.demand > u.supply)) continue;
        push(2, kind, `${kind === "power" ? "Power" : "Water"} demand ${Math.round(u.demand)} exceeds supply ${Math.round(u.supply)}.`);
      }
      if (s.garbageProduced > s.garbageCapacity) push(2, "garbage", `Garbage ${Math.round(s.garbageProduced)} exceeds capacity ${Math.round(s.garbageCapacity)}.`);
      if (unpowered.count) push(2, "unpowered", `${unpowered.label} plots have no power.`, unpowered.where);
      if (unwatered.count) push(2, "unwatered", `${unwatered.label} medium or high density plots have no water.`, unwatered.where);
      if (noRoad.count) push(2, "noRoad", `${noRoad.label} plots have no road access.`, noRoad.where);
      if (abandoned.count) push(2, "abandoned", `${abandoned.label} lots are abandoned.`, abandoned.where);
      if (s.unemployment > 12) push(2, "unemployment", `Unemployment is ${round1(s.unemployment)}%.`);
      for (const a of s.advisors) if (a.mood === "bad" || a.mood === "warning") push(a.mood === "bad" ? 2 : 1, `advisor.${a.id ?? a.name}`, a.message);
      out.sort((a, b) => b.severity - a.severity);
      return { count: out.length, problems: out };
    },

    // Recent agent actions, which is the same list the human saw as notices.
    log(n = 20) { return history.slice(-clamp(int(n) || 20, 1, LOG_SIZE)); },

    // ---- writing ------------------------------------------------------

    // Drag from one corner to the other, exactly as the mouse does. Rectangle
    // tools fill the box, path tools draw a Manhattan L, and anything else
    // places one footprint centred on (x2, y2).
    build(tool, x1, y1, x2 = x1, y2 = y1, opts = {}) {
      if (!Object.hasOwn(TOOL_MAP, String(tool))) return { ok: false, error: `Unknown tool "${tool}". See help().tools.` };
      const a = { x: int(x1), y: int(y1) }, b = { x: int(x2), y: int(y2) };
      if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return { ok: false, error: "build(tool, x1, y1, x2, y2) needs integer coordinates." };
      const density = [1, 2, 3].includes(opts.density) ? opts.density : 1;
      const result = actions.build(tool, a, b, { density, confirmStructures:opts.confirmStructures, maxCost:opts.maxCost });
      if (result.ok) {
        announce({ text: `${tool}${density > 1 ? ` (density ${density})` : ""} ${a.x},${a.y} to ${b.x},${b.y} — ${result.changed} tiles, $${Math.round(result.cost).toLocaleString()}`, tool, from: a, to: b, changed: result.changed, cost: result.cost }, b);
        return { ok: true, changed: result.changed, cost: Math.round(result.cost), connectionOffers: result.connectionOffers || [], money: Math.round(getCity().money) };
      }
      return { ok: false, error: result.message, requiresConfirmation:result.requiresConfirmation || false, quote:result.quote, money: Math.round(getCity().money) };
    },

    connections() { return {established:getCity().transportConnections || [],offers:connectionOffers(getCity(),getCity().tiles)}; },
    connectNeighbor(x,y,side,route) {
      const link={x:int(x),y:int(y),side,route};
      const quote=quoteConnection(getCity(),link);
      if(!quote.ok || quote.noop) return quote;
      return actions.connectNeighbor(link);
    },
    bulldoze(x1, y1, x2 = x1, y2 = y1) { return api.build("bulldoze", x1, y1, x2, y2); },

    // Any of tax.*, fund.*, ordinance.*, name or loan. See help().policies.
    policy(key, value) {
      const result = actions.setPolicy(String(key), value);
      if (result.ok) announce({ text: `${key} = ${value}`, policy: key, value });
      return { ok: !!result.ok, message: result.message || "", ...(result.ok ? { state: api.state().taxes } : {}) };
    },

    // Advance the simulation by whole months and report what moved. This is
    // the same tick the clock runs, so nothing is skipped.
    run(months = 1) {
      const n = clamp(int(months) || 1, 1, 240);
      const before = api.state();
      const events = actions.stepMonths(n);
      const after = api.state();
      announce({ text: `ran ${n} month${n === 1 ? "" : "s"} to ${after.date}`, months: n });
      return {
        ok: true, months: n, from: before.date, to: after.date,
        population: { before: before.population, after: after.population, change: after.population - before.population },
        money: { before: before.money, after: after.money, change: after.money - before.money },
        demand: after.demand,
        events,
      };
    },

    // 0 pauses, 1 to 3 run the clock at the human speeds.
    speed(n) { const v = clamp(int(n) || 0, 0, 3); actions.setSpeed(v); announce({ text: `speed ${v}`, speed: v }); return { ok: true, speed: v }; },

    overlay(id) { actions.setOverlay(id); return { ok: true, overlay: id }; },
    focus(x, y) { renderer?.focusOn?.(clamp(int(x) || 0, 0, getCity().size - 1), clamp(int(y) || 0, 0, getCity().size - 1)); return { ok: true }; },
    undo() { const ok = !!actions.undo(); if (ok) announce({ text: "undid the last construction" }); return { ok }; },
    disaster(id) { if (!Object.hasOwn(DISASTERS, String(id))) return { ok: false, error: `Unknown disaster. Known: ${Object.keys(DISASTERS).join(", ")}` }; actions.setDisaster(id); announce({ text: `triggered ${id}`, disaster: id }); return { ok: true }; },
    // Slot 0 is the January autosave, and `|| 1` would quietly rewrite it to
    // slot 1 because 0 is falsy. Fall back only when the number is unusable.
    save(slot = 1) { const n = slotOf(slot); actions.save(n); return { ok: true, slot: n }; },
    load(slot = 1) { const n = slotOf(slot); actions.load(n); return { ok: true, slot: n }; },
    saves() { return actions.listSaves(); },
    newCity(options = {}) { actions.newCity(options); announce({ text: `new city: ${getCity().name}`, options }); return api.state(); },
  };

  // One place that turns a throw into a reply, so a bad argument never breaks
  // the page the human is watching.
  return Object.fromEntries(Object.entries(api).map(([name, fn]) => [name, (...args) => {
    try { return fn(...args); }
    catch (err) { return { ok: false, error: `${name}() failed: ${err.message}` }; }
  }]));
}
