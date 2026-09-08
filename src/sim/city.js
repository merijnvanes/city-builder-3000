import { restoreStructures } from './structures.js';
import { bedElevation, waterSurface, waterVolume, MIN_WATER_DEPTH, WATER_EPSILON } from './surface-water.js';
import { parseConnections } from './neighbor-links.js';
import { effectState, parseEffects } from "./effects-state.js";
// City state: tile schema, creation, save format (version 6).
import { generateTerrain, LAYOUTS, MAX_ELEVATION, MIN_ELEVATION } from "./terrain.js";
import { BUILDINGS, ZONE_TYPES, PORT_TYPES, ZONED_TYPES, ROAD_TYPES, FUNDED_DEPARTMENTS } from "./catalog.js";
import { tileAt } from "./grid.js";
import { lotTiles } from "./lots.js";
import { blankPopulation, serializePopulation, parsePopulation } from "./population.js";
import { INDUSTRY_TYPES } from "./industry.js";
import { COMMERCE_TYPES } from "./commerce.js";
import { blankSiren, parseSiren, serializeSiren } from "./siren.js";
import { OVERLOAD_MONTHS } from "./power.js";
import { DEALS, SIDES, RATE_SPREAD, CAP_SPREAD } from "./neighbors.js";
import { MAX_LOANS, LOAN_MAX, LOAN_YEARS } from "./economy.js";

// Nothing holds more trash than the largest landfill tile.
const MAX_FILL = Math.max(...Object.values(BUILDINGS).map((b) => b.hold || 0));

export const SAVE_VERSION = 6;
export const DEFAULT_SIZE = 64;
export const MAX_SIZE = 128;
export const START_MONEY = 50000;
export const START_YEAR = 2000;

// mood: how residents feel about the ordinance itself, on top of whatever it
// does. The manual lists "excessive regulations (ordinances)" as a drag on
// aura; services.js adds a further penalty for enacting a great many.
export const ORDINANCES = {
  recycling:          { label: "Recycling Program",        cost: 0.012, description: "Cuts garbage by 25%. Costs $0.012 per resident." },
  cleanAir:           { label: "Clean Air Act",            cost: 0.02,  description: "Reduces air pollution 30%. Industry dislikes it." },
  neighborhoodWatch:  { label: "Neighborhood Watch",       cost: 0.008, description: "Cuts crime 15% city-wide." },
  energyConservation: { label: "Energy Conservation",      cost: 0.01,  description: "Reduces power demand 15%." },
  waterConservation:  { label: "Water Conservation",       cost: 0.01,  description: "Reduces water demand 15%." },
  youthCurfew:        { label: "Youth Curfew",             cost: 0.005, mood: -2, description: "Lowers crime a little; residents grumble." },
  tourismPromotion:   { label: "Tourism Promotion",        cost: 0.02,  mood: 1, description: "Boosts commercial demand." },
  gambling:           { label: "Legalized Gambling",       cost: -0.05, mood: -1, description: "Earns $0.05 per resident. Raises crime." },
  freeClinics:        { label: "Free Clinics",             cost: 0.03,  mood: 1, description: "Improves health coverage everywhere." },
  readingCampaign:    { label: "Pro-Reading Campaign",     cost: 0.015, mood: 1, description: "Improves education coverage everywhere." },
  parkingFines:       { label: "Parking Fines",            cost: -0.02, mood: -2, description: "Earns $0.02 per resident. Slightly lowers approval." },
  smokingBan:         { label: "Public Smoking Ban",       cost: 0.004, mood: -1, description: "Small health boost. Commerce grumbles a little." },
  carpool:            { label: "Carpool Incentive",        cost: 0.008, description: "Cuts road traffic 10%." },
  alternateDriving:   { label: "Alternate-Day Driving",    cost: 0.004, mood: -3, description: "Cuts road traffic 25%. Drivers hate it." },
  juniorSports:       { label: "Junior Sports League",     cost: 0.012, mood: 1, description: "Healthier, better-educated kids." },
  leafBurningBan:     { label: "Leaf Burning Ban",         cost: 0.002, mood: -1, description: "Reduces air pollution 5%. Gardeners grumble." },
  cprTraining:        { label: "CPR Training",             cost: 0.006, description: "Raises health a little everywhere." },
  wasteTax:           { label: "Industrial Waste Tax",     cost: 0,     mood: -1, description: "Industry pays 15% more tax and pollutes 8% less, but grows slower." },
  trashPresort:       { label: "Trash Presort",            cost: 0.006, mood: -1, description: "Residents sort their own waste. Recycling centers handle 40% more." },
  fireCode:           { label: "Fire Code",                cost: 0.01,  mood: -1, description: "Sprinklers and inspections cut flammability across the city by 30%." },
};

