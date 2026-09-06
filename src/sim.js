// sim.js — Civic 3000 simulation engine. No browser deps.
import { updateInfrastructure, POWER_CAPACITY, WATER_CAPACITY } from "./infrastructure.js";
import {
  getTaxRates,
  computeTaxIncome,
  computeExpenses,
  computeDemand,
  generateAdvisors,
  generateNews,
} from "./economy.js";

// ── deterministic PRNG ────────────────────────────────────────
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ── tool definitions ──────────────────────────────────────────
export const TOOLS = [
  { id: "inspect",     label: "Inspect",      cost: 0,    group: "inspect",   description: "Inspect any tile", shortcut: "i" },
  // zones
  { id: "residential", label: "Residential",  cost: 100,  group: "zone",      description: "Zone residential ($100/density)", shortcut: "z" },
  { id: "commercial",  label: "Commercial",   cost: 150,  group: "zone",      description: "Zone commercial ($150/density)", shortcut: "c" },
  { id: "industrial",  label: "Industrial",   cost: 100,  group: "zone",      description: "Zone industrial ($100/density)", shortcut: "n" },
  // transport
  { id: "road",        label: "Road",         cost: 50,   group: "transport", description: "Build road ($50)", shortcut: "r" },
  { id: "rail",        label: "Rail",         cost: 80,   group: "transport", description: "Build rail line ($80)", shortcut: "t" },
  { id: "bus",         label: "Bus Depot",    cost: 2500, group: "transport", description: "Build bus depot ($2,500)", shortcut: "" },
  // utilities
  { id: "power",       label: "Power Plant",  cost: 5000, group: "utilities", description: "Build power plant ($5,000)", shortcut: "e" },
  { id: "water",       label: "Water Tower",  cost: 2000, group: "utilities", description: "Build water tower ($2,000)", shortcut: "u" },
  { id: "powerline",   label: "Power Line",   cost: 25,   group: "utilities", description: "Lay power line ($25)", shortcut: "" },
  { id: "pipe",        label: "Water Pipe",   cost: 20,   group: "utilities", description: "Lay water pipe ($20)", shortcut: "" },
  // civic
  { id: "police",      label: "Police Stn",   cost: 3000, group: "civic",     description: "Build police station ($3,000)", shortcut: "l" },
  { id: "fire",        label: "Fire Station", cost: 3000, group: "civic",     description: "Build fire station ($3,000)", shortcut: "f" },
  { id: "school",      label: "School",       cost: 2000, group: "civic",     description: "Build school ($2,000)", shortcut: "" },
  { id: "hospital",    label: "Hospital",     cost: 4000, group: "civic",     description: "Build hospital ($4,000)", shortcut: "" },
  { id: "landfill",    label: "Landfill",     cost: 1500, group: "civic",     description: "Build landfill ($1,500)", shortcut: "" },
  // landscape
  { id: "park",        label: "Park",         cost: 75,   group: "landscape", description: "Build park ($75)", shortcut: "p" },
  // demolish
  { id: "bulldoze",    label: "Bulldoze",     cost: 25,   group: "demolish",  description: "Demolish tile, 25% refund ($25)", shortcut: "b" },
];

const TOOL_MAP = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
const TOOL_COST = Object.fromEntries(TOOLS.map((t) => [t.id, t.cost]));
const ZONE_TYPES = new Set(["residential", "commercial", "industrial"]);
const VALID_TILE_TYPES = new Set([
  "empty", "road", "rail", "residential", "commercial", "industrial",
  "park", "power", "water", "police", "fire", "school", "hospital",
  "landfill", "bus",
]);
const VALID_TERRAIN = new Set(["grass", "water", "sand"]);
const MAX_LEVEL_FOR_DENSITY = [0, 1, 2, 4]; // index = density

// ── geometry helpers ──────────────────────────────────────────
const tidx = (size, x, y) => y * size + x;
const inBounds = (size, x, y) =>
  Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size;

// ── terrain generation ────────────────────────────────────────
function makeTile(x, y, terrain, rng) {
  return {
    x, y, terrain,
    type: "empty",
    level: 0,
    density: 1,
    variant: rng(),
    powered: false,
    watered: false,
    roadAccess: false,
    powerline: false,
    pipe: false,
    pollution: 0,
    crime: 0,
    traffic: 0,
    landValue: 45,
  };
}

function generateTerrain(size, rng) {
  const tiles = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const riverDist = Math.abs(x - 30) - 2 + Math.sin(y * 0.31 + x * 0.09) * 1.4;
      const terrain = riverDist < 0 ? "water" : riverDist < 1.1 ? "sand" : "grass";
      tiles.push(makeTile(x, y, terrain, rng));
    }
  }
  return tiles;
}

