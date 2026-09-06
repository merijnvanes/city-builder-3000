// Neighbouring cities beyond the four map edges.
//
// A road, rail line, power line or pipe that reaches the map edge connects
// to the neighbour on that side. Connections open trade (demand and jobs)
// and neighbour deals: buying or selling power and water, and exporting or
// importing garbage. Deals end when their connection is cut.
import { ROAD_TYPES } from "./catalog.js";

export const SIDES = ["north", "east", "south", "west"];
const NAMES = ["Ashford", "Brightwater", "Cedar Falls", "Dunmore", "Eastbrook", "Fairhaven", "Glenrock", "Harborview", "Ironvale", "Juniper", "Kingsport", "Lakemont", "Millbridge", "Northgate", "Oakridge", "Pinehurst"];

export const DEALS = {
  power: {
    buy:  { amount: 3000, price: 180, label: "Buy 3,000 units of power", needs: "power" },
    sell: { amount: 2000, price: 150, label: "Sell 2,000 units of surplus power", needs: "power" },
  },
  water: {
    buy:  { amount: 2000, price: 110, label: "Buy 2,000 units of water", needs: "water" },
    sell: { amount: 1500, price: 90,  label: "Sell 1,500 units of surplus water", needs: "water" },
  },
  garbage: {
    buy:  { amount: 600, price: 220, label: "Accept 600 tons of their garbage", needs: "road" },
    sell: { amount: 500, price: 160, label: "Export 500 tons of garbage", needs: "road" },
  },
};

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
export function detectConnections(city) {
  const result = {};
  SIDES.forEach((side, index) => {
    const info = { name: neighborName(city.seed, index), road: 0, rail: 0, power: 0, water: 0, roadTiles: [], powerTiles: [], pipeTiles: [] };
    for (const t of edgeTiles(city, side)) {
      if (t.type === "road") { info.road++; info.roadTiles.push(t); }
      if (t.type === "rail") info.rail++;
      if (t.powerline) { info.power++; info.powerTiles.push(t); }
      if (t.pipe) { info.water++; info.pipeTiles.push(t); }
    }
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
  return c[needs] > 0;
}

export function signDeal(city, resource, side, kind) {
  if (!DEALS[resource] || !DEALS[resource][kind] || !SIDES.includes(side)) return { ok: false, message: "Unknown deal." };
  const connections = detectConnections(city);
  if (!dealAvailable(connections, resource, side)) {
    const needs = DEALS[resource][kind].needs;
    return { ok: false, message: `Connect a ${needs === "power" ? "power line" : needs === "water" ? "pipe" : "road"} to the ${side} edge first.` };
  }
  ensureDeals(city)[resource] = { side, kind, since: city.month };
  const d = DEALS[resource][kind];
  return { ok: true, message: `${d.label} ${kind === "buy" ? "from" : "to"} ${connections[side].name} for $${d.price}/month.` };
}

export function cancelDeal(city, resource) {
  if (!city.deals?.[resource]) return { ok: false, message: "No such deal." };
  delete city.deals[resource];
  return { ok: true, message: `${resource} deal cancelled.` };
}

// Drop deals whose connection is gone. Returns news lines.
export function auditDeals(city, connections) {
  const news = [];
  for (const [resource, deal] of Object.entries(city.deals || {})) {
    if (!dealAvailable(connections, resource, deal.side)) {
      delete city.deals[resource];
      news.push(`${connections[deal.side].name} cancelled the ${resource} deal: the connection was cut.`);
    }
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