export function makeTile(x, y, terrain, trees, variant, elev = 0, salt = 0) {
  return {
    x, y, terrain, trees, elev: terrain === "water" ? elev - 1 : elev,
    waterLevel: terrain === "water" ? elev - .25 : null,
    // Sea water. Fresh pumps cannot draw from it; a desalinization plant can.
    salt: terrain === "water" ? !!salt : false,
    type: "empty", density: 0, lot: null, level: 0, variant, abandoned: false, age: 0, fire: 0, industry: null, commerce: null, strain: 0,
    // Trash buried in this tile, for landfills.
    fill: 0,
    // A road (1) or rail (2) tunnel bored under this tile.
    tunnel: 0,
    // A road (1) or rail (2) running under an elevated highway. "Highways may
    // be built over roads, but if you want your Sims to be able to get from
    // one to the other, the intersection requires an on-ramp."
    under: 0,
    // Fallout from a meltdown. "The only time Sims won't return is when an
    // area has been contaminated by radiation from a nuclear explosion."
    radiation: false,
    powered: false, watered: false, roadAccess: false, powerline: false, pipe: false, subway: false,
    // Travel cost to the nearest workplace (homes) or customers (shops), -1
    // when nothing is within a reasonable commute. Derived; see traffic.js.
    reach: 0,
    pollution: 0, crime: 0, traffic: 0, landValue: 40, svc: null,
  };
}

export function defaultPolicies() {
  return {
    taxes: { residential: 7, commercial: 7, industrial: 7 },
    funding: Object.fromEntries(FUNDED_DEPARTMENTS.map((d) => [d, 100])),
    ordinances: Object.fromEntries(Object.keys(ORDINANCES).map((k) => [k, false])),
  };
}

export function blankCity({ seed = 42, size = DEFAULT_SIZE, layout, name = "New Riverton", startYear = START_YEAR, hills = 1 } = {}) {
  seed = Number.isFinite(seed) ? seed >>> 0 : 42;
  size = Math.max(16, Math.min(MAX_SIZE, size | 0));
  startYear = Number.isInteger(startYear) && startYear >= 1800 && startYear <= 2200 ? startYear : START_YEAR;
  const gen = generateTerrain(size, seed, layout, hills);
  const tiles = [];
  let v = seed ^ 0x2545f491;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      v = (Math.imul(1664525, v) + 1013904223) >>> 0;
      const i = y * size + x;
      tiles.push(makeTile(x, y, gen.terrain[i], gen.trees[i], v / 4294967296, gen.heights[i], gen.salt[i]));
    }
  }
  return {
    version: SAVE_VERSION,
    size, seed, layout: gen.layout, name, startYear,
    tiles,
    transportConnections: [],
    transportStructures: [],
    money: START_MONEY, debt: 0, loans: [],
    month: 0,
    ...defaultPolicies(),
    people: blankPopulation(),
    roadCondition: 100,
    // How congested the roads have been, which sets how far Sims will drive.
    trafficLevel: 0,
    // Fire crews and police units sent out this month; see fire.js.
    dispatched: 0, patrolled: 0,
    siren: blankSiren(),
    population: 0, happiness: 50,
    demand: Object.fromEntries([...ZONED_TYPES].map((k) => [k, 0])),
    history: [], news: [],
    deals: {},
    revision: 0,
    _rng: seed,
    _prev: null,
  };
}

// One canonical shape for a loan, out and in, so a save round-trips exactly.
const loanRecord = (l) => ({ amount: l.amount, remaining: l.remaining, payment: l.payment, since: l.since });