// ── growth simulation ─────────────────────────────────────────
function updateGrowth(city, rng) {
  const { tiles, demand } = city;
  for (const t of tiles) {
    if (!ZONE_TYPES.has(t.type)) continue;
    const density = t.density ?? 1;
    const maxLevel = MAX_LEVEL_FOR_DENSITY[density];
    const needsWater = density >= 2;

    // Enforce density cap always, even if set externally
    if (t.level > maxLevel) t.level = maxLevel;

    if (!t.roadAccess || !t.powered || (needsWater && !t.watered)) {
      if (t.level > 0 && rng() < 0.12) t.level--;
      continue;
    }
    if (t.level >= maxLevel) continue;

    const d = demand[t.type] || 0;
    const chance = Math.max(0, (d / 100) * 0.28 * (1 - t.level / (maxLevel + 1)));
    if (rng() < chance) t.level = Math.min(maxLevel, t.level + 1);
  }
}

// ── stats helpers ─────────────────────────────────────────────
function countTiles(tiles) {
  const c = {};
  for (const t of tiles) c[t.type] = (c[t.type] || 0) + 1;
  return c;
}

// ── stats computation ─────────────────────────────────────────
function computeStats(city) {
  const { tiles, month } = city;
  let pop = 0, comJobs = 0, indJobs = 0;
  let poweredZones = 0, wateredZones = 0, totalZones = 0;
  let totalPollution = 0, totalCrime = 0, totalTraffic = 0;
  let schoolCovered = 0, hospitalCovered = 0, landfillCovered = 0;
  let roadCount = 0;

  for (const t of tiles) {
    switch (t.type) {
      case "residential":
        pop += t.level * 80;
        totalZones++;
        if (t.powered) poweredZones++;
        if (t.watered) wateredZones++;
        totalPollution += t.pollution || 0;
        totalCrime += t.crime || 0;
        if (t.schoolCoverage) schoolCovered++;
        if (t.hospitalCoverage) hospitalCovered++;
        if (t.landfillCoverage) landfillCovered++;
        break;
      case "commercial":
        comJobs += t.level * 50;
        totalZones++;
        if (t.powered) poweredZones++;
        if (t.watered) wateredZones++;
        totalPollution += t.pollution || 0;
        totalCrime += t.crime || 0;
        break;
      case "industrial":
        indJobs += t.level * 70;
        totalZones++;
        if (t.powered) poweredZones++;
        if (t.watered) wateredZones++;
        break;
      case "road":
      case "rail":
        roadCount++;
        totalTraffic += t.traffic || 0;
        break;
    }
  }

  const jobs = comJobs + indJobs;
  const powerPct = totalZones
    ? Math.round((poweredZones / totalZones) * 100)
    : tiles.some((t) => t.type === "power") ? 100 : 0;
  const waterPct = totalZones
    ? Math.round((wateredZones / totalZones) * 100)
    : tiles.some((t) => t.type === "water") ? 100 : 0;
  const utilityRatio = totalZones ? (poweredZones + wateredZones) / (totalZones * 2) : 0;

  const counts = countTiles(tiles);
  const policeCount = counts.police || 0;
  const fireCount = counts.fire || 0;
  const parkCount = counts.park || 0;
  const schoolCount = counts.school || 0;
  const hospitalCount = counts.hospital || 0;
  const landfillCount = counts.landfill || 0;

  const serviceScore = Math.min(
    1,
    (policeCount * 150 + fireCount * 150 + parkCount * 50) / Math.max(1, pop),
  );
  const taxRates = getTaxRates(city);
  const avgTax = (taxRates.residential + taxRates.commercial + taxRates.industrial) / 3;
  const taxPenalty = Math.max(0, (avgTax - 9) * 3);
  const happiness = Math.round(
    Math.max(10, Math.min(100, 40 + serviceScore * 30 + utilityRatio * 25 - taxPenalty)),
  );

  const income = computeTaxIncome(city, pop, comJobs, indJobs);
  const expenses = computeExpenses(city, counts);
  const balance = income - expenses.total;

  const demand = computeDemand(city, pop, comJobs, indJobs, counts, happiness, utilityRatio);

  // Extended stats
  const unemployment = pop > 0 ? Math.round(Math.max(0, Math.min(100, (pop - jobs) / pop * 100)) * 0.6) : 0;
  const resPollution = totalZones > 0 ? Math.round(totalPollution / Math.max(1, counts.residential || 1)) : 0;
  const resCrime = totalZones > 0 ? Math.round(totalCrime / Math.max(1, (counts.residential || 0) + (counts.commercial || 0))) : 0;
  const avgTraffic = roadCount > 0 ? Math.round(totalTraffic / roadCount) : 0;

  const resCount = counts.residential || 0;
  const education = resCount > 0
    ? Math.round(Math.min(100, (schoolCovered / resCount) * 70 + (schoolCount > 0 ? 30 : 5)))
    : 5;
  const health = resCount > 0
    ? Math.round(Math.min(100, (hospitalCovered / resCount) * 70 + (hospitalCount > 0 ? 30 : 10)))
    : 10;
  const garbage = Math.round(Math.max(0, 100 - (resCount > 0 ? (landfillCovered / resCount) : 0) * 85));

  const monthName = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][month % 12];
  const year = 2000 + Math.floor(month / 12);
  const date = `${monthName} ${year}`;

  // Single legacy-compat advice string
  let advice = "Your city is growing steadily.";
  if (!tiles.some((t) => t.type === "power")) advice = "Build a power plant to energize your zones.";
  else if (!tiles.some((t) => t.type === "water")) advice = "Add a water tower so medium-density zones develop.";
  else if (powerPct < 90) advice = "Some zones lack power. Extend your road or power-line network.";
  else if (waterPct < 90) advice = "Some zones lack water. Extend your pipe or road network.";
  else if (!policeCount && pop > 500) advice = "Crime is rising. Build a police station.";
  else if (!fireCount && pop > 800) advice = "Fire risk is high. Add a fire station.";
  else if (demand.residential > 60) advice = "High housing demand. Zone more residential areas.";
  else if (demand.commercial > 60) advice = "People need jobs. Zone more commercial areas.";
  else if (demand.industrial > 60) advice = "Commercial zones need supply. Zone industrial areas.";
  else if (city.money < 2000) advice = "Funds are low. Consider raising taxes slightly.";
  else if (happiness < 40) advice = "Citizens are unhappy. Improve services and lower taxes.";
  else if (balance < 0) advice = "Budget is in deficit. Raise taxes or cut spending.";

  const statsObj = {
    population: pop,
    money: city.money,
    happiness,
    income,
    expenses: expenses.total,
    balance,
    power: powerPct,
    water: waterPct,
    jobs,
    demand,
    date,
    advice,
    // extended
    unemployment,
    pollution: resPollution,
    crime: resCrime,
    health,
    education,
    garbage,
    traffic: avgTraffic,
    debt: city.debt ?? 0,
    loanPayment: expenses.loanPayment,
    taxes: taxRates,
    funding: { police: (city.funding?.police ?? 100), fire: (city.funding?.fire ?? 100), health: (city.funding?.health ?? 100), education: (city.funding?.education ?? 100), transport: (city.funding?.transport ?? 100) },
    ordinances: { recycling: !!(city.ordinances?.recycling), cleanAir: !!(city.ordinances?.cleanAir), neighborhoodWatch: !!(city.ordinances?.neighborhoodWatch) },
    advisors: [],
    news: city._news ?? [],
  };
  statsObj.advisors = generateAdvisors(city, statsObj);
  return statsObj;
}

