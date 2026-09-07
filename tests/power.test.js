// Power plants: invention years, ageing, hilltop wind and overload failure.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, refresh, serialize, deserialize, evaluate } from "../src/sim.js";
import { BUILDINGS, TECH_YEAR } from "../src/sim/catalog.js";
import { plantOutput, OVERLOAD_MONTHS, OVERLOAD_WARNING, isPlant } from "../src/sim/power.js";
import { ageFactor, lifespanOf, WORN } from "../src/sim/wear.js";

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
    const life = lifespanOf("coal");
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
    plant.age = lifespanOf("coal");
    assert.ok(plantOutput(plant) < BUILDINGS.coal.powerOut * 0.4);
  });

  test("an aging plant is announced before it fails", () => {
    const c = blank();
    c.money = 100000;
    place(c, 4, 4, "coal");
    const plant = c.tiles[4 * c.size + 4];
    plant.age = Math.floor(lifespanOf("coal") * 0.55) - 1;
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
  // Replace a starter town's plant with a much smaller one on the very same
  // footprint. The grid keeps its shape, so the town is instantly drawing far
  // more than the plant can give, which is the state the manual warns about.
  function starveGrid(seed) {
    const c = createCity(seed, true);
    const plant = c.tiles.find((t) => t.lot?.x === t.x && t.lot?.y === t.y && isPlant(t));
    assert.ok(plant, "the starter town should have a power plant");
    const { x, y } = plant;
    c.money = 500_000;
    assert.equal(place(c, x, y, "bulldoze").ok, true);
    assert.equal(place(c, x, y, "solar").ok, true);
    const { supply, demand } = getStats(c).utilities.power;
    assert.ok(demand > supply, `the grid should be overdrawn: ${demand} vs ${supply}`);
    return { c, at: () => c.tiles.find((t) => t.lot?.x === t.x && t.lot?.y === t.y && isPlant(t)) };
  }

  test("a grid held past capacity for a year destroys a plant", () => {
    const { c, at } = starveGrid(21);
    for (let i = 0; i < OVERLOAD_MONTHS - 1; i++) tick(c);
    assert.ok(at(), "it should not fail before a full year");
    for (let i = 0; i < 3; i++) tick(c);
    assert.equal(at(), undefined, "the plant survived a year of overdraw");
    assert.ok(c.news.some((n) => /exploded/.test(n)), c.news.slice(-6).join(" | "));
  });

  test("strain clears when the load is taken off", () => {
    const { c, at } = starveGrid(42);
    for (let i = 0; i < 4; i++) tick(c);
    assert.ok(at().strain >= 3, `strain only reached ${at().strain}`);
    assert.ok(at().strain < OVERLOAD_MONTHS);
    // Restore capacity and the counter resets rather than creeping on.
    const { x, y } = at();
    c.money = 500_000;
    place(c, x, y, "bulldoze");
    place(c, x, y, "nuclear");
    tick(c);
    assert.equal(at().strain, 0);
  });

  test("strain survives a save and keeps counting", () => {
    const { c, at } = starveGrid(44);
    for (let i = 0; i < 5; i++) tick(c);
    assert.ok(at().strain >= 4, `strain only reached ${at().strain}`);
    const d = deserialize(serialize(c));
    const dPlant = d.tiles.find((t) => t.lot?.x === t.x && t.lot?.y === t.y && isPlant(t));
    assert.equal(dPlant.strain, at().strain);
    tick(c); tick(d);
    assert.equal(serialize(d), serialize(c));
  });

  test("a grid with headroom never blows a plant up", () => {
    const c = createCity(21, true);
    const plant = c.tiles.find((t) => t.lot?.x === t.x && t.lot?.y === t.y && isPlant(t));
    c.money = 500_000;
    place(c, plant.x, plant.y, "bulldoze");
    place(c, plant.x, plant.y, "nuclear");
    for (let i = 0; i < 60; i++) tick(c);
    const now = c.tiles.find((t) => t.lot?.x === t.x && t.lot?.y === t.y && isPlant(t));
    assert.equal(now.type, "nuclear");
    assert.equal(now.strain, 0);
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

describe("a grid is only as good as its own plants", () => {
  // "Areas of your city that draw power from an aging power plant may
  // experience blackouts." Areas, not the city. A total across every network
  // hides the one that is in trouble, and a city can run itself to a standstill
  // while the headline figure says it has thousands of megawatts to spare.
  //
  // Starve the town's own grid, then drop a big plant on an island of its own
  // so the totals look comfortable. That is the shape the seed-44 collapse had.
  function splitGrid(seed) {
    const c = createCity(seed, true);
    const plant = c.tiles.find((t) => t.lot?.x === t.x && t.lot?.y === t.y && isPlant(t));
    c.money = 5_000_000;
    place(c, plant.x, plant.y, "bulldoze");
    place(c, plant.x, plant.y, "solar");
    // Somewhere nothing else reaches: a clear 6x6 with no lot, zone or line.
    const clear = (x, y) => {
      for (let dy = -1; dy <= 4; dy++) for (let dx = -1; dx <= 4; dx++) {
        const t = c.tiles[(y + dy) * c.size + (x + dx)];
        if (!t || t.terrain === "water" || t.lot || t.powerline || t.type !== "empty") return false;
      }
      return true;
    };
    let island = null;
    for (let y = 1; y < c.size - 5 && !island; y++) for (let x = 1; x < c.size - 5; x++) if (clear(x, y)) { island = { x, y }; break; }
    assert.ok(island, "the map should have room for an isolated plant");
    assert.equal(place(c, island.x, island.y, "coal").ok, true);
    refresh(c);
    return { c, island };
  }

  test("an idle grid does not hide an overdrawn one", () => {
    const { c } = splitGrid(21);
    const { supply, demand, worst } = getStats(c).utilities.power;
    assert.ok(supply > demand * 2, `the totals should look healthy: ${supply} vs ${demand}`);
    assert.ok(worst, "the worst-off network should be reported");
    assert.ok(worst.demand > worst.supply, `the town's own grid is overdrawn: ${worst.demand} vs ${worst.supply}`);
    assert.ok(worst.x != null, "the report should say where to look");
  });

  test("the advisor points at the strained grid, not at the total", () => {
    const { c } = splitGrid(21);
    const gus = getStats(c).advisors.find((a) => a.id === "utilities");
    assert.equal(gus.mood, "bad", gus.message);
    assert.match(gus.message, /\(\d+, \d+\)/, "Gus should name a place to query");
  });

  test("a plant past capacity is announced months before it explodes", () => {
    const { c } = splitGrid(42);
    for (let i = 0; i < OVERLOAD_WARNING + 1; i++) tick(c);
    assert.ok(c.news.some((n) => /run past capacity for \d+ months/.test(n)), c.news.slice(-6).join(" | "));
    assert.ok(!c.news.some((n) => /has exploded/.test(n)), "far too early to explode");
  });

  // Gus's other cause: "query tiles between the power plant and the location of
  // the blackout to find a break in the line."
  test("a district cut off from every plant reads as a break in the line", () => {
    const c = createCity(21, true);
    const plant = c.tiles.find((t) => t.lot?.x === t.x && t.lot?.y === t.y && isPlant(t));
    c.money = 5_000_000;
    place(c, plant.x, plant.y, "bulldoze");
    refresh(c);
    const { worst } = getStats(c).utilities.power;
    assert.equal(worst.supply, 0);
    assert.ok(worst.demand > 0);
    const gus = getStats(c).advisors.find((a) => a.id === "utilities");
    assert.match(gus.message, /no plant behind it|break in the line/);
  });
});

describe("blackouts spread from the edges", () => {
  // "Power will radiate as far as possible from the power station and then
  // will just stop, leaving structures farthest from the plant without power."
  test("a short grid keeps the near streets lit and drops the far ones", () => {
    const c = createCity(21, true);
    const plant = c.tiles.find((t) => t.lot?.x === t.x && t.lot?.y === t.y && isPlant(t));
    c.money = 500_000;
    place(c, plant.x, plant.y, "bulldoze");
    place(c, plant.x, plant.y, "solar");
    refresh(c);

    const reach = (t) => Math.abs(t.x - plant.x) + Math.abs(t.y - plant.y);
    const zoned = c.tiles.filter((t) => t.lot && t.type === "residential");
    const lit = zoned.filter((t) => t.powered), dark = zoned.filter((t) => !t.powered);
    assert.ok(lit.length > 0 && dark.length > 0, "this should be a brownout, not a blackout");
    const mean = (a) => a.reduce((s, t) => s + reach(t), 0) / a.length;
    assert.ok(mean(dark) > mean(lit) + 5, `dark ${Math.round(mean(dark))} vs lit ${Math.round(mean(lit))}`);
  });

  test("the nearest lot to the plant is never the one that goes dark", () => {
    const c = createCity(21, true);
    const plant = c.tiles.find((t) => t.lot?.x === t.x && t.lot?.y === t.y && isPlant(t));
    c.money = 500_000;
    place(c, plant.x, plant.y, "bulldoze");
    place(c, plant.x, plant.y, "solar");
    refresh(c);
    const zoned = c.tiles.filter((t) => t.lot && t.type === "residential" && t.level);
    const reach = (t) => Math.abs(t.x - plant.x) + Math.abs(t.y - plant.y);
    zoned.sort((a, b) => reach(a) - reach(b));
    assert.equal(zoned[0].powered, true, "the closest lot should still have power");
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
