// Water: fresh against salt sources, the three pump types, pipe reach,
// ageing, and pollution from industry.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, evaluate, serialize, deserialize, setPolicy, inspectTile } from "../src/sim.js";
import { BUILDINGS, TECH_YEAR } from "../src/sim/catalog.js";
import { WATER_RADIUS } from "../src/sim/utilities.js";
import { pumpOutput, hasSource, SOURCE_REACH } from "../src/sim/water.js";
import { ageFactor, lifespanOf, WORN } from "../src/sim/wear.js";

const at = (c, x, y) => c.tiles[y * c.size + x];
const anchors = (c, type) => c.tiles.filter((t) => t.type === type && t.lot?.x === t.x && t.lot?.y === t.y);

// A dry tile with the given kind of water within reach. `span` reserves a
// clear square for buildings bigger than one tile.
function shoreTile(city, salt, span = 1) {
  return city.tiles.find((t) => {
    if (t.terrain === "water" || t.type !== "empty" || t.x < 2 || t.y < 2) return false;
    if (t.x + span >= city.size - 1 || t.y + span >= city.size - 1) return false;
    for (let dy = 0; dy < span; dy++) for (let dx = 0; dx < span; dx++) {
      const n = at(city, t.x + dx, t.y + dy);
      if (!n || n.terrain === "water" || n.type !== "empty") return false;
    }
    return [[-1, 0], [0, -1], [span, 0], [0, span], [-1, -1], [span, span]].some(([dx, dy]) => {
      const n = at(city, t.x + dx, t.y + dy);
      return n?.terrain === "water" && !!n.salt === salt;
    });
  });
}

describe("fresh and salt water", () => {
  test("only the coast layout makes sea water", () => {
    for (const layout of ["river", "lakes", "delta", "plains"]) {
      const c = createCity({ seed: 5, starter: false, layout });
      assert.equal(c.tiles.some((t) => t.salt), false, `${layout} should have no sea`);
    }
    const coast = createCity({ seed: 5, starter: false, layout: "coast" });
    assert.ok(coast.tiles.filter((t) => t.salt).length > 100);
  });

  test("water type survives a save and a tampered flag is rejected", () => {
    const c = createCity({ seed: 5, starter: false, layout: "coast" });
    const d = deserialize(serialize(c));
    assert.equal(d.tiles.filter((t) => t.salt).length, c.tiles.filter((t) => t.salt).length);
    const bad = JSON.parse(serialize(c));
    bad.tiles[0][20] = 7;
    assert.throws(() => deserialize(JSON.stringify(bad)), /bad water type/);
  });
});

describe("the three kinds of pump", () => {
  test("a pumping station needs fresh water and yields the most", () => {
    const c = createCity({ seed: 5, starter: false, layout: "river" });
    c.money = 100000;
    const shore = shoreTile(c, false);
    place(c, shore.x, shore.y, "waterpump");
    assert.equal(hasSource(c, at(c, shore.x, shore.y)), true);
    assert.equal(pumpOutput(c, at(c, shore.x, shore.y)), BUILDINGS.waterpump.waterOut);
    assert.ok(BUILDINGS.waterpump.waterOut > BUILDINGS.watertower.waterOut);
    assert.ok(BUILDINGS.waterpump.waterOut > BUILDINGS.desalination.waterOut);
  });

  test("a pumping station beside the sea has no capacity at all", () => {
    const c = createCity({ seed: 5, starter: false, layout: "coast" });
    c.money = 100000;
    const beach = shoreTile(c, true);
    place(c, beach.x, beach.y, "waterpump");
    assert.equal(pumpOutput(c, at(c, beach.x, beach.y)), 0);
  });

  test("a tower draws on springs, so it works anywhere", () => {
    const c = createCity({ seed: 5, starter: false, layout: "plains" });
    c.money = 100000;
    const inland = c.tiles.find((t) => t.terrain === "grass" && t.type === "empty" && t.x === 30 && t.y === 30);
    place(c, inland.x, inland.y, "watertower");
    assert.equal(hasSource(c, at(c, inland.x, inland.y)), true);
    assert.equal(pumpOutput(c, at(c, inland.x, inland.y)), BUILDINGS.watertower.waterOut);
  });

  test("a desalinization plant needs the sea, and not before 1960", () => {
    assert.equal(TECH_YEAR.desalination, 1960);
    const early = createCity({ seed: 5, starter: false, layout: "coast", startYear: 1900 });
    assert.equal(evaluate(early, 4, 4, "desalination").ok, false);

    const c = createCity({ seed: 5, starter: false, layout: "coast", startYear: 2000 });
    c.money = 100000;
    const beach = shoreTile(c, true, 3);
    assert.equal(place(c, beach.x, beach.y, "desalination").ok, true);
    assert.equal(pumpOutput(c, at(c, beach.x, beach.y)), BUILDINGS.desalination.waterOut);

    const river = createCity({ seed: 5, starter: false, layout: "river", startYear: 2000 });
    river.money = 100000;
    const bank = shoreTile(river, false, 3);
    assert.equal(place(river, bank.x, bank.y, "desalination").ok, true);
    assert.equal(pumpOutput(river, at(river, bank.x, bank.y)), 0, "there is no sea to desalinate");
  });

  test("a coast town is founded on towers, an inland one on pumping stations", () => {
    const coast = createCity({ seed: 21, starter: true, layout: "coast" });
    assert.ok(anchors(coast, "watertower").length > 0);
    assert.equal(anchors(coast, "waterpump").length, 0);
    assert.ok(getStats(coast).water >= 95, `coast town water ${getStats(coast).water}%`);

    const river = createCity({ seed: 21, starter: true, layout: "river" });
    assert.ok(anchors(river, "waterpump").length > 0);
    assert.ok(getStats(river).water >= 95, `river town water ${getStats(river).water}%`);
  });
});

