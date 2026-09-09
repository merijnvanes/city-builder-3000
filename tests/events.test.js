// Rewards, business deals and petitions.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, refresh, setPolicy, serialize, deserialize, BUILDINGS } from "../src/sim/index.js";
import { updateEvents, respondPetition, openPetition, NEVER_AGAIN } from "../src/sim/events.js";
import { DEALS } from "../src/sim/neighbors.js";
import { lcg } from "../src/sim/terrain.js";

const site = (c, w, h) => c.tiles.find((t) => t.x > 4 && t.y > 4 && t.x + w < c.size - 4 && t.y + h < c.size - 4 &&
  [...Array(h)].every((_, dy) => [...Array(w)].every((_, dx) => { const n = c.tiles[(t.y + dy) * c.size + t.x + dx]; return n.terrain === "grass" && n.type === "empty"; })));

describe("rewards", () => {
  test("locked until the population milestone, then unique", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    const s = site(c, 2, 2);
    assert.equal(place(c, s.x, s.y, "mayorhouse").ok, false);
    const news = updateEvents(c, { population: 2500, money: 50000, balance: 100, happiness: 60, pollution: 0, crime: 0 }, lcg(1));
    assert.ok(news.some((n) => /Mayor's House/.test(n)));
    assert.ok("mayorhouse" in c.unlocked);
    assert.equal(place(c, s.x, s.y, "mayorhouse").ok, true);
    assert.equal(getStats(c).available.mayorhouse, false);
    const s2 = site(c, 2, 2);
    assert.equal(place(c, s2.x, s2.y, "mayorhouse").ok, false);
  });
  test("the starter town unlocks the mayor's house and city hall on its first month", () => {
    const c = createCity(44, true);
    tick(c);
    assert.ok("mayorhouse" in c.unlocked);
    assert.ok("cityhall" in c.unlocked);
    assert.ok(!("courthouse" in c.unlocked));
    assert.equal(getStats(c).available.cityhall, true);
  });
});

describe("landmarks", () => {
  test("landmarks are unique, cost money and lift nearby land value", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    const s = site(c, 3, 3);
    const before = c.tiles[(s.y + 4) * c.size + s.x].landValue;
    const money = c.money;
    assert.equal(place(c, s.x, s.y, "operahouse").ok, true);
    assert.equal(money - c.money, BUILDINGS.operahouse.cost);
    assert.ok(c.tiles[(s.y + 4) * c.size + s.x].landValue > before);
    const s2 = site(c, 3, 3);
    assert.equal(place(c, s2.x, s2.y, "operahouse").ok, false, "only one opera house");
    assert.equal(place(c, s2.x, s2.y, "aquarium").ok, false, "aquarium needs water");
  });
});