// ── starter city builder ──────────────────────────────────────
function setTile(city, x, y, type, level = 0, density = 1) {
  if (!inBounds(city.size, x, y)) return;
  const t = city.tiles[tidx(city.size, x, y)];
  if (t.terrain === "water" && type !== "road") return;
  t.type = type;
  t.level = level;
  t.density = density;
}

function fillBlock(city, x1, y1, x2, y2, type, rng, levels, density = 1) {
  const maxLvl = MAX_LEVEL_FOR_DENSITY[density];
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      const t = city.tiles[tidx(city.size, x, y)];
      if (!t || t.type !== "empty" || t.terrain === "water") continue;
      t.type = type;
      t.level = Math.min(maxLvl, levels[Math.floor(rng() * levels.length)]);
      t.density = density;
    }
  }
}

function buildStarterCity(city, rng) {
  const s = city.size;

  // Road grid: same layout as before
  for (const rx of [8, 14, 20]) {
    for (let y = 6; y <= 33; y++) setTile(city, rx, y, "road");
  }
  for (const ry of [6, 10, 16, 22, 28, 33]) {
    for (let x = 5; x <= 27; x++) setTile(city, x, ry, "road");
  }
  for (const rx of [11, 17, 23]) {
    for (let y = 6; y <= 33; y++) setTile(city, rx, y, "road");
  }
  for (let y = 6; y <= 33; y++) setTile(city, 26, y, "road");
  for (let x = 21; x <= 28; x++) setTile(city, x, 19, "road");

  // Utilities
  setTile(city, 6, 7, "power");
  setTile(city, 7, 7, "water");
  setTile(city, 6, 8, "police");
  setTile(city, 7, 8, "fire");
  setTile(city, 22, 8, "power");
  setTile(city, 23, 8, "water");
  // Civic buildings for services
  setTile(city, 6, 9, "school");
  setTile(city, 7, 9, "hospital");

  // Zone blocks — diversified density
  // Row 1 (y=11..15): outer=density2, some density3 core
  fillBlock(city, 9, 11, 10, 15, "residential", rng, [1, 2], 2);
  fillBlock(city, 12, 11, 13, 15, "residential", rng, [2, 3], 3);
  fillBlock(city, 15, 11, 16, 15, "commercial", rng, [1, 2], 2);
  fillBlock(city, 18, 11, 19, 15, "commercial", rng, [2], 2);
  fillBlock(city, 21, 11, 22, 15, "residential", rng, [1], 1);
  fillBlock(city, 24, 11, 25, 15, "residential", rng, [1, 2], 2);

  // Row 2 (y=17..21)
  fillBlock(city, 9, 17, 10, 21, "residential", rng, [2, 3], 3);
  fillBlock(city, 12, 17, 13, 21, "residential", rng, [1, 2], 2);
  fillBlock(city, 15, 17, 16, 21, "commercial", rng, [1, 2], 2);
  fillBlock(city, 18, 17, 19, 21, "commercial", rng, [1], 1);
  fillBlock(city, 21, 17, 22, 21, "commercial", rng, [1, 2], 2);
  fillBlock(city, 24, 17, 25, 21, "commercial", rng, [1], 1);

  // Row 3 (y=23..27)
  fillBlock(city, 9, 23, 10, 27, "industrial", rng, [1, 2], 2);
  fillBlock(city, 12, 23, 13, 27, "industrial", rng, [1], 1);
  fillBlock(city, 15, 23, 16, 27, "residential", rng, [1, 2], 2);
  fillBlock(city, 18, 23, 19, 27, "residential", rng, [2, 3], 3);
  fillBlock(city, 21, 23, 22, 27, "industrial", rng, [1], 1);
  fillBlock(city, 24, 23, 25, 27, "industrial", rng, [1, 2], 2);

  // Row 4 (y=29..32)
  fillBlock(city, 9, 29, 10, 32, "commercial", rng, [1, 2], 2);
  fillBlock(city, 12, 29, 13, 32, "commercial", rng, [1], 1);
  fillBlock(city, 15, 29, 16, 32, "residential", rng, [1, 2], 2);
  fillBlock(city, 18, 29, 19, 32, "residential", rng, [1], 1);
  fillBlock(city, 21, 29, 22, 32, "commercial", rng, [1, 2], 2);
  fillBlock(city, 24, 29, 25, 32, "commercial", rng, [1], 1);

  // Parks
  const parkSpots = [
    [10,7],[12,7],[16,7],[18,7],[10,9],[12,9],[16,9],[18,9],
    [22,7],[24,7],[22,9],[24,9],
    [11,13],[17,13],[23,13],[11,19],[17,19],[23,19],
    [11,25],[17,25],[23,25],[11,31],[17,31],[23,31],
  ];
  for (const [px, py] of parkSpots) {
    const t = city.tiles[tidx(city.size, px, py)];
    if (t && t.type === "empty" && t.terrain !== "water") t.type = "park";
  }
}

