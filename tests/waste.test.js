// Garbage: landfills store rather than process, need roads, decompose, and
// cannot be bulldozed until they have.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, evaluate, serialize, deserialize, setPolicy, inspectTile } from "../src/sim.js";
import { BUILDINGS, TECH_YEAR } from "../src/sim/catalog.js";
import { landfillLoad, isLandfill, DECAY } from "../src/sim/waste.js";
import { ageFactor, lifespanOf } from "../src/sim/wear.js";

const at = (c, x, y) => c.tiles[y * c.size + x];
const tips = (c) => c.tiles.filter(isLandfill);

// A block of landfill with a road along its edge, so trucks can reach it.
function dump(city, x0, y0, span) {
  city.money = 500000;
  for (let y = y0; y < y0 + span; y++) for (let x = x0; x < x0 + span; x++) {
    assert.equal(place(city, x, y, "landfill").ok, true, `landfill at ${x},${y}`);
  }
  for (let x = x0 - 1; x <= x0 + span; x++) place(city, x, y0 - 1, "road");
}

describe("a landfill is a store, not an allowance", () => {
  test("it fills up over time and then garbage piles up in the streets", () => {
    const c = createCity(21, true);
    assert.ok(tips(c).length > 0, "the starter town should have a landfill");
    assert.equal(getStats(c).garbage, 0, "a new town keeps its streets clean");

    let full = null;
    for (let month = 0; month < 12 * 30 && full === null; month++) {
      tick(c);
      if (landfillLoad(c) >= 0.97) full = month;
    }
    assert.ok(full !== null, "the landfill never filled in thirty years");
    assert.ok(full > 12 * 4, `it filled after only ${Math.round(full / 12)} years`);
    for (let i = 0; i < 6; i++) tick(c);
    assert.ok(getStats(c).garbage > 50, `garbage should pile up, got ${getStats(c).garbage}%`);
  });

  test("the mayor is warned before and when the tips run out", () => {
    const c = createCity(21, true);
    const heard = [];
    for (let i = 0; i < 12 * 12; i++) for (const n of tick(c).news) if (/landfill/i.test(n)) heard.push(n);
    assert.ok(heard.some((n) => /nearly full/.test(n)), heard.join(" | "));
    assert.ok(heard.some((n) => /are full/.test(n)), heard.join(" | "));
    assert.ok(heard.findIndex((n) => /nearly full/.test(n)) < heard.findIndex((n) => /are full/.test(n)));
  });

  test("trucks cannot reach a landfill with no road", () => {
    const c = createCity({ seed: 5, starter: false, layout: "plains" });
    dump(c, 20, 20, 3);
    tick(c);
    const reached = at(c, 21, 21).roadAccess;
    assert.equal(reached, true);
    const stranded = createCity({ seed: 5, starter: false, layout: "plains" });
    stranded.money = 500000;
    for (let y = 20; y < 23; y++) for (let x = 20; x < 23; x++) place(stranded, x, y, "landfill");
    tick(stranded);
    assert.equal(at(stranded, 21, 21).roadAccess, false);
    assert.equal(getStats(stranded).garbageCapacity, 0, "an unreachable landfill offers no capacity");
  });

  test("buried trash decomposes when nothing more is tipped", () => {
    const c = createCity({ seed: 5, starter: false, layout: "plains" });
    dump(c, 20, 20, 2);
    for (const t of tips(c)) t.fill = 1000;
    const before = at(c, 20, 20).fill;
    tick(c);
    assert.equal(at(c, 20, 20).fill, before - DECAY);
  });
});

describe("landfills are a decision you live with", () => {
  test("a landfill holding trash cannot be bulldozed", () => {
    const c = createCity({ seed: 5, starter: false, layout: "plains" });
    dump(c, 20, 20, 2);
    at(c, 20, 20).fill = 500;
    const refused = evaluate(c, 20, 20, "bulldoze");
    assert.equal(refused.ok, false);
    assert.match(refused.message, /decompose/);
    // Once it has decomposed it can be cleared.
    at(c, 20, 20).fill = 0;
    assert.equal(place(c, 20, 20, "bulldoze").ok, true);
  });

  test("landfill contents survive a save and a tampered figure is rejected", () => {
    const c = createCity(21, true);
    for (let i = 0; i < 24; i++) tick(c);
    const filled = tips(c).filter((t) => t.fill > 0);
    assert.ok(filled.length > 0);
    const d = deserialize(serialize(c));
    assert.equal(at(d, filled[0].x, filled[0].y).fill, filled[0].fill);
    tick(c); tick(d);
    assert.equal(serialize(d), serialize(c));

    const bad = JSON.parse(serialize(c));
    bad.tiles[filled[0].y * c.size + filled[0].x][21] = 99999;
    assert.throws(() => deserialize(JSON.stringify(bad)), /landfill contents/);
  });
});

describe("burning and recycling", () => {
  test("incinerators lose capacity as they age", () => {
    assert.ok(BUILDINGS.incinerator.lifespan > 0);
    assert.ok(ageFactor("incinerator", lifespanOf("incinerator")) < 0.5);
  });

  test("recycling reduces what has to be disposed of, and presort helps more", () => {
    const build = (presort) => {
      const c = createCity(21, true, { startYear: 2010 });
      c.money = 500000;
      for (let y = 1; y + 4 < c.size; y += 5) {
        for (let x = 1; x + 4 < c.size; x += 5) {
          if (!place(c, x, y, "recycling").ok) continue;
          for (let i = -1; i <= 3; i++) { place(c, x + i, y + 3, "road"); place(c, x + i, y - 1, "powerline"); }
          if (presort) setPolicy(c, "ordinance.trashPresort", true);
          return c;
        }
      }
      throw new Error("could not place a recycling center");
    };
    const plain = getStats(build(false)).garbageCapacity;
    const sorted = getStats(build(true)).garbageCapacity;
    assert.ok(sorted > plain, `${sorted} vs ${plain}`);
  });

  test("the waste-to-energy plant burns garbage and returns power", () => {
    assert.equal(TECH_YEAR.wasteenergy, 2000);
    assert.ok(BUILDINGS.wasteenergy.powerOut > 0);
    assert.ok(BUILDINGS.wasteenergy.garbage > BUILDINGS.incinerator.garbage);
    const early = createCity({ seed: 5, starter: false, layout: "plains", startYear: 1950 });
    assert.equal(evaluate(early, 20, 20, "wasteenergy").ok, false);

    const c = createCity({ seed: 5, starter: false, layout: "plains", startYear: 2010 });
    c.money = 500000;
    assert.equal(place(c, 20, 20, "wasteenergy").ok, true);
    for (let i = -1; i <= 3; i++) place(c, 20 + i, 23, "road");
    for (let i = -1; i <= 3; i++) place(c, 20 + i, 19, "powerline");
    tick(c);
    assert.ok(getStats(c).utilities.power.supply >= BUILDINGS.wasteenergy.powerOut);
    assert.ok(getStats(c).garbageCapacity >= BUILDINGS.wasteenergy.garbage * 0.9);
  });

  test("the query card reports what a landfill holds", () => {
    const c = createCity(21, true);
    for (let i = 0; i < 24; i++) tick(c);
    const tip = tips(c).find((t) => t.fill > 0);
    const details = inspectTile(c, tip.x, tip.y).details.join(" | ");
    assert.match(details, /Buried here: [\d,]+ of 5,000/);
    assert.match(details, /City landfills: \d+% full/);
  });
});
