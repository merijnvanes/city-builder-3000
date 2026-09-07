// Commuting. Each residential lot sends its workers along the transport
// network to the nearest open jobs (cheapest path, up to MAX_TRIP tiles of
// street). Roads carry cars; highways and rail move people twice as fast;
// rail is entered through stations; roads that reach the map edge lead to
// jobs in the neighbouring city. Every tile on the way carries the trip,
// which becomes its traffic level. Trips are assigned twice: the second
// pass routes around the jams the first pass produced.
import { forRadius, NEIGHBORS4 } from "./grid.js";
import { ZONE_TYPES, BUILDINGS } from "./catalog.js";
import { isAnchor, capacityOf, lotTiles } from "./lots.js";
import { roadCapacity } from "./roads.js";
import { besideWhatItNeeds } from "./siting.js";

export const MAX_TRIP = 40;
// Fallback share for callers without a demographic pyramid. The live value
// comes from the city's age structure; see population.js.
export const WORKFORCE_SHARE = 0.4;
export const EXTERNAL_JOBS_PER_ROAD = 400;
const TRAFFIC_PER_POINT = 6; // commuters per traffic point on a road tile
const RAIL_PER_POINT = 20;   // trains carry more per tile
const HIGHWAY_PER_POINT = 18;

// Travel cost per tile: highways, rail and subways are twice as fast as streets.
const ROAD = 1, RAIL = 2, STATION = 3, HIGHWAY = 4, SUBSTATION = 5, TUNNEL = 6, RAMP = 7, BORE = 8;

// Cost of entering a tile of each kind, indexed by the constants above.
// Highways, rail and tunnels move people at twice the speed of a street.
const STEP_COST = [];
STEP_COST[0] = 0;
STEP_COST[ROAD] = 2; STEP_COST[RAIL] = 1; STEP_COST[STATION] = 2;
STEP_COST[HIGHWAY] = 1; STEP_COST[SUBSTATION] = 2; STEP_COST[TUNNEL] = 1;
STEP_COST[RAMP] = 2;
// A bore runs flat under the hill, so it never pays the climbing penalty.
STEP_COST[BORE] = 2;
const MAX_COST = MAX_TRIP * 2;

// Nearest road tile index within reach of a lot, or -1.
function entryOf(city, anchor, kind) {
  let best = -1, bestD = 99;
  for (const t of lotTiles(city, anchor.lot)) {
    forRadius(city, t.x, t.y, 3, (n, d) => {
      const k = kind[n.y * city.size + n.x];
      if ((k === ROAD || k === RAMP) && d < bestD) { bestD = d; best = n.y * city.size + n.x; }
    });
  }
  return best;
}

