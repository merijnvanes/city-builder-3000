// Public simulation API. No browser deps.
import { TOOLS, TOOL_MAP, BUILDINGS, ZONE_TYPES, PORT_TYPES, ZONED_TYPES, FUNDED_DEPARTMENTS, isZone } from "./catalog.js";
import { blankCity, serialize, deserialize as parseCity, ORDINANCES, START_YEAR, DEFAULT_SIZE, defaultPolicies } from "./city.js";
import { place, evaluate, techAvailable } from "./place.js";
import { refreshCity } from "./refresh.js";
import { updateTraffic, settleTraffic } from "./traffic.js";
import { computeMetrics, dateOf, yearOf } from "./metrics.js";
import { computeDemand, updateGrowth, conditionsOk, connected } from "./growth.js";
import { computeBudget, amortize, takeLoan, repayLoan } from "./economy.js";
import { generateAdvisors, generateNews, ADVISORS } from "./advisors.js";
import { triggerDisaster, advanceFires, randomDisaster, advanceEffects, DISASTERS } from "./disasters.js";
import { buildStarterTown } from "./starter.js";
import { lcg } from "./terrain.js";
import { nextRandom, tileAt, inBounds } from "./grid.js";
import { anchorOf, capacityOf, drawOf } from "./lots.js";
import { WATER_RADIUS } from "./utilities.js";
import { updateEvents, respondPetition, openPetition, specialAvailable, ensureEvents, PETITIONS } from "./events.js";
import { SPECIAL_TYPES } from "./catalog.js";
import { DEALS, SIDES, cancelDeal, auditDeals, dealAvailable, cancelPenalty, dealTerms } from "./neighbors.js";
import { buildingName } from "./names.js";
import { advanceYear, updateStrikes, readPopulation, blankPopulation, serviceQuality } from "./population.js";
import { INDUSTRY, industryOf, ensureIndustry } from "./industry.js";
import { COMMERCE, commerceOf, ensureCommerce } from "./commerce.js";
import { agePlants, plantOutput, OVERLOAD_MONTHS } from "./power.js";
import { agePumps, pumpOutput, hasSource, SOURCE_REACH } from "./water.js";
import { fillLandfills, landfillLoad, landfillNews } from "./waste.js";
import { advanceRoads, roadCapacity } from "./roads.js";
import { sitingNote } from "./siting.js";
import { sound, advanceSiren, sirenSounding, blankSiren } from "./siren.js";
import { flammability, reliefGrant, developedLots, fireCrews, crewsAvailable } from "./fire.js";
import { ageFactor } from "./wear.js";
import { PORTS, portJobs, portUpkeep, portNote, portReady, portObstacle } from "./ports.js";

export { TOOLS, TOOL_MAP, BUILDINGS, ZONE_TYPES, PORT_TYPES, ZONED_TYPES, ORDINANCES, ADVISORS, DISASTERS, START_YEAR, DEFAULT_SIZE, FUNDED_DEPARTMENTS, SPECIAL_TYPES, PETITIONS, DEALS, SIDES, serialize, place, evaluate, isZone };

export function createCity(seed = 42, starter = true, options = {}) {
  if (seed && typeof seed === "object") { options = seed; seed = options.seed ?? 42; starter = options.starter ?? true; }
  const city = blankCity({ seed, size: options.size ?? DEFAULT_SIZE, layout: options.layout, name: options.name, startYear: options.startYear, hills: options.hills });
  if (starter) buildStarterTown(city);
  return settle(city);
}

const dateYear = (city) => yearOf(city.month, city.startYear);

// Recompute everything derived and cache stats on the city.
function settle(city) {
  ensureEvents(city);
  if (!city.people) city.people = blankPopulation();
  refreshCity(city);
  const people = readPopulation(city, city.population || 0);
  ensureIndustry(city, dateYear(city), people.eq);
  ensureCommerce(city, people.eq);
  city._traffic = updateTraffic(city, people.workforceShare);
  refreshCity(city);
  const m = computeMetrics(city);
  city.population = m.population;
  city.happiness = m.happiness;
  city.demand = computeDemand(city, m);
  city._metrics = m;
  return city;
}