// One canonical shape for a petition, used on the way out and on the way in.
// A petition may carry a neighbour's offer, which is money, so this copies
// only the fields the game writes and holds the terms to what an offer can be.
// Both directions go through it, so a save reproduces byte for byte however
// the runtime happened to build the object.
function petitionRecord(p) {
  const out = { id: p.id, status: p.status, since: p.since };
  for (const k of ["expires", "decidedAt", "buildBy"]) if (Number.isInteger(p[k])) out[k] = p[k];
  if (p.never === true) out.never = true;
  if (typeof p.topic === "string" && p.topic.length <= 40) out.topic = p.topic;
  for (const k of ["title", "body", "accept", "decline"]) if (typeof p[k] === "string" && p[k].length <= 400) out[k] = p[k];
  const d = p.deal;
  if (d && DEALS[d.resource]?.[d.kind] && SIDES.includes(d.side)) {
    const base = DEALS[d.resource][d.kind];
    const within = (x, lo, hi) => (Number.isFinite(x) && x >= lo && x <= hi ? x : null);
    out.deal = {
      resource: d.resource, side: d.side, kind: d.kind,
      rate: within(d.rate, base.rate * (1 - RATE_SPREAD), base.rate * (1 + RATE_SPREAD)) ?? base.rate,
      cap: within(d.cap, base.cap * (1 - CAP_SPREAD), base.cap * (1 + CAP_SPREAD)) ?? base.cap,
      minimum: within(d.minimum, 0, (base.minimum || 0) * (1 + RATE_SPREAD)) ?? base.minimum,
    };
  }
  return out;
}

// ── save / load ───────────────────────────────────────────────
const TERRAIN_CODE = { grass: 0, water: 1, sand: 2, rock: 3 };
const TERRAIN_NAME = ["grass", "water", "sand", "rock"];

export function serialize(city) {
  const types = [];
  const typeIndex = new Map();
  const code = (type) => {
    let i = typeIndex.get(type);
    if (i === undefined) { i = types.length; types.push(type); typeIndex.set(type, i); }
    return i;
  };
  const tiles = city.tiles.map((t) => [
    TERRAIN_CODE[t.terrain], t.trees | 0, code(t.type), t.density | 0,
    t.lot ? t.lot.x : -1, t.lot ? t.lot.y : -1, t.lot ? t.lot.w : 0, t.lot ? t.lot.h : 0,
    t.level | 0, Math.round(t.variant * 1000) / 1000, t.abandoned ? 1 : 0, t.age | 0, t.fire | 0,
    t.powerline ? 1 : 0, t.pipe ? 1 : 0, bedElevation(t), t.subway ? 1 : 0, t.flooded | 0,
    t.industry ? INDUSTRY_TYPES.indexOf(t.industry) + 1 : 0, t.strain | 0, t.salt ? 1 : 0,
    Math.round((t.fill || 0) * 100) / 100, t.tunnel | 0,
    t.commerce ? COMMERCE_TYPES.indexOf(t.commerce) + 1 : 0, t.radiation ? 1 : 0, t.under | 0, waterVolume(t)>0 ? waterSurface(t) : null,
  ]);
  return JSON.stringify({
    version: SAVE_VERSION,
    size: city.size, seed: city.seed, layout: city.layout, name: city.name, startYear: city.startYear ?? START_YEAR,
    types, tiles,
    transportConnections: city.transportConnections ?? [],
    transportStructures: city.transportStructures ?? [],
    money: city.money, debt: city.debt, loans: city.loans.map(loanRecord), month: city.month,
    taxes: city.taxes, funding: city.funding, ordinances: city.ordinances,
    population: city.population, happiness: city.happiness, demand: city.demand,
    history: city.history, news: city.news, revision: city.revision, _rng: city._rng,
    scenario: city.scenario ?? null,
    prev: city._prev ?? null,
    disasters: city.disasters !== false,
    effects: effectState(city.effects),
    unlocked: city.unlocked ?? {},
    petitions: (city.petitions ?? []).map(petitionRecord),
    settings: city.settings ?? { yearEndBudget: true },
    deals: city.deals ?? {},
    people: serializePopulation(city.people),
    roadCondition: city.roadCondition ?? 100,
    trafficLevel: city.trafficLevel ?? 0,
    dispatched: city.dispatched ?? 0,
    patrolled: city.patrolled ?? 0,
    siren: serializeSiren(city.siren ?? blankSiren()),
  });
}

const VALID_TYPES = new Set(["empty", ...ZONED_TYPES, ...Object.keys(BUILDINGS)]);

