// Rewards, business deals, neighbour offers and citizen petitions.
//
// Rewards unlock a unique building when the city reaches a population
// milestone. Business deals arrive from petitioners: accept to unlock a
// money-making building with side effects, or decline. Citizen petitions ask
// for a policy change. Open petitions wait for the player's answer.
//
// Neighbour deals arrive the same way, because that is where the manual puts
// them: "When these connections are in place and the conditions are right (you
// have excess or insufficient resources or disposal means) the Mayor of the
// city your connection runs to will approach you via the Petitioners Meet
// window with terms for an import or export deal. Deals are updated
// periodically to reflect both your city's and the neighboring city's needs."
//
// And on declining anything: "If you reject the offer, the Petitioner leaves;
// sometimes they never come back."
import { BUILDINGS, SPECIAL_TYPES } from "./catalog.js";
import { isAnchor } from "./lots.js";
import { nextRandom } from "./grid.js";
import { DEALS, SIDES, offerTerms, describeTerms, dealAvailable, signDeal, cancelPenalty } from "./neighbors.js";

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
  // A neighbouring mayor at the door. Title, body and buttons are written per
  // offer, because every offer carries its own terms.
  neighborDeal: { title: "A neighbouring mayor calls", body: "", accept: "Sign the contract", decline: "Decline" },
};

// "If you reject the offer, the Petitioner leaves; sometimes they never come
// back." One in three declined petitioners is gone for good.
export const NEVER_AGAIN = 1 / 3;
// How long the rest stay away.
export const COOLDOWN_MONTHS = 120;

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
    if (p.status === "open" && month >= p.expires) { p.status = "expired"; news.push(`${p.title ?? PETITIONS[p.id].title} withdrawn.`); }
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
  const recently = (topic) => city.petitions.some((p) => (p.topic ?? p.id) === topic
    && (p.never || month - (p.decidedAt ?? p.expires) < COOLDOWN_MONTHS));

  // A neighbouring mayor with an offer, if the wires are up and either side
  // has something the other needs.
  const offer = neighborOffer(city, stats, rng, recently);
  if (offer) {
    city.petitions.push({ ...offer, status: "open", since: month, expires: month + PETITION_MONTHS });
    news.push(`${offer.title}: a petition awaits your decision.`);
    return news;
  }

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

// Does the city have "excess or insufficient resources or disposal means"?
// Returns the kind of deal the neighbour would propose, or null.
function dealWanted(city, stats, resource) {
  const u = stats.utilities || {};
  if (resource === "power" || resource === "water") {
    const { supply = 0, demand = 0 } = u[resource] || {};
    const base = DEALS[resource];
    // "you can purchase power or water from a neighbor" when short of it...
    if (demand > supply) return "buy";
    // ...and "if you are generating excess power or water... you may be
    // approached by a neighbor looking to purchase these resources."
    if (supply - demand > base.sell.cap * 1.2) return "sell";
    return null;
  }
  // Garbage: export what the city cannot handle, or take in a neighbour's if
  // there is room to bury or burn it.
  const spare = (stats.garbageCapacity || 0) - (stats.garbageProduced || 0);
  if ((stats.garbage || 0) > 0) return "sell";
  if (spare > DEALS.garbage.buy.cap * 1.5) return "buy";
  return null;
}

// The whole offer, ready to become a petition, or null.
function neighborOffer(city, stats, rng, recently) {
  const connections = city._connections;
  if (!connections) return null;
  const open = [];
  for (const resource of Object.keys(DEALS)) {
    if (city.deals?.[resource]) continue;
    const kind = dealWanted(city, stats, resource);
    if (!kind) continue;
    const topic = `deal:${resource}:${kind}`;
    if (recently(topic)) continue;
    for (const side of SIDES) {
      if (dealAvailable(connections, resource, side)) open.push({ resource, kind, side, topic });
    }
  }
  if (!open.length) return null;
  // A neighbour comes calling about as often as a citizen petition does.
  if (rng() > 0.09) return null;
  const pick = open[Math.min(open.length - 1, Math.floor(rng() * open.length))];
  const terms = offerTerms(pick.resource, pick.kind, rng());
  const who = connections[pick.side]?.name || "A neighbour";
  const direction = pick.kind === "buy"
    ? `sell ${pick.resource === "garbage" ? "you their garbage to dispose of" : `you ${pick.resource}`}`
    : `buy ${pick.resource === "garbage" ? "your excess garbage" : `your surplus ${pick.resource}`}`;
  return {
    id: "neighborDeal",
    topic: pick.topic,
    deal: { resource: pick.resource, side: pick.side, kind: pick.kind, ...terms },
    title: `${who} wants to ${direction}`,
    body: `The mayor of ${who}, to your ${pick.side}, offers to ${direction}: ${describeTerms(pick.resource, pick.kind, terms)}. `
      + `Terms change from offer to offer, and breaking the contract later costs `
      + `$${cancelPenalty(terms).toLocaleString()}.`,
    accept: "Sign the contract",
    decline: "Send them home",
  };
}

export function respondPetition(city, id, accept) {
  ensureEvents(city);
  const p = city.petitions.find((x) => x.id === id && x.status === "open");
  if (!p) return { ok: false, message: "No such petition is open." };
  p.status = accept ? "accepted" : "declined";
  p.decidedAt = city.month;
  if (!accept) {
    // "If you reject the offer, the Petitioner leaves; sometimes they never
    // come back." The roll is taken here so a decline costs the same however
    // often the player reopens the window.
    p.never = nextRandom(city) < NEVER_AGAIN;
    const who = p.title || PETITIONS[id].title;
    return { ok: true, message: `${who} declined.${p.never ? " They will not be back." : ""}` };
  }
  if (id === "neighborDeal") {
    const { resource, side, kind, rate, cap, minimum } = p.deal || {};
    const result = signDeal(city, resource, side, kind, { rate, cap, minimum });
    if (!result.ok) { p.status = "expired"; }
    return result;
  }
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
