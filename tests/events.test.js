// Rewards, business deals and petitions.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, setPolicy, serialize, deserialize, BUILDINGS } from "../src/sim/index.js";
import { updateEvents, respondPetition } from "../src/sim/events.js";
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
