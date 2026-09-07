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
//   Seaports must be zoned at least 2x6 tiles or larger in order to develop.
//   They require power, water, and a road nearby. They must be located along a
//   shoreline to do anything, but if you want to see real results, build one
//   on a seacoast."
//
// And page 69: "Seaports and airports are considered connections to all
// neighbors."
import { tileAt } from "./grid.js";

// The manual gives the minimum footprints and nothing else. Everything below
// them is calibrated so a port's first development lands where the manual
// says it should: when the city "requires outside sources for commerce and
// industry", not before.
//
// short/long: the minimum rectangle, in either orientation.
// serves:     the sector the port mainly exists for.
// carries:    sector jobs one tile of working port can serve. A minimum
//             airport (15 tiles) carries 6,000 commercial jobs; a minimum
//             seaport (12 tiles) carries 3,600 industrial ones.
export const PORTS = {
  airport: {
    label: "Airport", short: 3, long: 5,
    serves: "commercial", carries: 400,
    jobs: 18, power: 0.5, water: 0.25, upkeep: 7, pollution: 0.9,
    demand: 0.8, crossDemand: 0.25,
  },
  seaport: {
    label: "Seaport", short: 2, long: 6,
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

// A save may not carry a lot wider or deeper than this; see city.js.
export const MAX_PORT = 8;
// How far from the quay a berth still counts as being on the water.
const SHORE_REACH = 2;

export const minTiles = (spec) => spec.short * spec.long;
export const fitsPort = (spec, w, h) =>
  (w >= spec.short && h >= spec.long) || (w >= spec.long && h >= spec.short);

const rect = (lot) => {
  const out = [];
  for (let y = lot.y; y < lot.y + lot.h; y++) for (let x = lot.x; x < lot.x + lot.w; x++) out.push([x, y]);
  return out;
};

// Water within reach of the footprint. `salt` asks for the open sea.
function nearWater(city, lot, salt) {
  for (const [cx, cy] of rect(lot)) {
    for (let dy = -SHORE_REACH; dy <= SHORE_REACH; dy++) {
      for (let dx = -SHORE_REACH; dx <= SHORE_REACH; dx++) {
        const n = tileAt(city, cx + dx, cy + dy);
        if (n?.terrain === "water" && (!salt || n.salt)) return true;
      }
    }
  }
  return false;
}

// "They must be located along a shoreline to do anything, but if you want to
// see real results, build one on a seacoast." So an inland berth works; it
// just does not pay like a sea one. An airport does not care where it is.
export function berthFactor(city, anchor) {
  const spec = PORTS[anchor.type];
  if (!spec?.shoreline) return 1;
  const lot = anchor.lot || { x: anchor.x, y: anchor.y, w: 1, h: 1 };
  if (nearWater(city, lot, true)) return 1;
  return nearWater(city, lot, false) ? 0.4 : 0;
}

// The largest rectangle of free port zone that contains `seed`, or null if
// the zone is smaller than the manual's minimum. Ports are one facility on
// one block, so unlike an RCI lot this takes as much of the block as it can.
export function findPortLot(city, seed) {
  const spec = PORTS[seed.type];
  if (!spec || seed.lot) return null;
  const free = (x, y) => {
    const t = tileAt(city, x, y);
    return !!t && t.type === seed.type && !t.lot && t.terrain !== "water" && t.elev === seed.elev;
  };
  let best = null;
  for (let top = seed.y; top > seed.y - MAX_PORT; top--) {
    if (!free(seed.x, top)) break;
    for (let bottom = seed.y; bottom < top + MAX_PORT; bottom++) {
      if (!free(seed.x, bottom)) break;
      const column = (x) => { for (let y = top; y <= bottom; y++) if (!free(x, y)) return false; return true; };
      let left = seed.x, right = seed.x;
      while (column(left - 1)) left--;
      while (column(right + 1)) right++;
      // Trim an over-wide block from the right, then the left, so the lot
      // still contains the seed and hugs the top-left like every other lot.
      if (right - left + 1 > MAX_PORT) right = Math.max(seed.x, left + MAX_PORT - 1);
      if (right - left + 1 > MAX_PORT) left = right - MAX_PORT + 1;
      const w = right - left + 1, h = bottom - top + 1;
      if (!fitsPort(spec, w, h)) continue;
      if (!best || w * h > best.w * best.h) best = { x: left, y: top, w, h };
    }
  }
  return best;
}

// Is this port standing where it can work at all? "They require power, water,
// and a road nearby" - all three, whatever the size.
export function portReady(t) {
  if (t.radiation) return false;
  return !!(t.roadAccess && t.powered && t.watered);
}

// Working tiles of port: the footprint, scaled by how good the berth is.
// Zero while it is unpowered, dry, cut off or abandoned.
export function portTiles(city, anchor) {
  if (!anchor.lot || !isPort(anchor.type) || !anchor.level || anchor.abandoned) return 0;
  if (!portReady(anchor)) return 0;
  return anchor.lot.w * anchor.lot.h * berthFactor(city, anchor);
}

export function portJobs(city, anchor) {
  return Math.round(portTiles(city, anchor) * PORTS[anchor.type].jobs);
}

// Power and water draw, and monthly upkeep. A port that has been zoned but
// not developed draws nothing.
export function portDraw(anchor) {
  const spec = PORTS[anchor.type];
  if (!spec || !anchor.lot || !anchor.level || anchor.abandoned) return { power: 0, water: 0 };
  const tiles = anchor.lot.w * anchor.lot.h;
  return { power: spec.power * tiles, water: spec.water * tiles };
}

export function portUpkeep(anchor) {
  const spec = PORTS[anchor.type];
  if (!spec || !anchor.lot || !anchor.level || anchor.abandoned) return 0;
  return spec.upkeep * anchor.lot.w * anchor.lot.h;
}

// "Airports help your Industrial and Commercial districts to grow"; seaports
// help "your Industrial and Commercial sector". Both name both sectors, so
// each port lifts its own first and the other a little. Capped, because the
// sector it lifts is the same one that decides whether more port is wanted.
export function portDemandBonus(city) {
  const bonus = {};
  for (const t of city.tiles) {
    if (!t.lot || t.lot.x !== t.x || t.lot.y !== t.y || !isPort(t.type)) continue;
    const spec = PORTS[t.type];
    const tiles = portTiles(city, t);
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
  const standing = { airport: 0, seaport: 0 };
  for (const t of city.tiles) {
    if (!t.lot || t.lot.x !== t.x || t.lot.y !== t.y || !isPort(t.type)) continue;
    // Zoned tiles already built on count against the want even when idle:
    // a dark, dry airport is still an airport the city paid for.
    standing[t.type] += t.abandoned ? 0 : t.lot.w * t.lot.h * berthFactor(city, t);
  }
  const out = {};
  for (const [type, spec] of Object.entries(PORTS)) {
    const wanted = (jobs[spec.serves] || 0) / spec.carries;
    const d = (wanted - standing[type]) / Math.max(minTiles(spec), wanted) * 100;
    out[type] = Math.round(Math.max(-100, Math.min(100, d)));
  }
  return out;
}

// Why a zoned port has not been built on yet. A terminal is one flat slab, so
// unlike an RCI block it cannot fall back to a smaller lot and quietly build
// something: if the block is short, or steps up a hill, nothing happens at all
// and the mayor deserves to be told which.
export function portObstacle(city, t) {
  const spec = PORTS[t.type];
  if (!spec || t.lot) return null;
  if (t.radiation) return "Contaminated ground: nothing will be built here.";
  const missing = [!t.powered && "power", !t.watered && "water", !t.roadAccess && "a road nearby"].filter(Boolean);
  if (missing.length) return `Waiting on ${missing.join(", ")}.`;
  if (!findPortLot(city, t)) {
    return `Not big enough: needs ${spec.short}×${spec.long} tiles of ${t.type} zone at one elevation. Level the ground or zone more.`;
  }
  return null;
}

// One line for the query card when a berth is in the wrong place.
export function portNote(city, anchor) {
  const spec = PORTS[anchor.type];
  if (!spec?.shoreline) return null;
  const factor = berthFactor(city, anchor);
  if (factor === 0) return "Not on a shoreline: this port does nothing.";
  if (factor < 1) return "Inland water only: a seacoast berth would carry far more trade.";
  return null;
}

// Ports that are running this month: lit, watered, reachable and on a berth
// that works. What the city's trade is actually worth.
export function workingPorts(city) {
  return countPorts(city, (t) => portTiles(city, t) > 0);
}

// "Seaports and airports are considered connections to all neighbors."
// A seaport therefore opens garbage deals on every side, the way a road to the
// border does. This one reads only what a save carries - a terminal stands
// whether or not the lights are on this month - because connections are
// derived before the power and water networks are, so a test on `powered`
// here would come out differently on load than it does in a running city.
export function standingPorts(city) {
  return countPorts(city, (t) => !t.abandoned && t.level > 0 && berthFactor(city, t) > 0);
}

function countPorts(city, test) {
  let airport = 0, seaport = 0;
  for (const t of city.tiles) {
    if (!t.lot || t.lot.x !== t.x || t.lot.y !== t.y || !isPort(t.type)) continue;
    if (!test(t)) continue;
    if (t.type === "airport") airport++; else seaport++;
  }
  return { airport, seaport };
}
