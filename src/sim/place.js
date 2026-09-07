// Construction rules: evaluate() prices a single action without mutating;
// place() applies it. Multi-tile buildings are placed by their top-left
// anchor and every footprint tile must be free land.
import { BUILDINGS, ZONE_COST, PORT_TYPES, ZONED_TYPES, OVERLAY_TOOLS, TOOL_MAP, TECH_YEAR, LEVEL_FEE, ROAD_TYPES } from "./catalog.js";
import { yearOf } from "./metrics.js";
import { MAX_ELEVATION } from "./terrain.js";

// Terrain changes cascade: every neighbour is dragged to within one level,
// so a hill grows a gentle base. Nothing built may be in the way, and water
// stays at its level.
function terraformPlan(city, start, target) {
  if (target < 0 || target > MAX_ELEVATION) return { error: "Terrain cannot go that far." };
  const changes = new Map();
  const queue = [[start, target]];
  while (queue.length) {
    const [t, elev] = queue.shift();
    const key = t.y * city.size + t.x;
    if (changes.has(key) && changes.get(key).elev === elev) continue;
    if (t.type !== "empty" || t.lot || t.powerline || t.pipe) return { error: t === start ? "Clear the tile before changing the terrain." : "A building or road is in the way." };
    if (t.terrain === "water") return { error: t === start ? "Fill the water first." : "Too close to the water." };
    changes.set(key, { tile: t, elev });
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = tileAt(city, t.x + dx, t.y + dy);
      if (!n) continue;
      const current = changes.get(n.y * city.size + n.x)?.elev ?? n.elev;
      if (current < elev - 1) queue.push([n, elev - 1]);
      else if (current > elev + 1) queue.push([n, elev + 1]);
    }
    if (changes.size > 400) return { error: "That would move too much earth at once." };
  }
  return { changes: [...changes.values()].filter((c) => c.tile.elev !== c.elev) };
}

