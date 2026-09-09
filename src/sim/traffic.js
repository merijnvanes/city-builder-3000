import { surfaceStep, isPortal, providesAccess } from './structures.js';
// Commuting. Each residential lot sends its workers along the transport
// network to the nearest open jobs (cheapest path, up to MAX_TRIP tiles of
// street). Roads carry cars; highways and rail move people twice as fast;
// rail is entered through stations. Every tile on the way carries the trip,
// which becomes its traffic level. Trips are assigned twice: the second
// pass routes around the jams the first pass produced.
//
// Three layers share the tile grid: the surface, the subway tunnels beneath
// it, and the streets that run under an elevated highway. A viaduct tile is a
// highway on the surface and a road or rail line below, and the two do not
// meet: "Highways may be built over roads, but if you want your Sims to be
// able to get from one to the other, the intersection requires an on-ramp."
import { forRadius, NEIGHBORS4 } from "./grid.js";
import { ZONE_TYPES, PORT_TYPES, BUILDINGS } from "./catalog.js";
import { isAnchor, capacityOf, lotTiles } from "./lots.js";
import { roadCapacity } from "./roads.js";
import { besideWhatItNeeds } from "./siting.js";
import { portJobs } from "./ports.js";

// How far a Sim will go to work on empty roads, and how far once the roads
// are full. "Sims aren't willing to drive as far if traffic is bad. That means
// that you are forced to make a tiny congested city with no real hope for
// expansion... Fewer cars means less traffic and less traffic means Sims are
// willing to travel further."
export const MAX_TRIP = 40;
export const MIN_TRIP = 20;
// Traffic a driver puts up with without thinking about it, and the level at
// which patience has run all the way out. The manual's condition is "if
// traffic is bad", so a quiet city loses nothing.
export const PATIENCE = 30;
export const GRIDLOCK = 80;

export function tripRange(traffic) {
  const bad = Math.max(0, Math.min(1, ((traffic || 0) - PATIENCE) / (GRIDLOCK - PATIENCE)));
  return Math.round(MAX_TRIP - (MAX_TRIP - MIN_TRIP) * bad);
}

// How fast the city's reputation for bad traffic catches up with the roads.
// A month of clear streets does not make anyone drive further tomorrow, and
// one bad month does not make them give up: it is a standing impression.
// tick() advances it, in the mutation half of the month; updateTraffic only
// reads it, so a reloaded city derives the same commute as a running one.
export const TRAFFIC_MEMORY = 0.3;
export const settleTraffic = (level, measured) =>
  Math.round(((level || 0) * (1 - TRAFFIC_MEMORY) + (measured || 0) * TRAFFIC_MEMORY) * 10) / 10;

// Fallback share for callers without a demographic pyramid. The live value
// comes from the city's age structure; see population.js.
export const WORKFORCE_SHARE = 0.4;
const TRAFFIC_PER_POINT = 6; // commuters per traffic point on a road tile
const RAIL_PER_POINT = 20;   // trains carry more per tile
const HIGHWAY_PER_POINT = 18;

// Travel cost per tile: highways, rail and subways are twice as fast as streets.
const ROAD = 1, RAIL = 2, STATION = 3, HIGHWAY = 4, SUBSTATION = 5, TUNNEL = 6, RAMP = 7;