// ── default city fields ───────────────────────────────────────
function defaultFields() {
  return {
    funding: { police: 100, fire: 100, health: 100, education: 100, transport: 100 },
    ordinances: { recycling: false, cleanAir: false, neighborhoodWatch: false },
    debt: 0,
    name: "New Riverton",
    _news: [],
    _prevStats: null,
  };
}

// ── public API ────────────────────────────────────────────────
export function createCity(seed = 42, starter = true) {
  seed = Number.isFinite(seed) ? seed >>> 0 : 42;
  const rng = lcg(seed);
  const size = 40;
  const tiles = generateTerrain(size, rng);

  const city = {
    size,
    tiles,
    money: 50000,
    month: 0,
    tax: 9,
    population: 0,
    happiness: 50,
    demand: { residential: 50, commercial: 20, industrial: 10 },
    history: [],
    seed,
    revision: 0,
    _rng: seed,
    ...defaultFields(),
  };

  if (starter) buildStarterCity(city, rng);

  updateInfrastructure(city);
  syncStats(city);
  return city;
}

export function tick(city) {
  city._rng = (Math.imul(1664525, city._rng) + 1013904223) >>> 0;
  const rng = lcg(city._rng);

  updateInfrastructure(city);
  updateGrowth(city, rng);
  updateInfrastructure(city);

  const stats = computeStats(city);

  // Generate news before overwriting _prevStats
  const news = generateNews(stats, city._prevStats, city);
  if (news.length) {
    city._news = [...(city._news || []), ...news].slice(-20);
  }

  city.population = stats.population;
  city.happiness = stats.happiness;
  city.demand = { ...stats.demand };
  city.money += stats.balance;

  // Reduce outstanding debt by payment made this month
  if (city.debt > 0 && stats.loanPayment > 0) {
    city.debt = Math.max(0, city.debt - stats.loanPayment);
  }

  city.month++;

  city.history.push({
    month: city.month,
    population: stats.population,
    money: city.money,
    happiness: stats.happiness,
    balance: stats.balance,
    debt: city.debt,
  });
  if (city.history.length > 240) city.history.shift();

  city._prevStats = {
    population: stats.population,
    crime: stats.crime,
    pollution: stats.pollution,
    balance: stats.balance,
    debt: city.debt,
  };

  city.revision++;
}

