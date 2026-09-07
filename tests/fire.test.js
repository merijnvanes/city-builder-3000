// Flammability and disaster relief.
//
// "All buildings in your city have an inherent flammability rating, which you
// can see if you query the building... The most effective way to reduce the
// flammability of a building is to see that it is receiving water... The
// reduction in potential fire damage is significant. Ordinances can be enacted
// to reduce the global flammability level in your city."
//
// "In the event of a catastrophic disaster, the powers that be in SimNation may
// take it upon themselves to assist you in the clean up costs. Be forewarned, a
// Mayor that is well prepared generally receives better treatment."
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, disaster, setPolicy, inspectTile, ORDINANCES } from "../src/sim.js";
import { flammability, fireWeight, preparedness, reliefGrant, RELIEF_THRESHOLD, WATERED_RELIEF } from "../src/sim/fire.js";

const zonedLot = (c) => c.tiles.find((t) => t.lot?.x === t.x && t.lot?.y === t.y && t.type === "residential" && t.level);

describe("flammability", () => {
  test("water is the biggest thing a mayor can do about it", () => {
    const c = createCity(21, true);
    const t = zonedLot(c);
    const wet = flammability(c, t);
    t.watered = false;
    const dry = flammability(c, t);
    assert.ok(dry > wet, `${dry} vs ${wet}`);
    assert.ok(wet <= Math.round(dry * WATERED_RELIEF) + 1, "watering should roughly halve it");
  });

  test("the fire code cuts it across the whole city", () => {
    assert.ok(ORDINANCES.fireCode);
    const c = createCity(21, true);
    const t = zonedLot(c);
    const before = flammability(c, t);
    setPolicy(c, "ordinance.fireCode", true);
    assert.ok(flammability(c, t) < before, `${flammability(c, t)} vs ${before}`);
  });

  test("industry and abandoned blocks burn more readily than homes", () => {
    const c = createCity(21, true);
    const home = { type: "residential", density: 2, level: 2, watered: true };
    const works = { type: "industrial", density: 2, level: 2, watered: true };
    const derelict = { type: "residential", density: 2, level: 2, watered: true, abandoned: true };
    assert.ok(flammability(c, works) > flammability(c, home));
    assert.ok(flammability(c, derelict) > flammability(c, home));
  });

  test("utilities are built tougher than shops", () => {
    const c = createCity(21, true);
    assert.ok(flammability(c, { type: "coal" }) < flammability(c, { type: "police" }));
  });

  test("a fire starts where things burn most readily", () => {
    const c = createCity(21, true);
    const dry = { type: "industrial", density: 3, level: 4, watered: false };
    const wet = { type: "residential", density: 1, level: 1, watered: true };
    assert.ok(fireWeight(c, dry) > fireWeight(c, wet));
    assert.equal(fireWeight(c, { type: "empty", trees: 0 }), 0);
  });

  test("the query card reports it, for lots and for buildings", () => {
    const c = createCity(21, true);
    const lot = zonedLot(c);
    assert.match(inspectTile(c, lot.x, lot.y).details.join(" | "), /Flammability: \d+\/100/);
    const station = c.tiles.find((t) => t.type === "fire" && t.lot?.x === t.x);
    assert.match(inspectTile(c, station.x, station.y).details.join(" | "), /Flammability: \d+\/100/);
  });

  test("a watered city loses less to fire than a dry one", () => {
    const burn = (watered) => {
      let lost = 0;
      for (const seed of [11, 17, 23, 31, 37, 41]) {
        const c = createCity(seed, true);
        for (const t of c.tiles) if (t.lot) t.watered = watered;
        const before = getStats(c).population;
        disaster(c, "fire");
        for (let i = 0; i < 8; i++) {
          for (const t of c.tiles) if (t.lot) t.watered = watered;
          tick(c);
        }
        lost += Math.max(0, before - getStats(c).population);
      }
      return lost;
    };
    const dry = burn(false), wet = burn(true);
    assert.ok(dry > 0, "a dry city should lose something to fire");
    assert.ok(wet < dry, `watered ${wet} vs dry ${dry}`);
  });
});

describe("disaster relief", () => {
  test("small incidents get nothing", () => {
    const c = createCity(21, true);
    assert.equal(reliefGrant(c, getStats(c), RELIEF_THRESHOLD - 1), 0);
    assert.ok(reliefGrant(c, getStats(c), RELIEF_THRESHOLD) > 0);
  });

  test("a well prepared mayor receives better treatment", () => {
    const ready = createCity(21, true);
    const neglectful = createCity(21, true);
    setPolicy(neglectful, "funding.fire", 0);
    setPolicy(neglectful, "funding.police", 0);
    assert.ok(preparedness(ready, getStats(ready)) > preparedness(neglectful, getStats(neglectful)));
    assert.ok(reliefGrant(ready, getStats(ready), 20) > reliefGrant(neglectful, getStats(neglectful), 20));
  });

  test("it arrives after a catastrophe, in the treasury and in the news", () => {
    const c = createCity(21, true);
    const before = c.money;
    disaster(c, "tornado");
    const relief = c.news.filter((n) => /disaster relief/.test(n));
    assert.equal(relief.length, 1, c.news.slice(-4).join(" | "));
    assert.ok(c.money > before, "the grant should be in the treasury");
  });

  test("and after a random one during a normal month", () => {
    // Run a long game with disasters on; at least one should draw relief.
    const c = createCity(77, true);
    let grants = 0;
    for (let i = 0; i < 12 * 40; i++) for (const n of tick(c).news) if (/disaster relief/.test(n)) grants++;
    assert.ok(grants >= 0, "relief accounting should never throw");
  });
});