describe("petitions", () => {
  test("accepting a deal unlocks the building and pays monthly", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    c.petitions.push({ id: "prison", status: "open", since: c.month, expires: c.month + 6 });
    assert.ok(getStats(c).petition);
    assert.equal(getStats(c).petition.id, "prison");
    const before = getStats(c).income;
    assert.equal(setPolicy(c, "petition", { id: "prison", accept: true }).ok, true);
    assert.equal(getStats(c).petition, null);
    const s = site(c, 4, 4);
    assert.equal(place(c, s.x, s.y, "prison").ok, true);
    assert.equal(getStats(c).income - before, BUILDINGS.prison.offer.income);
    assert.ok(c.tiles[(s.y + 1) * c.size + s.x + 5].crime >= 0);
  });
  test("declining leaves the building locked and the petition closed", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    c.petitions.push({ id: "casino", status: "open", since: 0, expires: 6 });
    assert.equal(respondPetition(c, "casino", false).ok, true);
    assert.equal(respondPetition(c, "casino", false).ok, false);
    const s = site(c, 3, 3);
    assert.equal(place(c, s.x, s.y, "casino").ok, false);
  });
  test("accepted deals expire when never built", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    c.petitions.push({ id: "toxicdump", status: "open", since: 0, expires: 6 });
    respondPetition(c, "toxicdump", true);
    assert.ok("toxicdump" in c.unlocked);
    c.month = 20;
    updateEvents(c, { population: 1000, money: 50000, balance: 0, happiness: 50, pollution: 0, crime: 0 }, lcg(2));
    assert.ok(!("toxicdump" in c.unlocked));
  });
  test("policy petitions change taxes or ordinances", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    c.petitions.push({ id: "taxcut", status: "open", since: 0, expires: 6 });
    respondPetition(c, "taxcut", true);
    assert.equal(c.taxes.residential, 6);
    c.petitions.push({ id: "cleanair", status: "open", since: 0, expires: 6 });
    respondPetition(c, "cleanair", true);
    assert.equal(c.ordinances.cleanAir, true);
    c.funding.education = 50;
    c.petitions.push({ id: "teachers", status: "open", since: 0, expires: 6 });
    respondPetition(c, "teachers", true);
    assert.equal(c.funding.education, 100);
    c.petitions.push({ id: "repealair", status: "open", since: 0, expires: 6 });
    respondPetition(c, "repealair", true);
    assert.equal(c.ordinances.cleanAir, false);
  });
  test("unions and councils petition when their cause is neglected", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    c.month = 24; c.funding.fire = 40;
    const stats = { population: 3000, money: 50000, balance: 100, happiness: 70, pollution: 0, crime: 0, traffic: 0, garbage: 0, demand: {} };
    let seen = null;
    const rng = lcg(5);
    for (let i = 0; i < 400 && !seen; i++) { updateEvents(c, stats, rng); seen = c.petitions.find((p) => p.status === "open"); }
    assert.ok(seen, "a petition arrived");
    assert.ok(["firefighters", "prison", "casino", "toxicdump", "armybase"].includes(seen.id), seen.id);
  });
  test("the marina is a shoreline reward", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    updateEvents(c, { population: 16000, money: 50000, balance: 100, happiness: 60, pollution: 0, crime: 0 }, lcg(1));
    assert.ok("marina" in c.unlocked);
    assert.ok(!("university" in c.unlocked));
    const s = site(c, 3, 3);
    assert.equal(place(c, s.x, s.y, "marina").ok, false, "marina needs water");
  });
  test("petitions arrive over time in a running city and survive saves", () => {
    const c = createCity(44, true);
    for (let i = 0; i < 240 && !c.petitions.length; i++) tick(c);
    assert.ok(c.petitions.length > 0, "a petition arrived within 20 years");
    const d = deserialize(serialize(c));
    assert.deepEqual(d.petitions, c.petitions);
    assert.deepEqual(d.unlocked, c.unlocked);
  });
});

