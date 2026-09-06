// City state: tile schema, creation, save format (version 3).
import { generateTerrain, LAYOUTS, MAX_ELEVATION } from "./terrain.js";
import { BUILDINGS, ZONE_TYPES, ROAD_TYPES, FUNDED_DEPARTMENTS } from "./catalog.js";
import { tileAt } from "./grid.js";
import { lotTiles } from "./lots.js";

export const SAVE_VERSION = 3;
export const DEFAULT_SIZE = 64;
export const MAX_SIZE = 128;
export const START_MONEY = 50000;
export const START_YEAR = 2000;

export const ORDINANCES = {
  recycling:          { label: "Recycling Program",        cost: 0.012, description: "Cuts garbage by 25%. Costs $0.012 per resident." },
  cleanAir:           { label: "Clean Air Act",            cost: 0.02,  description: "Reduces air pollution 30%. Industry dislikes it." },
  neighborhoodWatch:  { label: "Neighborhood Watch",       cost: 0.008, description: "Cuts crime 15% city-wide." },
  energyConservation: { label: "Energy Conservation",      cost: 0.01,  description: "Reduces power demand 15%." },
  waterConservation:  { label: "Water Conservation",       cost: 0.01,  description: "Reduces water demand 15%." },
  youthCurfew:        { label: "Youth Curfew",             cost: 0.005, description: "Lowers crime a little; residents grumble." },
  tourismPromotion:   { label: "Tourism Promotion",        cost: 0.02,  description: "Boosts commercial demand." },
  gambling:           { label: "Legalized Gambling",       cost: -0.05, description: "Earns $0.05 per resident. Raises crime." },
  freeClinics:        { label: "Free Clinics",             cost: 0.03,  description: "Improves health coverage everywhere." },
  readingCampaign:    { label: "Pro-Reading Campaign",     cost: 0.015, description: "Improves education coverage everywhere." },
  parkingFines:       { label: "Parking Fines",            cost: -0.02, description: "Earns $0.02 per resident. Slightly lowers approval." },
  smokingBan:         { label: "Public Smoking Ban",       cost: 0.004, description: "Small health boost. Commerce grumbles a little." },
  carpool:            { label: "Carpool Incentive",        cost: 0.008, description: "Cuts road traffic 10%." },
  alternateDriving:   { label: "Alternate-Day Driving",    cost: 0.004, description: "Cuts road traffic 25%. Drivers hate it." },
  juniorSports:       { label: "Junior Sports League",     cost: 0.012, description: "Healthier, better-educated kids." },
  leafBurningBan:     { label: "Leaf Burning Ban",         cost: 0.002, description: "Reduces air pollution 5%. Gardeners grumble." },
  cprTraining:        { label: "CPR Training",             cost: 0.006, description: "Raises health a little everywhere." },
  wasteTax:           { label: "Industrial Waste Tax",     cost: 0,     description: "Industry pays 15% more tax and pollutes 8% less, but grows slower." },
};

export function makeTile(x, y, terrain, trees, variant, elev = 0) {
  return {
    x, y, terrain, trees, elev,
    type: "empty", density: 0, lot: null, level: 0, variant, abandoned: false, age: 0, fire: 0,
    powered: false, watered: false, roadAccess: false, powerline: false, pipe: false,
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
      tiles.push(makeTile(x, y, gen.terrain[i], gen.trees[i], v / 4294967296, gen.heights[i]));
    }
  }
  return {
    version: SAVE_VERSION,
    size, seed, layout: gen.layout, name, startYear,
    tiles,
    money: START_MONEY, debt: 0, loans: [],
    month: 0,
    ...defaultPolicies(),
    population: 0, happiness: 50,
    demand: { residential: 0, commercial: 0, industrial: 0 },
    history: [], news: [],
    revision: 0,
    _rng: seed,
    _prev: null,
  };
}

// ── save / load ───────────────────────────────────────────────
const TERRAIN_CODE = { grass: 0, water: 1, sand: 2 };
const TERRAIN_NAME = ["grass", "water", "sand"];

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
    t.powerline ? 1 : 0, t.pipe ? 1 : 0, t.elev | 0,
  ]);
  return JSON.stringify({
    version: SAVE_VERSION,
    size: city.size, seed: city.seed, layout: city.layout, name: city.name, startYear: city.startYear ?? START_YEAR,
    types, tiles,
    money: city.money, debt: city.debt, loans: city.loans, month: city.month,
    taxes: city.taxes, funding: city.funding, ordinances: city.ordinances,
    population: city.population, happiness: city.happiness, demand: city.demand,
    history: city.history, news: city.news, revision: city.revision, _rng: city._rng,
    scenario: city.scenario ?? null,
    prev: city._prev ?? null,
    disasters: city.disasters !== false,
    unlocked: city.unlocked ?? {},
    petitions: city.petitions ?? [],
    settings: city.settings ?? { yearEndBudget: true },
    deals: city.deals ?? {},
  });
}