function finishPlacement(city, options) {
  if (options.deferRefresh) return;
  updateInfrastructure(city);
  city.revision++;
  syncStats(city);
}

export function place(city, x, y, tool, options = {}) {
  options = options ?? {};
  const density = options.density ?? 1;
  if (![1, 2, 3].includes(density)) return { ok: false, message: "Invalid density." };

  if (!inBounds(city.size, x, y))
    return { ok: false, message: "Out of map bounds." };
  if (!Object.hasOwn(TOOL_MAP, tool))
    return { ok: false, message: "Unknown construction tool." };

  const t = city.tiles[tidx(city.size, x, y)];

  // ── overlay tools (powerline / pipe) ─────────────────────────
  if (tool === "powerline" || tool === "pipe") {
    const field = tool === "powerline" ? "powerline" : "pipe";
    if (t.terrain === "water" && t.type !== "road")
      return { ok: false, message: "Cannot lay utility lines on water. Build a road bridge first." };
    if (t[field]) return { ok: true, message: "Already has this utility line." };
    const cost = TOOL_COST[tool];
    if (city.money < cost)
      return { ok: false, message: `Not enough funds. Need $${cost}, have $${city.money}.` };
    city.money -= cost;
    t[field] = true;
    finishPlacement(city, options);
    return { ok: true, message: `Laid ${tool} for $${cost}.` };
  }

  // ── inspect ───────────────────────────────────────────────────
  if (tool === "inspect") return { ok: true, message: "" };

  // ── bulldoze ──────────────────────────────────────────────────
  if (tool === "bulldoze") {
    const hasContent = t.type !== "empty" || t.powerline || t.pipe;
    if (!hasContent) return { ok: false, message: "Nothing to demolish here." };
    const refund = Math.floor((TOOL_COST[t.type] || 0) * 0.25);
    const fee = TOOL_COST.bulldoze;
    if (city.money + refund < fee)
      return { ok: false, message: `Demolition needs $${fee - refund} after salvage.` };
    t.type = "empty";
    t.level = 0;
    t.density = 1;
    t.powerline = false;
    t.pipe = false;
    city.money += refund - fee;
    finishPlacement(city, options);
    return { ok: true, message: `Demolished. $${fee} fee; $${refund} salvaged.` };
  }

  // ── same-zone noop / rezone ───────────────────────────────────
  if (ZONE_TYPES.has(tool) && t.type === tool) {
    const curDensity = t.density ?? 1;
    if (curDensity === density) return { ok: true, message: "Zone already set at this density." };
    // Preserve development when rezoning, within the new density cap.
    const cost = TOOL_COST[tool] * density;
    if (city.money < cost)
      return { ok: false, message: `Need $${cost} to rezone to density ${density}.` };
    city.money -= cost;
    t.density = density;
    t.level = Math.min(t.level, MAX_LEVEL_FOR_DENSITY[density]);
    finishPlacement(city, options);
    return { ok: true, message: `Rezoned to density ${density} for $${cost}.` };
  }

  // ── cannot build on occupied tile ────────────────────────────
  if (t.type !== "empty")
    return { ok: false, message: "Tile is already occupied. Bulldoze first." };

  // ── terrain restrictions ──────────────────────────────────────
  if (tool === "water" && t.terrain === "water")
    return { ok: false, message: "Place water tower on land, not water." };
  if (tool === "rail" && t.terrain === "water")
    return { ok: false, message: "Rail cannot cross water." };
  if (tool !== "road" && t.terrain === "water")
    return { ok: false, message: "Cannot build here on water. Roads can bridge water." };

  // ── cost calculation ──────────────────────────────────────────
  const baseCost = TOOL_COST[tool] ?? 0;
  const cost = ZONE_TYPES.has(tool) ? baseCost * density : baseCost;
  if (city.money < cost)
    return { ok: false, message: `Not enough funds. Need $${cost}, have $${city.money}.` };

  city.money -= cost;
  t.type = tool;
  t.level = 0;
  if (ZONE_TYPES.has(tool)) t.density = density;

  finishPlacement(city, options);
  return { ok: true, message: `Built ${TOOL_MAP[tool]?.label ?? tool} for $${cost}.` };
}