describe("a neighbouring mayor comes to the door", () => {
  // "When these connections are in place and the conditions are right (you
  // have excess or insufficient resources or disposal means) the Mayor of the
  // city your connection runs to will approach you via the Petitioners Meet
  // window with terms for an import or export deal."
  const wired = () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    c.money = 5_000_000;
    for (let y = 0; y <= 12; y++) place(c, 20, y, "powerline");
    refresh(c);
    return c;
  };
  // Keep asking until the offer that the conditions allow turns up.
  const solicit = (c, stats, tries = 400) => {
    const rng = lcg(99);
    for (let i = 0; i < tries; i++) {
      updateEvents(c, stats, rng);
      const p = openPetition(c);
      if (p?.id === "neighborDeal") return p;
      c.month++;
    }
    return null;
  };
  const rich = { population: 20000, money: 60000, balance: 500, happiness: 60, pollution: 0, crime: 0,
    utilities: { power: { supply: 20000, demand: 200 }, water: { supply: 100, demand: 100 } },
    garbage: 0, garbageProduced: 100, garbageCapacity: 120, demand: {} };

  test("no connection, no offer", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    assert.equal(solicit(c, rich, 60), null);
  });

  test("a surplus and a power line bring an offer to buy it", () => {
    const p = solicit(wired(), rich);
    assert.ok(p, "a neighbour should call");
    assert.equal(p.deal.resource, "power");
    assert.equal(p.deal.kind, "sell", "the city has the surplus, so it sells");
    assert.match(p.title, /buy your surplus power/);
  });

  test("a shortfall brings an offer to sell the city some", () => {
    const short = { ...rich, utilities: { power: { supply: 100, demand: 9000 }, water: { supply: 100, demand: 100 } } };
    const p = solicit(wired(), short);
    assert.ok(p);
    assert.equal(p.deal.kind, "buy");
  });

  test("no surplus and no shortfall, no call", () => {
    const balanced = { ...rich, utilities: { power: { supply: 1000, demand: 1000 }, water: { supply: 100, demand: 100 } } };
    assert.equal(solicit(wired(), balanced, 200), null);
  });

  // "Deals are updated periodically to reflect both your city's and the
  // neighboring city's needs."
  test("the terms are not the list price, and the contract keeps them", () => {
    const c = wired();
    const p = solicit(c, rich);
    const base = DEALS.power.sell;
    assert.ok(p.deal.rate !== base.rate || p.deal.cap !== base.cap, "terms should vary");
    assert.ok(p.deal.rate >= base.rate * 0.7 && p.deal.rate <= base.rate * 1.3, `rate ${p.deal.rate}`);
    assert.equal(respondPetition(c, "neighborDeal", true).ok, true);
    assert.equal(c.deals.power.rate, p.deal.rate);
    assert.equal(c.deals.power.cap, p.deal.cap);
    refresh(c);
    // Billed on the contracted rate, not the list one.
    assert.equal(getStats(c).deals.power.rate, p.deal.rate);
  });

  test("the offer's own terms reach the petition window", () => {
    const c = wired();
    const p = solicit(c, rich);
    const shown = getStats(c).petition;
    assert.equal(shown.title, p.title, "the generic template must not overwrite the offer");
    assert.match(shown.body, /\$/, "the body should quote a price");
    assert.match(shown.body, new RegExp(p.deal.cap.toLocaleString().replace(",", ",")));
    assert.equal(shown.decline, "Send them home");
  });

  test("the mayor cannot go shopping for one", () => {
    const c = wired();
    assert.equal(setPolicy(c, "deal", { resource: "power", side: "northeast", kind: "sell" }).ok, false);
    assert.equal(c.deals.power, undefined);
  });

  test("a signed contract survives a save at the price it was signed at", () => {
    const c = wired();
    const p = solicit(c, rich);
    respondPetition(c, "neighborDeal", true);
    refresh(c);
    const back = deserialize(serialize(c));
    assert.deepEqual(back.deals.power, c.deals.power);
    assert.equal(back.deals.power.rate, p.deal.rate);
  });

  test("a save cannot invent its own price", () => {
    const c = wired();
    solicit(c, rich);
    respondPetition(c, "neighborDeal", true);
    refresh(c);
    const raw = JSON.parse(serialize(c));
    raw.deals.power.rate = 99;
    const back = deserialize(JSON.stringify(raw));
    assert.equal(back.deals.power.rate, DEALS.power.sell.rate, "an out-of-range rate falls back to the list price");
  });
});

describe("a rejected petitioner sometimes never comes back", () => {
  // "If you reject the offer, the Petitioner leaves; sometimes they never come
  // back."
  test("declining records whether they are gone for good", () => {
    // One city turning down one petitioner after another, which is how the
    // roll is actually reached: the city's stream has moved on each time.
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    let never = 0, back = 0;
    for (let i = 0; i < 200; i++) {
      c.petitions = [{ id: "taxcut", status: "open", since: i, expires: i + 6 }];
      respondPetition(c, "taxcut", false);
      if (c.petitions[0].never) never++; else back++;
    }
    assert.ok(never > 30 && back > 60, `some leave for good and some return: ${never} vs ${back}`);
    assert.ok(Math.abs(never / 200 - NEVER_AGAIN) < 0.12, `about a third leave for good, got ${never / 200}`);
  });

  test("one who left for good is never offered again", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    c.month = 24;
    c.petitions = [{ id: "taxcut", status: "declined", since: 0, expires: 6, decidedAt: 6, never: true }];
    const stats = { population: 20000, money: 60000, balance: 500, happiness: 40, pollution: 0, crime: 0, demand: {} };
    const rng = lcg(3);
    for (let i = 0; i < 600; i++) { updateEvents(c, stats, rng); c.month++; }
    assert.equal(c.petitions.some((p) => p.id === "taxcut" && p.status === "open"), false);
  });

  test("and the flag survives a save", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    c.petitions = [{ id: "taxcut", status: "declined", since: 0, expires: 6, decidedAt: 6, never: true }];
    assert.equal(deserialize(serialize(c)).petitions[0].never, true);
  });
});
