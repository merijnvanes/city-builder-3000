// Commuting. Each residential lot sends its workers along the road network
// to the nearest open jobs (breadth-first, up to MAX_TRIP tiles). Every road
// tile on the way carries the trip, which becomes its traffic level.
import { forRadius, NEIGHBORS4 } from "./grid.js";
import { ROAD_TYPES, ZONE_TYPES } from "./catalog.js";
import { isAnchor, capacityOf, lotTiles } from "./lots.js";

export const MAX_TRIP = 40;
export const WORKFORCE_SHARE = 0.4;
const TRAFFIC_PER_POINT = 6; // commuters per traffic point on a tile

// Nearest road tile index within reach of a lot, or -1.
function entryOf(city, anchor) {
  let best = -1, bestD = 99;
  for (const t of lotTiles(city, anchor.lot)) {
    forRadius(city, t.x, t.y, 3, (n, d) => {
      if (n.type === "road" && d < bestD) { bestD = d; best = n.y * city.size + n.x; }
    });
  }
  return best;
}

export function updateTraffic(city) {
  const { tiles, size } = city;
  const load = new Float64Array(tiles.length);
  const isRoad = new Uint8Array(tiles.length);
  for (let i = 0; i < tiles.length; i++) if (tiles[i].type === "road") isRoad[i] = 1;

  // Jobs reachable from each road tile.
  const jobsAt = new Map();
  const homes = [];
  let workers = 0, jobsTotal = 0;
  for (const t of tiles) {
    if (!isAnchor(t) || !ZONE_TYPES.has(t.type)) continue;
    const cap = capacityOf(t);
    if (!cap) continue;
    const entry = entryOf(city, t);
    if (t.type === "residential") {
      const w = Math.round(cap * WORKFORCE_SHARE);
      workers += w;
      if (entry >= 0) homes.push({ entry, workers: w, anchor: t });
      else t.commute = 0;
    } else {
      jobsTotal += cap;
      t.filled = 0;
      if (entry >= 0) {
        if (!jobsAt.has(entry)) jobsAt.set(entry, []);
        jobsAt.get(entry).push({ anchor: t, open: cap });
      }
    }
  }

  const parent = new Int32Array(tiles.length).fill(-1);
  const dist = new Int32Array(tiles.length).fill(-1);
  const queue = new Int32Array(tiles.length);
  const touched = [];
  let employed = 0;

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
          for (let k = i; k >= 0; k = parent[k]) load[k] += take;
        }
      }
      if (dist[i] >= MAX_TRIP) continue;
      const x = i % size, y = (i - x) / size;
      for (const [dx, dy] of NEIGHBORS4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const ni = ny * size + nx;
        if (!isRoad[ni] || dist[ni] !== -1) continue;
        dist[ni] = dist[i] + 1; parent[ni] = i; queue[tail++] = ni; touched.push(ni);
      }
    }
    home.anchor.commute = home.workers ? 1 - remaining / home.workers : 0;
    for (const i of touched) { dist[i] = -1; parent[i] = -1; }
    touched.length = 0;
  }

  let sum = 0, roads = 0, congested = 0;
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    if (!isRoad[i]) { t.traffic = 0; continue; }
    let v = load[i] / TRAFFIC_PER_POINT;
    if (t.svc?.bus) v *= 0.75;
    t.traffic = Math.max(0, Math.min(100, Math.round(v)));
    sum += t.traffic; roads++;
    if (t.traffic >= 70) congested++;
  }
  // Non-road tiles inherit the busiest adjacent road for overlays and desirability.
  for (const t of tiles) {
    if (isRoad[t.y * size + t.x]) continue;
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
    workers, employed, jobs: jobsTotal, unemployment,
    traffic: roads ? Math.round(sum / roads) : 0,
    congestion: roads ? Math.round(100 * congested / roads) : 0,
  };
}
