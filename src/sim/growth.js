// RCI demand and lot development.
//
// Demand follows the jobs/housing loop of the original game: residents move
// in when there are jobs, shops open when there are customers, industry
// follows the workforce and outside trade. Taxes, services and pollution
// shift each curve.
import { ZONE_TYPES } from "./catalog.js";
import { isAnchor, findLot, assignLot, clearLot } from "./lots.js";
import { WORKFORCE_SHARE } from "./traffic.js";
import { pickIndustry, convertIndustry, industryOf } from "./industry.js";
import { pickCommerce, convertCommerce, commerceOf } from "./commerce.js";
import { yearOf } from "./metrics.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// "Density sets the maximum density for a zone. Land value of the zone must
// be very high in order for full density to be reached." A stage is how far a
// lot has built out within its density band, so the taller the target the
// more the address has to be worth. Indexed [level - 2][density - 1]; stage 1
// asks nothing.
const VALUE_FOR_STAGE = {
  residential:   [[0, 6, 14], [10, 22, 34], [18, 34, 52]],
  commercial:    [[0, 8, 16], [12, 24, 38], [20, 38, 56]],
  industrial:    [[0, 0, 0], [0, 4, 8], [0, 10, 18]],
  // Laboratories want a good address; foundries do not.
  hightech:      [[0, 8, 16], [8, 16, 26], [16, 28, 42]],
};

// Land value a lot needs before it will build up to `level`.
export function valueForStage(t, level) {
  if (level < 2) return 0;
  const table = t.type === "industrial" && industryOf(t) === "hightech"
    ? VALUE_FOR_STAGE.hightech
    : VALUE_FOR_STAGE[t.type];
  if (!table) return 0;
  return table[Math.min(table.length, level - 1) - 1][Math.max(1, Math.min(3, t.density)) - 1];
}

export function computeDemand(city, m) {
  const taxes = city.taxes;
  const ord = city.ordinances || {};
  const pop = m.population, jobs = m.jobs;
  const trade = m.tradeConnections || 0;
  const externalJobs = 350 + (m.externalJobs || 0);
  const wantedPop = (jobs + externalJobs) / (m.workforceShare || WORKFORCE_SHARE);
  let res = (wantedPop - pop) / Math.max(900, pop * 0.5) * 100;
  res -= (taxes.residential - 7) * 4;
  res += (m.happiness - 50) * 0.5;
  res -= Math.max(0, m.pollution - 30) * 0.4;
  res -= Math.max(0, m.unemployment - 8) * 1.2;

  // "The demand for Commercial zones typically rises as a city ages." Shops
  // follow their customers; offices are what a large, schooled city adds on
  // top, so its commercial ceiling keeps climbing after the shops are built.
  const officeRoom = Math.min(pop * 0.22, pop * 0.22 * Math.max(0, (m.eq ?? 55) - 45) / 45);
  const wantedC = pop * 0.3 + 60 + officeRoom + (ord.tourismPromotion ? pop * 0.04 : 0) + trade * 150;
  let com = (wantedC - m.jobsCommercial) / Math.max(250, wantedC) * 100;
  com -= (taxes.commercial - 7) * 3;
  com -= (ord.smokingBan ? 3 : 0);
  com += m.demandBonus?.commercial || 0;

  const wantedI = pop * 0.25 + 260 + trade * 250;
  let ind = (wantedI - m.jobsIndustrial) / Math.max(350, wantedI) * 100;
  ind -= (taxes.industrial - 7) * 3;
  ind -= (ord.cleanAir ? 6 : 0) + (ord.wasteTax ? 5 : 0);
  ind += m.demandBonus?.industrial || 0;

  return {
    residential: Math.round(clamp(res, -100, 100)),
    commercial: Math.round(clamp(com, -100, 100)),
    industrial: Math.round(clamp(ind, -100, 100)),
  };
}