export const techAvailable = (city, type) => !(type in TECH_YEAR) || yearOf(city.month, city.startYear) >= TECH_YEAR[type];
import { tileAt, inBounds, nextRandom } from "./grid.js";
import { lotTiles, assignLot, clearLot, anchorOf } from "./lots.js";
import { refreshCity } from "./refresh.js";
import { specialAvailable } from "./events.js";
import { isLandfill } from "./waste.js";
import { findBore, bore, MIN_BORE } from "./tunnels.js";

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

  // Zoning, RCI and ports alike: "you zone for airports and wait for Sims to
  // develop them." A port has one density, and a minimum size instead.
  if (ZONED_TYPES.has(tool)) {
    const port = PORT_TYPES.has(tool);
    const band = port ? 1 : density;
    if (!port && ![1, 2, 3].includes(density)) return fail("Invalid density.");
    if (!techAvailable(city, tool)) return fail(`${TOOL_MAP[tool].label} zoning is not available until ${TECH_YEAR[tool]}.`);
    if (t.terrain === "water") return fail("Cannot zone on water.");
    const cost = ZONE_COST[tool][band];
    if (t.type === tool && t.density === band) return noop("Zone already set.", here);
    if (ZONED_TYPES.has(t.type)) {
      if (t.lot) return fail("Bulldoze the building before rezoning.");
      return { ok: true, noop: false, cost, message: port ? `Rezone to ${tool}` : `Rezone to ${tool} (density ${density})`, tiles: here };
    }
    if (t.type !== "empty") return fail("Tile is occupied. Bulldoze first.");
    return { ok: true, noop: false, cost, message: "", tiles: here };
  }

  if (OVERLAY_TOOLS.has(tool)) {
    const b = BUILDINGS[tool];
    if (t.terrain === "water" && (tool === "subway" || !ROAD_TYPES.has(t.type))) return fail(tool === "pipe" ? "Pipes cannot cross water." : tool === "subway" ? "Subways cannot run under water." : "Power lines need a bridge to cross water.");
    if (t[tool]) return noop("Already here.", here);
    return { ok: true, noop: false, cost: b.cost, message: "", tiles: here };
  }

  if (tool === "tree") {
    if (t.terrain === "water") return fail("Trees cannot grow on water.");
    if (t.type !== "empty") return fail("Tile is occupied.");
    if (t.trees >= 3) return noop("Already forested.", here);
    return { ok: true, noop: false, cost: BUILDINGS.tree.cost, message: "", tiles: here };
  }

  if (tool === "makewater") {
    if (t.terrain === "water") return noop("Already water.", here);
    if (t.type !== "empty" || t.powerline || t.pipe) return fail("Clear the tile before flooding it.");
    return { ok: true, noop: false, cost: BUILDINGS.makewater.cost, message: "", tiles: here };
  }
  if (tool === "raise" || tool === "lower" || tool === "level") {
    const target = tool === "level" ? (options.elev ?? t.elev) : t.elev + (tool === "raise" ? 1 : -1);
    if (target < 0 || target > MAX_ELEVATION) return noop("Terrain cannot go that far.", here);
    if (t.elev === target) return noop("Already at that level.", here);
    const plan = terraformPlan(city, t, target);
    if (plan.error) return fail(plan.error);
    const tiles = plan.changes.map((c) => ({ x: c.tile.x, y: c.tile.y }));
    return { ok: true, noop: false, cost: BUILDINGS[tool].cost * plan.changes.length, message: plan.changes.length > 1 ? `Moves ${plan.changes.length} tiles` : "", tiles, changes: plan.changes };
  }
  if (tool === "makeland") {
    if (t.terrain !== "water") return noop("Already dry land.", here);
    if (t.type !== "empty") return fail("Remove the bridge first.");
    return { ok: true, noop: false, cost: BUILDINGS.makeland.cost, message: "", tiles: here };
  }

  // "If the underground distance is sufficient for the tunnel to be
  // constructed, six tiles minimum, the city engineers will ask if you wish
  // to bore a tunnel and let you know the cost."
  const bores = BUILDINGS[tool]?.bores;
  if (bores) {
    if (t.terrain === "water") return fail("A tunnel has to start on dry land.");
    const run = findBore(city, x, y, bores);
    if (!run) return fail(`No high ground to bore through. A tunnel needs at least ${MIN_BORE} tiles of higher ground and level ground on the far side.`);
    const cost = BUILDINGS[tool].cost * run.length;
    const tiles = [{ x: run.entrance.x, y: run.entrance.y }, { x: run.exit.x, y: run.exit.y },
      ...run.buried.map((n) => ({ x: n.x, y: n.y }))];
    return { ok: true, noop: false, cost, message: `Bore a ${run.length}-tile ${bores} tunnel`, tiles, run };
  }

  // An on-ramp is the only place cars move between a street and a highway.
  // It has to touch both, so it can only go where the two actually meet.
  if (tool === "onramp") {
    if (t.type === "onramp") return noop("On-ramp already here.", here);
    if (t.terrain === "water") return fail("On-ramps cannot be built on water.");
    if (t.type !== "empty" && t.type !== "road" && t.type !== "highway") return fail("Tile is occupied. Bulldoze first.");
    // The ramp itself may stand on the street it joins, or beside it.
    let road = t.type === "road", highway = t.type === "highway";
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = tileAt(city, x + dx, y + dy);
      if (n?.type === "road" || n?.type === "onramp") road = true;
      if (n?.type === "highway") highway = true;
    }
    if (!highway) return fail("An on-ramp must touch a highway.");
    if (!road) return fail("An on-ramp must touch a road.");
    return { ok: true, noop: false, cost: BUILDINGS.onramp.cost, message: "", tiles: here };
  }

  if (tool === "road" || tool === "rail" || tool === "highway") {
    const b = BUILDINGS[tool];
    if (t.type === tool) return noop(`${b.label} already here.`, here);
    if (t.type !== "empty") return fail("Tile is occupied. Bulldoze first.");
    if (t.terrain === "water") return { ok: true, noop: false, cost: b.cost * BRIDGE_MULTIPLIER, message: "Bridge", tiles: here };
    return { ok: true, noop: false, cost: b.cost, message: "", tiles: here };
  }

  if (tool === "dispatch") {
    const a = t.lot ? anchorOf(city, t) : t;
    if (!a?.fire) return fail("Nothing is burning here.");
    return { ok: true, noop: false, cost: BUILDINGS.dispatch.cost, message: "Send a fire crew", tiles: a.lot ? lotTiles(city, a.lot).map((n) => ({ x: n.x, y: n.y })) : here };
  }

  if (tool === "bulldoze") {
    // "You can't bulldoze over landfills; however, you can decommission them
    // by removing road or rail access. Over time the landfill will decompose
    // all of its accumulated garbage, at which time you can de-zone it."
    if (isLandfill(t) && (t.fill || 0) > 0) {
      return fail(`This landfill still holds ${Math.round(t.fill).toLocaleString()} tons. Cut its road access and let it decompose.`);
    }
    if (t.lot) {
      const a = anchorOf(city, t);
      const tiles = lotTiles(city, a.lot).map((n) => ({ x: n.x, y: n.y }));
      const b = BUILDINGS[a.type];
      const cost = DEMOLISH_FEE * tiles.length + (b ? Math.round(b.cost * 0.05) : 0);
      return { ok: true, noop: false, cost, message: `Demolish ${b ? b.label : a.type}`, tiles };
    }
    if (t.type !== "empty" || t.powerline || t.pipe || t.trees || t.subway) {
      return { ok: true, noop: false, cost: DEMOLISH_FEE, message: "", tiles: here };
    }
    return fail("Nothing to demolish here.");
  }

  // Catalog buildings with a footprint.
  const b = BUILDINGS[tool];
  if (!b) return fail("Unknown building.");
  if (!techAvailable(city, tool)) return fail(`${b.label} is not available until ${TECH_YEAR[tool]}.`);
  if ((b.reward || b.offer) && !specialAvailable(city, tool)) {
    return fail(b.reward ? `${b.label} unlocks at ${b.reward.population.toLocaleString()} residents and can be built once.` : `${b.label} needs an accepted deal and can be built once.`);
  }
  if (b.unique && !b.reward && !b.offer && city.tiles.some((n) => n.type === tool)) return fail(`Only one ${b.label} can be built.`);
  if (b.requiresWater) {
    let near = false;
    for (let yy = y - 2; yy < y + b.h + 2 && !near; yy++) for (let xx = x - 2; xx < x + b.w + 2; xx++) { const n = tileAt(city, xx, yy); if (n?.terrain === "water") { near = true; break; } }
    if (!near) return fail(`${b.label} must be built at the water's edge.`);
  }
  const tiles = [];
  const base = t.elev;
  let levelled = 0;
  for (let yy = y; yy < y + b.h; yy++) {
    for (let xx = x; xx < x + b.w; xx++) {
      if (!inBounds(city.size, xx, yy)) return fail("Building does not fit on the map here.");
      const n = city.tiles[yy * city.size + xx];
      if (n.terrain === "water") return fail("Cannot build on water.");
      if (n.type === tool && n.lot && n.lot.x === x && n.lot.y === y) return noop("Already here.", [{ x, y }]);
      if (n.type !== "empty") return fail("Site is blocked. Bulldoze first.");
      if (Math.abs(n.elev - base) > 1) return fail("Site is too steep. Level the terrain first.");
      if (n.elev !== base) levelled++;
      tiles.push({ x: xx, y: yy });
    }
  }
  return { ok: true, noop: false, cost: b.cost + levelled * LEVEL_FEE, message: levelled ? `Levels ${levelled} tile${levelled === 1 ? "" : "s"}` : "", tiles, elev: base };
}

