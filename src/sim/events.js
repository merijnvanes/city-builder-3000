// Rewards, business deals and citizen petitions.
//
// Rewards unlock a unique building when the city reaches a population
// milestone. Business deals arrive from petitioners: accept to unlock a
// money-making building with side effects, or decline. Citizen petitions ask
// for a policy change. Open petitions wait for the player's answer.
import { BUILDINGS, SPECIAL_TYPES } from "./catalog.js";
import { isAnchor } from "./lots.js";

export const OFFER_MONTHS = 12;       // months an accepted deal waits to be built
export const PETITION_MONTHS = 6;     // months a petition stays open

export const PETITIONS = {
  prison:    { title: "Prison Board proposal", body: "The State Prison Board wants to build a maximum security prison in your city. They will pay $600 a month. Neighbours worry about crime and land value.", accept: "Accept the prison", decline: "Decline" },
  casino:    { title: "Casino consortium", body: "A gaming consortium offers $450 a month to run a casino. Expect jobs, traffic and a little more crime.", accept: "Welcome the casino", decline: "Decline" },
  toxicdump: { title: "Waste contractor", body: "A contractor will pay $550 a month to store toxic waste here. Pollution will spread for miles.", accept: "Take the money", decline: "Decline" },
  armybase:  { title: "Army base", body: "The army wants land for a base. It brings $350 a month and 400 jobs, plus some crime and noise.", accept: "Host the base", decline: "Decline" },
  gigamall:  { title: "Gigamall developers", body: "A retail giant offers $400 a month to build a Gigamall: 350 jobs and heavy traffic, and the small shops nearby will suffer.", accept: "Approve the Gigamall", decline: "Decline" },
  taxcut:    { title: "Taxpayers' petition", body: "Residents petition for a 1% cut in residential tax. Approval would rise; income would fall.", accept: "Cut residential tax", decline: "Refuse" },
  comtaxcut: { title: "Chamber of Commerce", body: "Shop owners petition for a 1% cut in commercial tax to bring customers back downtown.", accept: "Cut commercial tax", decline: "Refuse" },
  cleanair:  { title: "Environmental league", body: "The Environmental League asks you to pass the Clean Air Act. Industry will grumble.", accept: "Pass the act", decline: "Refuse" },
  repealair: { title: "Industrial council", body: "Factory owners say the Clean Air Act is driving industry out of town. They want it repealed.", accept: "Repeal the act", decline: "Refuse" },
  curfew:    { title: "Parents' association", body: "Parents ask for a youth curfew to cut crime. Teenagers will not thank you.", accept: "Impose curfew", decline: "Refuse" },
  teachers:  { title: "Teachers' union", body: "Teachers ask you to restore full funding to education. Class sizes are growing.", accept: "Fund education fully", decline: "Refuse" },
  firefighters: { title: "Firefighters' union", body: "Firefighters warn that budget cuts leave engines idle. They ask for full fire funding.", accept: "Fund fire fully", decline: "Refuse" },
  gamblingAct: { title: "Tourism board", body: "The tourism board asks you to legalize gambling. It earns $0.05 per resident a month but raises crime.", accept: "Legalize gambling", decline: "Refuse" },
  carpoolAct: { title: "Commuters' alliance", body: "Commuters stuck in traffic ask for a carpool incentive to thin out the rush hour.", accept: "Pass the incentive", decline: "Refuse" },
  recyclingAct: { title: "Green council", body: "With the landfills filling up, the Green Council asks for a city recycling program.", accept: "Start recycling", decline: "Refuse" },
};

export function ensureEvents(city) {
  if (!city.unlocked) city.unlocked = {};
  if (!city.petitions) city.petitions = [];
  if (!city.settings) city.settings = { yearEndBudget: true };
  return city;
}

function hasBuilding(city, type) {
  return city.tiles.some((t) => isAnchor(t) && t.type === type);
}

export function specialAvailable(city, type) {
  const b = BUILDINGS[type];
  if (!b || (!b.reward && !b.offer)) return true;
  if (!city.unlocked || !(type in city.unlocked)) return false;
  return !(b.unique && hasBuilding(city, type));
}