export function refresh(city) {
  settle(city);
  city.revision++;
  return city;
}

export function deserialize(raw) {
  return settle(parseCity(raw));
}

// One month. Growth uses the demand shown to the player (computed at the end
// of the previous month), then every derived value is recomputed from the
// settled state so a save/load round trip reproduces it exactly.
export function tick(city) {
  const rng = lcg(nextRandom(city) * 4294967296);
  if (!city._metrics) settle(city);
  // Every change to the city happens here, above the refreshes. Anything
  // mutated afterwards would leave a save whose derived state settle() cannot
  // reproduce on load, and the two copies would drift apart.
  // How far Sims are willing to drive catches up with what the roads were
  // like last month. It has to move here, above the refreshes, or a reloaded
  // city would take a step the running one had not.
  city.trafficLevel = settleTraffic(city.trafficLevel, city._metrics?.traffic ?? city.trafficLevel);
  const growth = updateGrowth(city, city.demand, rng);
  // Last month's crews come back on duty: "one dispatch unit for each fire
  // station you build, plus one for the volunteer group", every month.
  city.dispatched = 0;
  const fireMessage = advanceFires(city, rng);
  // Sims age once a year: children are schooled, adults forget, and life
  // expectancy drifts toward what the city's hospitals and air support.
  const monthNews = advancePeople(city);
  // Plants and pumps age; a grid overdrawn for a year loses a plant.
  monthNews.push(...agePlants(city, rng));
  monthNews.push(...agePumps(city));
  // Trucks tip this month's collection into the landfills, and what is
  // already buried decomposes a little.
  const tipsBefore = landfillLoad(city);
  fillLandfills(city, city._svc?.buried || 0);
  monthNews.push(...landfillNews(city, tipsBefore, landfillLoad(city)));
  // Roads wear out unless the transport budget keeps them up.
  monthNews.push(...advanceRoads(city));
  advanceEffects(city);

  refreshCity(city);
  city._traffic = updateTraffic(city, readPopulation(city, city.population || 0).workforceShare);
  refreshCity(city);
  const m = computeMetrics(city);
  const demand = computeDemand(city, m);
  const budget = computeBudget(city);
  const statsForNews = { ...m, balance: budget.balance, money: city.money, demand };

  city.money = Math.round((city.money + budget.balance) * 100) / 100;
  amortize(city);
  city.month++;
  city.population = m.population;
  city.happiness = m.happiness;
  city.demand = demand;
  city._metrics = m;
  city._budget = budget;

  const news = [...monthNews];
  // "As long as Auto Budget is on, all of your Budget window settings will
  // remain unchanged and the Budget window will not pop up year after year. As
  // soon as your finances go into the negative, Auto Budget will be turned
  // off. This way you can hopefully recover before things get too out of
  // hand." The setting here is the review itself, so going into the red turns
  // it back on.
  if (city.settings?.yearEndBudget === false && city.money < 0) {
    city.settings.yearEndBudget = true;
    news.push("The treasury is in the red: the year-end budget review is back on.");
  }
  news.push(...generateNews(city, statsForNews, city._prev));
  news.push(...updateEvents(city, statsForNews, rng));
  const cancelled = auditDeals(city, city._connections, city._util);
  news.push(...cancelled);
  const standing = developedLots(city);
  const disaster = randomDisaster(city, m, rng);
  if (disaster) {
    news.push(disaster);
    news.push(...claimRelief(city, m, standing));
  }
  if (fireMessage) news.push(fireMessage);
  // A warning that came to nothing costs the mayor credibility.
  news.push(...advanceSiren(city, !!(disaster || fireMessage)));
  if (news.length) city.news = [...city.news, ...news].slice(-30);
  city._prev = { population: m.population, balance: budget.balance, money: city.money, crime: m.crime, pollution: m.pollution, garbage: m.garbage, power: m.power, unemployment: m.unemployment, abandonedLots: m.abandonedLots };

  city.history.push({
    month: city.month, population: m.population, money: Math.round(city.money), happiness: m.happiness,
    income: budget.income.total, expenses: budget.expenses.total, balance: budget.balance, debt: city.debt,
    pollution: m.pollution, crime: m.crime, traffic: m.traffic, landValue: m.landValue,
    eq: m.eq, lifeExpectancy: m.lifeExpectancy,
    demand: { ...demand },
  });
  if (city.history.length > 240) city.history.shift();
  // A disaster or a cancelled deal changes the city after this month's
  // figures were taken. The report above is what the month looked like; the
  // cached derived state has to catch up, or a save would carry tiles that
  // disagree with it and the reloaded city would drift.
  if (disaster || cancelled.length) settle(city);
  city.revision++;
  return { growth, news, disaster: disaster || fireMessage || null };
}