export function updateTraffic(city, workforceShare = WORKFORCE_SHARE) {
  const { tiles, size } = city;
  const N = tiles.length;
  // Two layers: surface nodes 0..N-1, tunnel nodes N..2N-1 under subway tiles.
  const kind = new Uint8Array(N * 2);
  for (let i = 0; i < N; i++) {
    const t = tiles[i];
    if (t.type === "road") kind[i] = ROAD;
    else if (t.type === "rail") kind[i] = RAIL;
    // "You must place Train Stations on tiles that touch the track." A
    // station with no rail beside it is a building, not an interchange.
    else if (t.type === "railstation") kind[i] = besideWhatItNeeds(city, t) ? STATION : ROAD;
    else if (t.type === "highway") kind[i] = HIGHWAY;
    else if (t.type === "substation") kind[i] = besideWhatItNeeds(city, t) ? SUBSTATION : ROAD;
    else if (t.type === "onramp") kind[i] = RAMP;
    else if (t.tunnel) kind[i] = BORE;
    if (t.subway || t.type === "substation") kind[N + i] = TUNNEL;
  }

  // Jobs reachable from each road tile.
  const jobsAt = new Map();
  const jobList = [];
  const addJobs = (entry, anchor, cap) => { const j = { anchor, cap, open: cap }; jobList.push(j); if (!jobsAt.has(entry)) jobsAt.set(entry, []); jobsAt.get(entry).push(j); };
  const homes = [];
  let workers = 0, jobsTotal = 0;
  for (const t of tiles) {
    if (!isAnchor(t)) continue;
    if (ZONE_TYPES.has(t.type)) {
      const cap = capacityOf(t);
      if (!cap) continue;
      const entry = entryOf(city, t, kind);
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
    } else if (BUILDINGS[t.type]?.effects?.jobs) {
      const entry = entryOf(city, t, kind);
      t.filled = 0;
      jobsTotal += BUILDINGS[t.type].effects.jobs;
      if (entry >= 0) addJobs(entry, t, BUILDINGS[t.type].effects.jobs);
    }
  }
  // Jobs in neighbouring cities at every road that reaches the map edge.
  let externalJobs = 0;
  const outside = { filled: 0 };
  for (const side of Object.values(city._connections || {})) {
    for (const t of side.roadTiles || []) { addJobs(t.y * size + t.x, outside, EXTERNAL_JOBS_PER_ROAD); externalJobs += EXTERNAL_JOBS_PER_ROAD; }
  }

  const parent = new Int32Array(N * 2).fill(-1);
  const dist = new Int32Array(N * 2).fill(-1);
  const settled = new Uint8Array(N * 2);
  const touched = [];
  const buckets = Array.from({ length: MAX_COST + 3 }, () => []);

  // Movement rules on the surface: streets join highways; rail only through
  // stations; subway stations join the street to the tunnel beneath them.
  const canStep = (from, to) => {
    const a = kind[from], b = kind[to];
    if (a === STATION || b === STATION || a === SUBSTATION || b === SUBSTATION) return b !== 0;
    if (a === RAIL || b === RAIL) return a === b;
    // "Highways may be built over roads, but if you want your Sims to be able
    // to get from one to the other, the intersection requires an on-ramp."
    // A ramp is the only tile both a street and a highway will step onto.
    if (a === RAMP || b === RAMP) return true;
    // A bore is a road or rail line under the hill. It joins the portals at
    // its ends and the rest of its own run; nothing enters it from above.
    if (a === BORE || b === BORE) return true;
    if ((a === HIGHWAY) !== (b === HIGHWAY)) return false;
    return true; // road <-> road, highway <-> highway
  };
  const neighborsOf = (n) => {
    const out = [];
    const i = n < N ? n : n - N;
    const x = i % size, y = (i - x) / size;
    if (n < N) {
      for (const [dx, dy] of NEIGHBORS4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const ni = ny * size + nx;
        if (kind[ni] && canStep(n, ni)) out.push(ni);
      }
      if (kind[n] === SUBSTATION) out.push(N + i);
    } else {
      for (const [dx, dy] of NEIGHBORS4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const ni = N + ny * size + nx;
        if (kind[ni] === TUNNEL) out.push(ni);
      }
      if (kind[i] === SUBSTATION) out.push(i);
    }
    return out;
  };

  // One assignment pass. `jam` marks tiles that cost an extra step.
  const assign = (jam) => {
    const load = new Float64Array(N * 2);
    for (const j of jobList) { j.open = j.cap; j.anchor.filled = 0; }
    let employed = 0, commuters = 0;
    for (const home of homes) {
      let remaining = home.workers;
      for (const b of buckets) b.length = 0;
      buckets[0].push(home.entry);
      dist[home.entry] = 0; parent[home.entry] = -1; touched.push(home.entry);
      for (let d = 0; d <= MAX_COST && remaining > 0; d++) {
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
              if (j.anchor === outside) commuters += take;
              for (let k = i; k >= 0; k = parent[k]) load[k] += take;
            }
          }
          for (const ni of neighborsOf(i)) {
            if (settled[ni]) continue;
            // Climbing a hill costs a step per level. A tunnel avoids it,
            // which is the whole reason to bore one.
            const climb = ni < N && i < N && kind[i] !== BORE && kind[ni] !== BORE
              ? Math.abs((tiles[ni].elev || 0) - (tiles[i].elev || 0)) : 0;
            const nd = d + STEP_COST[kind[ni]] + climb + (jam && jam[ni] ? 1 : 0);
            if (nd > MAX_COST) continue;
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
    return { load, employed, commuters };
  };

  const ord = city.ordinances || {};
  const carScale = (ord.carpool ? 0.9 : 1) * (ord.alternateDriving ? 0.75 : 1);
  // Potholes cost capacity: the same commuters make a worse jam on a road the
  // transport budget has stopped maintaining.
  const surface = roadCapacity(city);
  const trafficOf = (i, load) => {
    const t = tiles[i];
    if (kind[i] === ROAD || kind[i] === RAMP || kind[i] === BORE) { let v = load[i] / (TRAFFIC_PER_POINT * surface) * carScale; if (t.svc?.bus) v *= 0.75; return v; }
    if (kind[i] === HIGHWAY) return load[i] / (HIGHWAY_PER_POINT * surface) * carScale;
    if (kind[i] === RAIL) return load[i] / RAIL_PER_POINT;
    return 0;
  };

  const first = assign(null);
  const jam = new Uint8Array(N * 2);
  let jams = 0;
  for (let i = 0; i < N; i++) if ((kind[i] === ROAD || kind[i] === HIGHWAY || kind[i] === RAMP) && trafficOf(i, first.load) >= 80) { jam[i] = 1; jams++; }
  const { load, employed, commuters } = jams ? assign(jam) : first;

  let sum = 0, roads = 0, congested = 0, railRiders = 0, subwayRiders = 0;
  for (let i = N; i < N * 2; i++) if (kind[i] === TUNNEL) subwayRiders += load[i];
  for (let i = 0; i < N; i++) {
    const t = tiles[i];
    if (kind[i] === ROAD || kind[i] === HIGHWAY || kind[i] === RAMP) {
      t.traffic = Math.max(0, Math.min(100, Math.round(trafficOf(i, load))));
      if (kind[i] !== HIGHWAY) { sum += t.traffic; roads++; if (t.traffic >= 70) congested++; }
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

  const unemployment = workers > 0 ? Math.round(100 * (1 - employed / workers)) : 0;
  return {
    workers, employed, jobs: jobsTotal, unemployment, externalJobs, commuters,
    railRiders: Math.round(railRiders), subwayRiders: Math.round(subwayRiders),
    traffic: roads ? Math.round(sum / roads) : 0,
    congestion: roads ? Math.round(100 * congested / roads) : 0,
  };
}
