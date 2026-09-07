// Road access, service coverage, pollution, crime, land value and garbage.
import { forRadius, tileAt } from "./grid.js";
import { BUILDINGS, ZONE_TYPES, ACCESS_TYPES, ROAD_TYPES, FUNDED_DEPARTMENTS } from "./catalog.js";
import { ORDINANCES } from "./city.js";
import { isAnchor, lotTiles, capacityOf } from "./lots.js";
import { industryTraits } from "./industry.js";
import { readPopulation, NATIONAL_EQ, BASE_LIFE_EXPECTANCY } from "./population.js";
import { ageFactor } from "./wear.js";
import { DEALS } from "./neighbors.js";

export const ROAD_REACH = 3;
// Share of residents who pass through the courts in a year and need a cell.
export const ARREST_RATE = 0.02;
// Overlapping precincts stack, but not without limit.
export const SERVICE_CAP = 160;
// Aura a plain, adequately served neighbourhood sits at before anything
// local or city-wide moves it.
export const AURA_BASE = 62;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const SERVICE_KINDS = ["police", "fire", "health", "education", "culture", "park", "bus", "rail"];

const blankServices = () => ({ police: 0, fire: 0, health: 0, education: 0, culture: 0, park: 0, bus: 0, rail: 0 });

export function updateServices(city) {
  const { tiles, size } = city;
  const funding = city.funding || {};
  const ord = city.ordinances || {};
  // "An over funded branch will waste money. Underfunding causes a loss of
  // effectiveness of the branch." So the budget buys nothing above what the
  // department asks for; the surplus is spent and lost.
  const pct = (dept) => (FUNDED_DEPARTMENTS.includes(dept) ? Math.min(1, (funding[dept] ?? 100) / 100) : 1);

  // ── Road access: within ROAD_REACH of a road or rail tile ────
  for (const t of tiles) { t.roadAccess = false; t.svc = blankServices(); }
  for (const t of tiles) {
    if (!ACCESS_TYPES.has(t.type)) continue;
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
  // The manual, pages 85-87: "The size of a precinct expands as you raise the
  // police budget... Funding not only affects a precinct's size, but also its
  // effectiveness... Police stations placed near one another may have
  // precincts that overlap, and effectiveness in these overlapping areas is
  // additive." Fire coverage works the same way, with a ceiling on how far it
  // can be stretched.
  //
  // Jails come first, because a city with nowhere to put the people it
  // arrests loses police effectiveness everywhere: "the police will be forced
  // to release any new criminals they catch back onto the street."
  let cells = 0;
  for (const t of tiles) {
    if (!isAnchor(t)) continue;
    const b = BUILDINGS[t.type];
    if (b?.cells) cells += b.cells * (t.powered || !b.powerUse ? 1 : 0.4) * Math.min(1.25, pct(b.dept));
  }
  let arrestable = 0;
  for (const t of tiles) if (isAnchor(t) && t.type === "residential") arrestable += capacityOf(t) * ARREST_RATE;
  const jailFactor = arrestable > 0 ? clamp(0.35 + 0.65 * (cells / arrestable), 0.35, 1) : 1;

  for (const t of tiles) {
    if (!isAnchor(t)) continue;
    const b = BUILDINGS[t.type];
    if (!b?.service) continue;
    const s = b.service;
    const budget = pct(b.dept);
    const powered = b.powerUse && !t.powered ? 0.35 : 1;
    let strength = (s.strength ?? 100) * budget * powered;
    if (s.kind === "police") strength *= jailFactor;
    if (strength <= 0) continue;
    // A well-funded department reaches further; a starved one pulls back to
    // the streets around its own station.
    const reach = s.radius * clamp(0.35 + 0.65 * budget, 0.3, 1.35);
    const radius = Math.max(1, Math.round(Math.min(reach, s.maxRadius ?? reach)));
    const cx = t.x + Math.floor(t.lot.w / 2), cy = t.y + Math.floor(t.lot.h / 2);
    forRadius(city, cx, cy, radius, (n, d) => {
      const v = strength * (1 - d / (radius + 1));
      if (s.additive) n.svc[s.kind] = Math.min(SERVICE_CAP, n.svc[s.kind] + v);
      else if (v > n.svc[s.kind]) n.svc[s.kind] = v;
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
      const smoke = industryTraits(t).pollution;
      addSource(t.x, t.y, (14 + t.density * t.level * 3 * t.lot.w) * smoke, 7 + t.density);
    } else if (b?.pollution) {
      addSource(t.x + (t.lot.w >> 1), t.y + (t.lot.h >> 1), b.pollution * (t.powered || !b.powerUse ? 1 : 0.4), 5 + b.w);
    }
  }
  for (const t of tiles) {
    if (!ROAD_TYPES.has(t.type) || t.type === "rail" || !t.traffic) continue;
    addSource(t.x, t.y, t.traffic * (t.type === "highway" ? 0.2 : 0.12), 2);
  }
  // A toxic cloud poisons the air around its source while it lasts.
  for (const e of city.effects || []) if (e.type === "toxic") addSource(e.x, e.y, 90, 7);
  // Special buildings with area effects (prisons, dumps, city hall...).
  const crimeBump = new Float32Array(tiles.length);
  const valueBump = new Float32Array(tiles.length);
  // Landfills, prisons and their like drag a neighbourhood's mood down;
  // zoos, parks and landmarks lift it.
  const auraBump = new Float32Array(tiles.length);
  for (const t of tiles) {
    if (!isAnchor(t)) continue;
    const e = BUILDINGS[t.type]?.effects;
    if (!e || !e.radius) continue;
    const cx = t.x + (t.lot.w >> 1), cy = t.y + (t.lot.h >> 1);
    if (e.pollution) addSource(cx, cy, e.pollution, e.radius);
    forRadius(city, cx, cy, e.radius, (n, d) => {
      const f = 1 - d / (e.radius + 1);
      if (e.crime) crimeBump[n.y * size + n.x] += e.crime * f;
      if (e.landValue) valueBump[n.y * size + n.x] += e.landValue * f;
      if (e.aura ?? e.landValue) auraBump[n.y * size + n.x] += (e.aura ?? e.landValue * 0.6) * f;
    });
  }
  const airScale = (ord.cleanAir ? 0.7 : 1) * (ord.leafBurningBan ? 0.95 : 1) * (ord.wasteTax ? 0.92 : 1);
  for (const t of tiles) {
    let v = poll[t.y * size + t.x] * airScale;
    if (t.trees) v -= t.trees * 3;
    t.pollution = Math.max(0, Math.min(100, Math.round(v)));
  }

  // ── Garbage ───────────────────────────────────────────────────
  // Recycling first ("Recycling centers can significantly reduce the amount
  // of trash that Sims produce"), then incinerators burn what they can, then
  // whatever is left goes into landfills until they are full. "When a
  // landfill is full, garbage will accumulate around the city."
  let population = 0, jobs = 0, burnRate = 0, recycleRate = 0, landfillSpace = 0, landfillFill = 0, landfillHold = 0;
  for (const t of tiles) {
    if (!isAnchor(t)) continue;
    const cap = capacityOf(t);
    if (t.type === "residential") population += cap; else jobs += cap;
    const b = BUILDINGS[t.type];
    if (!b) continue;
    // "Like landfills, incinerators need to be near a road so garbage trucks
    // can deliver garbage to them."
    const reachable = t.roadAccess ? 1 : 0;
    const running = reachable * (b.powerUse && !t.powered ? 0.3 : 1) * pct(b.dept) * ageFactor(t.type, t.age || 0);
    if (b.garbage) burnRate += b.garbage * running;
    if (b.recycles) recycleRate += b.recycles * running * (ord.trashPresort ? 1.4 : 1);
    if (b.hold) {
      landfillHold += b.hold;
      landfillFill += t.fill || 0;
      if (reachable) landfillSpace += Math.max(0, b.hold - (t.fill || 0));
    }
  }
  let garbageProduced = population * 0.03 + jobs * 0.015;
  if (ord.recycling) garbageProduced *= 0.75;
  const garbageDeal = city.deals?.garbage;
  if (garbageDeal?.kind === "buy") garbageProduced += DEALS.garbage.buy.amount;
  const exported = garbageDeal?.kind === "sell" ? DEALS.garbage.sell.amount : 0;

  let left = Math.max(0, garbageProduced - recycleRate - burnRate - exported);
  const buried = Math.min(left, landfillSpace);
  const uncollected = left - buried;
  const garbage = garbageProduced > 0 ? Math.round(100 * uncollected / garbageProduced) : 0;
  const garbageCapacity = recycleRate + burnRate + exported + landfillSpace;
  if (garbage > 0) for (const t of tiles) if (ZONE_TYPES.has(t.type)) t.pollution = Math.min(100, t.pollution + Math.round(garbage * 0.06));

  // ── Land value (before crime, so the result depends only on the
  //    current state and a reload reproduces it exactly) ───────────
  const waterNear = new Float32Array(tiles.length);
  const industryNear = new Float32Array(tiles.length);
  for (const t of tiles) {
    if (t.terrain === "water") forRadius(city, t.x, t.y, 3, (n, d) => { const v = 14 - d * 4; if (v > waterNear[n.y * size + n.x]) waterNear[n.y * size + n.x] = v; });
    if (isAnchor(t) && t.type === "industrial" && t.level) forRadius(city, t.x, t.y, 4, (n, d) => { const v = 14 - d * 3; if (v > industryNear[n.y * size + n.x]) industryNear[n.y * size + n.x] = v; });
  }
  const baseValue = new Float32Array(tiles.length);
  for (const t of tiles) {
    const i = t.y * size + t.x;
    let v = 34 + waterNear[i] - industryNear[i];
    v += t.svc.park * 0.28 + t.svc.culture * 0.2 + t.svc.education * 0.08 + t.svc.health * 0.06;
    v += t.trees * 2.5 + valueBump[i] + (t.elev || 0) * 2;
    v -= t.pollution * 0.38 + (t.traffic || 0) * 0.08;
    if (t.powered) v += 5;
    if (t.watered) v += 5;
    if (t.roadAccess) v += 5;
    baseValue[i] = Math.max(0, Math.min(100, v));
  }

  // ── Crime ─────────────────────────────────────────────────────
  const unemployment = city._traffic?.unemployment ?? 0;
  const watch = ord.neighborhoodWatch ? 0.85 : 1;
  for (const t of tiles) {
    if (!ZONE_TYPES.has(t.type) || !t.lot) { t.crime = 0; continue; }
    let c = 4 + t.density * 5 + (100 - baseValue[t.y * size + t.x]) * 0.18 + unemployment * 0.35 + crimeBump[t.y * size + t.x];
    if (t.abandoned) c += 20;
    c -= t.svc.police * 0.55;
    c *= watch;
    t.crime = Math.max(0, Math.min(100, Math.round(c)));
  }
  for (const t of tiles) t.landValue = Math.max(0, Math.min(100, Math.round(baseValue[t.y * size + t.x] - t.crime * 0.2)));

  // ── Aura ──────────────────────────────────────────────────────
  // The manual, page 93: "Many things affect a city's aura. High education
  // levels, high life expectancy, a growing economy, and desirable buildings
  // such as parks and zoos can raise aura. Pollution, crime, traffic,
  // excessive regulations (ordinances), high tax levels, and the presence of
  // undesirable buildings such as landfills and prisons can lower aura...
  // Neighborhoods each have their own aura."
  //
  // So it is a map, not a single number, and the mayoral approval rating is
  // its population-weighted average. City-wide terms (taxes, schooling,
  // lifespan, red tape) shift every neighbourhood alike; the rest is local.
  const people = readPopulation(city, city.population || 0);
  const avgTax = (city.taxes.residential + city.taxes.commercial + city.taxes.industrial) / 3;
  let enacted = 0, mood = 0;
  for (const [key, on] of Object.entries(ord)) {
    if (!on || !ORDINANCES[key]) continue;
    enacted++;
    mood += ORDINANCES[key].mood || 0;
  }
  let civic = mood;
  civic += (people.eq - NATIONAL_EQ) * 0.14;
  civic += (people.le - BASE_LIFE_EXPECTANCY) * 0.32;
  civic -= (avgTax - 7) * 3;
  // "Excessive regulations": the first few ordinances are tolerated, the rest
  // grate. This is on top of the individual gripes each one carries.
  civic -= Math.max(0, enacted - 4) * 1.1;
  civic -= (garbage || 0) * 0.08;
  if (people.strikes.education) civic -= 6;
  if (people.strikes.health) civic -= 6;

  for (const t of tiles) {
    const i = t.y * size + t.x;
    let a = AURA_BASE + civic;
    a += t.svc.park * 0.30 + t.svc.culture * 0.22;
    a += (t.landValue - 40) * 0.22;
    a += Math.min(t.svc.police, 100) * 0.06 + Math.min(t.svc.fire, 100) * 0.06;
    a += (t.svc.health + t.svc.education) * 0.04;
    a -= t.pollution * 0.30 + t.crime * 0.26 + (t.traffic || 0) * 0.10;
    a += auraBump[i];
    if (t.lot && t.abandoned) a -= 8;
    t.aura = Math.max(0, Math.min(100, Math.round(a)));
  }

  return { garbage, garbageProduced: Math.round(garbageProduced), garbageCapacity: Math.round(garbageCapacity), industrialLots,
           buried, landfillSpace: Math.round(landfillSpace), landfillFill: Math.round(landfillFill), landfillHold,
           waterPollution: city._util?.waterPollution || 0,
           cells: Math.round(cells), arrestable: Math.round(arrestable), jailFactor };
}