// Cost of entering a tile of each kind, indexed by the constants above.
// Highways, rail and tunnels move people at twice the speed of a street.
const STEP_COST = [];
STEP_COST[0] = 0;
STEP_COST[ROAD] = 2; STEP_COST[RAIL] = 1; STEP_COST[STATION] = 2;
STEP_COST[HIGHWAY] = 1; STEP_COST[SUBSTATION] = 2; STEP_COST[TUNNEL] = 1;
STEP_COST[RAMP] = 2;
// "If the mass transit budget is low, things will start deteriorating and Sims
// will be less likely to use the system. If the budget is far below adequate,
// transit workers will go out on strike."
//
// Two states, and only the strike was modelled: below it the trains ran exactly
// as well on a tenth of the money as on all of it. Deterioration is not a
// walkout, it is a service not worth the walk, so a starved system charges more
// to board. Sims who would have taken the train drive instead, and the traffic
// the network was there to remove comes back onto the street. Added to the cost
// of a station at no funding at all, against a trip budget of MAX_TRIP * 2.
export const TRANSIT_NEGLECT = 6;
// Coverage at which a bus stop takes its full quarter off the street. A stop
// puts out 100 at its own tile and fades to a tenth of that at the rim of its
// radius: "if you place bus stops and Sims don't seem to use them, they may be
// too far apart." Below this the stop is too far to be worth walking to, and
// the same scale carries the transit budget, since coverage is cut by it.
export const BUS_FULL = 60;
const MAX_COST = MAX_TRIP * 2;
// Sims reach the network from up to this far off it; the same rule gives a
// lot its road access. See ROAD_REACH in services.js.
const OFF_ROAD = 3;

// Nearest street node within reach of a lot, or -1. `ground` resolves a tile
// to whichever node carries local traffic there: the surface, or the street
// running under a viaduct.
function entryOf(city, anchor, kind, ground) {
  let best = -1, bestD = 99;
  for (const t of lotTiles(city, anchor.lot)) {
    forRadius(city, t.x, t.y, OFF_ROAD, (n, d) => {
      if (d >= bestD || !providesAccess(n)) return;
      const node = ground(n.y * city.size + n.x);
      if (kind[node] === ROAD || kind[node] === RAMP) { bestD = d; best = node; }
    });
  }
  return best;
}