export function setPolicy(city, key, value) {
  if (typeof key !== "string") return { ok: false, message: "Invalid policy." };
  if (key === "loan") {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0)
      return { ok: false, message: "Loan amount must be a positive number." };
    if (amount + (city.debt || 0) > 100000)
      return { ok: false, message: "Maximum outstanding debt is $100,000." };
    city.money += amount;
    city.debt = (city.debt || 0) + amount;
    syncStats(city);
    return { ok: true, message: `Borrowed $${amount}. Total debt: $${city.debt}.` };
  }

  if (key === "repayLoan") {
    const amount = value === true ? city.debt : Number(value);
    if (!Number.isFinite(amount) || amount <= 0)
      return { ok: false, message: "Repayment amount must be positive." };
    if (!city.debt || city.debt <= 0)
      return { ok: false, message: "No outstanding debt." };
    const payment = Math.min(amount, city.debt, city.money);
    if (payment <= 0)
      return { ok: false, message: "Insufficient funds to repay loan." };
    city.money -= payment;
    city.debt = Math.max(0, city.debt - payment);
    syncStats(city);
    return { ok: true, message: `Repaid $${payment}. Remaining debt: $${city.debt}.` };
  }

  const [category, field] = key.split(".");

  if (category === "tax") {
    const valid = ["residential", "commercial", "industrial"];
    if (!valid.includes(field))
      return { ok: false, message: `Unknown tax type: ${field}.` };
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate < 1 || rate > 25)
      return { ok: false, message: "Tax rate must be between 1 and 25." };
    // Ensure city.taxes exists
    if (!city.taxes) city.taxes = getTaxRates(city);
    city.taxes[field] = rate;
    syncStats(city);
    return { ok: true, message: `${field} tax set to ${rate}%.` };
  }

  if (category === "funding") {
    const valid = ["police", "fire", "health", "education", "transport"];
    if (!valid.includes(field))
      return { ok: false, message: `Unknown funding type: ${field}.` };
    const pct = Number(value);
    if (!Number.isFinite(pct) || pct < 0 || pct > 150)
      return { ok: false, message: "Funding must be between 0 and 150%." };
    if (!city.funding) city.funding = { police: 100, fire: 100, health: 100, education: 100, transport: 100 };
    city.funding[field] = pct;
    updateInfrastructure(city);
    syncStats(city);
    city.revision++;
    return { ok: true, message: `${field} funding set to ${pct}%.` };
  }

  if (category === "ordinance") {
    const valid = ["recycling", "cleanAir", "neighborhoodWatch"];
    if (!valid.includes(field))
      return { ok: false, message: `Unknown ordinance: ${field}.` };
    const enabled = Boolean(value);
    if (!city.ordinances) city.ordinances = { recycling: false, cleanAir: false, neighborhoodWatch: false };
    city.ordinances[field] = enabled;
    updateInfrastructure(city);
    syncStats(city);
    city.revision++;
    return { ok: true, message: `Ordinance ${field} ${enabled ? "enabled" : "disabled"}.` };
  }

  return { ok: false, message: `Unknown policy key: ${key}.` };
}

export function getStats(city) {
  return computeStats(city);
}

function syncStats(city) {
  const stats = computeStats(city);
  city.population = stats.population;
  city.happiness = stats.happiness;
  city.demand = { ...stats.demand };
}

