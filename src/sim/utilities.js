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
import { BUILDINGS, ZONED_TYPES, ROAD_TYPES } from "./catalog.js";
import { isAnchor, anchorOf, drawOf, lotTiles } from "./lots.js";
import { dealTerms } from "./neighbors.js";
import { plantOutput, OVERLOAD_RATIO } from "./power.js";
import { pumpOutput, waterPollutionOf } from "./water.js";
import { industryTraits } from "./industry.js";

// "Water seeps out along water mains, watering all areas within seven tiles
// of any part of the pipe. Unlike power transmission, watered tiles do not
// act as relay stations." - the manual, page 99.
export const WATER_RADIUS = 7;

// Neighbour deals attach to the network that touches the map edge.
//
// Buying is metered: "a contracted neighbour will look at your city's needs at
// the connection point, and will supply any deficit", up to the contracted
// cap. Selling is a fixed obligation the city has to be able to meet.
//
// "The connection point is critical. Any area of the city that you want to
// supply with purchased power or water must be able to be served from the
// connection point." So only the one network that reaches the edge benefits.
function applyDeal(city, resource, netIds, supply, consumers, tilesKey) {
  const deal = city.deals?.[resource];
  if (!deal) return null;
  const side = city._connections?.[deal.side];
  const edge = side?.[tilesKey]?.[0];
  if (!edge) return null;
  const net = netIds[edge.y * city.size + edge.x];
  if (net < 0) return null;
  const d = dealTerms(city, resource);
  if (deal.kind === "buy") {
    // Work out that network's shortfall, and buy exactly that much.
    let demand = 0;
    for (const c of consumers) if (c.net === net) demand += c.draw;
    const deficit = Math.max(0, demand - supply[net]);
    const bought = Math.min(deficit, d.cap);
    supply[net] += bought;
    return { net, kind: "buy", amount: bought };
  }
  consumers.unshift({ anchor: { deal: resource }, net, draw: d.cap });
  return { net, kind: "sell", amount: d.cap };
}

// Conductors: power lines, zoned tiles and building footprints. Power also
// jumps across a single road or rail tile, so lots on both sides of a
// street share a network without lines along every block.
const conducts = (t) => t.powerline || !!t.lot || ZONED_TYPES.has(t.type);
const isRoad = (t) => ROAD_TYPES.has(t.type);

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

// Hops from the nearest power plant, across the conducting grid. A brownout
// works outward from the plants, so this decides who keeps the lights on.
function distanceFromPlants(city, netIds) {
  const { size, tiles } = city;
  const dist = new Int32Array(tiles.length).fill(-1);
  const queue = new Int32Array(tiles.length);
  let head = 0, tail = 0;
  for (const t of tiles) {
    if (!isAnchor(t) || !BUILDINGS[t.type]?.powerOut) continue;
    for (const cell of lotTiles(city, t.lot)) {
      const i = cell.y * size + cell.x;
      if (dist[i] === -1) { dist[i] = 0; queue[tail++] = i; }
    }
  }
  const step = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (head < tail) {
    const i = queue[head++];
    const x = i % size, y = (i - x) / size;
    for (const [dx, dy] of step) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const ni = ny * size + nx;
      if (dist[ni] !== -1 || netIds[ni] < 0) continue;
      dist[ni] = dist[i] + 1;
      queue[tail++] = ni;
    }
  }
  return dist;
}

function allocate(city, netIds, count, supply, consumers) {
  const budget = Float64Array.from(supply);
  const demand = new Float64Array(count);
  const strain = new Float64Array(count);
  for (const c of consumers) demand[c.net] += c.draw;
  const full = new Uint8Array(count);
  for (let n = 0; n < count; n++) if (supply[n] > 0 && supply[n] >= demand[n]) full[n] = 1;
  const served = new Set();
  for (const c of consumers) {
    if (full[c.net]) { served.add(c.anchor); continue; }
    if (budget[c.net] >= c.draw) { budget[c.net] -= c.draw; served.add(c.anchor); }
  }
  let totalSupply = 0, totalDemand = 0;
  for (let n = 0; n < count; n++) { totalSupply += supply[n]; totalDemand += demand[n]; strain[n] = supply[n] > 0 ? demand[n] / supply[n] : 0; }
  return { full, served, totalSupply, totalDemand, strain, demand };
}