export function updateTraffic(city, workforceShare = WORKFORCE_SHARE) {
  const { tiles, size } = city;
  const N = tiles.length;
  // Surface nodes 0..N-1, subway nodes N..2N-1, and the street under a
  // viaduct at 2N..3N-1. The third band is only allocated when the city has
  // one, so a city without crossings pays nothing for them.
  const UNDER = N * 2;
  const crossings = tiles.some((t) => t.under);
  const nodes = crossings ? N * 3 : N * 2;
  const kind = new Uint8Array(nodes);
  // "If the budget is far below adequate, transit workers will go out on
  // strike." Nobody boards a train that is not running.
  const strike = (city.people?.strikes?.transit || 0) > 0;
  // A starved system still runs; it is just not worth the walk. Boarding costs
  // more the further the mass transit budget is below adequate.
  const transitBudget = Math.min(1, (city.funding?.transit ?? 100) / 100);
  const stepCost = STEP_COST.slice();
  stepCost[STATION] = stepCost[SUBSTATION] = STEP_COST[STATION] + Math.round(TRANSIT_NEGLECT * (1 - transitBudget));
  for (let i = 0; i < N; i++) {
    const t = tiles[i];
    if (t.type === "road") kind[i] = ROAD;
    else if (t.type === "rail") kind[i] = RAIL;
    // "You must place Train Stations on tiles that touch the track." A
    // station with no rail beside it is a building, not an interchange.
    else if (t.type === "railstation") kind[i] = besideWhatItNeeds(city, t) && !strike ? STATION : ROAD;
    else if (t.type === "highway") kind[i] = HIGHWAY;
    else if (t.type === "substation") kind[i] = besideWhatItNeeds(city, t) && !strike ? SUBSTATION : ROAD;
    else if (t.type === "onramp") kind[i] = RAMP;

    if (!strike && (t.subway || t.type === "substation")) kind[N + i] = TUNNEL;
    if (crossings && t.under) kind[UNDER + i] = t.under === 2 ? RAIL : ROAD;
  }

  // A step onto tile `ni` from a node on the ground: under a viaduct, the
  // street is the lower node, never the highway carried above it.
  const groundAt = crossings ? (ni) => (kind[ni] === ROAD || kind[ni] === RAMP ? ni : kind[UNDER + ni] ? UNDER + ni : ni) : (ni) => ni;
  // Everything but the subway climbs the same hills.
  const onGround = (n) => n < N || n >= UNDER;

  // Jobs reachable from each road tile.
  const jobsAt = new Map();
  const jobList = [];
  const addJobs = (entry, anchor, cap) => { const j = { anchor, cap, open: cap }; jobList.push(j); if (!jobsAt.has(entry)) jobsAt.set(entry, []); jobsAt.get(entry).push(j); return j; };
  const homes = [];
  let workers = 0, jobsTotal = 0;
  for (const t of tiles) {
    if (!isAnchor(t)) continue;
    if (ZONE_TYPES.has(t.type)) {
      const cap = capacityOf(t);
      if (!cap) continue;
      const entry = entryOf(city, t, kind, groundAt);
      if (t.type === "residential") {
        const w = Math.round(cap * workforceShare);
        workers += w;
        if (entry >= 0) homes.push({ entry, workers: w, anchor: t });
        else t.commute = 0;
      } else {
        jobsTotal += cap;
        t.filled = 0;
        if (entry >= 0) addJobs(entry, t, cap);
      }
    } else {
      // Terminals and the special buildings that carry a payroll.
      const port = PORT_TYPES.has(t.type);
      if (!port && !BUILDINGS[t.type]?.effects?.jobs) continue;
      // A port that has gone dark offers nothing, so clear its tally first.
      t.filled = 0;
      const cap = port ? portJobs(city, t) : BUILDINGS[t.type].effects.jobs;
      if (!cap) continue;
      const entry = entryOf(city, t, kind, groundAt);
      jobsTotal += cap;
      if (entry >= 0) addJobs(entry, t, cap);
    }
  }
  // Employment stays within this city. Neighbour connections support trade;
  // cross-border jobs are outside the current simulation scope.

  const parent = new Int32Array(nodes).fill(-1);
  const dist = new Int32Array(nodes).fill(-1);
  const settled = new Uint8Array(nodes);
  const touched = [];
  const buckets = Array.from({ length: MAX_COST + 3 }, () => []);

  // Movement rules on the surface: streets join highways; rail only through
  // stations; subway stations join the street to the tunnel beneath them.
  const engineered=!!city.transportStructures?.length;
  const canStep = (from, to) => {
    if(engineered) {
      const aTile=tiles[from%N],bTile=tiles[to%N];
      if(!surfaceStep(aTile,bTile))return false;
      if(aTile.structure?.kind==='tunnel' && isPortal(aTile) && bTile.structure===aTile.structure || bTile.structure?.kind==='tunnel' && isPortal(bTile) && aTile.structure===bTile.structure)return false;
    }
    const a = kind[from], b = kind[to];
    if (a === STATION || b === STATION || a === SUBSTATION || b === SUBSTATION) return b !== 0 && a !== HIGHWAY && b !== HIGHWAY;
    if (a === RAIL || b === RAIL) return a === b;
    // "Highways may be built over roads, but if you want your Sims to be able
    // to get from one to the other, the intersection requires an on-ramp."
    // A ramp is the only tile both a street and a highway will step onto.
    if (a === RAMP || b === RAMP) return true;
    if ((a === HIGHWAY) !== (b === HIGHWAY)) return false;
    return true; // road <-> road, highway <-> highway
  };
  // The subway band, shared by both versions below.
  const tunnelNeighbors = (n, i, x, y, out) => {
    for (const [dx, dy] of NEIGHBORS4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const ni = N + ny * size + nx;
      if (kind[ni] === TUNNEL) out.push(ni);
    }
    if (kind[i] === SUBSTATION) out.push(i);
    return out;
  };

  // This runs for every neighbour of every settled node of every home's
  // search, so the city without a viaduct anywhere gets the plain version: no
  // band arithmetic, no ground lookup.
  const plainNeighbors = (n) => {
    const out = [];
    const i = n < N ? n : n - N;
    const x = i % size, y = (i - x) / size;
    if (n >= N) return tunnelNeighbors(n, i, x, y, out);
    for (const [dx, dy] of NEIGHBORS4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const ni = ny * size + nx;
      if (kind[ni] && canStep(n, ni)) out.push(ni);
    }
    if (kind[n] === SUBSTATION) out.push(N + i);
    return out;
  };

  // Crossings expose both routes to adjacent tiles. canStep keeps cars,
  // trains and highways separate, with transfers only at stations and ramps.
  const crossingNeighbors = (n) => {
    const out = [];
    const band = n < N ? 0 : n < UNDER ? 1 : 2;
    const i = n - band * N;
    const x = i % size, y = (i - x) / size;
    if (band === 1) return tunnelNeighbors(n, i, x, y, out);
    for (const [dx, dy] of NEIGHBORS4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const ni = ny * size + nx;
      if (kind[ni] && canStep(n, ni)) out.push(ni);
      const below = UNDER + ni;
      if (kind[below] && canStep(n, below)) out.push(below);
    }
    if (band === 0 && kind[n] === SUBSTATION) out.push(N + i);
    return out;
  };

  const surfaceNeighbors = crossings ? crossingNeighbors : plainNeighbors;
  const portals=new Map();
  for(const s of city.transportStructures || [])if(s.kind==='tunnel') {
    const a=s.from.y*size+s.from.x,b=s.to.y*size+s.to.x;
    portals.set(a,b);portals.set(b,a);
  }
  const neighborsOf = portals.size ? n=>{const out=surfaceNeighbors(n);if(portals.has(n))out.push(portals.get(n));return out;} : surfaceNeighbors;
  const heights=Float64Array.from(tiles,t=>t.structure?.kind==='bridge'?t.structure.elevation:t.elev || 0);
  const travelCost=(a,b)=> {
    if(portals.get(a)===b)return stepCost[kind[b]]*(Math.abs(tiles[a].x-tiles[b].x)+Math.abs(tiles[a].y-tiles[b].y));
    return stepCost[kind[b]]+(onGround(a) && onGround(b)?Math.abs(heights[a%N]-heights[b%N]):0);
  };

  // Cheapest cost from any of `sources` to every node, capped at maxCost.
  // Used for "is there anything within a reasonable commute of here", which
  // is a different question from where each block's workers actually went.
  const reachFrom = (sources, maxCost) => {
    const cost = new Int32Array(nodes).fill(-1);
    for (const b of buckets) b.length = 0;
    for (const s of sources) { if (cost[s] === -1) { cost[s] = 0; buckets[0].push(s); } }
    for (let d = 0; d <= maxCost; d++) {
      const bucket = buckets[d];
      for (let q = 0; q < bucket.length; q++) {
        const i = bucket[q];
        if (cost[i] !== d) continue;
        for (const ni of neighborsOf(i)) {
          const nd = d + travelCost(i,ni);
          if (nd > maxCost) continue;
          if (cost[ni] === -1 || nd < cost[ni]) { cost[ni] = nd; buckets[nd].push(ni); }
        }
      }
    }
    return cost;
  };

  // One assignment pass. `jam` marks tiles that cost an extra step.
  const assign = (jam, maxCost = MAX_COST) => {
    const load = new Float64Array(nodes);
    for (const j of jobList) { j.open = j.cap; j.anchor.filled = 0; }
    let employed = 0;
    for (const home of homes) {
      let remaining = home.workers;
      for (const b of buckets) b.length = 0;
      buckets[0].push(home.entry);
      dist[home.entry] = 0; parent[home.entry] = -1; touched.push(home.entry);
      for (let d = 0; d <= maxCost && remaining > 0; d++) {
        const bucket = buckets[d];
        for (let q = 0; q < bucket.length && remaining > 0; q++) {
          const i = bucket[q];
          if (settled[i] || dist[i] !== d) continue;
          settled[i] = 1;
          const jobs = jobsAt.get(i);
          if (jobs) {
            for (const j of jobs) {
              if (remaining <= 0) break;
              if (j.open <= 0) continue;
              const take = Math.min(remaining, j.open);
              j.open -= take; j.anchor.filled += take;
              remaining -= take; employed += take;
              for (let k = i; k >= 0; k = parent[k]) load[k] += take;
            }
          }
          for (const ni of neighborsOf(i)) {
            if (settled[ni]) continue;
            // Climbing a hill costs a step per level. A tunnel avoids it,
            // which is the whole reason to bore one.
            const nd = d + travelCost(i,ni) + (jam && jam[ni] ? 1 : 0);
            if (nd > maxCost) continue;
            if (dist[ni] === -1 || nd < dist[ni]) {
              if (dist[ni] === -1) touched.push(ni);
              dist[ni] = nd; parent[ni] = i; buckets[nd].push(ni);
            }
          }
        }
      }
      home.anchor.commute = home.workers ? 1 - remaining / home.workers : 0;
      for (const i of touched) { dist[i] = -1; parent[i] = -1; settled[i] = 0; }
      touched.length = 0;
    }
    return { load, employed };
  };

  const ord = city.ordinances || {};
  const carScale = (ord.carpool ? 0.9 : 1) * (ord.alternateDriving ? 0.75 : 1);
  // Potholes cost capacity: the same commuters make a worse jam on a road the
  // transport budget has stopped maintaining.
  const surface = roadCapacity(city);
  const trafficOf = (i, load) => {
    const t = tiles[i < N ? i : i - UNDER];
    if (kind[i] === ROAD || kind[i] === RAMP) { let v = load[i] / (TRAFFIC_PER_POINT * surface) * carScale; if (t.svc?.bus) v *= 1 - 0.25 * Math.min(1, t.svc.bus / BUS_FULL); return v; }
    if (kind[i] === HIGHWAY) return load[i] / (HIGHWAY_PER_POINT * surface) * carScale;
    if (kind[i] === RAIL) return load[i] / RAIL_PER_POINT;
    return 0;
  };

  // How far a Sim will drive is what the roads have been like, not what this
  // month's first guess says: taking it from within the month would stack on
  // top of the jam penalty below and strand a congested city outright, then
  // free it again the moment nobody could travel. It is carried in the save.
  const range = tripRange(city.trafficLevel || 0);
  const maxCost = range * 2;
  // Pass one finds the routes on an empty map; pass two reroutes around the
  // jams the first pass produced.
  const first = assign(null, maxCost);
  const jam = new Uint8Array(nodes);
  let jams = 0;
  // Both street bands: the surface, and anything running under a viaduct.
  // Subway tunnels never jam.
  for (const base of crossings ? [0, UNDER] : [0]) {
    for (let i = base; i < base + N; i++) {
      if (kind[i] !== ROAD && kind[i] !== HIGHWAY && kind[i] !== RAMP) continue;
      if (trafficOf(i, first.load) >= 80) { jam[i] = 1; jams++; }
    }
  }
  const { load, employed } = jams ? assign(jam, maxCost) : first;

  let sum = 0, roads = 0, congested = 0, railRiders = 0, subwayRiders = 0;
  for (let i = N; i < N * 2; i++) if (kind[i] === TUNNEL) subwayRiders += load[i];
  for (let i = 0; i < N; i++) {
    const t = tiles[i];
    const below = crossings ? kind[UNDER + i] : 0;
    // A viaduct tile carries the highway above and the street below, and the
    // tile shows the pair of them.
    const local = below ? trafficOf(UNDER + i, load) : 0;
    if (below === RAIL) railRiders += load[UNDER + i];
    if (kind[i] === ROAD || kind[i] === HIGHWAY || kind[i] === RAMP) {
      t.traffic = Math.max(0, Math.min(100, Math.round(trafficOf(i, load) + local)));
      // The average the range and the advisors read is of streets, so a
      // viaduct counts through the street underneath it rather than the deck.
      if (kind[i] !== HIGHWAY) { sum += t.traffic; roads++; if (t.traffic >= 70) congested++; }
      else if (below === ROAD) { const v = Math.min(100, Math.round(local)); sum += v; roads++; if (v >= 70) congested++; }
    } else if (kind[i] === RAIL) {
      t.traffic = Math.max(0, Math.min(100, Math.round(trafficOf(i, load))));
      railRiders += load[i];
    } else t.traffic = 0;
  }
  // Non-road tiles inherit the busiest adjacent road for overlays and desirability.
  for (const t of tiles) {
    const i = t.y * size + t.x;
    if (kind[i] === ROAD || kind[i] === RAIL || kind[i] === HIGHWAY) continue;
    let max = 0;
    for (const [dx, dy] of NEIGHBORS4) {
      const nx = t.x + dx, ny = t.y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const n = tiles[ny * size + nx];
      if ((n.type === "road" || n.type === "highway") && n.traffic > max) max = n.traffic;
    }
    t.traffic = max;
  }

  // "Sims don't like to travel too far. A Residential or Commercial zone won't
  // develop if it's beyond a reasonable commute distance from other zones. But
  // an Industrial zone on the outskirts of town could develop into a farm."
  //
  // So every zone tile gets the cost of reaching what its kind needs: work for
  // homes, customers for shops. Both are measured over the same network the
  // commuters use, at the same range, so a jammed city shrinks in on itself.
  const workAt = [...jobsAt.keys()];
  const homeAt = [...new Set(homes.map((h) => h.entry))];
  // "Inter-city connections help your Commercial sector as well, by opening up
  // the borders so new customers can visit and shop."
  for (const side of Object.values(city._connections || {})) {
    for (const link of side.roadLinks || []) {
      const i=link.y*size+link.x;
      homeAt.push(link.route==="road" && crossings && kind[UNDER+i]===ROAD ? UNDER+i : i);
    }
  }
  const spread = (sources) => {
    const out = new Int32Array(N).fill(-1);
    if (!sources.length) return out;
    const cost = reachFrom(sources, maxCost);
    for (const base of crossings ? [0, UNDER] : [0]) {
      for (let i = base; i < base + N; i++) {
        if (!providesAccess(tiles[i-base]) || cost[i] < 0 || (kind[i] !== ROAD && kind[i] !== RAMP)) continue;
        const tile = i - base, x = tile % size, y = (tile - x) / size;
        forRadius(city, x, y, OFF_ROAD, (n) => {
          const j = n.y * size + n.x;
          if (out[j] === -1 || cost[i] < out[j]) out[j] = cost[i];
        });
      }
    }
    return out;
  };
  const toWork = spread(workAt), toHome = spread(homeAt);
  for (const t of tiles) {
    if (!ZONE_TYPES.has(t.type)) { t.reach = 0; continue; }
    // With nothing of the kind anywhere on the map the rule has nothing to
    // say yet, so a first neighbourhood is never blocked from starting.
    if (t.type === "residential") t.reach = workAt.length ? toWork[t.y * size + t.x] : 0;
    else if (t.type === "commercial") t.reach = homeAt.length ? toHome[t.y * size + t.x] : 0;
    else t.reach = 0;
  }

  const unemployment = workers > 0 ? Math.round(100 * (1 - employed / workers)) : 0;
  return {
    range,
    workers, employed, jobs: jobsTotal, unemployment,
    railRiders: Math.round(railRiders), subwayRiders: Math.round(subwayRiders),
    traffic: roads ? Math.round(sum / roads) : 0,
    congestion: roads ? Math.round(100 * congested / roads) : 0,
  };
}
