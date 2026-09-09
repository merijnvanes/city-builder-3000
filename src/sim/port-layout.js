// How a zoned port fills with buildings.
//
// A port is not one slab. The manual says "you zone for airports and wait for
// Sims to develop them", and what the Sims put up is a runway with a terminal
// beside it, then hangars, a tower and aprons as trade grows; or a quay with
// a freight shed, then piers, cranes and container yards. Each piece is a
// module: a small lot on the zone whose anchor carries `part`, the module's
// kind. Modules never overlap, stand on level ground, and the layout is
// derived only from the tiles, so a save reproduces it exactly.
//
// A zone is one connected block of port tiles (a component). Its readiness,
// berth and trade are properties of the block, not of any single module.
import { tileAt, components } from "./grid.js";
import { PORT_TYPES } from "./catalog.js";
import { assignLot, isAnchor } from "./lots.js";

const CARDINAL = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Every module kind, with its footprint. `water` marks a module that stands
// on zoned water; `shore` one that must touch water from dry land.
export const PORT_PARTS = {
  airport: {
    "threshold-x": { w: 1, h: 1, label: "Runway threshold" },
    "runway-x": { w: 1, h: 1, label: "Runway" },
    "threshold-y": { w: 1, h: 1, label: "Runway threshold" },
    "runway-y": { w: 1, h: 1, label: "Runway" },
    terminal: { w: 2, h: 2, label: "Terminal" },
    tower: { w: 1, h: 1, label: "Control tower" },
    hangar: { w: 2, h: 2, label: "Hangar" },
    cargo: { w: 1, h: 1, label: "Air freight shed" },
    fuel: { w: 1, h: 1, label: "Fuel farm" },
    apron: { w: 1, h: 1, label: "Apron" },
  },
  seaport: {
    warehouse: { w: 2, h: 2, label: "Freight shed" },
    quay: { w: 1, h: 1, label: "Quay", shore: true },
    pier: { w: 1, h: 1, label: "Pier", water: true },
    gantry: { w: 2, h: 2, label: "Container gantry" },
    office: { w: 1, h: 1, label: "Harbour office" },
    tanks: { w: 1, h: 1, label: "Tank farm" },
    containers: { w: 1, h: 1, label: "Container yard" },
  },
};

// The save encodes a part as a small integer; this order is part of the format.
export const PART_CODES = Object.entries(PORT_PARTS).flatMap(([type, parts]) => Object.keys(parts).map((part) => `${type}:${part}`));
export const partCode = (type, part) => (part ? PART_CODES.indexOf(`${type}:${part}`) + 1 : 0);
export const partFromCode = (code) => (code > 0 && code <= PART_CODES.length ? PART_CODES[code - 1].split(":") : null);
export const partSpec = (type, part) => PORT_PARTS[type]?.[part] || null;
export const isRunwayPart = (part) => /^(runway|threshold)-[xy]$/.test(part || "");

// "Airports must be at least 3x5 tiles": a runway of five with a terminal
// beside it. Longer runways are better up to a point; past it the zone is
// better spent on hangars and aprons.
export const RUNWAY_MIN = 5;
export const RUNWAY_MAX = 8;
// How far from a tile of the port the water still counts as its berth.
export const SHORE_REACH = 2;

// The kinds a port adds after its core, in order of preference. An entry
// applies while fewer than `max` of its kind stand; later entries of the same
// kind lift that ceiling once the earlier wants are met.
const FILL = {
  airport: [
    { part: "tower", max: 1 }, { part: "hangar", max: 1 }, { part: "cargo", max: 1 }, { part: "fuel", max: 1 },
    { part: "hangar", max: 2 }, { part: "cargo", max: 2 }, { part: "apron", max: Infinity },
  ],
  seaport: [
    { part: "quay", max: Infinity }, { part: "pier", max: Infinity }, { part: "gantry", max: 1 }, { part: "office", max: 1 },
    { part: "containers", max: 3 }, { part: "tanks", max: 1 }, { part: "containers", max: 6 }, { part: "tanks", max: 2 }, { part: "containers", max: Infinity },
  ],
};

// ── Components ───────────────────────────────────────────────────

