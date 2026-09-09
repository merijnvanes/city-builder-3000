// Airport and seaport zones.
//
// The manual, page 33-34 and 73, is explicit that these are zones and not
// buildings the mayor places:
//
//   "What actually builds in the Residential, Commercial, Industrial, Airport
//   and Seaport zones is up to the Sims."
//
//   "Airports help your Industrial and Commercial districts to grow by
//   bringing in tourists and workers, as well as making your city more
//   accessible to the outside world. Just like RCI zones, you zone for
//   airports and wait for Sims to develop them. Available in 1930, airports
//   must be at least 3x5 tiles or larger in order to develop. They also
//   require power, water and a road nearby. They will only develop as your
//   city grows and requires outside sources for commerce and industry."
//
//   "Seaports help your Industrial and Commercial sector to grow by providing
//   a means to transport goods to the outside world. They also allow your city
//   to make deals to import or export garbage to neighboring cities...
//   They require power, water, and a road nearby. They must be located along a
//   shoreline to do anything, but if you want to see real results, build one
//   on a seacoast."
//
// And page 69: "Seaports and airports are considered connections to all
// neighbors."
//
// A port grows module by module on its zone; see port-layout.js. This file
// is what the port is worth: its jobs, draw, upkeep, demand and readiness.
import { portComponents, portOf, portModules, portReady as componentReady, planPortCore, coreObstacle, partSpec } from "./port-layout.js";

// Balance for each port type, calibrated so a port's first development lands
// where the manual says it should: when the city "requires outside sources
// for commerce and industry", not before.
//
// serves:  the sector the port mainly exists for.
// carries: sector jobs one tile of working port can serve.
// scale:   the port the city thinks in when it measures its want: the
//          manual's minimum, a five-tile runway with a 2×2 terminal (nine
//          tiles) or a 2×6 harbour. A seaport can open smaller than that,
//          with just its freight shed; the want still reads against a real
//          harbour, so a village never asks for one.
export const PORTS = {
  airport: {
    label: "Airport", scale: 9, // RUNWAY_MIN + a 2×2 terminal; a literal, as lots.js and this file import each other.
    serves: "commercial", carries: 400,
    jobs: 18, power: 0.5, water: 0.25, upkeep: 7, pollution: 0.9,
    demand: 0.8, crossDemand: 0.25,
  },
  seaport: {
    label: "Seaport", scale: 12,
    serves: "industrial", carries: 300,
    jobs: 22, power: 0.5, water: 0.25, upkeep: 7, pollution: 1.1,
    demand: 0.9, crossDemand: 0.25,
    shoreline: true,
  },
};

// Most a city's ports can add to one sector's demand, however many it builds.
export const DEMAND_CAP = 20;

export const PORT_TYPES = Object.keys(PORTS);
export const isPort = (type) => Object.hasOwn(PORTS, type);

// "They must be located along a shoreline to do anything, but if you want to
// see real results, build one on a seacoast." So an inland berth works; it
// just does not pay like a sea one. An airport does not care where it is.
export function berthFactor(city, t) {
  return portOf(city, t)?.berth ?? 0;
}

// Is this port standing where it can work at all? "They require power, water,
// and a road nearby" - all three, whatever the size.
export function portReady(city, t) {
  return componentReady(city, portOf(city, t));
}

const standing = (anchor) => !!anchor.lot && !!anchor.part && anchor.level > 0 && !anchor.abandoned;

// Working tiles of one module: its footprint, scaled by how good the berth is.
// Zero while the port is unpowered, dry, cut off or abandoned.
export function portTiles(city, anchor) {
  if (!standing(anchor) || !isPort(anchor.type) || !portReady(city, anchor)) return 0;
  return anchor.lot.w * anchor.lot.h * berthFactor(city, anchor);
}

export function portJobs(city, anchor) {
  return Math.round(portTiles(city, anchor) * PORTS[anchor.type].jobs);
}

// Everything the whole port employs, for the query card.
export function portComponentJobs(city, t) {
  const component = portOf(city, t);
  return component ? portModules(component).reduce((sum, anchor) => sum + portJobs(city, anchor), 0) : 0;
}

// Power and water draw, and monthly upkeep. A zoned but undeveloped tile
// draws nothing.
export function portDraw(anchor) {
  const spec = PORTS[anchor.type];
  if (!spec || !standing(anchor)) return { power: 0, water: 0 };
  const tiles = anchor.lot.w * anchor.lot.h;
  return { power: spec.power * tiles, water: spec.water * tiles };
}

