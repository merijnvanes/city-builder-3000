// Shops and offices. The manual lists what a commercial zone builds by
// density: light is "mom and pop stores, gas stations", medium adds "medium
// size office buildings and stores", dense has "large office buildings and
// large stores". And: "The type of Commercial buildings that get built depends
// on the density of the zone, as well its land value."
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, serialize, deserialize, setPolicy, inspectTile } from "../src/sim.js";
import { officeAppeal, pickCommerce, commerceOf, COMMERCE, OFFICE_BAR } from "../src/sim/commerce.js";
import { educate, years } from "./city-helpers.mjs";

const lot = (density, landValue, variant = 0.1) => ({ density, landValue, variant });

// Raise every undeveloped commercial zone to the given density.
function zoneAt(city, density) {
  for (const t of city.tiles) if (t.type === "commercial" && !t.lot) t.density = density;
  return city;
}

describe("the density ladder", () => {
  test("light density is shops only, whatever the city", () => {
    for (const eq of [45, 70, 120]) for (const lv of [20, 45, 80]) {
      assert.equal(officeAppeal(lot(1, lv), eq), 0);
      assert.equal(pickCommerce(lot(1, lv), eq), "shops");
    }
  });

  test("dense zones take offices in an educated city", () => {
    assert.ok(officeAppeal(lot(3, 30), 100) >= OFFICE_BAR);
    assert.equal(pickCommerce(lot(3, 30, 0.1), 100), "offices");
  });

  test("medium zones need both education and a decent address", () => {
    assert.equal(pickCommerce(lot(2, 30, 0.1), 100), "offices");
    assert.equal(pickCommerce(lot(2, 20, 0.1), 100), "shops", "a poor address stays shops");
    assert.equal(pickCommerce(lot(2, 45, 0.1), 60), "shops", "an unschooled city stays shops");
  });

  test("a badly schooled city gets no offices at any density", () => {
    for (const d of [1, 2, 3]) for (const lv of [20, 45, 80]) {
      assert.equal(pickCommerce(lot(d, lv, 0.01), 45), "shops");
    }
  });

  test("appeal rises with density, schooling and land value", () => {
    assert.ok(officeAppeal(lot(3, 30), 100) > officeAppeal(lot(2, 30), 100));
    assert.ok(officeAppeal(lot(3, 30), 100) > officeAppeal(lot(3, 30), 70));
    assert.ok(officeAppeal(lot(3, 45), 100) > officeAppeal(lot(3, 20), 100));
  });
});

describe("what offices are worth", () => {
  test("they hold more workers and pay more per head than shops", () => {
    assert.ok(COMMERCE.offices.jobs > COMMERCE.shops.jobs);
    assert.ok(COMMERCE.offices.value > COMMERCE.shops.value);
  });

  test("and bring fewer lorries", () => {
    assert.ok(COMMERCE.offices.pollution < COMMERCE.shops.pollution);
    assert.ok(COMMERCE.offices.traffic < COMMERCE.shops.traffic);
  });
});

describe("a commercial district over time", () => {
  test("schooling turns a dense downtown to offices, and keeps shops between", () => {
    const taught = zoneAt(createCity(9, true, { startYear: 1950 }), 3);
    educate(taught);
    years(taught, 70);
    const mix = getStats(taught).commerceMix;
    assert.ok(mix.offices > 0, `no offices: ${JSON.stringify(mix)}`);
    assert.ok(mix.shops > 0, `no shops left: ${JSON.stringify(mix)}`);
  });

  test("a city that neglects its schools keeps only shops", () => {
    const neglected = zoneAt(createCity(9, true, { startYear: 1950 }), 3);
    setPolicy(neglected, "funding.education", 0);
    years(neglected, 70);
    assert.equal(getStats(neglected).commerceMix.offices, 0);
  });

  test("blocks keep their character instead of trading places every decade", () => {
    const c = zoneAt(createCity(9, true, { startYear: 1950 }), 3);
    educate(c);
    years(c, 45);
    // Count lots, not jobs: a lot's job count also moves with its building
    // stage, which is a separate story from whether it holds shops or desks.
    const offices = () => c.tiles.filter((t) => t.type === "commercial" && t.lot?.x === t.x && t.lot?.y === t.y && t.level && commerceOf(t) === "offices").length;
    const readings = [];
    for (let i = 0; i < 4; i++) { years(c, 12); readings.push(offices()); }
    assert.ok(readings[0] > 0, "the downtown should have offices by now");
    const spread = Math.max(...readings) - Math.min(...readings);
    assert.ok(spread <= 3, `office count swung by ${spread}: ${readings.join(", ")}`);
  });

  test("every developed commercial lot has a kind from the first frame", () => {
    const c = createCity(21, true);
    for (const t of c.tiles) {
      if (t.type !== "commercial" || t.lot?.x !== t.x || t.lot?.y !== t.y || !t.level) continue;
      assert.ok(COMMERCE[t.commerce], `lot at ${t.x},${t.y} has commerce ${t.commerce}`);
    }
  });

  test("the query card names shops or offices", () => {
    const c = createCity(21, true);
    const t = c.tiles.find((t) => t.type === "commercial" && t.lot?.x === t.x && t.lot?.y === t.y && t.level);
    const description = inspectTile(c, t.x, t.y).description;
    assert.ok(/^(Shops|Offices),/.test(description), description);
  });

  test("kinds survive a save and a tampered code is rejected", () => {
    const c = zoneAt(createCity(9, true, { startYear: 1950 }), 3);
    educate(c);
    years(c, 60);
    const d = deserialize(serialize(c));
    assert.deepEqual(getStats(d).commerceMix, getStats(c).commerceMix);
    tick(c); tick(d);
    assert.equal(serialize(d), serialize(c));

    const bad = JSON.parse(serialize(c));
    bad.tiles[0][23] = 9;
    assert.throws(() => deserialize(JSON.stringify(bad)), /bad commerce/);
  });
});