// "In the event of a catastrophic disaster, the powers that be in SimNation
// may take it upon themselves to assist you in the clean up costs. Be
// forewarned, a Mayor that is well prepared generally receives better
// treatment." Returns news.
function claimRelief(city, stats, standingBefore) {
  const grant = reliefGrant(city, stats, standingBefore - developedLots(city));
  if (grant <= 0) return [];
  city.money += grant;
  return [`SimNation sends $${grant.toLocaleString()} in disaster relief.`];
}

// Strike bookkeeping every month, ageing every January. Returns news.
function advancePeople(city) {
  const before = { ...city.people.strikes };
  updateStrikes(city);
  const news = [];
  for (const [dept, label] of [["education", "Teachers"], ["health", "Hospital staff"], ["transit", "Bus drivers and conductors"]]) {
    if (!before[dept] && city.people.strikes[dept]) news.push(`${label} walk out over budget cuts.`);
    else if (before[dept] && !city.people.strikes[dept]) news.push(`${label} return to work.`);
  }
  if ((city.month + 1) % 12 === 0) {
    const m = city._metrics || {};
    advanceYear(city, city.population || 0, {
      pollution: m.pollution || 0,
      waterPollution: m.waterPollution || 0,
      traffic: m.traffic || 0,
      garbage: m.garbage || 0,
    });
  }
  return news;
}

