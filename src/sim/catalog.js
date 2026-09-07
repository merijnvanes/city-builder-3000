// Building and tool catalog. One table drives placement, cost, upkeep,
// utilities, services and art. No browser deps.

export const ZONE_TYPES = new Set(["residential", "commercial", "industrial"]);
export const ROAD_TYPES = new Set(["road", "rail", "highway"]);
// Lots get road access from these; highways need a road to reach a lot.
export const ACCESS_TYPES = new Set(["road", "rail"]);
export const OVERLAY_TOOLS = new Set(["powerline", "pipe", "subway"]);

// Zone cost per tile scales with density. Density 1 = low, 2 = medium, 3 = high.
export const ZONE_COST = { residential: [0, 10, 25, 50], commercial: [0, 10, 25, 50], industrial: [0, 10, 25, 50] };

// Lot sizes a zone density can form, largest first. Low-density industry
// spreads into 3×3 farms when it has the room.
export const LOT_SIZES = { 1: [1], 2: [2, 1], 3: [3, 2, 1] };
export const LOT_SIZES_BY_TYPE = { industrial: { 1: [3, 1], 2: [2, 1], 3: [3, 2, 1] } };

// First year a technology is available. Anything unlisted is always there.
export const TECH_YEAR = {
  // Power plant years are the manual's, page 38-39.
  coal: 1900, oil: 1900, gas: 1955, nuclear: 1965, wind: 1980, solar: 1990, microwave: 2020, fusion: 2050,
  highway: 1940, subway: 1920, substation: 1920,
  treatment: 1935, desalination: 1960, incinerator: 1920, recycling: 1970, wasteenergy: 2000,
  airport: 1930, railstation: 1900, bus: 1920,
  college: 1900, hospital: 1900, museum: 1900, zoo: 1900, casino: 1930, toxicdump: 1960, prison: 1900, armybase: 1900, jail: 1900,
};

// Residents or jobs per tile per development level (levels 1..4 scale by level/4).
export const CAPACITY = {
  residential: [0, 40, 120, 320],
  commercial:  [0, 24, 100, 300],
  industrial:  [0, 28, 70, 140],
};

// Power and water draw per tile per level, by zone type.
export const DRAW = {
  residential: { power: 1.0, water: 1.0 },
  commercial:  { power: 1.5, water: 1.0 },
  industrial:  { power: 3.0, water: 2.0 },
};

