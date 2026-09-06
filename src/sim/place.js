// Construction rules: evaluate() prices a single action without mutating;
// place() applies it. Multi-tile buildings are placed by their top-left
// anchor and every footprint tile must be free land.
import { BUILDINGS, ZONE_COST, ZONE_TYPES, OVERLAY_TOOLS, TOOL_MAP } from "./catalog.js";
import { tileAt, inBounds, nextRandom } from "./grid.js";
import { lotTiles, assignLot, clearLot, anchorOf } from "./lots.js";
import { refreshCity } from "./refresh.js";

export const DEMOLISH_FEE = 5;
export const BRIDGE_MULTIPLIER = 5;

const fail = (message) => ({ ok: false, noop: false, cost: 0, message, tiles: [] });
const noop = (message, tiles) => ({ ok: true, noop: true, cost: 0, message, tiles });

export function evaluate(city, x, y, tool, options = {}) {
  if (!inBounds(city.size, x, y)) return fail("Out of map bounds.");
  if (typeof tool !== "string" || !Object.hasOwn(TOOL_MAP, tool)) return fail("Unknown construction tool.");
  const density = options?.density ?? 1;
  const t = city.tiles[y * city.size + x];
  const here = [{ x, y }];

  if (tool === "inspect") return noop("", here);

  if (ZONE_TYPES.has(tool)) {
    if (![1, 2, 3].includes(density)) return fail("Invalid density.");
    if (t.terrain === "water") return fail("Cannot zone on water.");
    const cost = ZONE_COST[tool][density];
    if (t.type === tool && t.density === density) return noop("Zone already set.", here);
    if (ZONE_TYPES.has(t.type)) {
      if (t.lot) return fail("Bulldoze the building before rezoning.");
      return { ok: true, noop: false, cost, message: `Rezone to ${tool} (density ${density})`, tiles: here };
    }
    if (t.type !== "empty") return fail("Tile is occupied. Bulldoze first.");
    return { ok: true, noop: false, cost, message: "", tiles: here };
  }

  if (OVERLAY_TOOLS.has(tool)) {
    const b = BUILDINGS[tool];
    if (t.terrain === "water" && t.type !== "road") return fail(tool === "pipe" ? "Pipes cannot cross water." : "Power lines need a bridge to cross water.");
    if (t[tool]) return noop("Already here.", here);
    return { ok: true, noop: false, cost: b.cost, message: "", tiles: here };
  }

  if (tool === "tree") {
    if (t.terrain === "water") return fail("Trees cannot grow on water.");
    if (t.type !== "empty") return fail("Tile is occupied.");
    if (t.trees >= 3) return noop("Already forested.", here);
    return { ok: true, noop: false, cost: BUILDINGS.tree.cost, message: "", tiles: here };
  }

  if (tool === "road" || tool === "rail") {
    const b = BUILDINGS[tool];
    if (t.type === tool) return noop(`${b.label} already here.`, here);
    if (t.type !== "empty") return fail("Tile is occupied. Bulldoze first.");
    if (t.terrain === "water") {
      if (tool === "rail") return fail("Rail cannot cross water.");
      return { ok: true, noop: false, cost: b.cost * BRIDGE_MULTIPLIER, message: "Bridge", tiles: here };
    }
    return { ok: true, noop: false, cost: b.cost, message: "", tiles: here };
  }

  if (tool === "bulldoze") {
    if (t.lot) {
      const a = anchorOf(city, t);
      const tiles = lotTiles(city, a.lot).map((n) => ({ x: n.x, y: n.y }));
      const b = BUILDINGS[a.type];
      const cost = DEMOLISH_FEE * tiles.length + (b ? Math.round(b.cost * 0.05) : 0);
      return { ok: true, noop: false, cost, message: `Demolish ${b ? b.label : a.type}`, tiles };
    }
    if (t.type !== "empty" || t.powerline || t.pipe || t.trees) {
      return { ok: true, noop: false, cost: DEMOLISH_FEE, message: "", tiles: here };
    }
    return fail("Nothing to demolish here.");
  }

  // Catalog buildings with a footprint.
  const b = BUILDINGS[tool];
  if (!b) return fail("Unknown building.");
  const tiles = [];
  for (let yy = y; yy < y + b.h; yy++) {
    for (let xx = x; xx < x + b.w; xx++) {
      if (!inBounds(city.size, xx, yy)) return fail("Building does not fit on the map here.");
      const n = city.tiles[yy * city.size + xx];
      if (n.terrain === "water") return fail("Cannot build on water.");
      if (n.type === tool && n.lot && n.lot.x === x && n.lot.y === y) return noop("Already here.", [{ x, y }]);
      if (n.type !== "empty") return fail("Site is blocked. Bulldoze first.");
      tiles.push({ x: xx, y: yy });
    }
  }
  return { ok: true, noop: false, cost: b.cost, message: "", tiles };
}

export function place(city, x, y, tool, options = {}) {
  options = options ?? {};
  const ev = evaluate(city, x, y, tool, options);
  if (!ev.ok) return { ok: false, message: ev.message, cost: 0, changed: 0 };
  if (ev.noop) return { ok: true, noop: true, message: ev.message, cost: 0, changed: 0 };
  if (city.money < ev.cost) return { ok: false, message: `Not enough funds. Need $${ev.cost.toLocaleString()}, have $${Math.floor(city.money).toLocaleString()}.`, cost: 0, changed: 0 };

  const t = city.tiles[y * city.size + x];
  const density = options.density ?? 1;

  if (ZONE_TYPES.has(tool)) {
    t.type = tool; t.density = density; t.level = 0; t.lot = null; t.trees = 0; t.abandoned = false; t.age = 0;
  } else if (OVERLAY_TOOLS.has(tool)) {
    t[tool] = true;
  } else if (tool === "tree") {
    t.trees = Math.min(3, (t.trees || 0) + 1);
  } else if (tool === "road" || tool === "rail") {
    t.type = tool; t.trees = 0; t.density = 0; t.level = 0;
  } else if (tool === "bulldoze") {
    if (t.lot) {
      const a = anchorOf(city, t);
      clearLot(city, a, { keepZone: ZONE_TYPES.has(a.type) });
    } else {
      t.type = "empty"; t.density = 0; t.level = 0; t.powerline = false; t.pipe = false; t.trees = 0; t.fire = 0;
    }
  } else {
    const b = BUILDINGS[tool];
    const lot = { x, y, w: b.w, h: b.h };
    for (const n of lotTiles(city, lot)) { n.type = tool; n.trees = 0; n.density = 0; }
    assignLot(city, lot, 1, nextRandom(city));
  }

  city.money -= ev.cost;
  if (!options.deferRefresh) {
    refreshCity(city);
    city.revision++;
  }
  return { ok: true, message: ev.message || `Built ${TOOL_MAP[tool].label} for $${ev.cost.toLocaleString()}.`, cost: ev.cost, changed: ev.tiles.length };
}