// The worst-off network, and where to go and look at it.
//
// Totals hide the thing that actually causes a blackout. "Areas of your city
// that draw power from an aging power plant may experience blackouts as the
// power plant loses capacity" — areas, not the city. One grid can sit at 110%
// while another idles with thousands to spare, and the sum of the two reads
// as comfortable. Gus names both causes a player has to tell apart: plants too
// small for what they serve, or a break in the line that leaves a district
// with no plant behind it at all. Ranking by shortfall covers both, and puts
// the district that lost its plant above a small grid running a little hot.
function worstNetwork(city, sourceIds, sourceKey, supply, demand, totalDemand, consumers) {
  // Shortfall first, so the district that lost its plant outranks a small grid
  // running a little hot. With nothing short anywhere, fall back to the
  // network closest to its limit, which is the one to warn about next.
  let short = -1, gap = 0, tight = -1, load = -1;
  for (let n = 0; n < demand.length; n++) {
    if (demand[n] <= 0) continue;
    if (demand[n] - supply[n] > gap) { gap = demand[n] - supply[n]; short = n; }
    if (demand[n] / supply[n] > load) { load = demand[n] / supply[n]; tight = n; }
  }
  const worst = short >= 0 ? short : tight;
  if (worst < 0) return null;
  // Somewhere to send the player. A plant or pump on the network if it has
  // one, since that is what the manual says to query; otherwise its largest
  // consumer, which is where the lights are going out.
  let mark = null;
  for (const t of city.tiles) {
    if (!isAnchor(t) || !BUILDINGS[t.type]?.[sourceKey]) continue;
    if (sourceIds[t.y * city.size + t.x] === worst) { mark = t; break; }
  }
  let biggest = 0;
  if (!mark) for (const c of consumers) {
    if (c.net === worst && c.draw > biggest && c.anchor?.x != null) { biggest = c.draw; mark = c.anchor; }
  }
  return {
    supply: Math.round(supply[worst]), demand: Math.round(demand[worst]),
    share: totalDemand > 0 ? demand[worst] / totalDemand : 1,
    x: mark?.x ?? null, y: mark?.y ?? null,
  };
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
    // An aging plant delivers less than its nameplate rating.
    if (b?.powerOut) powerSupply[net] += plantOutput(t);
    const draw = drawOf(t).power;
    if (draw > 0) powerConsumers.push({ anchor: t, net, draw });
  }
  if (city.ordinances?.energyConservation) for (const c of powerConsumers) c.draw *= 0.85;
  // "Power will radiate as far as possible from the power station and then
  // will just stop, leaving structures farthest from the plant without
  // power." So when a grid is short, it is the outskirts that go dark, not an
  // arbitrary scatter of buildings.
  const hops = distanceFromPlants(city, power.ids);
  for (const c of powerConsumers) c.reach = hops[c.anchor.y * size + c.anchor.x];
  powerConsumers.sort((a, b) => (a.reach < 0 ? 1e9 : a.reach) - (b.reach < 0 ? 1e9 : b.reach));
  const powerDeal = applyDeal(city, "power", power.ids, powerSupply, powerConsumers, "powerTiles");
  const p = allocate(city, power.ids, power.count, powerSupply, powerConsumers);
  for (const t of tiles) {
    const net = power.ids[t.y * size + t.x];
    if (net < 0 || powerSupply[net] <= 0) continue;
    if (p.full[net]) { t.powered = true; continue; }
    const a = anchorOf(city, t);
    if (a && (p.served.has(a) || BUILDINGS[a.type]?.powerOut)) t.powered = true;
  }

  // ── Water pollution ──────────────────────────────────────────
  // "Invisible contaminants, primarily from industry, can invade your water
  // supply." Computed here, between the two networks, because pumps draw
  // less from fouled water and treatment plants need power to clean it. Doing
  // it in one pass keeps the order acyclic, so a reloaded city derives the
  // same state as the one it was saved from.
  let industrialLoad = 0;
  for (const t of tiles) {
    if (!isAnchor(t) || t.type !== "industrial" || !t.level || t.abandoned) continue;
    industrialLoad += t.lot.w * t.lot.h * t.density * t.level * industryTraits(t).pollution;
  }
  // A concentration, not a total: the same factories foul a small map's water
  // far more than a large one's.
  let landTiles = 0;
  for (const t of tiles) if (t.terrain !== "water") landTiles++;
  const { waterPollution } = waterPollutionOf(city, landTiles ? 100 * industrialLoad / (landTiles * 0.9) : 0);

  // ── Water ────────────────────────────────────────────────────
  // A pipe network carries water; watered tiles do not relay it onward.
  const carries = (t) => t.pipe || !!BUILDINGS[t.type]?.waterOut;
  const water = components(city, carries);
  const waterSupply = new Float64Array(water.count);
  for (const t of tiles) {
    if (!isAnchor(t)) continue;
    const b = BUILDINGS[t.type];
    if (!b?.waterOut) continue;
    const net = water.ids[t.y * size + t.x];
    // Output falls with age, with dirty water, and to nothing at all if the
    // pump cannot reach the kind of water it needs.
    if (net >= 0 && t.powered) waterSupply[net] += pumpOutput(city, t, waterPollution);
  }
  // Coverage: the nearest pipe network claims each tile, and a network with
  // pumps on it beats a dry one at the same distance. Claiming by iteration
  // order instead would let a stub of disconnected pipe strand a whole
  // district that a supplied main runs right past.
  const cover = new Int32Array(tiles.length).fill(-1);
  const claim = new Int32Array(tiles.length).fill(WATER_RADIUS * 2 + 4);
  for (const t of tiles) {
    const net = water.ids[t.y * size + t.x];
    if (net < 0) continue;
    const dry = waterSupply[net] > 0 ? 0 : 1;
    forSquare(city, t.x, t.y, WATER_RADIUS, (n, d) => {
      const i = n.y * size + n.x, score = d * 2 + dry;
      if (score < claim[i]) { claim[i] = score; cover[i] = net; }
    });
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
  // Networks asked for more than their plants could give this month. Sustained
  // across a year, one of their plants gives way: see power.js.
  const overdrawn = new Set();
  for (let n = 0; n < power.count; n++) if (p.strain[n] >= OVERLOAD_RATIO) overdrawn.add(n);
  return {
    netOf: power.ids,
    overdrawn,
    waterPollution,
    power: {
      supply: Math.round(p.totalSupply), demand: Math.round(p.totalDemand),
      worst: worstNetwork(city, power.ids, "powerOut", powerSupply, p.demand, p.totalDemand, powerConsumers),
      deal: powerDeal ? { ...powerDeal, met: sold(powerDeal, p.served) } : null,
    },
    water: {
      supply: Math.round(w.totalSupply), demand: Math.round(w.totalDemand),
      worst: worstNetwork(city, water.ids, "waterOut", waterSupply, w.demand, w.totalDemand, waterConsumers),
      deal: waterDeal ? { ...waterDeal, met: sold(waterDeal, w.served) } : null,
    },
  };
}