// Called once a month. Returns news lines.
export function updateEvents(city, stats, rng) {
  ensureEvents(city);
  const news = [];
  const month = city.month;

  // Rewards by population.
  for (const type of SPECIAL_TYPES) {
    const b = BUILDINGS[type];
    if (!b.reward || type in city.unlocked) continue;
    if (stats.population >= b.reward.population) {
      city.unlocked[type] = month;
      news.push(`${city.name} reaches ${b.reward.population.toLocaleString()} residents: the ${b.label} is yours to place.`);
    }
  }

  // Expire stale petitions and accepted deals that were never built.
  for (const p of city.petitions) {
    if (p.status === "open" && month >= p.expires) { p.status = "expired"; news.push(`${PETITIONS[p.id].title} withdrawn.`); }
    if (p.status === "accepted" && BUILDINGS[p.id]?.offer && !hasBuilding(city, p.id) && month >= p.buildBy) {
      p.status = "expired"; delete city.unlocked[p.id];
      news.push(`${BUILDINGS[p.id].label} deal fell through: no site was provided in time.`);
    }
  }
  city.petitions = city.petitions.filter((p) => p.status === "open" || p.status === "accepted" || month - (p.decidedAt || p.expires) < 240);

  // New petitions arrive now and then, one at a time.
  if (city.petitions.some((p) => p.status === "open")) return news;
  if (month < 12 || stats.population < 500) return news;
  const candidates = [];
  const recently = (id) => city.petitions.some((p) => p.id === id && month - (p.decidedAt ?? p.expires) < 120);
  for (const type of ["prison", "casino", "toxicdump", "armybase", "gigamall"]) {
    if (type in city.unlocked || recently(type) || hasBuilding(city, type)) continue;
    if (type === "gigamall" && stats.population < 8000) continue;
    candidates.push({ id: type, weight: stats.money < 15000 || stats.balance < 0 ? 3 : 1 });
  }
  const demand = stats.demand || {};
  const funding = city.funding || {};
  if (!recently("taxcut") && city.taxes.residential >= 7 && stats.happiness < 60) candidates.push({ id: "taxcut", weight: 2 });
  if (!recently("comtaxcut") && city.taxes.commercial >= 7 && (demand.commercial ?? 0) < 0) candidates.push({ id: "comtaxcut", weight: 2 });
  if (!recently("cleanair") && !city.ordinances.cleanAir && stats.pollution > 25) candidates.push({ id: "cleanair", weight: 2 });
  if (!recently("repealair") && city.ordinances.cleanAir && (demand.industrial ?? 0) < 0) candidates.push({ id: "repealair", weight: 2 });
  if (!recently("curfew") && !city.ordinances.youthCurfew && stats.crime > 35) candidates.push({ id: "curfew", weight: 2 });
  if (!recently("teachers") && (funding.education ?? 100) < 80) candidates.push({ id: "teachers", weight: 2 });
  if (!recently("firefighters") && (funding.fire ?? 100) < 80) candidates.push({ id: "firefighters", weight: 2 });
  if (!recently("gamblingAct") && !city.ordinances.gambling && stats.balance < 0) candidates.push({ id: "gamblingAct", weight: 2 });
  if (!recently("carpoolAct") && !city.ordinances.carpool && (stats.traffic ?? 0) > 40) candidates.push({ id: "carpoolAct", weight: 2 });
  if (!recently("recyclingAct") && !city.ordinances.recycling && (stats.garbage ?? 0) > 30) candidates.push({ id: "recyclingAct", weight: 2 });
  if (!candidates.length) return news;
  const chance = 0.06 + (stats.money < 10000 ? 0.06 : 0);
  if (rng() > chance) return news;
  const total = candidates.reduce((s, c) => s + c.weight, 0);
  let roll = rng() * total;
  let pick = candidates[0];
  for (const c of candidates) { roll -= c.weight; if (roll <= 0) { pick = c; break; } }
  city.petitions.push({ id: pick.id, status: "open", since: month, expires: month + PETITION_MONTHS });
  news.push(`${PETITIONS[pick.id].title}: a petition awaits your decision.`);
  return news;
}

export function respondPetition(city, id, accept) {
  ensureEvents(city);
  const p = city.petitions.find((x) => x.id === id && x.status === "open");
  if (!p) return { ok: false, message: "No such petition is open." };
  p.status = accept ? "accepted" : "declined";
  p.decidedAt = city.month;
  if (!accept) return { ok: true, message: `${PETITIONS[id].title} declined.` };
  if (BUILDINGS[id]?.offer) {
    city.unlocked[id] = city.month;
    p.buildBy = city.month + OFFER_MONTHS;
    return { ok: true, message: `${BUILDINGS[id].label} accepted. Place it within ${OFFER_MONTHS} months to start earning $${BUILDINGS[id].offer.income}/month.` };
  }
  if (id === "taxcut") { city.taxes.residential = Math.max(0, city.taxes.residential - 1); return { ok: true, message: "Residential tax cut by 1%." }; }
  if (id === "comtaxcut") { city.taxes.commercial = Math.max(0, city.taxes.commercial - 1); return { ok: true, message: "Commercial tax cut by 1%." }; }
  if (id === "cleanair") { city.ordinances.cleanAir = true; return { ok: true, message: "Clean Air Act passed." }; }
  if (id === "repealair") { city.ordinances.cleanAir = false; return { ok: true, message: "Clean Air Act repealed." }; }
  if (id === "curfew") { city.ordinances.youthCurfew = true; return { ok: true, message: "Youth curfew imposed." }; }
  if (id === "teachers") { city.funding.education = 100; return { ok: true, message: "Education funding restored to 100%." }; }
  if (id === "firefighters") { city.funding.fire = 100; return { ok: true, message: "Fire funding restored to 100%." }; }
  if (id === "gamblingAct") { city.ordinances.gambling = true; return { ok: true, message: "Gambling legalized." }; }
  if (id === "carpoolAct") { city.ordinances.carpool = true; return { ok: true, message: "Carpool incentive passed." }; }
  if (id === "recyclingAct") { city.ordinances.recycling = true; return { ok: true, message: "Recycling program started." }; }
  return { ok: true, message: "Petition accepted." };
}

export function openPetition(city) {
  return city.petitions?.find((p) => p.status === "open") || null;
}