export function place(city, x, y, tool, options = {}) {
  options = options ?? {};
  const ev = evaluate(city, x, y, tool, options);
  if (!ev.ok) return { ok: false, message: ev.message, cost: 0, changed: 0 };
  if (ev.noop) return { ok: true, noop: true, message: ev.message, cost: 0, changed: 0 };
  if (city.money < ev.cost) return { ok: false, message: `Not enough funds. Need $${ev.cost.toLocaleString()}, have $${Math.floor(city.money).toLocaleString()}.`, cost: 0, changed: 0 };

  const t = city.tiles[y * city.size + x];
  const density = options.density ?? 1;

  if (ZONED_TYPES.has(tool)) {
    t.type = tool; t.density = PORT_TYPES.has(tool) ? 1 : density; t.level = 0; t.lot = null; t.trees = 0; t.abandoned = false; t.age = 0;
  } else if (OVERLAY_TOOLS.has(tool)) {
    t[tool] = true;
  } else if (tool === "tree") {
    t.trees = Math.min(3, (t.trees || 0) + 1);
  } else if (tool === "makewater") {
    t.terrain = "water"; t.trees = 0; t.elev = Math.max(0, Math.min(t.elev, ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => tileAt(city, t.x + dx, t.y + dy)?.elev ?? t.elev)));
  } else if (tool === "makeland") {
    t.terrain = "sand";
  } else if (tool === "raise" || tool === "lower" || tool === "level") {
    for (const c of ev.changes) c.tile.elev = c.elev;
  } else if (BUILDINGS[tool]?.bores) {
    bore(city, ev.run, BUILDINGS[tool].bores);
  } else if (tool === "road" || tool === "rail" || tool === "highway" || tool === "onramp") {
    t.type = tool; t.trees = 0; t.density = 0; t.level = 0;
  } else if (tool === "dispatch") {
    const a = t.lot ? anchorOf(city, t) : t;
    a.fire = 0;
  } else if (tool === "bulldoze") {
    if (t.lot) {
      const a = anchorOf(city, t);
      clearLot(city, a, { keepZone: ZONED_TYPES.has(a.type) });
    } else {
      // Surface first; a subway under an empty tile goes on the next pass.
      if (t.type === "empty" && !t.powerline && !t.pipe && !t.trees) t.subway = false;
      t.type = "empty"; t.density = 0; t.level = 0; t.powerline = false; t.pipe = false; t.trees = 0; t.fire = 0;
    }
  } else {
    const b = BUILDINGS[tool];
    const lot = { x, y, w: b.w, h: b.h };
    for (const n of lotTiles(city, lot)) { n.type = tool; n.trees = 0; n.density = 0; n.elev = ev.elev ?? n.elev; }
    assignLot(city, lot, 1, nextRandom(city));
  }

  city.money -= ev.cost;
  if (!options.deferRefresh) {
    refreshCity(city);
    city.revision++;
  }
  return { ok: true, message: ev.message || `Built ${TOOL_MAP[tool].label} for $${ev.cost.toLocaleString()}.`, cost: ev.cost, changed: ev.tiles.length };
}