const VALID_TYPES = new Set(["empty", ...ZONE_TYPES, ...Object.keys(BUILDINGS)]);

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
  if (!Array.isArray(d.loans) || d.loans.length > 10 || d.loans.some((l) => !l || !Number.isFinite(l.amount) || !Number.isFinite(l.remaining) || !Number.isFinite(l.payment) || l.remaining < 0))
    throw new Error("Invalid save: bad loans.");
  if (!Array.isArray(d.history) || d.history.length > 240) throw new Error("Invalid save: bad history.");
  if (!Array.isArray(d.news) || d.news.length > 30 || d.news.some((n) => typeof n !== "string" || n.length > 300)) throw new Error("Invalid save: bad news.");
  if (!Number.isSafeInteger(d.revision) || d.revision < 0) throw new Error("Invalid save: bad revision.");

  const tiles = [];
  for (let i = 0; i < d.tiles.length; i++) {
    const r = d.tiles[i];
    const x = i % size, y = (i - x) / size;
    if (!Array.isArray(r) || (r.length !== 15 && r.length !== 16)) throw new Error(`Invalid save: tile ${i} malformed.`);
    const [terrainCode, trees, typeCode, density, lotX, lotY, lotW, lotH, level, variant, abandoned, age, fire, powerline, pipe, elev = 0] = r;
    if (!Number.isInteger(elev) || elev < 0 || elev > MAX_ELEVATION) throw new Error(`Invalid save: tile ${i} bad elevation.`);
    if (!TERRAIN_NAME[terrainCode]) throw new Error(`Invalid save: tile ${i} bad terrain.`);
    if (![0, 1, 2, 3].includes(trees)) throw new Error(`Invalid save: tile ${i} bad trees.`);
    const type = d.types[typeCode];
    if (!type) throw new Error(`Invalid save: tile ${i} bad type.`);
    if (![0, 1, 2, 3].includes(density) || (ZONE_TYPES.has(type) ? density === 0 : density !== 0)) throw new Error(`Invalid save: tile ${i} bad density.`);
    if (!Number.isInteger(level) || level < 0 || level > 4) throw new Error(`Invalid save: tile ${i} bad level.`);
    if (!Number.isFinite(variant) || variant < 0 || variant > 1) throw new Error(`Invalid save: tile ${i} bad variant.`);
    if (![0, 1].includes(abandoned) || ![0, 1].includes(powerline) || ![0, 1].includes(pipe)) throw new Error(`Invalid save: tile ${i} bad flags.`);
    if (!Number.isInteger(age) || age < 0 || !Number.isInteger(fire) || fire < 0 || fire > 6) throw new Error(`Invalid save: tile ${i} bad counters.`);
    const terrain = TERRAIN_NAME[terrainCode];
    if (terrain === "water" && type !== "empty" && type !== "road") throw new Error(`Invalid save: tile ${i} built on water.`);
    const t = makeTile(x, y, terrain, trees, variant, elev);
    t.type = type; t.density = density; t.level = level; t.abandoned = !!abandoned; t.age = age; t.fire = fire;
    t.powerline = !!powerline; t.pipe = !!pipe;
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
    money: d.money, debt: d.debt, loans: d.loans.map((l) => ({ amount: l.amount, remaining: l.remaining, payment: l.payment })),
    month: d.month,
    taxes: { residential: d.taxes.residential, commercial: d.taxes.commercial, industrial: d.taxes.industrial },
    funding: { ...policies.funding, ...Object.fromEntries(Object.entries(d.funding || {}).filter(([k]) => k in policies.funding)) },
    ordinances: { ...policies.ordinances, ...Object.fromEntries(Object.entries(d.ordinances || {}).filter(([k, v]) => k in policies.ordinances && typeof v === "boolean")) },
    population: Number.isFinite(d.population) ? d.population : 0,
    happiness: Number.isFinite(d.happiness) ? d.happiness : 50,
    demand: { residential: 0, commercial: 0, industrial: 0, ...(d.demand || {}) },
    history: d.history.filter((h) => h && Number.isSafeInteger(h.month)),
    news: d.news,
    revision: d.revision,
    _rng: d._rng,
    _prev: d.prev && typeof d.prev === "object" && Object.values(d.prev).every(Number.isFinite) ? { ...d.prev } : null,
    disasters: d.disasters !== false,
    unlocked: Object.fromEntries(Object.entries(d.unlocked || {}).filter(([k, v]) => BUILDINGS[k] && Number.isInteger(v))),
    petitions: Array.isArray(d.petitions) ? d.petitions.filter((p) => p && typeof p.id === "string" && typeof p.status === "string" && Number.isInteger(p.since)).slice(0, 50).map((p) => ({ ...p })) : [],
    settings: { yearEndBudget: d.settings?.yearEndBudget !== false },
    deals: Object.fromEntries(Object.entries(d.deals || {}).filter(([k, v]) => ["power", "water", "garbage"].includes(k) && v && ["north", "east", "south", "west"].includes(v.side) && ["buy", "sell"].includes(v.kind)).map(([k, v]) => [k, { side: v.side, kind: v.kind, since: Number.isInteger(v.since) ? v.since : 0 }])),
  };
  if (d.scenario && typeof d.scenario === "object") city.scenario = d.scenario;
  // Every lot must be consistent: all its tiles reference the same anchor and share a type.
  for (const t of tiles) {
    if (!t.lot) continue;
    const anchor = tileAt(city, t.lot.x, t.lot.y);
    if (!anchor?.lot || anchor.lot.x !== t.lot.x || anchor.lot.y !== t.lot.y || anchor.lot.w !== t.lot.w || anchor.lot.h !== t.lot.h)
      throw new Error("Invalid save: inconsistent lot.");
    for (const n of lotTiles(city, t.lot)) if (n.type !== anchor.type) throw new Error("Invalid save: lot spans different types.");
    if (t !== anchor) { t.level = 0; t.abandoned = false; }
  }
  return city;
}

export const isRoadLike = (t) => ROAD_TYPES.has(t.type);
