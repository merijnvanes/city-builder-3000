// RCI demand and lot development.
//
// Demand follows the jobs/housing loop of the original game: residents move
// in when there are jobs, shops open when there are customers, industry
// follows the workforce and outside trade. Taxes, services and pollution
// shift each curve.
import { ZONE_TYPES } from "./catalog.js";
import { isAnchor, findLot, assignLot, clearLot } from "./lots.js";
import { WORKFORCE_SHARE } from "./traffic.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function computeDemand(city, m) {
  const taxes = city.taxes;
  const ord = city.ordinances || {};
  const pop = m.population, jobs = m.jobs;
  const trade = m.tradeConnections || 0;
  const externalJobs = 350 + (m.externalJobs || 0);
  const wantedPop = (jobs + externalJobs) / WORKFORCE_SHARE;
  let res = (wantedPop - pop) / Math.max(900, pop * 0.5) * 100;
  res -= (taxes.residential - 7) * 4;
  res += (m.happiness - 50) * 0.5;
  res -= Math.max(0, m.pollution - 30) * 0.4;
  res -= Math.max(0, m.unemployment - 8) * 1.2;

  const wantedC = pop * 0.3 + 60 + (ord.tourismPromotion ? pop * 0.04 : 0) + trade * 150;
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
    d = 0.45 + lv / 100 - t.pollution / 140 - t.crime / 140 + (s.park + s.education + s.health) / 700 - t.traffic / 500;
  } else if (t.type === "commercial") {
    d = 0.5 + lv / 120 - t.crime / 150 - t.pollution / 320 + Math.min(t.traffic, 50) / 350 + (s.bus + s.rail) / 500;
  } else {
    d = 0.75 + (100 - lv) / 220 - t.crime / 300 + s.rail / 300;
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
  let built = 0, upgraded = 0, declined = 0, abandoned = 0;

  // Developed lots first so freshly formed lots are not judged twice.
  for (const t of tiles) {
    if (!isAnchor(t) || !ZONE_TYPES.has(t.type)) continue;
    const d = demand[t.type];
    t.age = (t.age || 0) + 1;
    const ok = conditionsOk(t);
    const des = desirability(t);
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
    if (d > 0 && t.level < 4 && t.age >= 2) {
      const needsWater = t.level >= 1 && (t.density >= 2 || t.level >= 2);
      if (needsWater && !t.watered) continue;
      if (t.level === 3 && t.type !== "industrial" && (t.landValue ?? 0) < 35) continue;
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
    assignLot(city, lot, 1, rng());
    built++;
  }
  return { built, upgraded, declined, abandoned };
}