function berthOf(city, tiles) {
  let best = 0;
  for (const t of tiles) {
    for (let dy = -SHORE_REACH; dy <= SHORE_REACH && best < 1; dy++) for (let dx = -SHORE_REACH; dx <= SHORE_REACH; dx++) {
      const n = tileAt(city, t.x + dx, t.y + dy);
      if (n?.terrain !== "water") continue;
      if (n.salt) { best = 1; break; }
      best = Math.max(best, 0.4);
    }
    if (best >= 1) break;
  }
  return best;
}

// Every port zone on the map, each with its tiles and berth. Cached for a
// city revision: zoning changes bump the revision, development does not.
export function portComponents(city) {
  const cached = city._ports;
  if (cached && cached.tiles === city.tiles && cached.revision === city.revision) return cached;
  const list = [], ids = new Int32Array(city.tiles.length).fill(-1);
  for (const type of PORT_TYPES) {
    const found = components(city, (t) => t.type === type);
    const offset = list.length;
    for (let i = 0; i < found.count; i++) list.push({ id: offset + i, type, tiles: [], land: [], water: [] });
    for (let i = 0; i < city.tiles.length; i++) {
      if (found.ids[i] < 0) continue;
      const t = city.tiles[i], component = list[offset + found.ids[i]];
      ids[i] = component.id; component.tiles.push(t); (t.terrain === "water" ? component.water : component.land).push(t);
    }
  }
  // "They must be located along a shoreline to do anything, but if you want
  // to see real results, build one on a seacoast." An airport is placed anywhere.
  for (const c of list) c.berth = c.type === "seaport" ? berthOf(city, c.tiles) : 1;
  return (city._ports = { tiles: city.tiles, revision: city.revision, ids, list });
}

export function portOf(city, t) {
  if (!t || !PORT_TYPES.has(t.type)) return null;
  const ports = portComponents(city), id = ports.ids[t.y * city.size + t.x];
  return id < 0 ? null : ports.list[id];
}

// Module anchors standing on the zone.
export const portModules = (component) => component.tiles.filter((t) => isAnchor(t) && t.part);

// "They require power, water, and a road nearby": the block as a whole.
export function portReady(city, component) {
  if (!component || component.tiles.some((t) => t.radiation)) return false;
  return component.tiles.some((t) => t.roadAccess) && component.tiles.some((t) => t.powered) && component.tiles.some((t) => t.watered);
}

// ── Placement ────────────────────────────────────────────────────

// Can this module stand with its anchor at (x, y)? Every tile must be part of
// the zone, undeveloped, of the right kind of ground, and level.
function fits(city, component, spec, x, y, reserved = null) {
  const anchor = tileAt(city, x, y);
  if (!anchor) return false;
  for (let yy = y; yy < y + spec.h; yy++) for (let xx = x; xx < x + spec.w; xx++) {
    const t = tileAt(city, xx, yy);
    if (!t || t.lot || t.type !== component.type || (reserved && reserved.has(t))) return false;
    if (spec.water ? t.terrain !== "water" : t.terrain === "water") return false;
    if (portComponents(city).ids[yy * city.size + xx] !== component.id) return false;
    if (t.elev !== anchor.elev) return false;
  }
  if (spec.shore && !CARDINAL.some(([dx, dy]) => tileAt(city, x + dx, y + dy)?.terrain === "water")) return false;
  return true;
}

// How many developed port tiles touch the module: fill grows outward from
// what already stands, so a tower rises beside the terminal, not in a corner.
function company(city, spec, x, y) {
  let count = 0;
  for (let yy = y - 1; yy <= y + spec.h; yy++) for (let xx = x - 1; xx <= x + spec.w; xx++) {
    if (yy >= y && yy < y + spec.h && xx >= x && xx < x + spec.w) continue;
    const t = tileAt(city, xx, yy);
    if (t?.lot && PORT_TYPES.has(t.type)) count++;
  }
  return count;
}

// The best anchor for a module of this kind, or null.
function findSite(city, component, part) {
  const spec = partSpec(component.type, part);
  let best = null;
  for (const t of spec.water ? component.water : component.land) {
    if (!fits(city, component, spec, t.x, t.y)) continue;
    const score = company(city, spec, t.x, t.y);
    if (!best || score > best.score) best = { x: t.x, y: t.y, score };
  }
  return best && { x: best.x, y: best.y, part };
}

