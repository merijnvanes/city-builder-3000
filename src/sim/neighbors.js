// Neighbouring cities beyond the four map edges.
//
// A road, rail line, power line or pipe that reaches the map edge connects
// to the neighbour on that side. Connections open trade (demand and jobs)
// and neighbour deals: buying or selling power and water, and exporting or
// importing garbage. Deals end when their connection is cut.
import { ROAD_TYPES } from "./catalog.js";
import { standingPorts } from "./ports.js";

export const SIDES = ["north", "east", "south", "west"];
const NAMES = ["Ashford", "Brightwater", "Cedar Falls", "Dunmore", "Eastbrook", "Fairhaven", "Glenrock", "Harborview", "Ironvale", "Juniper", "Kingsport", "Lakemont", "Millbridge", "Northgate", "Oakridge", "Pinehurst"];

// What a neighbour will do for you, and what it costs.
//
// The manual, pages 81 and 100-101, is specific about which side of a deal is
// metered and which is a fixed obligation:
//
//   Buying: "a contracted neighbour will look at your city's power or water
//     needs at the connection point, and will supply any deficit... funds are
//     deducted from your treasury based on how much power or water you
//     needed. If you didn't need any during the month, you still have to pay
//     a minimum fee."
//   Selling: "Each month you are responsible to supply them with the
//     contracted amount... If conditions change and you can no longer provide
//     the power you promised, the deal is canceled and you'll be charged a
//     large penalty."
//   Exporting garbage: "a contracted neighbour will take all your excess
//     garbage... funds are deducted based on how much garbage they took. If
//     you don't generate any excess garbage, you still have to pay a minimum
//     fee."
//
// So `cap` is the most a neighbour will handle, `rate` is the price per unit
// actually traded, and `minimum` is the standing charge either way.
export const DEALS = {
  power: {
    buy:  { cap: 6000, rate: 0.06, minimum: 40, label: "Buy power as needed", needs: "power" },
    sell: { cap: 2000, rate: 0.075, minimum: 0, label: "Sell 2,000 units of surplus power", needs: "power" },
  },
  water: {
    buy:  { cap: 4000, rate: 0.055, minimum: 25, label: "Buy water as needed", needs: "water" },
    sell: { cap: 1500, rate: 0.06, minimum: 0, label: "Sell 1,500 units of water", needs: "water" },
  },
  garbage: {
    buy:  { cap: 600, rate: 0.37, minimum: 0, label: "Accept 600 tons of their garbage", needs: "road" },
    sell: { cap: 4000, rate: 0.32, minimum: 45, label: "Export excess garbage", needs: "road" },
  },
};

// "There is a large penalty for cancelling the deal", whether the mayor walks
// away or the city simply stops being able to deliver. Twelve months of the
// standing charge, or of the contracted amount for a sale.
export const CANCEL_MONTHS = 12;
export function cancelPenalty(resource, kind) {
  const d = DEALS[resource]?.[kind];
  if (!d) return 0;
  return Math.round((d.minimum || d.cap * d.rate) * CANCEL_MONTHS);
}

export function neighborName(seed, index) {
  return NAMES[(seed * 7 + index * 3 + (seed >> 5)) % NAMES.length];
}

function edgeTiles(city, side) {
  const { size, tiles } = city;
  const out = [];
  for (let i = 0; i < size; i++) {
    if (side === "north") out.push(tiles[i]);
    else if (side === "south") out.push(tiles[(size - 1) * size + i]);
    else if (side === "west") out.push(tiles[i * size]);
    else out.push(tiles[i * size + size - 1]);
  }
  return out;
}

// { north: { name, road, rail, power, water, roadTiles: [...] }, ... }
//
// "Seaports and airports are considered connections to all neighbors", and
// garbage may travel by "road, highway, rail, or seaport connection". So a
// working terminal opens the same doors a road to the border does, on every
// side at once. It carries no roadTiles: outbound commuters still need a real
// road, and a neighbour deal metered at the connection point needs a wire.
export function detectConnections(city) {
  const result = {};
  const ports = standingPorts(city);
  SIDES.forEach((side, index) => {
    const info = { name: neighborName(city.seed, index), road: 0, rail: 0, power: 0, water: 0, port: 0, roadTiles: [], powerTiles: [], pipeTiles: [] };
    for (const t of edgeTiles(city, side)) {
      if (t.type === "road" || t.type === "highway") { info.road++; info.roadTiles.push(t); }
      if (t.type === "rail") info.rail++;
      if (t.powerline) { info.power++; info.powerTiles.push(t); }
      if (t.pipe) { info.water++; info.pipeTiles.push(t); }
    }
    info.port = ports.seaport;
    result[side] = info;
  });
  return result;
}