export function portUpkeep(anchor) {
  const spec = PORTS[anchor.type];
  if (!spec || !standing(anchor)) return 0;
  return spec.upkeep * anchor.lot.w * anchor.lot.h;
}

// "Airports help your Industrial and Commercial districts to grow"; seaports
// help "your Industrial and Commercial sector". Both name both sectors, so
// each port lifts its own first and the other a little. Capped, because the
// sector it lifts is the same one that decides whether more port is wanted.
export function portDemandBonus(city) {
  const bonus = {};
  for (const component of portComponents(city).list) {
    const spec = PORTS[component.type];
    const tiles = portModules(component).reduce((sum, anchor) => sum + portTiles(city, anchor), 0);
    if (!tiles) continue;
    const other = spec.serves === "commercial" ? "industrial" : "commercial";
    bonus[spec.serves] = (bonus[spec.serves] || 0) + tiles * spec.demand;
    bonus[other] = (bonus[other] || 0) + tiles * spec.crossDemand;
  }
  for (const k of Object.keys(bonus)) bonus[k] = Math.min(DEMAND_CAP, bonus[k]);
  return bonus;
}

// How much port the city wants, against how much it has. "They will only
// develop as your city grows and requires outside sources for commerce and
// industry", so the yardstick is the sector the port serves.
export function portDemand(city, m) {
  const jobs = { commercial: m.jobsCommercial, industrial: m.jobsIndustrial };
  const built = { airport: 0, seaport: 0 };
  for (const component of portComponents(city).list) {
    // Zoned tiles already built on count against the want even when idle:
    // a dark, dry airport is still an airport the city paid for.
    for (const anchor of portModules(component)) if (standing(anchor)) built[component.type] += anchor.lot.w * anchor.lot.h * component.berth;
  }
  const out = {};
  for (const [type, spec] of Object.entries(PORTS)) {
    const wanted = (jobs[spec.serves] || 0) / spec.carries;
    const d = (wanted - built[type]) / Math.max(spec.scale, wanted) * 100;
    out[type] = Math.round(Math.max(-100, Math.min(100, d)));
  }
  return out;
}

// Why a zoned tile has nothing on it yet. A port cannot open on a zone that
// has no room for its core, and the mayor deserves to be told which.
export function portObstacle(city, t) {
  const component = portOf(city, t);
  if (!component || t.lot) return null;
  if (t.radiation) return "Contaminated ground: nothing will be built here.";
  const missing = [
    !component.tiles.some((n) => n.powered) && "power",
    !component.tiles.some((n) => n.watered) && "water",
    !component.tiles.some((n) => n.roadAccess) && "a road nearby",
  ].filter(Boolean);
  if (missing.length) return `Waiting on ${missing.join(", ")}.`;
  if (portModules(component).length) return null;
  return coreObstacle(city, component);
}

// One line for the query card when a berth is in the wrong place.
export function portNote(city, t) {
  const spec = PORTS[t.type];
  if (!spec?.shoreline) return null;
  const factor = berthFactor(city, t);
  if (factor === 0) return "Not on a shoreline: this port does nothing.";
  if (factor < 1) return "Inland water only: a seacoast berth would carry far more trade.";
  return null;
}

// Ports that are running this month: lit, watered, reachable and on a berth
// that works. What the city's trade is actually worth.
export function workingPorts(city) {
  return countPorts(city, (component) => componentReady(city, component) && component.berth > 0 && portModules(component).some(standing));
}

// "Seaports and airports are considered connections to all neighbors."
// A seaport therefore opens garbage deals on every side, the way a road to the
// border does. This one reads only what a save carries - a terminal stands
// whether or not the lights are on this month - because connections are
// derived before the power and water networks are, so a test on `powered`
// here would come out differently on load than it does in a running city.
export function standingPorts(city) {
  return countPorts(city, (component) => component.berth > 0 && portModules(component).some(standing));
}

function countPorts(city, test) {
  const out = { airport: 0, seaport: 0 };
  for (const component of portComponents(city).list) if (test(component)) out[component.type]++;
  return out;
}

// What a module is, for labels: "Runway", "Freight shed".
export const partLabel = (type, part) => partSpec(type, part)?.label || null;
export { planPortCore };
