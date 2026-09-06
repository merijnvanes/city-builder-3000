// Road access, service coverage, pollution, crime, land value and garbage.
import { forRadius, tileAt } from "./grid.js";
import { BUILDINGS, ZONE_TYPES, ROAD_TYPES, FUNDED_DEPARTMENTS } from "./catalog.js";
import { isAnchor, lotTiles, capacityOf } from "./lots.js";

export const ROAD_REACH = 3;
export const SERVICE_KINDS = ["police", "fire", "health", "education", "culture", "park", "bus", "rail"];

const blankServices = () => ({ police: 0, fire: 0, health: 0, education: 0, culture: 0, park: 0, bus: 0, rail: 0 });

export function updateServices(city) {
  const { tiles, size } = city;
  const funding = city.funding || {};
  const ord = city.ordinances || {};
  const pct = (dept) => (FUNDED_DEPARTMENTS.includes(dept) ? (funding[dept] ?? 100) / 100 : 1);

  // ── Road access: within ROAD_REACH of a road or rail tile ────
  for (const t of tiles) { t.roadAccess = false; t.svc = blankServices(); }
  for (const t of tiles) {
    if (!ROAD_TYPES.has(t.type)) continue;
    forRadius(city, t.x, t.y, ROAD_REACH, (n) => { n.roadAccess = true; });
  }
  // A lot has access when any of its tiles has it.
  for (const t of tiles) {
    if (!isAnchor(t)) continue;
    if (t.lot.w === 1 && t.lot.h === 1) continue;
    const any = lotTiles(city, t.lot).some((n) => n.roadAccess);
    if (any) for (const n of lotTiles(city, t.lot)) n.roadAccess = true;
  }

  // ── Service coverage ──────────────────────────────────────────
  for (const t of tiles) {
    if (!isAnchor(t)) continue;
    const b = BUILDINGS[t.type];
    if (!b?.service) continue;
    const s = b.service;
    const eff = Math.min(1.25, pct(b.dept)) * (b.powerUse && !t.powered ? 0.35 : 1);
    const strength = (s.strength ?? 100) * eff;
    if (strength <= 0) continue;
    const cx = t.x + Math.floor(t.lot.w / 2), cy = t.y + Math.floor(t.lot.h / 2);
    forRadius(city, cx, cy, s.radius, (n, d) => {
      const v = strength * (1 - d / (s.radius + 1));
      if (v > n.svc[s.kind]) n.svc[s.kind] = v;
    });
  }

  // ── Pollution ─────────────────────────────────────────────────
  const poll = new Float32Array(tiles.length);
  const addSource = (x, y, amount, radius) => {
    forRadius(city, x, y, radius, (n, d) => {
      const f = 1 - d / (radius + 1);
      poll[n.y * size + n.x] += amount * f * f;
    });
  };
  let industrialLots = 0;
  for (const t of tiles) {
    if (!isAnchor(t)) continue;
    const b = BUILDINGS[t.type];
    if (t.type === "industrial" && t.level && !t.abandoned) {
      industrialLots++;
      addSource(t.x, t.y, 14 + t.density * t.level * 3 * t.lot.w, 7 + t.density);
    } else if (b?.pollution) {
      addSource(t.x + (t.lot.w >> 1), t.y + (t.lot.h >> 1), b.pollution * (t.powered || !b.powerUse ? 1 : 0.4), 5 + b.w);
    }
  }
  for (const t of tiles) {
    if (t.type !== "road" || !t.traffic) continue;
    addSource(t.x, t.y, t.traffic * 0.12, 2);
  }
  const airScale = ord.cleanAir ? 0.7 : 1;
  for (const t of tiles) {
    let v = poll[t.y * size + t.x] * airScale;
    if (t.trees) v -= t.trees * 3;
    t.pollution = Math.max(0, Math.min(100, Math.round(v)));
  }

  // ── Garbage ───────────────────────────────────────────────────
  let population = 0, jobs = 0, garbageCapacity = 0;
  for (const t of tiles) {
    if (!isAnchor(t)) continue;
    const cap = capacityOf(t);
    if (t.type === "residential") population += cap; else jobs += cap;
    const b = BUILDINGS[t.type];
    if (b?.garbage) garbageCapacity += b.garbage * (b.powerUse && !t.powered ? 0.3 : 1) * pct(b.dept);
  }
  let garbageProduced = population * 0.03 + jobs * 0.015;
  if (ord.recycling) garbageProduced *= 0.75;
  const uncollected = Math.max(0, garbageProduced - garbageCapacity);
  const garbage = garbageProduced > 0 ? Math.round(100 * uncollected / garbageProduced) : 0;
  if (garbage > 0) for (const t of tiles) if (ZONE_TYPES.has(t.type)) t.pollution = Math.min(100, t.pollution + Math.round(garbage * 0.06));

  // ── Crime ─────────────────────────────────────────────────────
  const unemployment = city._metrics?.unemployment ?? 0;
  const watch = ord.neighborhoodWatch ? 0.85 : 1;
  for (const t of tiles) {
    if (!ZONE_TYPES.has(t.type) || !t.lot) { t.crime = 0; continue; }
    let c = 4 + t.density * 5 + (100 - (t.landValue ?? 45)) * 0.18 + unemployment * 0.35;
    if (t.abandoned) c += 20;
    c -= t.svc.police * 0.55;
    c *= watch;
    t.crime = Math.max(0, Math.min(100, Math.round(c)));
  }

  // ── Land value ────────────────────────────────────────────────
  const waterNear = new Float32Array(tiles.length);
  const industryNear = new Float32Array(tiles.length);
  for (const t of tiles) {
    if (t.terrain === "water") forRadius(city, t.x, t.y, 3, (n, d) => { const v = 14 - d * 4; if (v > waterNear[n.y * size + n.x]) waterNear[n.y * size + n.x] = v; });
    if (isAnchor(t) && t.type === "industrial" && t.level) forRadius(city, t.x, t.y, 4, (n, d) => { const v = 14 - d * 3; if (v > industryNear[n.y * size + n.x]) industryNear[n.y * size + n.x] = v; });
  }
  for (const t of tiles) {
    const i = t.y * size + t.x;
    let v = 32 + waterNear[i] - industryNear[i];
    v += t.svc.park * 0.28 + t.svc.culture * 0.2 + t.svc.education * 0.08 + t.svc.health * 0.06;
    v += t.trees * 2.5;
    v -= t.pollution * 0.38 + t.crime * 0.2 + (t.traffic || 0) * 0.08;
    if (t.powered) v += 5;
    if (t.watered) v += 5;
    if (t.roadAccess) v += 5;
    t.landValue = Math.max(0, Math.min(100, Math.round(v)));
  }

  return { garbage, garbageProduced: Math.round(garbageProduced), garbageCapacity: Math.round(garbageCapacity), industrialLots };
}