export function connectionCount(connections, kind) {
  return SIDES.reduce((s, side) => s + (connections?.[side]?.[kind] ? 1 : 0), 0);
}

export function ensureDeals(city) {
  if (!city.deals) city.deals = {};
  return city.deals;
}

export function dealAvailable(connections, resource, side) {
  const c = connections?.[side];
  if (!c) return false;
  const needs = DEALS[resource].buy.needs;
  // Garbage travels by "road, highway, rail, or seaport connection".
  if (needs === "road") return c.road > 0 || c.rail > 0 || c.port > 0;
  return c[needs] > 0;
}

export function signDeal(city, resource, side, kind) {
  if (!DEALS[resource] || !DEALS[resource][kind] || !SIDES.includes(side)) return { ok: false, message: "Unknown deal." };
  const connections = detectConnections(city);
  if (!dealAvailable(connections, resource, side)) {
    const needs = DEALS[resource][kind].needs;
    return { ok: false, message: `Connect a ${needs === "power" ? "power line" : needs === "water" ? "pipe" : "road, rail line or seaport"} to the ${side} edge first.` };
  }
  ensureDeals(city)[resource] = { side, kind, since: city.month };
  const d = DEALS[resource][kind];
  const terms = kind === "buy" && d.minimum
    ? `at $${d.rate.toFixed(2)} a unit, minimum $${d.minimum}/month`
    : `for about $${Math.round(d.cap * d.rate).toLocaleString()}/month`;
  return { ok: true, message: `${d.label} ${kind === "buy" ? "from" : "to"} ${connections[side].name} ${terms}. Breaking it costs $${cancelPenalty(resource, kind).toLocaleString()}.` };
}

export function cancelDeal(city, resource) {
  const deal = city.deals?.[resource];
  if (!deal) return { ok: false, message: "No such deal." };
  const penalty = cancelPenalty(resource, deal.kind);
  if (penalty > city.money) return { ok: false, message: `Breaking the ${resource} contract costs $${penalty.toLocaleString()}, which the city cannot pay.` };
  delete city.deals[resource];
  city.money -= penalty;
  return { ok: true, message: `${resource} deal cancelled. The contract penalty cost $${penalty.toLocaleString()}.` };
}

// End deals the city can no longer honour, and charge for it. "If conditions
// change and you can no longer provide the power you promised, the deal is
// canceled and you'll be charged a large penalty." Losing the connection ends
// a deal the same way.
export function auditDeals(city, connections, utilities) {
  const news = [];
  for (const [resource, deal] of Object.entries(city.deals || {})) {
    const cut = !dealAvailable(connections, resource, deal.side);
    const undelivered = !cut && deal.kind === "sell" && resource !== "garbage" && utilities?.[resource]?.deal?.met === false;
    if (!cut && !undelivered) continue;
    const penalty = cancelPenalty(resource, deal.kind);
    delete city.deals[resource];
    city.money -= penalty;
    const who = connections[deal.side]?.name || "The neighbour";
    news.push(cut
      ? `${who} cancelled the ${resource} deal: the connection was cut. Penalty $${penalty.toLocaleString()}.`
      : `${who} cancelled the ${resource} deal: the city could not deliver. Penalty $${penalty.toLocaleString()}.`);
  }
  return news;
}

// Monthly money effect of deals: positive income, negative expense.
export function dealBalance(city) {
  let income = 0, expense = 0;
  for (const [resource, deal] of Object.entries(city.deals || {})) {
    const d = DEALS[resource]?.[deal.kind];
    if (!d) continue;
    if (deal.kind === "sell") { if (resource === "garbage") expense += d.price; else income += d.price; }
    else { if (resource === "garbage") income += d.price; else expense += d.price; }
  }
  return { income, expense };
}
