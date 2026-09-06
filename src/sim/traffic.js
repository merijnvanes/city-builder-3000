// Commuting. Each residential lot sends its workers along the transport
// network to the nearest open jobs (breadth-first, up to MAX_TRIP tiles).
// Roads carry cars; rail carries passengers between stations; roads that
// reach the map edge lead to jobs in the neighbouring city. Every tile on
// the way carries the trip, which becomes its traffic level.
import { forRadius, NEIGHBORS4 } from "./grid.js";
import { ZONE_TYPES, BUILDINGS } from "./catalog.js";
import { isAnchor, capacityOf, lotTiles } from "./lots.js";

export const MAX_TRIP = 40;
export const WORKFORCE_SHARE = 0.4;
export const EXTERNAL_JOBS_PER_ROAD = 400;
const TRAFFIC_PER_POINT = 6; // commuters per traffic point on a road tile
const RAIL_PER_POINT = 20;   // trains carry more per tile

const ROAD = 1, RAIL = 2, STATION = 3;

// Nearest road tile index within reach of a lot, or -1.
function entryOf(city, anchor, kind) {
  let best = -1, bestD = 99;
  for (const t of lotTiles(city, anchor.lot)) {
    forRadius(city, t.x, t.y, 3, (n, d) => {
      if (kind[n.y * city.size + n.x] === ROAD && d < bestD) { bestD = d; best = n.y * city.size + n.x; }
    });
  }
  return best;
}

export function updateTraffic(city) {
  const { tiles, size } = city;
  const load = new Float64Array(tiles.length);
  const kind = new Uint8Array(tiles.length);
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (t.type === "road") kind[i] = ROAD;
    else if (t.type === "rail") kind[i] = RAIL;
    else if (t.type === "railstation") kind[i] = STATION;
  }

  // Jobs reachable from each road tile.
  const jobsAt = new Map();
  const addJobs = (entry, anchor, open) => { if (!jobsAt.has(entry)) jobsAt.set(entry, []); jobsAt.get(entry).push({ anchor, open }); };
  const homes = [];
  let workers = 0, jobsTotal = 0;
  for (const t of tiles) {
    if (!isAnchor(t)) continue;
    if (ZONE_TYPES.has(t.type)) {
      const cap = capacityOf(t);
      if (!cap) continue;
      const entry = entryOf(city, t, kind);
      if (t.type === "residential") {
        const w = Math.round(cap * WORKFORCE_SHARE);
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

  const parent = new Int32Array(tiles.length).fill(-1);
  const dist = new Int32Array(tiles.length).fill(-1);
  const queue = new Int32Array(tiles.length);
  const touched = [];
  let employed = 0, commuters = 0;

  // Movement rules: road-road, rail-rail, station-anything.
  const canStep = (from, to) => (kind[from] === STATION || kind[to] === STATION) ? kind[to] !== 0 : kind[from] === kind[to];

  for (const home of homes) {
    let remaining = home.workers;
    let head = 0, tail = 0;
    queue[tail++] = home.entry;
    dist[home.entry] = 0; parent[home.entry] = -1; touched.push(home.entry);
    while (head < tail && remaining > 0) {
      const i = queue[head++];
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
      if (dist[i] >= MAX_TRIP) continue;
      const x = i % size, y = (i - x) / size;
      for (const [dx, dy] of NEIGHBORS4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const ni = ny * size + nx;
        if (!kind[ni] || dist[ni] !== -1 || !canStep(i, ni)) continue;
        dist[ni] = dist[i] + 1; parent[ni] = i; queue[tail++] = ni; touched.push(ni);
      }
    }
    home.anchor.commute = home.workers ? 1 - remaining / home.workers : 0;
    for (const i of touched) { dist[i] = -1; parent[i] = -1; }
    touched.length = 0;
  }

  let sum = 0, roads = 0, congested = 0, railRiders = 0;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (kind[i] === ROAD) {
      let v = load[i] / TRAFFIC_PER_POINT;
      if (t.svc?.bus) v *= 0.75;
      t.traffic = Math.max(0, Math.min(100, Math.round(v)));
      sum += t.traffic; roads++;
      if (t.traffic >= 70) congested++;
    } else if (kind[i] === RAIL) {
      t.traffic = Math.max(0, Math.min(100, Math.round(load[i] / RAIL_PER_POINT)));
      railRiders += load[i];
    } else t.traffic = 0;
  }
  // Non-road tiles inherit the busiest adjacent road for overlays and desirability.
  for (const t of tiles) {
    const i = t.y * size + t.x;
    if (kind[i] === ROAD || kind[i] === RAIL) continue;
    let max = 0;
    for (const [dx, dy] of NEIGHBORS4) {
      const nx = t.x + dx, ny = t.y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const n = tiles[ny * size + nx];
      if (n.type === "road" && n.traffic > max) max = n.traffic;
    }
    t.traffic = max;
  }

  const unemployment = workers > 0 ? Math.round(100 * (1 - employed / workers)) : 0;
  return {
    workers, employed, jobs: jobsTotal, unemployment, externalJobs, commuters,
    railRiders: Math.round(railRiders),
    traffic: roads ? Math.round(sum / roads) : 0,
    congestion: roads ? Math.round(100 * congested / roads) : 0,
  };
}
