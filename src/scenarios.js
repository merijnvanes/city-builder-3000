// Scenarios: a setup and a goal layered on top of the simulation.
import { setPolicy, disaster, refresh } from "./sim.js";
import { isAnchor, clearLot } from "./sim/lots.js";

export const SCENARIOS = {
  sandbox: { name: "Open city", description: "Build at your own pace. No deadline.", starter: false },
  growth: {
    name: "A town of your own", description: "Grow to 20,000 residents with a balanced budget within ten years.", starter: false, deadline: 120,
    won: (s) => s.population >= 20000 && s.balance >= 0,
  },
  boomtown: {
    name: "Boomtown", description: "Reach 50,000 residents within twenty years while keeping approval above 50%.", starter: true, deadline: 240,
    won: (s) => s.population >= 50000 && s.happiness >= 50,
  },
  recovery: {
    name: "Riverton renewal", description: "Inherit a struggling town: reach 60% approval and a positive monthly balance within five years.", starter: true, deadline: 60,
    won: (s) => s.happiness >= 60 && s.balance >= 0,
    setup(city) {
      city.money = 12000;
      setPolicy(city, "loan", 25000);
      city.money = 8000;
      for (const key of ["residential", "commercial", "industrial"]) city.taxes[key] = 11;
      city.funding.police = 40; city.funding.fire = 40; city.funding.education = 30;
      let n = 0;
      for (const t of city.tiles) if (isAnchor(t) && ["residential", "commercial"].includes(t.type) && t.level > 0 && (n++ % 5 === 0)) t.abandoned = true;
    },
  },
  cleanup: {
    name: "Smokestack City", description: "A factory town chokes on its own air. Bring residential pollution under 10% within eight years without going broke.", starter: true, deadline: 96,
    won: (s) => s.pollution < 10 && s.money > 0,
    setup(city) {
      city.money = 30000;
      // Heavy industry in the medium-density blocks, trees felled, clean-air rules off.
      let flipped = 0;
      for (const t of city.tiles) {
        if (t.trees && t.type === "empty") t.trees = 0;
        if (isAnchor(t) && t.type === "residential" && t.density === 2 && flipped < 14) {
          for (let y = t.lot.y; y < t.lot.y + t.lot.h; y++) for (let x = t.lot.x; x < t.lot.x + t.lot.w; x++) { const n = city.tiles[y * city.size + x]; n.type = "industrial"; n.density = 3; }
          t.level = 4; flipped++;
        }
      }
      city.ordinances.cleanAir = false;
    },
  },
  aftermath: {
    name: "After the quake", description: "An earthquake and fires have torn through town. Rebuild to the population you started with within five years.", starter: true, deadline: 60,
    won: (s, goal) => s.population >= goal.target,
    setup(city, goal) {
      goal.target = city.population;
      city.money = 15000;
      for (let i = 0; i < 4; i++) disaster(city, "earthquake");
      // Every fourth lot came down in the quake.
      let n = 0;
      for (const t of city.tiles) if (isAnchor(t) && ["residential", "commercial", "industrial"].includes(t.type) && t.level > 0 && (n++ % 4 === 0)) clearLot(city, t, { keepZone: true });
      disaster(city, "fire"); disaster(city, "fire"); disaster(city, "fire");
    },
  },
};

export function startScenario(city, id = "sandbox") {
  const def = SCENARIOS[id] || SCENARIOS.sandbox;
  if (!SCENARIOS[id]) id = "sandbox";
  city.scenario = { id, name: def.name, description: def.description, startMonth: city.month, deadline: def.deadline ?? null, status: "active" };
  if (def.setup) { def.setup(city, city.scenario); refresh(city); }
  return city;
}

export function updateScenario(city, stats) {
  const goal = city.scenario;
  const def = goal && SCENARIOS[goal.id];
  if (!goal || goal.status !== "active" || !def?.won) return null;
  if (def.won(stats, goal)) { goal.status = "won"; return `${goal.name} completed. Your city can keep growing.`; }
  if (goal.deadline != null && city.month - goal.startMonth >= goal.deadline) { goal.status = "missed"; return "The deadline passed. Continue improving your city in open play."; }
  return null;
}