// 0.2 .. 1.6 multiplier on growth chance from local conditions.
export function desirability(t) {
  const s = t.svc || {};
  const lv = t.landValue ?? 40;
  let d;
  if (t.type === "residential") {
    // People move where the neighbourhood feels good. Aura already folds in
    // pollution, crime, traffic, parks and the city's schooling and lifespan,
    // so the street's mood is most of the story.
    d = 0.35 + (t.aura ?? 50) / 90 + lv / 260 + (s.education + s.health) / 900;
  } else if (t.type === "commercial") {
    // Shops want passing trade; offices want an address and a station.
    const desks = commerceOf(t) === "offices";
    d = desks
      ? 0.45 + lv / 95 - t.crime / 170 - t.pollution / 300 + (s.bus + s.rail) / 340
      : 0.5 + lv / 120 - t.crime / 150 - t.pollution / 320 + Math.min(t.traffic, 50) / 350 + (s.bus + s.rail) / 500;
  } else {
    // Smokestacks want cheap land; laboratories want a good address.
    const clean = industryOf(t) === "hightech";
    d = clean
      ? 0.5 + lv / 130 - t.pollution / 200 - t.crime / 220 + (s.education + s.rail) / 500
      : 0.75 + (100 - lv) / 220 - t.crime / 300 + s.rail / 300;
  }
  return clamp(d, 0.2, 1.6);
}

// A lot can develop (or keep its level) only with road access and power.
// Low density gets by without water up to level 2.
export function conditionsOk(t) {
  if (!t.roadAccess || !t.powered) return false;
  if (!t.watered && (t.density >= 2 || t.level >= 3)) return false;
  return true;
}

export function updateGrowth(city, demand, rng) {
  const { tiles } = city;
  const year = yearOf(city.month, city.startYear);
  const eq = city._metrics?.eq ?? 55;
  let built = 0, upgraded = 0, declined = 0, abandoned = 0, retooled = 0;

  // Developed lots first so freshly formed lots are not judged twice.
  for (const t of tiles) {
    if (!isAnchor(t) || !ZONE_TYPES.has(t.type)) continue;
    const d = demand[t.type];
    t.age = (t.age || 0) + 1;
    const ok = conditionsOk(t);
    const des = desirability(t);
    // A working plant re-tools when the era and the city's schooling move on,
    // and a shopfront becomes offices when the neighbourhood does.
    if (t.type === "industrial" && !t.abandoned && t.level && rng() < 0.04) {
      const next = convertIndustry(t, year, eq, rng());
      if (next !== industryOf(t)) { t.industry = next; retooled++; }
    }
    if (t.type === "commercial" && !t.abandoned && t.level && rng() < 0.015) {
      const next = convertCommerce(t, eq);
      if (next !== commerceOf(t)) { t.commerce = next; retooled++; }
    }
    if (t.abandoned) {
      if (ok && d > 15 && rng() < 0.2 * des) { t.abandoned = false; t.level = 1; t.age = 0; built++; }
      else if (t.age > 30 && rng() < 0.3) { clearLot(city, t, { keepZone: true }); }
      continue;
    }
    if (!ok) {
      if (rng() < 0.28) {
        if (t.level > 1) { t.level--; declined++; } else { t.abandoned = true; t.age = 0; abandoned++; }
      }
      continue;
    }
    if (d < -15) {
      const p = (-d / 100) * 0.12 * (2 - des);
      if (rng() < p) {
        if (t.level > 1) { t.level--; declined++; } else { t.abandoned = true; t.age = 0; abandoned++; }
      }
      continue;
    }
    // A lot whose neighbourhood has decayed well past what its current stage
    // needs loses a storey: the nicer property no longer belongs there.
    if (t.level > 1 && (t.landValue ?? 0) < valueForStage(t, t.level) - 12) {
      if (rng() < 0.1) { t.level--; declined++; t.age = 0; continue; }
    }
    if (d > 0 && t.level < 4 && t.age >= 2) {
      const needsWater = t.level >= 1 && (t.density >= 2 || t.level >= 2);
      if (needsWater && !t.watered) continue;
      if ((t.landValue ?? 0) < valueForStage(t, t.level + 1)) continue;
      const p = (d / 100) * 0.14 * des;
      if (rng() < p) { t.level++; t.age = 0; upgraded++; }
    }
  }

  // Undeveloped zone tiles try to form lots.
  for (const t of tiles) {
    if (!ZONE_TYPES.has(t.type) || t.lot) continue;
    const d = demand[t.type];
    if (d <= 0 || !conditionsOk(t)) continue;
    const p = Math.min(0.6, (d / 100) * 0.4 * desirability(t));
    if (rng() >= p) continue;
    const lot = findLot(city, t);
    if (!lot) continue;
    const anchor = assignLot(city, lot, 1, rng());
    if (t.type === "industrial") anchor.industry = pickIndustry(anchor, year, eq, rng());
    if (t.type === "commercial") anchor.commerce = pickCommerce(anchor, eq);
    built++;
  }
  return { built, upgraded, declined, abandoned, retooled };
}