// Building catalog. w/h are footprint sizes. upkeep is monthly and goes into
// the department named by dept. service = { kind, radius, strength }.
// capacity = { kind, seats }: how many students or patients the building can
// take, which caps education and health however wide its coverage reaches.
export const BUILDINGS = {
  road:        { label: "Road",            group: "transport", cost: 10,   w: 1, h: 1, upkeep: 0.5, dept: "transport", path: true, water: true },
  rail:        { label: "Rail",            group: "transport", cost: 25,   w: 1, h: 1, upkeep: 1,   dept: "transport", path: true },
  highway:     { label: "Highway",         group: "transport", cost: 60,   w: 1, h: 1, upkeep: 2,   dept: "transport", path: true, water: true },
  bus:         { label: "Bus Stop",        group: "transport", cost: 150,  w: 1, h: 1, upkeep: 5,   dept: "transport", service: { kind: "bus", radius: 8 }, powerUse: 1 },
  railstation: { label: "Rail Station",    group: "transport", cost: 500,  w: 2, h: 2, upkeep: 15,  dept: "transport", service: { kind: "rail", radius: 10 }, powerUse: 4 },
  subway:      { label: "Subway",          group: "transport", cost: 40,   w: 1, h: 1, upkeep: 1,   dept: "transport", path: true, overlay: true, underground: true },
  substation:  { label: "Subway Station",  group: "transport", cost: 400,  w: 1, h: 1, upkeep: 12,  dept: "transport", service: { kind: "rail", radius: 8 }, powerUse: 3 },
  airport:     { label: "Airport",         group: "transport", cost: 10000, w: 6, h: 5, upkeep: 200, dept: "transport", unique: true, effects: { jobs: 500, traffic: 40, pollution: 25, radius: 8, demand: { commercial: 18 } }, powerUse: 12, waterUse: 6 },
  seaport:     { label: "Seaport",         group: "transport", cost: 5000, w: 4, h: 4, upkeep: 120, dept: "transport", unique: true, requiresWater: true, effects: { jobs: 350, traffic: 25, pollution: 15, radius: 6, demand: { industrial: 18 } }, powerUse: 8, waterUse: 4 },

  // lifespan is in years: a plant runs at full output for the first 55% of it,
  // then slides to 35% of nameplate capacity. Query one to see the gap.
  coal:        { label: "Coal Plant",      group: "utilities", cost: 4000,  w: 4, h: 4, upkeep: 180, dept: "utilities", powerOut: 6000,  pollution: 60, lifespan: 50 },
  oil:         { label: "Oil Plant",       group: "utilities", cost: 6600,  w: 4, h: 4, upkeep: 220, dept: "utilities", powerOut: 7000,  pollution: 40, lifespan: 50 },
  gas:         { label: "Gas Plant",       group: "utilities", cost: 3000,  w: 3, h: 3, upkeep: 120, dept: "utilities", powerOut: 3000,  pollution: 18, lifespan: 50 },
  nuclear:     { label: "Nuclear Plant",   group: "utilities", cost: 15000, w: 4, h: 4, upkeep: 420, dept: "utilities", powerOut: 16000, pollution: 0,  lifespan: 60 },
  wind:        { label: "Wind Turbine",    group: "utilities", cost: 500,   w: 1, h: 1, upkeep: 8,   dept: "utilities", powerOut: 200,   pollution: 0,  lifespan: 35, hilltop: true },
  solar:       { label: "Solar Array",     group: "utilities", cost: 1300,  w: 3, h: 3, upkeep: 15,  dept: "utilities", powerOut: 1000,  pollution: 0,  lifespan: 40 },
  microwave:   { label: "Microwave Plant", group: "utilities", cost: 28000, w: 4, h: 4, upkeep: 300, dept: "utilities", powerOut: 22000, pollution: 6,  lifespan: 60 },
  fusion:      { label: "Fusion Plant",    group: "utilities", cost: 40000, w: 4, h: 4, upkeep: 500, dept: "utilities", powerOut: 45000, pollution: 0,  lifespan: 80 },
  powerline:   { label: "Power Line",      group: "utilities", cost: 5,     w: 1, h: 1, upkeep: 0,   dept: "utilities", path: true, overlay: true, water: true },
  // source: which water the pump can draw from. A tower needs none - it draws
  // on underground springs, so it works anywhere but yields little.
  // pollutionSensitivity: how much dirty water slows it down.
  waterpump:   { label: "Water Pump",      group: "utilities", cost: 150,   w: 1, h: 1, upkeep: 12,  dept: "utilities", waterOut: 2500, source: "fresh", nearWater: true, pollutionSensitivity: 0.7, lifespan: 45, powerUse: 2 },
  watertower:  { label: "Water Tower",     group: "utilities", cost: 100,   w: 1, h: 1, upkeep: 5,   dept: "utilities", waterOut: 600, pollutionSensitivity: 0.45, lifespan: 40, powerUse: 1 },
  desalination:{ label: "Desalinization Plant", group: "utilities", cost: 6000, w: 3, h: 3, upkeep: 220, dept: "utilities", waterOut: 1800, source: "salt", nearWater: true, pollutionSensitivity: 0.3, lifespan: 45, powerUse: 10 },
  treatment:   { label: "Water Treatment", group: "utilities", cost: 5000,  w: 3, h: 3, upkeep: 120, dept: "utilities", powerUse: 8, cleansWater: true, pollution: 4 },
  pipe:        { label: "Water Pipe",      group: "utilities", cost: 5,     w: 1, h: 1, upkeep: 0,   dept: "utilities", path: true, overlay: true, water: true },

  // Precincts and fire coverage are additive where they overlap, and their
  // radius grows with the department budget, as the manual describes.
  police:      { label: "Police Station",  group: "civic", cost: 500,  w: 3, h: 3, upkeep: 90,  dept: "police",    service: { kind: "police", radius: 12, strength: 100, additive: true }, powerUse: 3, waterUse: 2 },
  fire:        { label: "Fire Station",    group: "civic", cost: 500,  w: 3, h: 3, upkeep: 90,  dept: "fire",      service: { kind: "fire", radius: 12, strength: 100, additive: true, maxRadius: 16 }, powerUse: 3, waterUse: 2 },
  // "If you do not have enough jails in your city, the police will be forced
  // to release any new criminals they catch back onto the street."
  jail:        { label: "Jail",            group: "civic", cost: 800,  w: 3, h: 3, upkeep: 110, dept: "police",    cells: 400, effects: { crime: 6, radius: 6, landValue: -6 }, powerUse: 3, waterUse: 2 },
  hospital:    { label: "Hospital",        group: "civic", cost: 600,  w: 3, h: 3, upkeep: 150, dept: "health",    service: { kind: "health", radius: 14, strength: 100 }, capacity: { kind: "hospital", seats: 12000 }, powerUse: 6, waterUse: 4 },
  school:      { label: "School",          group: "civic", cost: 250,  w: 3, h: 3, upkeep: 70,  dept: "education", service: { kind: "education", radius: 12, strength: 80 }, capacity: { kind: "school", seats: 1500 }, powerUse: 3, waterUse: 2 },
  college:     { label: "College",         group: "civic", cost: 1000, w: 4, h: 4, upkeep: 140, dept: "education", service: { kind: "education", radius: 18, strength: 100 }, capacity: { kind: "college", seats: 5000 }, powerUse: 6, waterUse: 4 },
  library:     { label: "Library",         group: "civic", cost: 500,  w: 2, h: 2, upkeep: 30,  dept: "education", service: { kind: "education", radius: 8, strength: 40 }, powerUse: 2, waterUse: 1 },
  museum:      { label: "Museum",          group: "civic", cost: 1000, w: 3, h: 3, upkeep: 45,  dept: "education", service: { kind: "culture", radius: 10, strength: 60 }, powerUse: 3, waterUse: 1 },
  // A landfill stores rather than processes: "Each tile of landfill can hold
  // up to a certain amount of trash", and it decomposes slowly. Incinerators
  // and recycling centres have a monthly throughput instead, and both lose
  // efficiency as they age.
  landfill:    { label: "Landfill",        group: "civic", cost: 20,   w: 1, h: 1, upkeep: 2,   dept: "sanitation", hold: 5000, rect: true, pollution: 10 },
  incinerator: { label: "Incinerator",     group: "civic", cost: 3000, w: 3, h: 3, upkeep: 90,  dept: "sanitation", garbage: 900, pollution: 35, powerUse: 5, lifespan: 45 },
  recycling:   { label: "Recycling Center",group: "civic", cost: 1500, w: 3, h: 3, upkeep: 50,  dept: "sanitation", recycles: 400, powerUse: 3, lifespan: 45 },
  wasteenergy: { label: "Waste-to-Energy Plant", group: "civic", cost: 9000, w: 3, h: 3, upkeep: 180, dept: "sanitation", garbage: 1400, pollution: 22, powerOut: 2200, lifespan: 45 },

  park:        { label: "Small Park",      group: "landscape", cost: 20,   w: 1, h: 1, upkeep: 1,   dept: "parks", service: { kind: "park", radius: 4, strength: 30 }, rect: true },
  largepark:   { label: "Large Park",      group: "landscape", cost: 200,  w: 3, h: 3, upkeep: 8,   dept: "parks", service: { kind: "park", radius: 7, strength: 60 } },
  zoo:         { label: "Zoo",             group: "landscape", cost: 3000, w: 4, h: 4, upkeep: 70,  dept: "parks", service: { kind: "park", radius: 10, strength: 90 }, powerUse: 3, waterUse: 3 },
  tree:        { label: "Plant Trees",     group: "landscape", cost: 3,    w: 1, h: 1, upkeep: 0,   dept: "parks", rect: true, overlay: true },
  dispatch:    { label: "Fire Crew",       group: "emergency", cost: 300,  w: 1, h: 1, upkeep: 0,   dept: "fire", emergency: true },
  makewater:   { label: "Dig Water",       group: "landscape", cost: 120,  w: 1, h: 1, upkeep: 0,   dept: "parks", rect: true, terrain: "water" },
  makeland:    { label: "Fill Land",       group: "landscape", cost: 180,  w: 1, h: 1, upkeep: 0,   dept: "parks", rect: true, terrain: "land" },
  raise:       { label: "Raise Terrain",   group: "landscape", cost: 25,   w: 1, h: 1, upkeep: 0,   dept: "parks", rect: true, terrain: "raise" },
  lower:       { label: "Lower Terrain",   group: "landscape", cost: 25,   w: 1, h: 1, upkeep: 0,   dept: "parks", rect: true, terrain: "lower" },
  level:       { label: "Level Terrain",   group: "landscape", cost: 20,   w: 1, h: 1, upkeep: 0,   dept: "parks", rect: true, terrain: "level" },

  // Rewards: unlocked once the city reaches a population milestone. One each.
  mayorhouse:  { label: "Mayor's House",   group: "special", cost: 0,    w: 2, h: 2, upkeep: 15,  dept: "parks", unique: true, reward: { population: 2000 },  service: { kind: "culture", radius: 6, strength: 40 }, effects: { landValue: 8, radius: 6 } },
  cityhall:    { label: "City Hall",       group: "special", cost: 0,    w: 3, h: 3, upkeep: 60,  dept: "parks", unique: true, reward: { population: 10000 }, service: { kind: "culture", radius: 10, strength: 60 }, effects: { landValue: 10, radius: 8, happiness: 3 } },
  courthouse:  { label: "Courthouse",      group: "special", cost: 0,    w: 3, h: 3, upkeep: 70,  dept: "police", unique: true, reward: { population: 25000 }, service: { kind: "police", radius: 16, strength: 60 }, effects: { happiness: 2 } },
  stadium:     { label: "Stadium",         group: "special", cost: 0,    w: 5, h: 5, upkeep: 150, dept: "parks", unique: true, reward: { population: 40000 }, service: { kind: "park", radius: 14, strength: 80 }, effects: { happiness: 5, jobs: 300, traffic: 30 }, powerUse: 10, waterUse: 6 },
  statue:      { label: "Mayor's Statue",  group: "special", cost: 0,    w: 1, h: 1, upkeep: 5,   dept: "parks", unique: true, reward: { population: 60000 }, service: { kind: "park", radius: 5, strength: 50 }, effects: { happiness: 2 } },
  marina:      { label: "Marina",          group: "special", cost: 0,    w: 3, h: 3, upkeep: 40,  dept: "parks", unique: true, requiresWater: true, reward: { population: 15000 }, service: { kind: "park", radius: 10, strength: 70 }, effects: { landValue: 8, radius: 8, demand: { commercial: 4 }, jobs: 60 }, powerUse: 2, waterUse: 1 },
  university:  { label: "University",      group: "special", cost: 0,    w: 4, h: 4, upkeep: 160, dept: "education", unique: true, reward: { population: 30000 }, service: { kind: "education", radius: 22, strength: 110 }, capacity: { kind: "college", seats: 12000 }, effects: { landValue: 6, radius: 8, jobs: 200, demand: { commercial: 4 } }, powerUse: 8, waterUse: 5 },
  medcenter:   { label: "Medical Research Center", group: "special", cost: 0, w: 4, h: 4, upkeep: 180, dept: "health", unique: true, reward: { population: 50000 }, service: { kind: "health", radius: 20, strength: 120 }, capacity: { kind: "hospital", seats: 30000 }, effects: { jobs: 250, happiness: 2 }, powerUse: 8, waterUse: 6 },

  // Landmarks: pricey showpieces that lift land value, culture and tourism.
  clocktower:  { label: "Clock Tower",     group: "landmark", cost: 8000,  w: 2, h: 2, upkeep: 30,  dept: "parks", unique: true, service: { kind: "culture", radius: 8, strength: 70 }, effects: { landValue: 10, radius: 7, demand: { commercial: 3 } }, powerUse: 2 },
  operahouse:  { label: "Opera House",     group: "landmark", cost: 12000, w: 3, h: 3, upkeep: 70,  dept: "parks", unique: true, service: { kind: "culture", radius: 12, strength: 100 }, effects: { landValue: 14, radius: 9, demand: { commercial: 6 }, jobs: 120, traffic: 15 }, powerUse: 6, waterUse: 3 },
  observatory: { label: "Observatory",     group: "landmark", cost: 6000,  w: 2, h: 2, upkeep: 30,  dept: "education", unique: true, service: { kind: "education", radius: 12, strength: 60 }, effects: { landValue: 8, radius: 6 }, powerUse: 3 },
  cathedral:   { label: "Cathedral",       group: "landmark", cost: 10000, w: 3, h: 3, upkeep: 40,  dept: "parks", unique: true, service: { kind: "culture", radius: 12, strength: 90 }, effects: { landValue: 12, radius: 9, happiness: 2, demand: { commercial: 3 } }, powerUse: 2 },
  aquarium:    { label: "Aquarium",        group: "landmark", cost: 9000,  w: 3, h: 3, upkeep: 60,  dept: "parks", unique: true, requiresWater: true, service: { kind: "park", radius: 10, strength: 80 }, effects: { landValue: 10, radius: 8, demand: { commercial: 5 }, jobs: 80 }, powerUse: 5, waterUse: 6 },

  // Business deals: offered by petitioners; pay monthly but cost the city otherwise.
  prison:      { label: "Maximum Security Prison", group: "special", cost: 0, w: 4, h: 4, upkeep: 0, dept: "police", unique: true, offer: { income: 600 }, cells: 1200, effects: { crime: 18, radius: 10, landValue: -12, jobs: 120 }, powerUse: 6, waterUse: 4 },
  casino:      { label: "Casino",          group: "special", cost: 0,    w: 3, h: 3, upkeep: 0,   dept: "parks", unique: true, offer: { income: 450 }, effects: { crime: 10, radius: 8, jobs: 200, traffic: 20, happiness: -1 }, powerUse: 6, waterUse: 3 },
  toxicdump:   { label: "Toxic Waste Dump", group: "special", cost: 0,   w: 3, h: 3, upkeep: 0,   dept: "sanitation", unique: true, offer: { income: 550 }, effects: { pollution: 55, radius: 9, landValue: -15, jobs: 30 }, garbage: 200 },
  armybase:    { label: "Army Base",       group: "special", cost: 0,    w: 5, h: 5, upkeep: 0,   dept: "police", unique: true, offer: { income: 350 }, effects: { crime: 6, radius: 8, pollution: 12, jobs: 400, landValue: -5 }, powerUse: 8, waterUse: 6 },
  gigamall:    { label: "Gigamall",        group: "special", cost: 0,    w: 4, h: 4, upkeep: 0,   dept: "parks", unique: true, offer: { income: 400 }, effects: { jobs: 350, traffic: 35, radius: 8, landValue: -4, demand: { commercial: -6 } }, powerUse: 8, waterUse: 4 },
};