describe("pipes", () => {
  test("water reaches seven tiles from a pipe, as the manual says", () => {
    assert.equal(WATER_RADIUS, 7);
  });

  test("a dry stub of pipe never strands ground the main runs past", () => {
    const c = createCity({ seed: 5, starter: false, layout: "river" });
    c.money = 500000;
    const shore = shoreTile(c, false);
    // A pump with power, feeding a main that runs southwest.
    place(c, shore.x, shore.y, "waterpump");
    place(c, shore.x, shore.y, "powerline");
    place(c, shore.x, shore.y - 1, "powerline");
    place(c, shore.x, shore.y - 2, "wind");
    for (let i = 1; i < 16; i++) place(c, shore.x, shore.y + i, "pipe");
    tick(c);
    const target = at(c, shore.x + 3, shore.y + 8);
    assert.equal(target.watered, true, "a tile three from the main should be watered");
    // Drop an unconnected stub of pipe closer to it; the main still wins,
    // because a network with no pump loses ties it would otherwise take.
    place(c, target.x + 1, target.y, "pipe");
    tick(c);
    assert.equal(at(c, target.x, target.y).watered, true, "the dry stub stole the tile");
  });
});

describe("ageing and pollution", () => {
  test("pumps wear out on the same curve as power plants", () => {
    for (const type of ["waterpump", "watertower", "desalination"]) {
      assert.ok(BUILDINGS[type].lifespan > 0, `${type} has no lifespan`);
      assert.equal(ageFactor(type, 0), 1);
      assert.ok(Math.abs(ageFactor(type, lifespanOf(type)) - WORN) < 1e-9);
    }
  });

  test("an aging pump is announced and delivers less", () => {
    const c = createCity({ seed: 5, starter: false, layout: "river" });
    c.money = 100000;
    const shore = shoreTile(c, false);
    place(c, shore.x, shore.y, "waterpump");
    const pump = at(c, shore.x, shore.y);
    pump.age = Math.floor(lifespanOf("waterpump") * 0.55) - 1;
    for (let i = 0; i < 40; i++) tick(c);
    assert.ok(pumpOutput(c, pump) < BUILDINGS.waterpump.waterOut);
    assert.ok(c.news.some((n) => /pumping less/.test(n)), c.news.slice(-5).join(" | "));
  });

  test("dirty water slows pumps down, and a treatment plant cleans it", () => {
    const c = createCity({ seed: 5, starter: false, layout: "river" });
    c.money = 100000;
    const shore = shoreTile(c, false);
    place(c, shore.x, shore.y, "waterpump");
    const pump = at(c, shore.x, shore.y);
    const clean = pumpOutput(c, pump, 0);
    assert.ok(pumpOutput(c, pump, 100) < clean * 0.4, "heavy pollution should cripple a pumping station");
    // A tower on springs is less exposed than a station on a fouled river.
    const dry = c.tiles.find((t) => t.terrain === "grass" && t.type === "empty" && t.x === 30 && t.y === 30);
    assert.equal(place(c, dry.x, dry.y, "watertower").ok, true);
    const tower = at(c, dry.x, dry.y);
    assert.ok(pumpOutput(c, tower, 0) > 0);
    const stationLoss = 1 - pumpOutput(c, pump, 60) / pumpOutput(c, pump, 0);
    const towerLoss = 1 - pumpOutput(c, tower, 60) / pumpOutput(c, tower, 0);
    assert.ok(towerLoss < stationLoss, `tower ${towerLoss} vs station ${stationLoss}`);
  });

  test("water pollution comes from industry and treatment plants remove it", () => {
    const dirty = createCity(9, true, { startYear: 1950 });
    for (let i = 0; i < 24; i++) tick(dirty);
    const before = getStats(dirty).waterPollution;
    assert.ok(before > 0, "an industrial town should foul its water");

    const clean = createCity(9, true, { startYear: 1950 });
    clean.money = 500000;
    let built = 0;
    for (let y = 1; y + 4 < clean.size && built < 3; y += 5) {
      for (let x = 1; x + 4 < clean.size && built < 3; x += 5) {
        if (!place(clean, x, y, "treatment").ok) continue;
        for (let i = -1; i <= 3; i++) { place(clean, x + i, y + 3, "road"); place(clean, x + i, y - 1, "powerline"); }
        built++;
      }
    }
    assert.equal(built, 3);
    for (let i = 0; i < 24; i++) tick(clean);
    assert.ok(getStats(clean).waterPollution < before, `${getStats(clean).waterPollution} vs ${before}`);
  });

  test("the query card reports capacity, age and a missing source", () => {
    const c = createCity({ seed: 5, starter: false, layout: "coast", startYear: 2000 });
    c.money = 100000;
    const beach = shoreTile(c, true);
    place(c, beach.x, beach.y, "waterpump");
    const details = inspectTile(c, beach.x, beach.y).details.join(" | ");
    assert.match(details, /Water output: 0 of 2,500/);
    assert.match(details, new RegExp(`No fresh water within ${SOURCE_REACH} tiles`));
  });
});