function build(city, component, x, y, part, rng) {
  const spec = partSpec(component.type, part);
  const anchor = assignLot(city, { x, y, w: spec.w, h: spec.h }, 1, rng());
  anchor.part = part;
  return anchor;
}

// ── The core ─────────────────────────────────────────────────────

// Every straight, level, undeveloped run of dry zone tiles long enough for a
// runway, longest first.
function runwayCandidates(city, component) {
  const out = [];
  for (const axis of ["x", "y"]) {
    const [dx, dy] = axis === "x" ? [1, 0] : [0, 1];
    for (const start of component.land) {
      const before = tileAt(city, start.x - dx, start.y - dy);
      // Only maximal runs: a run that could begin one tile earlier is the same run.
      if (before && fits(city, component, PORT_PARTS.airport["runway-x"], before.x, before.y) && before.elev === start.elev) continue;
      const tiles = [];
      for (let t = start; t && tiles.length < RUNWAY_MAX; t = tileAt(city, t.x + dx, t.y + dy)) {
        if (!fits(city, component, PORT_PARTS.airport["runway-x"], t.x, t.y) || t.elev !== start.elev) break;
        tiles.push(t);
      }
      if (tiles.length >= RUNWAY_MIN) out.push({ axis, tiles });
    }
  }
  return out.sort((a, b) => b.tiles.length - a.tiles.length || a.tiles[0].y - b.tiles[0].y || a.tiles[0].x - b.tiles[0].x);
}

// The runway and terminal an airport opens with, or the freight shed (or at
// least an office) a seaport opens with. Null when the zone cannot hold it.
export function planPortCore(city, component) {
  if (component.type === "airport") {
    const terminal = PORT_PARTS.airport.terminal;
    for (const candidate of runwayCandidates(city, component)) {
      // A shorter strip may leave room for the terminal; try the long one first.
      for (let length = candidate.tiles.length; length >= RUNWAY_MIN; length--) {
        const strip = candidate.tiles.slice(0, length), reserved = new Set(strip);
        for (const t of component.land) {
          if (!fits(city, component, terminal, t.x, t.y, reserved)) continue;
          return { runway: { axis: candidate.axis, tiles: strip }, terminal: { x: t.x, y: t.y } };
        }
      }
    }
    return null;
  }
  for (const part of ["warehouse", "office"]) {
    const site = findSite(city, component, part);
    if (site) return { modules: [site] };
  }
  return null;
}

export function buildPortCore(city, component, rng) {
  const plan = planPortCore(city, component);
  if (!plan) return false;
  if (plan.runway) {
    const { axis, tiles } = plan.runway;
    tiles.forEach((t, i) => build(city, component, t.x, t.y, `${i === 0 || i === tiles.length - 1 ? "threshold" : "runway"}-${axis}`, rng));
    build(city, component, plan.terminal.x, plan.terminal.y, "terminal", rng);
    return true;
  }
  for (const site of plan.modules) build(city, component, site.x, site.y, site.part, rng);
  return true;
}

// ── Filling in ───────────────────────────────────────────────────

// The next module a developed port adds, or null when it is full.
export function planPortFill(city, component) {
  const counts = {};
  for (const anchor of portModules(component)) counts[anchor.part] = (counts[anchor.part] || 0) + 1;
  for (const { part, max } of FILL[component.type]) {
    if ((counts[part] || 0) >= max) continue;
    const site = findSite(city, component, part);
    if (site) return site;
  }
  return null;
}

export function growPort(city, component, rng) {
  const site = planPortFill(city, component);
  if (!site) return null;
  return build(city, component, site.x, site.y, site.part, rng);
}

// Why an undeveloped zone cannot open, in the mayor's terms.
export function coreObstacle(city, component) {
  if (planPortCore(city, component)) return null;
  if (component.type === "airport") return `Not big enough: an airport needs a straight run of ${RUNWAY_MIN} level tiles for its runway and a 2×2 block beside it for the terminal. Level the ground or zone more.`;
  return component.land.length ? "No room for the freight shed: zone at least one tile of level dry land." : "A seaport needs dry land for its freight shed as well as the water it is zoned on.";
}