export function getStats(city) {
  const m = city._metrics && city._metricsRevision === city.revision ? city._metrics : computeMetrics(city);
  city._metrics = m; city._metricsRevision = city.revision;
  const budget = computeBudget(city);
  const stats = {
    ...m,
    money: city.money,
    demand: { ...city.demand },
    income: budget.income.total,
    expenses: budget.expenses.total,
    balance: budget.balance,
    budget,
    debt: city.debt || 0,
    loans: (city.loans || []).map((l) => ({ ...l })),
    loanPayment: budget.expenses.loans,
    taxes: { ...city.taxes },
    funding: { ...city.funding },
    ordinances: { ...city.ordinances },
    news: city.news.slice(),
    name: city.name,
    history: city.history,
    settings: { ...(city.settings || { yearEndBudget: true }) },
    unlocked: { ...(city.unlocked || {}) },
    available: Object.fromEntries(SPECIAL_TYPES.map((type) => [type, specialAvailable(city, type) && techAvailable(city, type)])),
    tech: Object.fromEntries(Object.keys(BUILDINGS).map((type) => [type, techAvailable(city, type)])),
    startYear: city.startYear,
    // The template first, so a petition that writes its own title, body or
    // button labels - a neighbour's offer does, because every offer carries
    // its own terms - overrides it rather than being overridden by it.
    petition: (() => { const p = openPetition(city); return p ? { ...PETITIONS[p.id], ...p } : null; })(),
    neighbors: SIDES.map((side) => {
      const c = city._connections?.[side] || {};
      return { side, name: c.name, road: c.road || 0, rail: c.rail || 0, power: c.power || 0, water: c.water || 0,
        deals: Object.fromEntries(Object.keys(DEALS).map((r) => [r, dealAvailable(city._connections, r, side)])) };
    }),
    // What each deal is actually costing or earning this month, so the
    // neighbours panel can show the metered figure rather than a list price.
    deals: Object.fromEntries(Object.entries(city.deals || {}).map(([r, d]) => {
      const terms = dealTerms(city, r);
      const traded = r === "garbage"
        ? (d.kind === "sell" ? city._svc?.exported || 0 : terms.cap)
        : city._util?.[r]?.deal?.amount ?? 0;
      return [r, {
        ...d, ...terms,
        traded: Math.round(traded),
        monthly: Math.max(terms.minimum || 0, Math.round(traded * terms.rate)),
        penalty: cancelPenalty(terms),
        met: r === "garbage" ? true : city._util?.[r]?.deal?.met !== false,
      }];
    })),
    siren: { sounding: sirenSounding(city), trust: city.siren?.trust ?? 1, until: city.siren?.until ?? 0 },
    // "One dispatch unit for each fire station you build, plus one for the
    // volunteer group", and how many of them are still at the station.
    crews: { total: fireCrews(city), free: crewsAvailable(city) },
    advice: "",
  };
  stats.advisors = generateAdvisors(city, stats);
  const worst = stats.advisors.find((a) => a.mood === "bad") || stats.advisors.find((a) => a.mood === "warning");
  stats.advice = worst ? worst.message : "The city is doing well.";
  return stats;
}

export function setPolicy(city, key, value) {
  if (typeof key !== "string") return { ok: false, message: "Invalid policy." };
  let result;
  if (key === "loan") result = takeLoan(city, value);
  else if (key === "repayLoan") result = repayLoan(city, value);
  else {
    const [category, field] = key.split(".");
    if (category === "tax") {
      if (!ZONE_TYPES.has(field)) return { ok: false, message: `Unknown tax type: ${field}.` };
      const rate = Number(value);
      if (!Number.isFinite(rate) || rate < 0 || rate > 20) return { ok: false, message: "Tax rate must be between 0 and 20." };
      city.taxes[field] = Math.round(rate);
      result = { ok: true, message: `${field} tax set to ${city.taxes[field]}%.` };
    } else if (category === "funding") {
      if (!FUNDED_DEPARTMENTS.includes(field)) return { ok: false, message: `Unknown department: ${field}.` };
      const pct = Number(value);
      if (!Number.isFinite(pct) || pct < 0 || pct > 120) return { ok: false, message: "Funding must be between 0 and 120%." };
      city.funding[field] = Math.round(pct);
      result = { ok: true, message: `${field} funding set to ${city.funding[field]}%.` };
    } else if (category === "ordinance") {
      if (!ORDINANCES[field]) return { ok: false, message: `Unknown ordinance: ${field}.` };
      city.ordinances[field] = Boolean(value);
      result = { ok: true, message: `${ORDINANCES[field].label} ${city.ordinances[field] ? "enacted" : "repealed"}.` };
    } else if (key === "disasters") {
      city.disasters = Boolean(value);
      result = { ok: true, message: `Random disasters ${city.disasters ? "enabled" : "disabled"}.` };
    } else if (category === "setting") {
      ensureEvents(city);
      if (!["yearEndBudget"].includes(field)) return { ok: false, message: `Unknown setting: ${field}.` };
      city.settings[field] = Boolean(value);
      result = { ok: true, message: "" };
    } else if (key === "siren") {
      if (!city.siren) city.siren = blankSiren();
      result = sound(city);
    } else if (key === "petition") {
      result = respondPetition(city, value?.id, !!value?.accept);
    } else if (key === "cancelDeal") {
      result = cancelDeal(city, value);
    } else if (key === "name") {
      const text = String(value ?? "").trim().slice(0, 40);
      if (!text) return { ok: false, message: "Name cannot be empty." };
      city.name = text;
      result = { ok: true, message: `City renamed to ${text}.` };
    } else return { ok: false, message: `Unknown policy key: ${key}.` };
  }
  if (result.ok) refresh(city);
  return result;
}