export function inspectTile(city, x, y) {
  if (!inBounds(city.size, x, y))
    return { title: "Out of bounds", description: "No tile here.", details: [] };

  const t = city.tiles[tidx(city.size, x, y)];
  const LABELS = {
    empty: "Empty land", road: "Road", rail: "Rail line",
    residential: "Residential zone", commercial: "Commercial zone", industrial: "Industrial zone",
    park: "Park", power: "Power plant", water: "Water tower",
    police: "Police station", fire: "Fire station",
    school: "School", hospital: "Hospital", landfill: "Landfill", bus: "Bus depot",
  };
  const title = LABELS[t.type] ?? t.type;
  let description = "";
  const details = [];

  if (t.type === "residential") {
    const p = t.level * 80;
    description = `Level ${t.level} housing (density ${t.density ?? 1}). ${p} residents.`;
    details.push(`Population: ${p}`, `Density: ${t.density ?? 1}`);
  } else if (t.type === "commercial") {
    const j = t.level * 50;
    description = `Level ${t.level} commerce (density ${t.density ?? 1}). ${j} workers employed.`;
    details.push(`Jobs: ${j}`, `Density: ${t.density ?? 1}`);
  } else if (t.type === "industrial") {
    const j = t.level * 70;
    description = `Level ${t.level} industry (density ${t.density ?? 1}). ${j} workers employed.`;
    details.push(`Jobs: ${j}`, `Density: ${t.density ?? 1}`);
  } else if (t.type === "power") {
    description = "Power plant. Supplies its network within 30 tiles.";
    details.push(`Output: ${POWER_CAPACITY} units`);
  } else if (t.type === "water") {
    description = "Water tower. Needs power; supplies its network within 25 tiles.";
    details.push(`Output: ${WATER_CAPACITY} units`);
  } else if (t.type === "road") {
    description = t.terrain === "water" ? "Bridge over water." : "Road connecting city zones.";
  } else if (t.type === "rail") {
    description = "Rail line. Reduces traffic, connects districts.";
  } else if (t.type === "park") {
    description = "Green space. Boosts citizen happiness nearby.";
  } else if (t.type === "police") {
    description = "Police station. Reduces crime in coverage area.";
  } else if (t.type === "fire") {
    description = "Fire station. Protects buildings in coverage area.";
  } else if (t.type === "school") {
    description = "School. Improves education in coverage area.";
  } else if (t.type === "hospital") {
    description = "Hospital. Improves health in coverage area.";
  } else if (t.type === "landfill") {
    description = "Landfill. Manages garbage for nearby zones.";
  } else if (t.type === "bus") {
    description = "Bus depot. Reduces traffic, improves transport.";
  } else {
    description = `Undeveloped ${t.terrain} terrain.`;
  }

  details.push(`Terrain: ${t.terrain}`);
  details.push(`Land value: ${t.landValue ?? 45}/100`);
  if (t.pollution) details.push(`Pollution: ${t.pollution}/100`);
  if (t.crime) details.push(`Crime: ${t.crime}/100`);
  if (t.traffic) details.push(`Traffic: ${t.traffic}/100`);
  if (t.type !== "empty" && t.type !== "road" && t.type !== "rail") {
    if (ZONE_TYPES.has(t.type))
      details.push(`Development level: ${t.level}/${MAX_LEVEL_FOR_DENSITY[t.density ?? 1]}`);
    details.push(`Power: ${t.powered ? "Connected" : "Not connected"}`);
    details.push(`Water: ${t.watered ? "Connected" : "Not connected"}`);
    details.push(`Road access: ${t.roadAccess ? "Yes" : "No"}`);
  }
  if (t.powerline) details.push("Has power line overlay");
  if (t.pipe) details.push("Has water pipe overlay");
  details.push(`Coords: (${x}, ${y})`);

  return { title, description, details };
}

// ── serialize / deserialize ───────────────────────────────────
export function serialize(city) {
  return JSON.stringify({
    size: city.size,
    tiles: city.tiles.map(({ x, y, terrain, type, level, density, variant, powered, watered, roadAccess, powerline, pipe }) => ({
      x, y, terrain, type, level, density: density ?? 1, variant, powered, watered, roadAccess,
      powerline: powerline ?? false, pipe: pipe ?? false,
    })),
    money: city.money,
    month: city.month,
    tax: city.tax,
    taxes: city.taxes ?? null,
    funding: city.funding ?? null,
    ordinances: city.ordinances ?? null,
    debt: city.debt ?? 0,
    name: city.name ?? "New Riverton",
    population: city.population,
    happiness: city.happiness,
    demand: { ...city.demand },
    history: city.history.slice(),
    seed: city.seed,
    revision: city.revision,
    _rng: city._rng,
    _news: city._news ?? [],
  });
}

