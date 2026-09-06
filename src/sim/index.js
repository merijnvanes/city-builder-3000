// Public simulation API. No browser deps.
import { TOOLS, TOOL_MAP, BUILDINGS, ZONE_TYPES, FUNDED_DEPARTMENTS, isZone } from "./catalog.js";
import { blankCity, serialize, deserialize as parseCity, ORDINANCES, START_YEAR, DEFAULT_SIZE, defaultPolicies } from "./city.js";
import { place, evaluate } from "./place.js";
import { refreshCity } from "./refresh.js";
import { updateTraffic } from "./traffic.js";
import { computeMetrics, dateOf } from "./metrics.js";
import { computeDemand, updateGrowth, conditionsOk } from "./growth.js";
import { computeBudget, amortize, takeLoan, repayLoan } from "./economy.js";
import { generateAdvisors, generateNews, ADVISORS } from "./advisors.js";
import { triggerDisaster, advanceFires, randomDisaster, DISASTERS } from "./disasters.js";
import { buildStarterTown } from "./starter.js";
import { lcg } from "./terrain.js";
import { nextRandom, tileAt, inBounds } from "./grid.js";
import { anchorOf, capacityOf, drawOf } from "./lots.js";
import { WATER_RADIUS } from "./utilities.js";

export { TOOLS, TOOL_MAP, BUILDINGS, ZONE_TYPES, ORDINANCES, ADVISORS, DISASTERS, START_YEAR, DEFAULT_SIZE, FUNDED_DEPARTMENTS, serialize, place, evaluate, isZone };

export function createCity(seed = 42, starter = true, options = {}) {
  if (seed && typeof seed === "object") { options = seed; seed = options.seed ?? 42; starter = options.starter ?? true; }
  const city = blankCity({ seed, size: options.size ?? DEFAULT_SIZE, layout: options.layout, name: options.name });
  if (starter) buildStarterTown(city);
  return settle(city);
}

// Recompute everything derived and cache stats on the city.
function settle(city) {
  refreshCity(city);
  city._traffic = updateTraffic(city);
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

export function tick(city) {
  const rng = lcg(nextRandom(city) * 4294967296);
  refreshCity(city);
  city._traffic = updateTraffic(city);
  refreshCity(city);
  const before = computeMetrics(city);
  const demand = computeDemand(city, before);
  const growth = updateGrowth(city, demand, rng);
  const fireMessage = advanceFires(city, rng);
  refreshCity(city);
  const m = computeMetrics(city);
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

  const news = generateNews(city, statsForNews, city._prev);
  const disaster = randomDisaster(city, m, rng);
  if (disaster) news.push(disaster);
  if (fireMessage) news.push(fireMessage);
  if (news.length) city.news = [...city.news, ...news].slice(-30);
  city._prev = { population: m.population, balance: budget.balance, money: city.money, crime: m.crime, pollution: m.pollution, garbage: m.garbage, power: m.power, unemployment: m.unemployment, abandonedLots: m.abandonedLots };

  city.history.push({
    month: city.month, population: m.population, money: Math.round(city.money), happiness: m.happiness,
    income: budget.income.total, expenses: budget.expenses.total, balance: budget.balance, debt: city.debt,
    pollution: m.pollution, crime: m.crime, traffic: m.traffic, landValue: m.landValue,
    demand: { ...demand },
  });
  if (city.history.length > 240) city.history.shift();
  city.revision++;
  return { growth, news, disaster: disaster || fireMessage || null };
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
  const message = triggerDisaster(city, id, rng);
  refresh(city);
  return message;
}

const LABELS = {
  empty: "Open land", road: "Road", rail: "Rail line",
  residential: "Residential zone", commercial: "Commercial zone", industrial: "Industrial zone",
};
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
    if (!a.lot) description = "Zoned, waiting for development. Needs road access and power" + (t.density >= 2 ? " and water." : ".");
    else if (a.abandoned) description = `Abandoned ${STAGE_NAMES[t.type][Math.max(1, a.level)].toLowerCase()}. Restore services and demand to bring residents back.`;
    else description = `${STAGE_NAMES[t.type][a.level]} (${a.lot.w}×${a.lot.h} lot, stage ${a.level}/4).`;
    const cap = capacityOf(a);
    if (cap) details.push(t.type === "residential" ? `Residents: ${cap.toLocaleString()}` : `Jobs: ${cap.toLocaleString()}${a.filled != null ? ` (${Math.min(cap, Math.round(a.filled)).toLocaleString()} filled)` : ""}`);
    if (t.type === "residential" && a.commute != null && cap) details.push(`Workers with a job: ${Math.round(a.commute * 100)}%`);
    if (a.lot) { const d = drawOf(a); details.push(`Power draw: ${Math.round(d.power)} · Water draw: ${Math.round(d.water)}`); }
    details.push(`Conditions: ${conditionsOk(a) ? "OK" : "Not met"}`);
  } else if (BUILDINGS[t.type]) {
    const b = BUILDINGS[t.type];
    description = `${b.label}, ${b.w}×${b.h}. Upkeep $${b.upkeep}/month.`;
    if (b.powerOut) details.push(`Power output: ${b.powerOut.toLocaleString()}`);
    if (b.waterOut) details.push(`Water output: ${b.waterOut.toLocaleString()}${b.nearWater ? " (near water)" : ""}`);
    if (b.service) details.push(`${b.service.kind} coverage radius ${b.service.radius}`);
    if (b.garbage) details.push(`Garbage capacity: ${b.garbage}`);
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
  return { title, description, details, x, y, lot: a.lot ? { ...a.lot } : null };
}

export { dateOf, WATER_RADIUS, defaultPolicies };