export function disaster(city, id) {
  if (!DISASTERS[id]) return "Unknown disaster.";
  const rng = lcg(nextRandom(city) * 4294967296);
  const standing = developedLots(city);
  const message = triggerDisaster(city, id, rng);
  refresh(city);
  const relief = claimRelief(city, city._metrics, standing);
  if (relief.length) city.news = [...city.news, ...relief].slice(-30);
  return message;
}

const LABELS = {
  empty: "Open land", road: "Road", rail: "Rail line",
  residential: "Residential zone", commercial: "Commercial zone", industrial: "Industrial zone",
  airport: "Airport zone", seaport: "Seaport zone",
};
// Query grades: enough places for everyone, adequately staffed, earns an A.
const GRADES = [[1.05, "A"], [0.9, "B"], [0.75, "C"], [0.55, "D"], [0, "F"]];
const grade = (score) => (GRADES.find(([floor]) => score >= floor) || GRADES.at(-1))[1];
const DENSITY_NAMES = ["", "Low density", "Medium density", "High density"];
const STAGE_NAMES = { residential: ["", "Small homes", "Family homes", "Apartments", "Residential towers"], commercial: ["", "Corner shops", "Retail strip", "Offices", "Corporate towers"], industrial: ["", "Workshops", "Factories", "Plants", "Heavy industry"] };

