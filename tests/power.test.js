// Power plants: invention years, ageing, hilltop wind and overload failure.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, place, serialize, deserialize, evaluate, setPolicy } from "../src/sim.js";
import { BUILDINGS, TECH_YEAR } from "../src/sim/catalog.js";
import { ageFactor, plantOutput, plantLifespan, WORN, OVERLOAD_MONTHS, isPlant } from "../src/sim/power.js";

const blank = (options = {}) => createCity({ seed: 5, starter: false, layout: "flat", ...options });
const anchors = (city, type) => city.tiles.filter((t) => t.type === type && t.lot?.x === t.x && t.lot?.y === t.y);

describe("the eight power plants", () => {
  test("every type the manual lists exists, with its invention year", () => {
    const expected = { coal: 1900, oil: 1900, gas: 1955, nuclear: 1965, wind: 1980, solar: 1990, microwave: 2020, fusion: 2050 };
    for (const [type, year] of Object.entries(expected)) {
      assert.ok(BUILDINGS[type]?.powerOut > 0, `${type} is missing from the catalog`);
      assert.equal(TECH_YEAR[type], year, `${type} unlocks in the wrong year`);
    }
  });

  test("a plant cannot be built before it is invented", () => {
    const early = blank({ startYear: 1900 });
    assert.equal(evaluate(early, 4, 4, "fusion").ok, false);
    assert.equal(evaluate(early, 4, 4, "coal").ok, true);
    const late = blank({ startYear: 2100 });
    assert.equal(evaluate(late, 4, 4, "fusion").ok, true);
  });
});

describe("ageing", () => {
  test("a plant runs at full output through its prime, then slides", () => {
    const life = plantLifespan("coal");
    assert.equal(ageFactor("coal", 0), 1);
    assert.equal(ageFactor("coal", Math.floor(life * 0.5)), 1);
    assert.ok(ageFactor("coal", Math.floor(life * 0.8)) < 1);
    assert.ok(Math.abs(ageFactor("coal", life) - WORN) < 1e-9);
    assert.ok(Math.abs(ageFactor("coal", life * 3) - WORN) < 1e-9);
  });

  test("output falls with age and the query card shows the gap", () => {
    const c = blank();
    c.money = 100000;
    place(c, 4, 4, "coal");
    const plant = c.tiles[4 * c.size + 4];
    assert.equal(plantOutput(plant), BUILDINGS.coal.powerOut);
    plant.age = plantLifespan("coal");
    assert.ok(plantOutput(plant) < BUILDINGS.coal.powerOut * 0.4);
  });

  test("an aging plant is announced before it fails", () => {
    const c = blank();
    c.money = 100000;
    place(c, 4, 4, "coal");
    const plant = c.tiles[4 * c.size + 4];
    plant.age = Math.floor(plantLifespan("coal") * 0.55) - 1;
    for (let i = 0; i < 60; i++) tick(c);
    assert.ok(c.news.some((n) => /past its prime/.test(n)), c.news.slice(-5).join(" | "));
  });

  test("wind turbines do better on a hill than on the flat", () => {
    const c = blank();
    c.money = 100000;
    place(c, 4, 4, "wind");
    const turbine = c.tiles[4 * c.size + 4];
    const low = plantOutput(turbine);
    turbine.elev = 8;
    assert.ok(plantOutput(turbine) > low * 1.5, `${plantOutput(turbine)} vs ${low}`);
  });
});

describe("overload", () => {
  // A starter town left to itself outgrows the plant it was founded with.
  // The manual: run a plant beyond capacity for months on end and it explodes.
  const outgrow = (seed) => {
    const c = createCity(seed, true);
    for (let year = 0; year < 40; year++) {
      for (let m = 0; m < 12; m++) tick(c);
      if (!anchors(c, "gas").length && !anchors(c, "coal").length) return { c, year };
    }
    return { c, year: null };
  };

  test("a grid held past capacity for a year destroys a plant", () => {
    const { c, year } = outgrow(21);
    assert.ok(year != null, "the plant survived being overdrawn for forty years");
    assert.ok(c.news.some((n) => /exploded/.test(n)), c.news.slice(-6).join(" | "));
  });

  test("strain builds up before the plant gives way, and clears when relieved", () => {
    const c = createCity(21, true);
    const plant = () => c.tiles.find((t) => t.lot?.x === t.x && t.lot?.y === t.y && isPlant(t));
    let strained = null;
    for (let i = 0; i < 12 * 30 && !strained; i++) { tick(c); if (plant()?.strain >= 3) strained = plant(); }
    assert.ok(strained, "the town never overdrew its plant");
    assert.ok(strained.strain < OVERLOAD_MONTHS, "it should not fail before a full year");
    // Take the load off and the counter resets rather than creeping on.
    setPolicy(c, "ordinance.energyConservation", true);
    tick(c);
    assert.equal(plant().strain, 0);
  });

  test("strain survives a save and keeps counting", () => {
    const c = createCity(21, true);
    const plant = (city) => city.tiles.find((t) => t.lot?.x === t.x && t.lot?.y === t.y && isPlant(t));
    for (let i = 0; i < 12 * 30 && !(plant(c)?.strain >= 3); i++) tick(c);
    assert.ok(plant(c)?.strain >= 3, "the town never overdrew its plant");
    const d = deserialize(serialize(c));
    assert.equal(plant(d).strain, plant(c).strain);
    tick(c); tick(d);
    assert.equal(serialize(d), serialize(c));
  });

  test("a tampered strain counter is rejected", () => {
    const c = blank();
    c.money = 100000;
    place(c, 4, 4, "coal");
    const bad = JSON.parse(serialize(c));
    bad.tiles[4 * c.size + 4][19] = OVERLOAD_MONTHS + 5;
    assert.throws(() => deserialize(JSON.stringify(bad)), /bad plant strain/);
  });
});

describe("plant ages persist", () => {
  test("a rebuilt plant starts fresh and a saved one keeps its age", () => {
    const c = blank();
    c.money = 100000;
    place(c, 4, 4, "coal");
    for (let i = 0; i < 60; i++) tick(c);
    const plant = anchors(c, "coal")[0];
    assert.equal(plant.age, 60);
    assert.equal(deserialize(serialize(c)).tiles[4 * c.size + 4].age, 60);
    place(c, 4, 4, "bulldoze");
    place(c, 4, 4, "coal");
    assert.equal(anchors(c, "coal")[0].age, 0);
  });

  test("only plants age; other buildings are left alone", () => {
    const c = blank();
    c.money = 100000;
    place(c, 4, 4, "police");
    for (let i = 0; i < 24; i++) tick(c);
    const station = anchors(c, "police")[0];
    assert.equal(isPlant(station), false);
    assert.equal(station.age, 0);
  });
});
