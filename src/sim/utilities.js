// Power and water networks.
//
// Power conducts through power lines, zoned tiles and building footprints.
// Roads do not carry power. A network is powered when its plants supply at
// least its demand; otherwise buildings are served in tile order until the
// budget runs out (a brownout).
//
// Water flows through pipes. A pipe network serves every tile within
// WATER_RADIUS (square) of one of its pipes, with the same budget rule.
import { components, forSquare, forRadius, tileAt } from "./grid.js";
import { BUILDINGS, ZONE_TYPES } from "./catalog.js";
import { isAnchor, anchorOf, drawOf } from "./lots.js";
import { DEALS } from "./neighbors.js";

export const WATER_RADIUS = 6;

// Neighbour deals: bought supply arrives on the network touching the edge;
// sold supply is a fixed extra load on that network.
function applyDeal(city, resource, netIds, supply, consumers, tilesKey) {
  const deal = city.deals?.[resource];
  if (!deal) return null;
  const side = city._connections?.[deal.side];
  const edge = side?.[tilesKey]?.[0];
  if (!edge) return null;
  const net = netIds[edge.y * city.size + edge.x];
  if (net < 0) return null;
  const d = DEALS[resource][deal.kind];
  if (deal.kind === "buy") supply[net] += d.amount;
  else consumers.unshift({ anchor: { deal: resource }, net, draw: d.amount });
  return { net, kind: deal.kind, amount: d.amount };
}

// Pumps near water give full output; elsewhere they trickle.
export function sourceEfficiency(city, anchor) {
  const b = BUILDINGS[anchor.type];
  if (!b?.nearWater) return 1;
  let near = false;
  forRadius(city, anchor.x, anchor.y, 2, (t) => { if (t.terrain === "water") near = true; });
  return near ? 1 : 0.3;
}

// Conductors: power lines, zoned tiles and building footprints. Power also
// jumps across a single road or rail tile, so lots on both sides of a
// street share a network without lines along every block.
const conducts = (t) => t.powerline || !!t.lot || ZONE_TYPES.has(t.type);
const isRoad = (t) => t.type === "road" || t.type === "rail" || t.type === "highway";

function powerComponents(city) {
  const { size, tiles } = city;
  const ids = new Int32Array(tiles.length).fill(-1);
  const queue = new Int32Array(tiles.length);
  let count = 0;
  const step = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let start = 0; start < tiles.length; start++) {
    if (ids[start] !== -1 || !conducts(tiles[start])) continue;
    let head = 0, tail = 0;
    queue[tail++] = start; ids[start] = count;
    while (head < tail) {
      const i = queue[head++];
      const x = i % size, y = (i - x) / size;
      for (const [dx, dy] of step) {
        let nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        let ni = ny * size + nx;
        let n = tiles[ni];
        if (!conducts(n)) {
          if (!isRoad(n) || n.powerline) continue;
          nx += dx; ny += dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          ni = ny * size + nx; n = tiles[ni];
          if (!conducts(n)) continue;
        }
        if (ids[ni] === -1) { ids[ni] = count; queue[tail++] = ni; }
      }
    }
    count++;
  }
  return { ids, count };
}

function allocate(city, netIds, count, supply, consumers) {
  const budget = Float64Array.from(supply);
  const demand = new Float64Array(count);
  for (const c of consumers) demand[c.net] += c.draw;
  const full = new Uint8Array(count);
  for (let n = 0; n < count; n++) if (supply[n] > 0 && supply[n] >= demand[n]) full[n] = 1;
  const served = new Set();
  for (const c of consumers) {
    if (full[c.net]) { served.add(c.anchor); continue; }
    if (budget[c.net] >= c.draw) { budget[c.net] -= c.draw; served.add(c.anchor); }
  }
  let totalSupply = 0, totalDemand = 0;
  for (let n = 0; n < count; n++) { totalSupply += supply[n]; totalDemand += demand[n]; }
  return { full, served, totalSupply, totalDemand };
}

