// Advisors and the news ticker. Messages come from the current stats.

export const ADVISORS = [
  { id: "finance",   name: "Constance Ledger", role: "Financial Advisor" },
  { id: "transport", name: "Moe Byway",        role: "Transportation Advisor" },
  { id: "planning",  name: "Randall Plott",    role: "City Planner" },
  { id: "utilities", name: "Gus Ampere",       role: "Utilities Advisor" },
  { id: "environment", name: "Karen Fielding", role: "Environmental Advisor" },
  { id: "safety",    name: "Chief Sam Ashby",  role: "Public Safety Advisor" },
  { id: "health",    name: "Dr. Marvin Kane",  role: "Health & Education Advisor" },
];

export function generateAdvisors(city, s) {
  const out = [];
  const say = (id, mood, message) => {
    const a = ADVISORS.find((x) => x.id === id);
    out.push({ ...a, mood, message });
  };
  const m = (n) => `$${Math.round(n).toLocaleString()}`;

  // Finance
  if (s.money < 0) say("finance", "bad", `We are ${m(-s.money)} in the red. Cut department funding or raise taxes before the city defaults.`);
  else if (s.balance < 0 && s.money < 5000) say("finance", "bad", `Monthly deficit of ${m(-s.balance)} with only ${m(s.money)} left. Act now.`);
  else if (s.balance < 0) say("finance", "warning", `We spend ${m(-s.balance)} more than we earn each month. Trim funding or grow the tax base.`);
  else if (s.debt > 40000) say("finance", "warning", `Debt stands at ${m(s.debt)}. Loan payments cost ${m(s.budget.expenses.loans)} a month.`);
  else if (s.money > 150000) say("finance", "good", `Reserves are ${m(s.money)}. Invest in services or lower taxes to spur growth.`);
  else say("finance", "good", `Budget is balanced with ${m(s.balance)} to spare each month.`);

  // Transportation
  if (s.unemployment > 25 && s.population > 500) say("transport", "bad", `${s.unemployment}% of workers cannot reach a job. Connect homes to workplaces by road.`);
  else if (s.congestion > 30) say("transport", "bad", `${s.congestion}% of roads are jammed. Add parallel routes, bus stops or rail.`);
  else if (s.traffic > 45) say("transport", "warning", "Traffic is getting heavy. Bus stops cut road load by a quarter.");
  else say("transport", "good", "Commutes are flowing. Keep roads connected as the city grows.");

  // Planning
  const d = s.demand;
  const top = Object.entries(d).sort((a, b) => b[1] - a[1])[0];
  if (s.abandonedLots > 5) say("planning", "bad", `${s.abandonedLots} buildings stand abandoned. Check power, water, road access and demand.`);
  else if (top[1] > 50) say("planning", "warning", `Strong ${top[0]} demand. Zone more ${top[0]} land near roads.`);
  else if (d.residential < -30) say("planning", "warning", "People are leaving. Cut residential taxes, add jobs and improve services.");
  else if (d.commercial < -30 || d.industrial < -30) say("planning", "warning", "Businesses see no customers. Residential growth drives commerce and industry.");
  else say("planning", "good", "Zoning is balanced. Mix densities as land value rises.");

  // Utilities
  const u = s.utilities;
  if (s.power < 60) say("utilities", "bad", `Only ${s.power}% of the city has power. Connect zones with power lines or add a plant.`);
  else if (u.power.demand > u.power.supply * 0.9 && u.power.supply > 0) say("utilities", "warning", `Power demand is ${Math.round(100 * u.power.demand / u.power.supply)}% of capacity. Build another plant soon.`);
  else if (s.water < 60 && s.population > 300) say("utilities", "bad", `Only ${s.water}% of dense zones have water. Lay pipes and add pumps near water.`);
  else if (u.water.demand > u.water.supply * 0.9 && u.water.supply > 0) say("utilities", "warning", "Water supply is nearly exhausted. Add pumps or a treatment plant.");
  else say("utilities", "good", "Power and water are keeping up with demand.");

  // Environment
  if (s.garbage > 40) say("environment", "bad", `${s.garbage}% of garbage is not collected. Zone a landfill or build an incinerator.`);
  else if (s.pollution > 45) say("environment", "bad", "Pollution is choking residential areas. Move industry downwind, plant trees, pass the Clean Air Act.");
  else if (s.pollution > 25) say("environment", "warning", "Air quality is slipping. Parks and trees help; keep industry away from homes.");
  else say("environment", "good", "The air is clean and parks are appreciated.");

  // Safety
  if (s.crime > 50) say("safety", "bad", "Crime is out of control. Build police stations and fund them fully.");
  else if (s.crime > 30) say("safety", "warning", "Crime is rising. Police coverage or a Neighborhood Watch would help.");
  else if (s.fireCover < 30 && s.population > 1000) say("safety", "warning", "Most homes are outside fire station coverage. One fire could spread far.");
  else say("safety", "good", "Streets are safe and fire crews are close by.");

  // Health & education
  if (s.health < 35 && s.population > 500) say("health", "bad", "Life expectancy is falling. Build a hospital and cut pollution.");
  else if (s.education < 35 && s.population > 500) say("health", "warning", "Education is weak. Schools raise land value and attract cleaner jobs.");
  else say("health", "good", "Residents are healthy and schools are within reach.");
  return out;
}

const FLAVOR = [
  "Local bakery wins regional pastry award.",
  "City council debates new bench designs for the riverside.",
  "Mayor cuts ribbon on refurbished playground.",
  "Weather service predicts a mild season ahead.",
  "Community garden reports record tomato harvest.",
  "Museum night draws crowds downtown.",
  "Marathon route announced; expect road closures Sunday.",
  "Library extends weekend hours.",
];

export function generateNews(city, s, prev) {
  const news = [];
  if (!prev) return news;
  const pop = s.population;
  for (const mark of [1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000]) {
    if (pop >= mark && prev.population < mark) news.push(`${city.name} passes ${mark.toLocaleString()} residents.`);
  }
  if (pop < prev.population * 0.9 && prev.population > 500) news.push(`Exodus: population falls to ${pop.toLocaleString()}.`);
  if (s.balance < 0 && prev.balance >= 0) news.push("City budget slips into deficit.");
  if (s.balance >= 0 && prev.balance < 0) news.push("Budget back in the black.");
  if (s.money < 0 && prev.money >= 0) news.push("Treasury empty: city is borrowing to pay its bills.");
  if (s.crime > 50 && prev.crime <= 50) news.push("Crime wave: residents demand more police.");
  if (s.crime < 20 && prev.crime >= 20 && pop > 500) news.push("Crime hits a record low.");
  if (s.pollution > 45 && prev.pollution <= 45) news.push("Smog alert issued for residential districts.");
  if (s.garbage > 30 && prev.garbage <= 30) news.push("Trash piles up: sanitation capacity exceeded.");
  if (s.power < 70 && prev.power >= 70) news.push("Brownouts reported across the city.");
  if (s.unemployment > 20 && prev.unemployment <= 20 && pop > 500) news.push("Unemployment tops 20%.");
  if (s.abandonedLots > prev.abandonedLots + 3) news.push("Buildings abandoned as residents move away.");
  if (news.length === 0 && city.month % 7 === 3) news.push(FLAVOR[(city.month * 31 + city.seed) % FLAVOR.length]);
  return news;
}
