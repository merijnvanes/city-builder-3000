// City-wide measurements derived from tile state. Pure and cheap enough to
// run after every construction action.
import { BUILDINGS, ZONE_TYPES, PORT_TYPES } from "./catalog.js";
import { isAnchor, capacityOf, drawOf } from "./lots.js";
import { portJobs, portDemandBonus, workingPorts } from "./ports.js";
import { INDUSTRY_TYPES, industryOf } from "./industry.js";
import { COMMERCE_TYPES, commerceOf } from "./commerce.js";
import { sitingFactor } from "./siting.js";
import { START_YEAR } from "./city.js";
import { readPopulation, BASE_LIFE_EXPECTANCY, NATIONAL_EQ } from "./population.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const yearOf = (month, startYear = START_YEAR) => startYear + Math.floor(month / 12);
export const dateOf = (month, startYear = START_YEAR) => `${MONTHS[month % 12]} ${yearOf(month, startYear)}`;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function computeMetrics(city) {
  const { tiles } = city;
  const ord = city.ordinances || {};
  let population = 0, jobsCommercial = 0, jobsIndustrial = 0;
  let needPower = 0, havePower = 0, needWater = 0, haveWater = 0;
  let wPoll = 0, wCrime = 0, wPark = 0, wPolice = 0, wFire = 0, wLand = 0, wTraffic = 0, wAura = 0;
  const counts = {};
  const zones = { residential: { tiles: 0, developed: 0, abandoned: 0 }, commercial: { tiles: 0, developed: 0, abandoned: 0 }, industrial: { tiles: 0, developed: 0, abandoned: 0 } };
  let abandonedLots = 0, landValueSum = 0, landTiles = 0, specialJobs = 0, specialHappiness = 0;
  let developedTiles = 0, dryTiles = 0;
  const industryMix = Object.fromEntries(INDUSTRY_TYPES.map((k) => [k, 0]));
  const commerceMix = Object.fromEntries(COMMERCE_TYPES.map((k) => [k, 0]));
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
      // "Zones that are not watered will never reach full development and are
      // at a high risk of fire disasters."
      if (t.lot) { developedTiles++; if (!t.watered) dryTiles++; }
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
        wAura += (t.aura ?? 50) * cap;
        wPark += (s.park || 0) * cap;
        wPolice += (s.police || 0) * cap; wFire += (s.fire || 0) * cap;
      } else if (t.type === "commercial") { jobsCommercial += cap; commerceMix[commerceOf(t)] += cap; }
      else { jobsIndustrial += cap; industryMix[industryOf(t)] += cap; }
    } else if (PORT_TYPES.has(t.type)) {
      if (t.abandoned) abandonedLots++;
      const draw = drawOf(t);
      if (draw.power) { needPower++; if (t.powered) havePower++; }
      if (draw.water) { needWater++; if (t.watered) haveWater++; }
      specialJobs += portJobs(city, t);
    } else {
      const b = BUILDINGS[t.type];
      if (b?.powerUse) { needPower++; if (t.powered) havePower++; }
      if (b?.waterUse) { needWater++; if (t.watered) haveWater++; }
      // A terminal only brings the trade its berth can carry.
      const siting = b?.effects ? sitingFactor(city, t) : 1;
      if (b?.effects?.jobs) specialJobs += Math.round(b.effects.jobs * siting);
      if (b?.effects?.happiness) specialHappiness += b.effects.happiness;
      if (b?.effects?.demand) for (const [k, v] of Object.entries(b.effects.demand)) demandBonus[k] = (demandBonus[k] || 0) + v * siting;
    }
  }

  // Ports lift the sectors the manual names them for.
  for (const [k, v] of Object.entries(portDemandBonus(city))) demandBonus[k] = (demandBonus[k] || 0) + v;

  const per = (v) => (population ? v / population : 0);
  const people = readPopulation(city, population);
  const jobs = jobsCommercial + jobsIndustrial + specialJobs;
  const traffic = city._traffic || { unemployment: 0, traffic: 0, congestion: 0, workers: 0, employed: 0, externalJobs: 0 };
  const connections = city._connections || {};
  // "Seaports and airports are considered connections to all neighbors", so a
  // working terminal is worth as much outside trade as a road to the border.
  const ports = workingPorts(city);
  const tradeConnections = Object.values(connections).filter((c) => c.road || c.rail).length
    + Math.min(4, ports.airport + ports.seaport);
  const svc = city._svc || { garbage: 0 };
  const pollution = Math.round(per(wPoll));
  const crime = Math.round(per(wCrime));
  const waterPollution = svc.waterPollution || 0;
  // Education is the workforce's Education Quotient and health is life
  // expectancy: both are properties of the Sims, earned over decades, not
  // readings off a coverage radius. Coverage still decides who can reach a
  // school or hospital; population.js turns that into learning and lifespan.
  let education = Math.round(clamp(people.eq, 0, 150));
  let health = Math.round(clamp((people.le - 25) / (90 - 25) * 100, 0, 100));
  const lifeExpectancy = Math.round(people.le * 10) / 10;
  const eq = Math.round(people.eq * 10) / 10;
  if (!population) { education = 0; health = 0; }
  const parks = Math.round(per(wPark));
  const police = Math.round(per(wPolice));
  const fireCover = Math.round(per(wFire));
  const powerPct = needPower ? Math.round(100 * havePower / needPower) : 100;
  const waterPct = needWater ? Math.round(100 * haveWater / needWater) : 100;

  // "Approval Rating Line Graph - a measure of the city's global aura which
  // doubles as your Mayoral Approval Rating." So the headline figure is not
  // its own formula: it is the average of the aura map, weighted by where
  // people actually live. Empty land has an aura too, but nobody is there to
  // feel it. services.js builds the map.
  let happiness = population ? Math.round(clamp(per(wAura), 5, 100)) : 50;
  happiness += specialHappiness;
  happiness = Math.round(clamp(happiness, 5, 100));
  // Unemployment is the one thing residents feel that is not on the map,
  // because it belongs to the city rather than to a street.
  happiness = Math.round(clamp(happiness - traffic.unemployment * 0.5 - (100 - powerPct) * 0.2, 5, 100));

  return {
    population, jobs, jobsCommercial, jobsIndustrial, specialJobs, demandBonus,
    tradeConnections, externalJobs: traffic.externalJobs || 0, connections, ports,
    workers: traffic.workers, employed: traffic.employed, unemployment: traffic.unemployment,
    traffic: traffic.traffic, congestion: traffic.congestion, range: traffic.range ?? null,
    // "If you place bus stops and Sims don't seem to use them, they may be too
    // far apart." The commute already counts who boards; without this the
    // mayor pays the mass transit budget every month with no way to find out
    // whether anybody is riding.
    railRiders: traffic.railRiders || 0, subwayRiders: traffic.subwayRiders || 0,
    pollution, crime, education, health, parks, police, fireCover, industryMix, commerceMix,
    dryShare: developedTiles ? dryTiles / developedTiles : 0,
    cells: svc.cells || 0, arrestable: svc.arrestable || 0, jailFactor: svc.jailFactor ?? 1,
    eq, lifeExpectancy, strikes: people.strikes,
    workforceShare: people.workforceShare, workingAgeShare: people.workingAgeShare,
    retirementAge: people.retirementAge, childShare: people.childShare, seniorShare: people.seniorShare,
    students: Math.round(people.school), undergrads: Math.round(people.college),
    youthEq: Math.round(people.youthEq * 10) / 10, cityEq: Math.round(people.cityEq * 10) / 10,
    garbage: svc.garbage, garbageProduced: svc.garbageProduced || 0, garbageCapacity: svc.garbageCapacity || 0, waterPollution,
    power: powerPct, water: waterPct,
    utilities: city._util || { power: { supply: 0, demand: 0 }, water: { supply: 0, demand: 0 } },
    landValue: landTiles ? Math.round(landValueSum / landTiles) : 0,
    aura: population ? Math.round(per(wAura)) : 50,
    residentialLandValue: Math.round(per(wLand)),
    happiness, counts, zones, abandonedLots,
    date: dateOf(city.month, city.startYear), year: yearOf(city.month, city.startYear), month: city.month,
  };
}
