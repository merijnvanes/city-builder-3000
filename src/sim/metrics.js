// City-wide measurements derived from tile state. Pure and cheap enough to
// run after every construction action.
import { BUILDINGS, ZONE_TYPES } from "./catalog.js";
import { isAnchor, capacityOf } from "./lots.js";
import { START_YEAR } from "./city.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const yearOf = (month, startYear = START_YEAR) => startYear + Math.floor(month / 12);
export const dateOf = (month, startYear = START_YEAR) => `${MONTHS[month % 12]} ${yearOf(month, startYear)}`;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function computeMetrics(city) {
  const { tiles } = city;
  const ord = city.ordinances || {};
  let population = 0, jobsCommercial = 0, jobsIndustrial = 0;
  let needPower = 0, havePower = 0, needWater = 0, haveWater = 0;
  let wPoll = 0, wCrime = 0, wEdu = 0, wHealth = 0, wPark = 0, wPolice = 0, wFire = 0, wLand = 0, wTraffic = 0;
  const counts = {};
  const zones = { residential: { tiles: 0, developed: 0, abandoned: 0 }, commercial: { tiles: 0, developed: 0, abandoned: 0 }, industrial: { tiles: 0, developed: 0, abandoned: 0 } };
  let abandonedLots = 0, landValueSum = 0, landTiles = 0, specialJobs = 0, specialHappiness = 0;
  const demandBonus = {};

  for (const t of tiles) {
    if (t.terrain !== "water") { landValueSum += t.landValue; landTiles++; }
    if (ZONE_TYPES.has(t.type)) {
      const z = zones[t.type];
      z.tiles++;
      if (t.lot) z.developed++;
      if (t.lot && t.abandoned) z.abandoned++;
      needPower++; if (t.powered) havePower++;
      if (t.density >= 2 || t.level >= 2) { needWater++; if (t.watered) haveWater++; }
    }
    if (!isAnchor(t)) continue;
    counts[t.type] = (counts[t.type] || 0) + 1;
    if (ZONE_TYPES.has(t.type)) {
      if (t.abandoned) abandonedLots++;
      const cap = capacityOf(t);
      if (!cap) continue;
      if (t.type === "residential") {
        population += cap;
        const s = t.svc || {};
        wPoll += t.pollution * cap; wCrime += t.crime * cap; wLand += t.landValue * cap; wTraffic += t.traffic * cap;
        wEdu += (s.education || 0) * cap; wHealth += (s.health || 0) * cap; wPark += (s.park || 0) * cap;
        wPolice += (s.police || 0) * cap; wFire += (s.fire || 0) * cap;
      } else if (t.type === "commercial") jobsCommercial += cap;
      else jobsIndustrial += cap;
    } else {
      const b = BUILDINGS[t.type];
      if (b?.powerUse) { needPower++; if (t.powered) havePower++; }
      if (b?.waterUse) { needWater++; if (t.watered) haveWater++; }
      if (b?.effects?.jobs) specialJobs += b.effects.jobs;
      if (b?.effects?.happiness) specialHappiness += b.effects.happiness;
      if (b?.effects?.demand) for (const [k, v] of Object.entries(b.effects.demand)) demandBonus[k] = (demandBonus[k] || 0) + v;
    }
  }

  const per = (v) => (population ? v / population : 0);
  const jobs = jobsCommercial + jobsIndustrial + specialJobs;
  const traffic = city._traffic || { unemployment: 0, traffic: 0, congestion: 0, workers: 0, employed: 0, externalJobs: 0 };
  const connections = city._connections || {};
  const tradeConnections = Object.values(connections).filter((c) => c.road || c.rail).length;
  const svc = city._svc || { garbage: 0 };
  const pollution = Math.round(per(wPoll));
  const crime = Math.round(per(wCrime));
  let education = Math.round(clamp(per(wEdu) + (ord.readingCampaign ? 12 : 0), 0, 100));
  let health = Math.round(clamp(20 + per(wHealth) * 0.8 + (ord.freeClinics ? 12 : 0) + (ord.smokingBan ? 3 : 0) - pollution * 0.25 - svc.garbage * 0.05, 0, 100));
  if (!population) { education = 0; health = 0; }
  const parks = Math.round(per(wPark));
  const police = Math.round(per(wPolice));
  const fireCover = Math.round(per(wFire));
  const powerPct = needPower ? Math.round(100 * havePower / needPower) : 100;
  const waterPct = needWater ? Math.round(100 * haveWater / needWater) : 100;
  const avgTax = (city.taxes.residential + city.taxes.commercial + city.taxes.industrial) / 3;

  // Expectations grow with the city: a village does not miss a hospital.
  const expect = clamp(population / 8000, 0.15, 1);
  let happiness = 58;
  happiness += ((health - 35) * 0.12 + (education - 35) * 0.08 + parks * 0.12 + police * 0.05 + fireCover * 0.05) * expect;
  happiness -= pollution * 0.22 + crime * 0.18 * expect + traffic.unemployment * 0.5 + (avgTax - 7) * 3 + svc.garbage * 0.08;
  happiness -= (100 - powerPct) * 0.2 + (100 - waterPct) * 0.06 * expect + traffic.traffic * 0.08;
  if (ord.youthCurfew) happiness -= 2;
  if (ord.parkingFines) happiness -= 2;
  if (ord.gambling) happiness -= 1;
  happiness += specialHappiness;
  if (!population) happiness = 50;
  happiness = Math.round(clamp(happiness, 5, 100));

  return {
    population, jobs, jobsCommercial, jobsIndustrial, specialJobs, demandBonus,
    tradeConnections, externalJobs: traffic.externalJobs || 0, connections,
    workers: traffic.workers, employed: traffic.employed, unemployment: traffic.unemployment,
    traffic: traffic.traffic, congestion: traffic.congestion,
    pollution, crime, education, health, parks, police, fireCover,
    garbage: svc.garbage, garbageProduced: svc.garbageProduced || 0, garbageCapacity: svc.garbageCapacity || 0,
    power: powerPct, water: waterPct,
    utilities: city._util || { power: { supply: 0, demand: 0 }, water: { supply: 0, demand: 0 } },
    landValue: landTiles ? Math.round(landValueSum / landTiles) : 0,
    residentialLandValue: Math.round(per(wLand)),
    happiness, counts, zones, abandonedLots,
    date: dateOf(city.month, city.startYear), year: yearOf(city.month, city.startYear), month: city.month,
  };
}
