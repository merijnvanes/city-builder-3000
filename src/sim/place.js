import { isPortal, removeStructure, structureTiles, structureCost } from './structures.js';
import { surfaceWaterPlan, applySurfaceWater, waterVolume, waterSurface, INITIAL_DEPTH } from './surface-water.js';
// Construction rules: evaluate() prices a single action without mutating;
// place() applies it. Multi-tile buildings are placed by their top-left
// anchor and every footprint tile must be free land.
import { BUILDINGS, ZONE_COST, PORT_TYPES, ZONED_TYPES, OVERLAY_TOOLS, TOOL_MAP, TECH_YEAR, LEVEL_FEE, ROAD_TYPES, carriesRoute, powerlineSite } from "./catalog.js";
import { yearOf } from "./metrics.js";
import { MAX_ELEVATION, MIN_ELEVATION } from "./terrain.js";

// Terrain changes cascade: every neighbour is dragged to within one level,
// so a hill grows a gentle base. Nothing built may be in the way, and water
// settles after earthworks.
function terraformPlan(city, start, target) {
  if (target < MIN_ELEVATION || target > MAX_ELEVATION) return { error: "Terrain cannot go that far." };
  const changes = new Map();
  const queue = [[start, target]];
  while (queue.length) {
    const [t, elev] = queue.shift();
    const key = t.y * city.size + t.x;
    if (changes.has(key) && changes.get(key).elev === elev) continue;
    if (t.type !== "empty" || t.lot || t.powerline || t.pipe || t.tunnel || t.structure) return { error: t === start ? "Clear the tile before changing the terrain." : "A building or road is in the way." };
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

// Water a pier may stand on: open water touching dry land, with nothing
// crossing it.
export const pierSite = (city, t) => t.terrain === "water" && !t.structure && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
  const n = tileAt(city, t.x + dx, t.y + dy);
  return n && n.terrain !== "water";
});
import { tileAt, inBounds, nextRandom } from "./grid.js";
import { lotTiles, assignLot, clearLot, anchorOf } from "./lots.js";
import { refreshCity } from "./refresh.js";
import { specialAvailable } from "./events.js";
import { isLandfill } from "./waste.js";
import { findBore, bore, MIN_BORE } from "./tunnels.js";
import { rampSite } from "./highways.js";
import { crewsAvailable, fireCrews, unitsAvailable, policeUnits } from "./fire.js";
import { riotAt, RIOT_REACH } from "./disasters.js";

export const DEMOLISH_FEE = 5;
// A span over an existing street costs more than laying one on open ground.
export const VIADUCT_MULTIPLIER = 2;

const fail = (message) => ({ ok: false, noop: false, cost: 0, message, tiles: [] });
const noop = (message, tiles) => ({ ok: true, noop: true, cost: 0, message, tiles });