export function deserialize(raw) {
  let d;
  try { d = JSON.parse(raw); } catch { throw new Error("Save file is corrupt."); }
  if (!d || typeof d !== "object") throw new Error("Save file is corrupt.");
  if (d.version !== SAVE_VERSION) throw new Error("This save is from an older version and cannot be loaded.");
  const size = d.size;
  if (!Number.isInteger(size) || size < 16 || size > MAX_SIZE) throw new Error("Invalid save: bad size.");
  if (!Array.isArray(d.tiles) || d.tiles.length !== size * size) throw new Error("Invalid save: tile count mismatch.");
  if (!Array.isArray(d.types) || !d.types.every((t) => VALID_TYPES.has(t))) throw new Error("Invalid save: bad building types.");
  if (!Number.isFinite(d.money)) throw new Error("Invalid save: bad money.");
  if (!Number.isSafeInteger(d.month) || d.month < 0) throw new Error("Invalid save: bad month.");
  if (!Number.isInteger(d.seed) || d.seed < 0 || d.seed > 4294967295) throw new Error("Invalid save: bad seed.");
  if (!Number.isInteger(d._rng) || d._rng < 0 || d._rng > 4294967295) throw new Error("Invalid save: bad rng.");
  if (typeof d.name !== "string" || d.name.length > 40) throw new Error("Invalid save: bad name.");
  if (!LAYOUTS.includes(d.layout)) throw new Error("Invalid save: bad layout.");
  const policies = defaultPolicies();
  for (const key of ["residential", "commercial", "industrial"]) {
    const v = d.taxes?.[key];
    if (!Number.isFinite(v) || v < 0 || v > 20) throw new Error("Invalid save: bad taxes.");
  }
  for (const key of Object.keys(policies.funding)) {
    const v = d.funding?.[key];
    if (v != null && (!Number.isFinite(v) || v < 0 || v > 120)) throw new Error("Invalid save: bad funding.");
  }
  if (d.ordinances && typeof d.ordinances !== "object") throw new Error("Invalid save: bad ordinances.");
  if (!Number.isFinite(d.debt) || d.debt < 0) throw new Error("Invalid save: bad debt.");
  // "You may have up to ten loans outstanding at any time", each of at most
  // $25,000, repaid over ten annual instalments.
  if (!Array.isArray(d.loans) || d.loans.length > MAX_LOANS || d.loans.some((l) => !l ||
      !Number.isFinite(l.amount) || l.amount <= 0 || l.amount > LOAN_MAX ||
      !Number.isFinite(l.payment) || l.payment <= 0 ||
      !Number.isFinite(l.remaining) || l.remaining < 0 || l.remaining > l.payment * LOAN_YEARS ||
      !Number.isSafeInteger(l.since) || l.since < 0 || l.since > d.month))
    throw new Error("Invalid save: bad loans.");
  if (!Array.isArray(d.history) || d.history.length > 240) throw new Error("Invalid save: bad history.");
  if (!Array.isArray(d.news) || d.news.length > 30 || d.news.some((n) => typeof n !== "string" || n.length > 300)) throw new Error("Invalid save: bad news.");
  if (!Number.isSafeInteger(d.revision) || d.revision < 0) throw new Error("Invalid save: bad revision.");

  const tiles = [];
  for (let i = 0; i < d.tiles.length; i++) {
    const r = d.tiles[i];
    const x = i % size, y = (i - x) / size;
    if (!Array.isArray(r) || r.length < 15 || r.length > 27) throw new Error(`Invalid save: tile ${i} malformed.`);
    const [terrainCode, trees, typeCode, density, lotX, lotY, lotW, lotH, level, variant, abandoned, age, fire, powerline, pipe, elev = 0, subway = 0, flooded = 0, industry = 0, strain = 0, salt = 0, fill = 0, tunnel = 0, commerce = 0, radiation = 0, under = 0, waterLevel = undefined] = r;
    if (![0, 1].includes(radiation)) throw new Error(`Invalid save: tile ${i} bad radiation.`);
    if (![0, 1, 2].includes(under)) throw new Error(`Invalid save: tile ${i} bad viaduct.`);
    if (!Number.isInteger(commerce) || commerce < 0 || commerce > COMMERCE_TYPES.length) throw new Error(`Invalid save: tile ${i} bad commerce.`);
    if (![0, 1, 2].includes(tunnel)) throw new Error(`Invalid save: tile ${i} bad tunnel.`);
    if (!Number.isFinite(fill) || fill < 0 || fill > MAX_FILL) throw new Error(`Invalid save: tile ${i} bad landfill contents.`);
    if (![0, 1].includes(salt)) throw new Error(`Invalid save: tile ${i} bad water type.`);
    if (!Number.isInteger(industry) || industry < 0 || industry > INDUSTRY_TYPES.length) throw new Error(`Invalid save: tile ${i} bad industry.`);
    if (!Number.isInteger(strain) || strain < 0 || strain > OVERLOAD_MONTHS) throw new Error(`Invalid save: tile ${i} bad plant strain.`);
    if (!Number.isInteger(elev) || elev < MIN_ELEVATION || elev > MAX_ELEVATION) throw new Error(`Invalid save: tile ${i} bad elevation.`);
    if (!Number.isInteger(flooded) || flooded < 0 || flooded > 2) throw new Error(`Invalid save: tile ${i} bad flood duration.`);
    if (![0, 1].includes(subway)) throw new Error(`Invalid save: tile ${i} bad subway flag.`);
    if (!TERRAIN_NAME[terrainCode]) throw new Error(`Invalid save: tile ${i} bad terrain.`);
    if (![0, 1, 2, 3].includes(trees)) throw new Error(`Invalid save: tile ${i} bad trees.`);
    const type = d.types[typeCode];
    if (!type) throw new Error(`Invalid save: tile ${i} bad type.`);
    // Ports have exactly one density band; RCI zones have three; nothing else
    // has any.
    const bands = PORT_TYPES.has(type) ? [1] : ZONE_TYPES.has(type) ? [1, 2, 3] : [0];
    if (!bands.includes(density)) throw new Error(`Invalid save: tile ${i} bad density.`);
    if (!Number.isInteger(level) || level < 0 || level > 4) throw new Error(`Invalid save: tile ${i} bad level.`);
    if (!Number.isFinite(variant) || variant < 0 || variant > 1) throw new Error(`Invalid save: tile ${i} bad variant.`);
    if (![0, 1].includes(abandoned) || ![0, 1].includes(powerline) || ![0, 1].includes(pipe)) throw new Error(`Invalid save: tile ${i} bad flags.`);
    if (!Number.isInteger(age) || age < 0 || !Number.isInteger(fire) || fire < 0 || fire > 6) throw new Error(`Invalid save: tile ${i} bad counters.`);
    const terrain = TERRAIN_NAME[terrainCode];
    if (terrain === "water" && type !== "empty" && !ROAD_TYPES.has(type)) throw new Error(`Invalid save: tile ${i} built on water.`);
    // Only a highway carries a route beneath it.
    if (under && type !== "highway" && !(type === "road" && under === 2)) throw new Error(`Invalid save: tile ${i} has a viaduct without a highway.`);
    const t = makeTile(x, y, terrain, trees, variant, elev, salt);
    if (waterLevel !== undefined) {
      const depth=waterLevel-elev;
      if(waterLevel===null ? terrain==="water" : !Number.isFinite(waterLevel) || depth<=0 || waterLevel>MAX_ELEVATION+1 || (terrain==="water" ? depth<MIN_WATER_DEPTH-WATER_EPSILON : depth>=MIN_WATER_DEPTH-WATER_EPSILON)) throw new Error(`Invalid save: tile ${i} bad water level.`);
      t.elev = elev; t.waterLevel = waterLevel;
    }
    t.type = type; t.density = density; t.level = level; t.abandoned = !!abandoned; t.age = age; t.fire = fire;
    t.powerline = !!powerline; t.pipe = !!pipe; t.subway = !!subway; t.flooded = flooded;
    t.industry = industry ? INDUSTRY_TYPES[industry - 1] : null;
    t.strain = strain;
    t.fill = fill;
    t.tunnel = tunnel;
    t.commerce = commerce ? COMMERCE_TYPES[commerce - 1] : null;
    t.radiation = !!radiation;
    t.under = under;
    if (lotW > 0) {
      if (!Number.isInteger(lotX) || !Number.isInteger(lotY) || !Number.isInteger(lotH) || lotW > 8 || lotH > 8 ||
          lotX > x || lotY > y || lotX + lotW <= x || lotY + lotH <= y) throw new Error(`Invalid save: tile ${i} bad lot.`);
      t.lot = { x: lotX, y: lotY, w: lotW, h: lotH };
    } else if (level !== 0 || abandoned) {
      throw new Error(`Invalid save: tile ${i} has development without a lot.`);
    }
    tiles.push(t);
  }
  const city = {
    version: SAVE_VERSION,
    size, seed: d.seed, layout: d.layout, name: d.name,
    startYear: Number.isInteger(d.startYear) && d.startYear >= 1800 && d.startYear <= 2200 ? d.startYear : START_YEAR,
    tiles,
    money: d.money, debt: d.debt, loans: d.loans.map(loanRecord),
    month: d.month,
    taxes: { residential: d.taxes.residential, commercial: d.taxes.commercial, industrial: d.taxes.industrial },
    funding: { ...policies.funding, ...Object.fromEntries(Object.entries(d.funding || {}).filter(([k]) => k in policies.funding)) },
    ordinances: { ...policies.ordinances, ...Object.fromEntries(Object.entries(d.ordinances || {}).filter(([k, v]) => k in policies.ordinances && typeof v === "boolean")) },
    population: Number.isFinite(d.population) ? d.population : 0,
    happiness: Number.isFinite(d.happiness) ? d.happiness : 50,
    demand: Object.fromEntries(["residential", "commercial", "industrial", ...PORT_TYPES]
      .map((k) => [k, Number.isFinite(d.demand?.[k]) ? Math.max(-100, Math.min(100, Math.round(d.demand[k]))) : 0])),
    history: d.history.filter((h) => h && Number.isSafeInteger(h.month)),
    news: d.news,
    revision: d.revision,
    _rng: d._rng,
    _prev: d.prev && typeof d.prev === "object" && Object.values(d.prev).every(Number.isFinite) ? { ...d.prev } : null,
    disasters: d.disasters !== false,
    effects: parseEffects(d.effects, size),
    unlocked: Object.fromEntries(Object.entries(d.unlocked || {}).filter(([k, v]) => BUILDINGS[k] && Number.isInteger(v))),
    petitions: Array.isArray(d.petitions) ? d.petitions.filter((p) => p && typeof p.id === "string" && typeof p.status === "string" && Number.isInteger(p.since)).slice(0, 50).map(petitionRecord) : [],
    settings: { yearEndBudget: d.settings?.yearEndBudget !== false },
    people: parsePopulation(d.people),
    roadCondition: Number.isFinite(d.roadCondition) && d.roadCondition >= 0 && d.roadCondition <= 100 ? d.roadCondition : 100,
    trafficLevel: Number.isFinite(d.trafficLevel) && d.trafficLevel >= 0 && d.trafficLevel <= 100 ? d.trafficLevel : 0,
    // Crews already out this month, so a save cannot refill the fire trucks.
    dispatched: Number.isInteger(d.dispatched) && d.dispatched >= 0 && d.dispatched <= 999 ? d.dispatched : 0,
    patrolled: Number.isInteger(d.patrolled) && d.patrolled >= 0 && d.patrolled <= 999 ? d.patrolled : 0,
    siren: parseSiren(d.siren),
    // A contract keeps the price it was signed at, so the terms travel with
    // it. They are money, so a save cannot be trusted to set them freely.
    deals: Object.fromEntries(Object.entries(d.deals || {})
      .filter(([k, v]) => ["power", "water", "garbage"].includes(k) && v && ["north", "east", "south", "west"].includes(v.side) && ["buy", "sell"].includes(v.kind))
      .map(([k, v]) => {
        const base = DEALS[k][v.kind];
        const within = (x, lo, hi) => (Number.isFinite(x) && x >= lo && x <= hi ? x : null);
        return [k, {
          side: v.side, kind: v.kind, since: Number.isInteger(v.since) ? v.since : 0,
          rate: within(v.rate, base.rate * (1 - RATE_SPREAD), base.rate * (1 + RATE_SPREAD)) ?? base.rate,
          cap: within(v.cap, base.cap * (1 - CAP_SPREAD), base.cap * (1 + CAP_SPREAD)) ?? base.cap,
          minimum: within(v.minimum, 0, (base.minimum || 0) * (1 + RATE_SPREAD)) ?? base.minimum,
        }];
      })),
  };
  if (d.scenario && typeof d.scenario === "object") city.scenario = d.scenario;
  // Every lot must be consistent: all its tiles reference the same anchor and share a type.
  for (const t of tiles) {
    if (!t.lot) continue;
    const anchor = tileAt(city, t.lot.x, t.lot.y);
    if (!anchor?.lot || anchor.lot.x !== t.lot.x || anchor.lot.y !== t.lot.y || anchor.lot.w !== t.lot.w || anchor.lot.h !== t.lot.h)
      throw new Error("Invalid save: inconsistent lot.");
    for (const n of lotTiles(city, t.lot)) {
      if (n.type !== anchor.type) throw new Error("Invalid save: lot spans different types.");
      if (n.density !== anchor.density) throw new Error("Invalid save: lot spans different densities.");
      if (n.elev !== anchor.elev) throw new Error("Invalid save: lot spans different elevations.");
    }
    if (t !== anchor) { t.level = 0; t.abandoned = false; }
  }
  restoreStructures(city,d.transportStructures);
  city.transportConnections = parseConnections(city, d.transportConnections);
  return city;
}

export const isRoadLike = (t) => ROAD_TYPES.has(t.type);