export const SPECIAL_TYPES = Object.entries(BUILDINGS).filter(([, b]) => b.reward || b.offer).map(([id]) => id);

export const DEPARTMENTS = ["police", "fire", "health", "education", "transport", "utilities", "sanitation", "parks"];
export const FUNDED_DEPARTMENTS = ["police", "fire", "health", "education", "transport", "sanitation"];

// Tools shown in the UI. Zones and demolition are not buildings.
export const TOOLS = [
  { id: "inspect",     label: "Inspect",        cost: 0,  group: "inspect",   description: "Query any tile", shortcut: "i" },
  { id: "residential", label: "Residential",    cost: 10, group: "zone",      description: "Zone residential ($10-50 per tile by density)", shortcut: "z" },
  { id: "commercial",  label: "Commercial",     cost: 10, group: "zone",      description: "Zone commercial ($10-50 per tile by density)", shortcut: "c" },
  { id: "industrial",  label: "Industrial",     cost: 10, group: "zone",      description: "Zone industrial ($10-50 per tile by density)", shortcut: "n" },
  ...Object.entries(BUILDINGS).map(([id, b]) => ({
    id, label: b.label, cost: b.cost, group: b.group,
    description: `${b.label} ($${b.cost.toLocaleString()}${b.path || b.rect ? " per tile" : ""}${b.w > 1 ? `, ${b.w}×${b.h}` : ""})`,
    shortcut: { road: "r", rail: "t", highway: "y", coal: "e", waterpump: "u", police: "l", fire: "f", park: "p", powerline: "w", pipe: "q", dispatch: "x" }[id] || "",
    w: b.w, h: b.h,
  })),
  { id: "bulldoze",    label: "Bulldoze",       cost: 5,  group: "demolish",  description: "Demolish ($5 per tile plus building fee)", shortcut: "b" },
];

export const TOOL_MAP = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
export const LEVEL_FEE = 10; // per tile flattened under a new building

export function isZone(type) { return ZONE_TYPES.has(type); }
export function building(type) { return BUILDINGS[type] || null; }