export function updateUtilities(city) {
  const { tiles, size } = city;
  for (const t of tiles) { t.powered = false; t.watered = false; }

  // ── Power ────────────────────────────────────────────────────
  const power = powerComponents(city);
  const powerSupply = new Float64Array(power.count);
  const powerConsumers = [];
  for (const t of tiles) {
    if (!isAnchor(t)) continue;
    const net = power.ids[t.y * size + t.x];
    if (net < 0) continue;
    const b = BUILDINGS[t.type];
    if (b?.powerOut) powerSupply[net] += b.powerOut;
    const draw = drawOf(t).power;
    if (draw > 0) powerConsumers.push({ anchor: t, net, draw });
  }
  if (city.ordinances?.energyConservation) for (const c of powerConsumers) c.draw *= 0.85;
  const powerDeal = applyDeal(city, "power", power.ids, powerSupply, powerConsumers, "powerTiles");
  const p = allocate(city, power.ids, power.count, powerSupply, powerConsumers);
  for (const t of tiles) {
    const net = power.ids[t.y * size + t.x];
    if (net < 0 || powerSupply[net] <= 0) continue;
    if (p.full[net]) { t.powered = true; continue; }
    const a = anchorOf(city, t);
    if (a && (p.served.has(a) || BUILDINGS[a.type]?.powerOut)) t.powered = true;
  }

  // ── Water ────────────────────────────────────────────────────
  const carries = (t) => t.pipe || !!BUILDINGS[t.type]?.waterOut;
  const water = components(city, carries);
  const waterSupply = new Float64Array(water.count);
  for (const t of tiles) {
    if (!isAnchor(t)) continue;
    const b = BUILDINGS[t.type];
    if (!b?.waterOut) continue;
    const net = water.ids[t.y * size + t.x];
    if (net >= 0 && t.powered) waterSupply[net] += b.waterOut * sourceEfficiency(city, t);
  }
  // Coverage: nearest pipe network claims each tile.
  const cover = new Int32Array(tiles.length).fill(-1);
  for (const t of tiles) {
    const net = water.ids[t.y * size + t.x];
    if (net < 0) continue;
    forSquare(city, t.x, t.y, WATER_RADIUS, (n) => { if (cover[n.y * size + n.x] < 0) cover[n.y * size + n.x] = net; });
  }
  const waterConsumers = [];
  for (const t of tiles) {
    if (!isAnchor(t)) continue;
    const net = cover[t.y * size + t.x];
    if (net < 0) continue;
    const draw = drawOf(t).water;
    if (draw > 0) waterConsumers.push({ anchor: t, net, draw });
  }
  if (city.ordinances?.waterConservation) for (const c of waterConsumers) c.draw *= 0.85;
  const waterDeal = applyDeal(city, "water", water.ids, waterSupply, waterConsumers, "pipeTiles");
  const w = allocate(city, cover, water.count, waterSupply, waterConsumers);
  for (const t of tiles) {
    const net = cover[t.y * size + t.x];
    if (net < 0 || waterSupply[net] <= 0) continue;
    if (w.full[net]) { t.watered = true; continue; }
    const a = anchorOf(city, t);
    if (a && w.served.has(a)) t.watered = true;
  }

  // A sale is honoured only when the network can carry it.
  const sold = (deal, served) => deal?.kind === "sell" ? [...served].some((a) => a.deal) : deal?.kind === "buy" ? true : null;
  return {
    power: { supply: Math.round(p.totalSupply), demand: Math.round(p.totalDemand), deal: powerDeal ? { ...powerDeal, met: sold(powerDeal, p.served) } : null },
    water: { supply: Math.round(w.totalSupply), demand: Math.round(w.totalDemand), deal: waterDeal ? { ...waterDeal, met: sold(waterDeal, w.served) } : null },
  };
}