export function inspectTile(city, x, y) {
  if (!inBounds(city.size, x, y)) return { title: "Out of bounds", description: "No tile here.", details: [] };
  const t = tileAt(city, x, y);
  const a = anchorOf(city, t) || t;
  const details = [];
  let title = LABELS[t.type] || BUILDINGS[t.type]?.label || t.type;
  let description = "";
  const yesNo = (v) => (v ? "Yes" : "No");
  if (ZONE_TYPES.has(t.type)) {
    title = `${DENSITY_NAMES[t.density]} ${t.type}`;
    const name = buildingName(a);
    if (!a.lot) description = "Zoned, waiting for development. Needs road access and power" + (t.density >= 2 ? " and water." : ".");
    else if (a.abandoned) description = `Abandoned ${STAGE_NAMES[t.type][Math.max(1, a.level)].toLowerCase()}. Restore services and demand to bring residents back.`;
    else {
      title = name || title;
      const stage = t.type === "industrial" ? INDUSTRY[industryOf(a)].label
        : t.type === "commercial" ? `${COMMERCE[commerceOf(a)].label}, ${STAGE_NAMES.commercial[a.level].toLowerCase()}`
        : STAGE_NAMES[t.type][a.level];
      description = `${stage}, ${DENSITY_NAMES[t.density].toLowerCase()} ${t.type} (${a.lot.w}×${a.lot.h} lot, stage ${a.level}/4).`;
    }
    const cap = capacityOf(a);
    if (cap) details.push(t.type === "residential" ? `Residents: ${cap.toLocaleString()}` : `Jobs: ${cap.toLocaleString()}${a.filled != null ? ` (${Math.min(cap, Math.round(a.filled)).toLocaleString()} filled)` : ""}`);
    if (t.type === "residential" && a.commute != null && cap) details.push(`Workers with a job: ${Math.round(a.commute * 100)}%`);
    if (a.lot) { const d = drawOf(a); details.push(`Power draw: ${Math.round(d.power)} · Water draw: ${Math.round(d.water)}`); }
    details.push(`Conditions: ${conditionsOk(a) ? "OK" : "Not met"}`);
    // "A Residential or Commercial zone won't develop if it's beyond a
    // reasonable commute distance from other zones."
    if (t.type === "residential" || t.type === "commercial") {
      const want = t.type === "residential" ? "work" : "customers";
      details.push(!connected(t)
        ? `No ${want} within a reasonable commute: nothing will be built here.`
        : `Nearest ${want}: ${Math.round((t.reach ?? 0) / 2)} tiles of travel.`);
    }
    if (a.lot) details.push(`Flammability: ${flammability(city, a)}/100${a.watered ? " (watered)" : ""}`);
  } else if (PORT_TYPES.has(t.type)) {
    const spec = PORTS[t.type];
    title = `${spec.label} zone`;
    if (!a.lot) {
      description = `Zoned, waiting for development. Needs at least ${spec.short}×${spec.long} tiles of ${t.type} zone, power, water and a road nearby.`;
      details.push(portObstacle(city, t) || `Ready to build. City demand for ${t.type}s: ${city.demand?.[t.type] ?? 0}`);
    } else if (a.abandoned) {
      description = `Closed ${spec.label.toLowerCase()}. Restore power, water and road access to bring the traffic back.`;
    } else {
      title = spec.label;
      description = `${spec.label}, ${a.lot.w}×${a.lot.h}. Serves the city's ${spec.serves} sector.`;
      const jobs = portJobs(city, a);
      details.push(`Jobs: ${jobs.toLocaleString()}${a.filled != null ? ` (${Math.min(jobs, Math.round(a.filled)).toLocaleString()} filled)` : ""}`);
      const d = drawOf(a);
      details.push(`Power draw: ${Math.round(d.power)} · Water draw: ${Math.round(d.water)}`);
      details.push(`Upkeep: $${portUpkeep(a).toLocaleString()}/month`);
    }
    if (a.lot) {
      const note = portNote(city, a);
      if (note) details.push(note);
      details.push(`Conditions: ${portReady(a) ? "OK" : "Not met"}`);
      details.push(`Flammability: ${flammability(city, a)}/100${a.watered ? " (watered)" : ""}`);
    }
  } else if (BUILDINGS[t.type]) {
    const b = BUILDINGS[t.type];
    description = `${b.label}, ${b.w}×${b.h}. Upkeep $${b.upkeep}/month.`;
    if (b.powerOut) {
      // The manual: query a plant for current capacity vs. potential capacity.
      const out = Math.round(plantOutput(t));
      const years = Math.floor((t.age || 0) / 12);
      details.push(`Power output: ${out.toLocaleString()} of ${b.powerOut.toLocaleString()} (age ${years} of ${b.lifespan ?? 50} years)`);
      if (t.strain) details.push(`OVERLOADED for ${t.strain} month${t.strain === 1 ? "" : "s"} — it will explode at ${OVERLOAD_MONTHS}.`);
    }
    if (b.waterOut) {
      const out = Math.round(pumpOutput(city, t, city._util?.waterPollution || 0));
      const years = Math.floor((t.age || 0) / 12);
      details.push(`Water output: ${out.toLocaleString()} of ${b.waterOut.toLocaleString()} (age ${years} of ${b.lifespan ?? 50} years)`);
      if (!hasSource(city, t)) details.push(`No ${b.source} water within ${SOURCE_REACH} tiles — this pump has no capacity.`);
    }
    if (b.service) details.push(`${b.service.kind} coverage radius ${b.service.radius}`);
    const note = sitingNote(city, t);
    if (note) details.push(note);
    details.push(`Flammability: ${flammability(city, t)}/100${t.watered ? " (watered)" : ""}`);
    // The manual tells players to query a school or hospital for its grade:
    // a good grade means enough places, well enough funded, for everyone who
    // needs one. Bad grades mean more buildings or more budget.
    if (b.capacity) {
      const q = serviceQuality(city, { ...readPopulation(city, city.population || 0), strikes: city.people.strikes });
      const kind = b.capacity.kind;
      const needed = { school: q.schoolDemand, college: q.collegeDemand, hospital: city.population || 0 }[kind] || 0;
      const seats = q.seats[kind] || 0;
      const score = kind === "hospital" ? q.hospitalService : (kind === "school" ? q.schoolQuality : q.collegeQuality) / 100;
      details.push(`${kind === "hospital" ? "Beds" : "Places"}: ${b.capacity.seats.toLocaleString()} (city-wide ${Math.round(seats).toLocaleString()} for ${Math.round(needed).toLocaleString()})`);
      details.push(`Grade: ${grade(score)}`);
    }
    if (b.cells) {
      const m = city._svc || {};
      details.push(`Cells: ${b.cells.toLocaleString()} (city-wide ${(m.cells || 0).toLocaleString()} for ${(m.arrestable || 0).toLocaleString()} arrests)`);
      if ((m.jailFactor ?? 1) < 1) details.push("Overcrowded: arrests are released and police effectiveness drops.");
    }
    // "Query a landfill tile to find out the disposal capacity system-wide",
    // and check an incinerator's capacity as it ages.
    if (b.garbage || b.recycles) {
      const rate = Math.round((b.garbage || b.recycles) * ageFactor(t.type, t.age || 0));
      details.push(`${b.recycles ? "Recycles" : "Burns"}: ${rate.toLocaleString()} of ${(b.garbage || b.recycles).toLocaleString()} tons per month`);
      if (!t.roadAccess) details.push("No road: garbage trucks cannot reach it.");
    }
    if (b.hold) {
      const m = city._svc || {};
      details.push(`Buried here: ${Math.round(t.fill || 0).toLocaleString()} of ${b.hold.toLocaleString()}`);
      details.push(`City landfills: ${Math.round(100 * landfillLoad(city))}% full (${(m.landfillSpace || 0).toLocaleString()} tons of space left)`);
      if (!t.roadAccess) details.push("No road: this landfill is decommissioned and slowly decomposing.");
    }
    // Streets and highways share one surface, kept up by the transport budget.
    if (b.path && t.type !== "rail" && t.type !== "subway") {
      const surface = Math.round(city.roadCondition ?? 100);
      const state = surface >= 90 ? "well maintained" : surface >= 70 ? "wearing" : surface >= 45 ? "potholed" : "breaking up";
      details.push(`Surface: ${surface}% — ${state}`);
    }
    if (t.type === "road" && t.terrain === "water") description = "Bridge.";
  } else {
    description = t.trees ? `${["", "Scattered trees", "Woodland", "Dense forest"][t.trees]} on ${t.terrain}.` : `Undeveloped ${t.terrain}.`;
  }
  details.push(`Land value: ${t.landValue}/100`);
  if (t.pollution) details.push(`Pollution: ${t.pollution}/100`);
  if (t.crime) details.push(`Crime: ${t.crime}/100`);
  if (t.traffic) details.push(`Traffic: ${t.traffic}/100`);
  if (t.type !== "empty" && t.type !== "road" && t.type !== "rail") {
    details.push(`Power: ${yesNo(t.powered)} · Water: ${yesNo(t.watered)} · Road: ${yesNo(t.roadAccess)}`);
  }
  const s = t.svc || {};
  const cov = ["police", "fire", "health", "education"].filter((k) => s[k] > 0).map((k) => `${k} ${Math.round(s[k])}`);
  if (cov.length) details.push(`Coverage: ${cov.join(", ")}`);
  if (t.powerline) details.push("Power line");
  if (t.pipe) details.push("Water pipe");
  if (t.fire) details.push("ON FIRE");
  details.push(`(${x}, ${y})`);
  return { title, description, details, x, y, lot: a.lot ? { ...a.lot } : null, anchor: a.lot ? a : null };
}

export { dateOf, WATER_RADIUS, defaultPolicies, techAvailable };