export function evaluate(city, x, y, tool, options = {}) {
  if (!inBounds(city.size, x, y)) return fail("Out of map bounds.");
  if (typeof tool !== "string" || !Object.hasOwn(TOOL_MAP, tool)) return fail("Unknown construction tool.");
  const density = options?.density ?? 1;
  const t = city.tiles[y * city.size + x];
  const here = [{ x, y }];

  if (tool === "inspect") return noop("", here);
  if(tool==='powerline' && t.terrain==='water')return fail('Power lines need dry land. Bridges carry power across water through built-in cabling.');
  if(tool==='powerline' && !powerlineSite(t))return fail('Power lines need an empty surface tile. Buildings and transport routes cannot share their tile.');
  if(t.structure && (t.structure.kind==='bridge' || isPortal(t))) {
    if(tool==='bulldoze')return {ok:true,noop:false,cost:DEMOLISH_FEE*(t.structure.length+2),message:`Remove entire ${t.structure.kind}`,tiles:structureTiles(city,t.structure).map(n=>({x:n.x,y:n.y})),removeStructure:t.structure};
    if(tool===t.structure.route)return noop('Route already here.',here);
    return fail('Remove the entire bridge or tunnel before changing its entrance or deck.');
  }
  if(t.tunnel && ['raise','lower','level','makewater','makeland','subway'].includes(tool))return fail('Remove the tunnel before changing the ground above it.');

  // Zoning, RCI and ports alike: "you zone for airports and wait for Sims to
  // develop them." A port has one density, and a minimum size instead.
  if (ZONED_TYPES.has(tool)) {
    const port = PORT_TYPES.has(tool);
    const band = port ? 1 : density;
    if (!port && ![1, 2, 3].includes(density)) return fail("Invalid density.");
    if (!techAvailable(city, tool)) return fail(`${TOOL_MAP[tool].label} zoning is not available until ${TECH_YEAR[tool]}.`);
    // A seaport reaches into the water it works: shallow water along the
    // shore may be zoned, and the Sims build piers on it.
    if (t.terrain === "water" && !(tool === "seaport" && pierSite(city, t))) return fail(tool === "seaport" ? "A seaport may only reach into water beside dry land." : "Cannot zone on water.");
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
    if (t.terrain === "water" && (tool === "subway" || !ROAD_TYPES.has(t.type))) return fail(tool === "subway" ? "Subways cannot run under water." : "Pipes cannot cross water.");
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
    const waterPlan=surfaceWaterPlan(city,[{tile:t,elev:Math.max(MIN_ELEVATION,t.elev-1)}],new Map([[y*city.size+x,INITIAL_DEPTH]]));
    if(waterPlan.error)return fail(waterPlan.error);
    return { ok: true, noop: false, cost: BUILDINGS.makewater.cost, message: "Excavate and fill a pond", tiles: here, waterPlan };
  }
  if (tool === "raise" || tool === "lower" || tool === "level") {
    const target = tool === "level" ? (options.elev ?? t.elev) : t.elev + (tool === "raise" ? 1 : -1);
    if (target < MIN_ELEVATION || target > MAX_ELEVATION) return noop("Terrain cannot go that far.", here);
    if (t.elev === target) return noop("Already at that level.", here);
    const plan = terraformPlan(city, t, target);
    if (plan.error) return fail(plan.error);
    const tiles = plan.changes.map((c) => ({ x: c.tile.x, y: c.tile.y }));
    const touchesWater=plan.changes.some(({tile})=>waterVolume(tile)>0 || [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>waterVolume(tileAt(city,tile.x+dx,tile.y+dy) || {})>0));
    const waterPlan=touchesWater?surfaceWaterPlan(city,plan.changes):null;
    if(waterPlan?.error)return fail(waterPlan.error);
    return { ok: true, noop: false, cost: BUILDINGS[tool].cost * plan.changes.length, message: plan.changes.length > 1 ? `Moves ${plan.changes.length} tiles` : "", tiles, changes: plan.changes, waterPlan };
  }
  if (tool === "makeland") {
    if (t.terrain !== "water") return noop("Already dry land.", here);
    if (t.type !== "empty") return fail(ROAD_TYPES.has(t.type) ? "Remove the bridge first." : "Clear the tile first.");
    const earth=terraformPlan(city,t,Math.ceil(waterSurface(t)));
    if(earth.error)return fail(earth.error);
    const waterPlan=surfaceWaterPlan(city,earth.changes,new Map([[y*city.size+x,-waterVolume(t)]]));
    if(waterPlan.error)return fail(waterPlan.error);
    return { ok: true, noop: false, cost: BUILDINGS.makeland.cost + Math.max(0,earth.changes.length-1)*BUILDINGS.level.cost, message: "Drain and reclaim this tile", tiles: earth.changes.map(c=>({x:c.tile.x,y:c.tile.y})), waterPlan };
  }

  // "If the underground distance is sufficient for the tunnel to be
  // constructed, six tiles minimum, the city engineers will ask if you wish
  // to bore a tunnel and let you know the cost."
  const bores = BUILDINGS[tool]?.bores;
  if (bores) {
    if (t.terrain === "water") return fail("A tunnel has to start on dry land.");
    const run = findBore(city, x, y, bores);
    if (!run) return fail(`No high ground to bore through. A tunnel needs at least ${MIN_BORE} tiles of higher ground and level ground on the far side.`);
    const cost = structureCost("tunnel",bores,run.length);
    const tiles = [{ x: run.entrance.x, y: run.entrance.y }, { x: run.exit.x, y: run.exit.y },
      ...run.buried.map((n) => ({ x: n.x, y: n.y }))];
    return { ok: true, noop: false, cost, message: `Bore a ${run.length}-tile ${bores} tunnel`, tiles, run, requiresConfirmation: true };
  }

  // An on-ramp is the only place cars move between a street and a highway.
  // It climbs from the street at its foot to the deck at its head, so it
  // needs the highway on one side and the street on the opposite side. It may
  // replace the last tile of either.
  if (tool === "onramp") {
    if (t.under) return fail("A crossing cannot be replaced by an on-ramp. Build the ramp beside it.");
    if (t.type === "onramp") return noop("On-ramp already here.", here);
    if (t.terrain === "water") return fail("On-ramps cannot be built on water.");
    if (t.type !== "empty" && t.type !== "road" && t.type !== "highway") return fail("Tile is occupied. Bulldoze first.");
    if (!rampSite(city, x, y)) return fail("An on-ramp needs a highway on one side and a road on the opposite side.");
    return { ok: true, noop: false, cost: BUILDINGS.onramp.cost, message: "", tiles: here };
  }

  if (tool === "road" || tool === "rail" || tool === "highway") {
    const b = BUILDINGS[tool];
    if (carriesRoute(t, tool)) return noop(`${b.label} already here.`, here);
    if (t.under) return fail("This tile already carries two transport routes.");
    if (t.terrain !== "water" && ((tool === "road" && t.type === "rail") || (tool === "rail" && t.type === "road"))) {
      return { ok: true, noop: false, cost: b.cost * VIADUCT_MULTIPLIER, message: "Road–rail level crossing", tiles: here, surface: "road", under: 2 };
    }
    if (t.terrain !== "water" && t.type === "highway" && (tool === "road" || tool === "rail")) {
      return { ok: true, noop: false, cost: b.cost * VIADUCT_MULTIPLIER, message: `Viaduct over the ${tool}`, tiles: here, surface: "highway", under: tool === "rail" ? 2 : 1 };
    }
    // "Highways may be built over roads, but if you want your Sims to be able
    // to get from one to the other, the intersection requires an on-ramp." The
    // street keeps running underneath; the two never meet without a ramp.
    if (t.terrain !== "water" && tool === "highway" && (t.type === "road" || t.type === "rail") && !t.under) {
      return { ok: true, noop: false, cost: Math.round(b.cost * VIADUCT_MULTIPLIER), message: `Viaduct over the ${t.type}`, tiles: here, under: t.type === "rail" ? 2 : 1 };
    }
    if (t.type !== "empty") return fail("Tile is occupied. Bulldoze first.");
    if (t.terrain === "water") return fail("Drag straight from dry land to dry land to build a bridge.");
    return { ok: true, noop: false, cost: b.cost, message: "", tiles: here };
  }

  if (tool === "dispatch") {
    const a = t.lot ? anchorOf(city, t) : t;
    if (!a?.fire) return fail("Nothing is burning here.");
    // "You will have one dispatch unit for each fire station you build, plus
    // one for the volunteer group."
    const free = crewsAvailable(city);
    if (free <= 0) {
      const crews = fireCrews(city);
      return fail(crews > 1
        ? `All ${crews} fire crews are already out this month. Build more fire stations.`
        : "The volunteer brigade is already out. Build a fire station to dispatch more units.");
    }
    return { ok: true, noop: false, cost: BUILDINGS.dispatch.cost, message: `Send a fire crew (${free} of ${fireCrews(city)} left)`, tiles: a.lot ? lotTiles(city, a.lot).map((n) => ({ x: n.x, y: n.y })) : here };
  }

  // "Fires and riots are the only disasters where you can make a difference by
  // dispatching fire and police units."
  if (tool === "patrol") {
    const riot = riotAt(city, x, y);
    if (!riot) return fail(`No riot within ${RIOT_REACH} tiles of here.`);
    const free = unitsAvailable(city);
    if (free <= 0) {
      const units = policeUnits(city);
      return fail(units > 1
        ? `All ${units} police units are already out this month. Build more police stations.`
        : "The only patrol car is already out. Build a police station to send more.");
    }
    return { ok: true, noop: false, cost: BUILDINGS.patrol.cost, message: `Break up the riot (${free} of ${policeUnits(city)} units left)`, tiles: here, riot };
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
      if (n.elev !== base && n.tunnel) return fail("Cannot level the ground over a tunnel.");
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

  if(ev.requiresConfirmation && (options.confirmStructures!==true || !Number.isFinite(options.maxCost) || ev.cost>options.maxCost))return {ok:false,requiresConfirmation:true,quote:ev.cost,message:ev.message,changed:0,cost:0};
  const t = city.tiles[y * city.size + x];
  const density = options.density ?? 1;

  if(ev.removeStructure) {
    removeStructure(city,ev.removeStructure);
  } else if (ZONED_TYPES.has(tool)) {
    t.powerline = false; t.type = tool; t.density = PORT_TYPES.has(tool) ? 1 : density; t.level = 0; t.lot = null; t.trees = 0; t.abandoned = false; t.age = 0;
  } else if (OVERLAY_TOOLS.has(tool)) {
    t[tool] = true;
    if(tool==='powerline')t.trees=0;
  } else if (tool === "tree") {
    t.powerline = false;
    t.trees = Math.min(3, (t.trees || 0) + 1);
  } else if (tool === "makewater" || tool === "makeland") {
    applySurfaceWater(ev.waterPlan);
  } else if (tool === "raise" || tool === "lower" || tool === "level") {
    for (const c of ev.changes) c.tile.elev = c.elev;
    if(ev.waterPlan)applySurfaceWater(ev.waterPlan);
  } else if (BUILDINGS[tool]?.bores) {
    bore(city, ev.run, BUILDINGS[tool].bores);
  } else if (tool === "road" || tool === "rail" || tool === "highway" || tool === "onramp") {
    t.powerline = false; t.type = ev.surface ?? tool; t.trees = 0; t.density = 0; t.level = 0;
    if (ev.under) t.under = ev.under;
  } else if (tool === "dispatch") {
    const a = t.lot ? anchorOf(city, t) : t;
    a.fire = 0;
    city.dispatched = (city.dispatched || 0) + 1;
  } else if (tool === "patrol") {
    // The crowd disperses; the fires it has already set still burn.
    ev.riot.ttl = 1;
    city.patrolled = (city.patrolled || 0) + 1;
  } else if (tool === "bulldoze") {
    if (t.lot) {
      const a = anchorOf(city, t);
      clearLot(city, a, { keepZone: ZONED_TYPES.has(a.type) });
    } else if (t.under) {
      // Take the viaduct down and leave the street it was built over.
      t.type = t.under === 2 ? "rail" : "road";
      t.under = 0;
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