export function deserialize(raw) {
  let d;
  try { d = JSON.parse(raw); } catch { throw new Error("Save file is corrupt: JSON parse failed."); }

  if (!d || typeof d !== "object" || d.size !== 40)
    throw new Error("Invalid save: bad size.");
  if (!Array.isArray(d.tiles) || d.tiles.length !== d.size * d.size)
    throw new Error("Invalid save: tile count mismatch.");
  if (!Number.isFinite(d.money))
    throw new Error("Invalid save: non-finite money.");
  if (!Number.isSafeInteger(d.month) || d.month < 0)
    throw new Error("Invalid save: bad month.");
  if (!Number.isFinite(d.tax) || d.tax < 1 || d.tax > 25)
    throw new Error("Invalid save: tax out of 1..25 range.");
  if (!d.demand || !["residential","commercial","industrial"].every(
    (key) => Number.isFinite(d.demand[key]) && Math.abs(d.demand[key]) <= 100))
    throw new Error("Invalid save: missing demand object.");
  for (const key of ["seed", "_rng"])
    if (!Number.isInteger(d[key]) || d[key] < 0 || d[key] > 4294967295)
      throw new Error(`Invalid save: bad ${key}.`);
  if (!Number.isSafeInteger(d.revision) || d.revision < 0)
    throw new Error("Invalid save: bad revision.");
  for (const [field, keys, min, max] of [
    ["taxes", ["residential", "commercial", "industrial"], 1, 25],
    ["funding", ["police", "fire", "health", "education", "transport"], 0, 150],
  ]) {
    if (d[field] != null && (typeof d[field] !== "object" || Array.isArray(d[field]) ||
      !keys.every(k => Number.isFinite(d[field][k]) && d[field][k] >= min && d[field][k] <= max)))
      throw new Error(`Invalid save: bad ${field}.`);
  }
  if (d.debt != null && (!Number.isFinite(d.debt) || d.debt < 0))
    throw new Error("Invalid save: bad debt.");
  if (d.name != null && (typeof d.name !== "string" || d.name.length > 40))
    throw new Error("Invalid save: bad city name.");
  if (d.ordinances != null && !["recycling", "cleanAir", "neighborhoodWatch"].every(k => typeof d.ordinances[k] === "boolean"))
    throw new Error("Invalid save: bad ordinances.");
  if (d._news != null && (!Array.isArray(d._news) || d._news.length > 20 || d._news.some(n => typeof n !== "string" || n.length > 500)))
    throw new Error("Invalid save: bad news.");
  if (!Number.isFinite(d.population) || d.population < 0 ||
      !Number.isFinite(d.happiness) || d.happiness < 0 || d.happiness > 100)
    throw new Error("Invalid save: bad population or happiness.");
  if (!Array.isArray(d.history) || d.history.length > 240 ||
    d.history.some((h) => !h || !Number.isSafeInteger(h.month) || h.month < 0 ||
      !Number.isFinite(h.money) || !Number.isFinite(h.population) || h.population < 0 ||
      !Number.isFinite(h.happiness) || h.happiness < 0 || h.happiness > 100))
    throw new Error("Invalid save: bad history.");

  for (let i = 0; i < d.tiles.length; i++) {
    const t = d.tiles[i];
    if (!t || t.x !== i % d.size || t.y !== Math.floor(i / d.size))
      throw new Error(`Invalid save: tile ${i} missing coords.`);
    if (!VALID_TERRAIN.has(t.terrain))
      throw new Error(`Invalid save: tile ${i} bad terrain "${t.terrain}".`);
    if (!VALID_TILE_TYPES.has(t.type))
      throw new Error(`Invalid save: tile ${i} bad type "${t.type}".`);
    if (!Number.isInteger(t.level) || t.level < 0 || t.level > 4 ||
        (!ZONE_TYPES.has(t.type) && t.level !== 0))
      throw new Error(`Invalid save: tile ${i} level out of range.`);
    if (!Number.isFinite(t.variant) || t.variant < 0 || t.variant > 1)
      throw new Error(`Invalid save: tile ${i} bad variant.`);
    if (t.density != null && ![1, 2, 3].includes(t.density))
      throw new Error(`Invalid save: tile ${i} bad density.`);
    for (const field of ["powerline", "pipe"])
      if (t[field] != null && typeof t[field] !== "boolean")
        throw new Error(`Invalid save: tile ${i} bad utility overlay.`);
    if (t.terrain === "water" && t.type !== "empty" && t.type !== "road")
      throw new Error(`Invalid save: tile ${i} built on water.`);
    if (!["powered","watered","roadAccess"].every((key) => typeof t[key] === "boolean"))
      throw new Error(`Invalid save: tile ${i} bad service flags.`);
  }

  const city = {
    size: d.size,
    tiles: d.tiles.map((t) => ({
      x: t.x, y: t.y,
      terrain: t.terrain,
      type: t.type,
      level: t.level,
      density: t.density ?? (t.level > 2 ? 3 : t.level > 1 ? 2 : 1),
      variant: t.variant,
      powered: Boolean(t.powered),
      watered: Boolean(t.watered),
      roadAccess: Boolean(t.roadAccess),
      // migrate: legacy saves get powerline/pipe on road tiles for compat
      powerline: t.powerline !== undefined ? Boolean(t.powerline) : t.type === "road",
      pipe: t.pipe !== undefined ? Boolean(t.pipe) : t.type === "road",
      pollution: t.pollution ?? 0,
      crime: t.crime ?? 0,
      traffic: t.traffic ?? 0,
      landValue: t.landValue ?? 45,
    })),
    money: d.money,
    month: d.month,
    tax: d.tax,
    taxes: d.taxes ?? null,
    funding: d.funding ?? { police: 100, fire: 100, health: 100, education: 100, transport: 100 },
    ordinances: d.ordinances ?? { recycling: false, cleanAir: false, neighborhoodWatch: false },
    debt: d.debt ?? 0,
    name: d.name ?? "New Riverton",
    population: d.population ?? 0,
    happiness: d.happiness ?? 50,
    demand: { residential: d.demand.residential, commercial: d.demand.commercial, industrial: d.demand.industrial },
    history: Array.isArray(d.history) ? d.history : [],
    seed: d.seed ?? 42,
    revision: d.revision ?? 0,
    _rng: d._rng ?? d.seed ?? 42,
    _news: d._news ?? [],
    _prevStats: null,
  };
  updateInfrastructure(city);
  syncStats(city);
  return city;
}
