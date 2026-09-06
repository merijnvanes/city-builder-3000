// Scenarios: goals layered on top of the simulation.
import { setPolicy } from "./sim.js";
import { isAnchor } from "./sim/lots.js";

export const SCENARIOS = {
  sandbox:  { name: "Open city",         description: "Build at your own pace. No deadline." },
  growth:   { name: "A town of your own", description: "Grow to 20,000 residents with a balanced budget within ten years." },
  recovery: { name: "Riverton renewal",  description: "Inherit a struggling town: reach 60% approval and a positive monthly balance within five years." },
};

export function startScenario(city, id = "sandbox") {
  if (!SCENARIOS[id]) id = "sandbox";
  city.scenario = { id, name: SCENARIOS[id].name, description: SCENARIOS[id].description, startMonth: city.month, deadline: id === "growth" ? 120 : id === "recovery" ? 60 : null, status: "active" };
  if (id === "recovery") {
    city.money = 12000;
    setPolicy(city, "loan", 25000);
    city.money = 8000;
    for (const key of ["residential", "commercial", "industrial"]) city.taxes[key] = 11;
    city.funding.police = 40; city.funding.fire = 40; city.funding.education = 30;
    let n = 0;
    for (const t of city.tiles) if (isAnchor(t) && ["residential", "commercial"].includes(t.type) && t.level > 0 && (n++ % 5 === 0)) t.abandoned = true;
    city.revision++;
  }
  return city;
}

export function updateScenario(city, stats) {
  const goal = city.scenario;
  if (!goal || goal.status !== "active" || goal.id === "sandbox") return null;
  const won = goal.id === "growth" ? stats.population >= 20000 && stats.balance >= 0 : stats.happiness >= 60 && stats.balance >= 0;
  if (won) { goal.status = "won"; return `${goal.name} completed. Your city can keep growing.`; }
  if (city.month - goal.startMonth >= goal.deadline) { goal.status = "missed"; return "The deadline passed. Continue improving your city in open play."; }
  return null;
}
