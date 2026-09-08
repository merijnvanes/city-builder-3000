// Every building that carries a number the player has to manage must report
// it when queried. Details in inspectTile() have been silently dropped by
// edits before now, and nothing else notices: the game still runs, the player
// simply loses the readout the manual tells them to check.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, place, inspectTile } from "../src/sim.js";
import { BUILDINGS } from "../src/sim/catalog.js";

// Place a building somewhere it fits, with a road and a power line, and
// return the lines its query card shows.
function card(type) {
  const b = BUILDINGS[type];
  const c = createCity({ seed: 5, starter: false, layout: "coast", startYear: 2100 });
  c.money = 5_000_000;
  for (let y = 2; y + b.h + 2 < c.size; y += b.h + 3) {
    for (let x = 2; x + b.w + 2 < c.size; x += b.w + 3) {
      if (!place(c, x, y, type).ok) continue;
      for (let i = -1; i <= b.w; i++) { place(c, x + i, y + b.h, "road"); place(c, x + i, y - 1, "powerline"); }
      return { details: inspectTile(c, x, y).details.join(" | "), city: c, x, y };
    }
  }
  throw new Error(`could not place a ${type} anywhere`);
}

// A building's defining number and the label its card must carry.
const REQUIRED = [
  ["coal", /Power output: [\d,]+ of [\d,]+ \(age \d+ of \d+ years\)/],
  ["fusion", /Power output: [\d,]+ of [\d,]+/],
  ["waterpump", /Water output: [\d,]+ of [\d,]+ \(age \d+ of \d+ years\)/],
  ["watertower", /Water output: [\d,]+ of [\d,]+/],
  ["desalination", /Water output: [\d,]+ of [\d,]+/],
  ["school", /Places: [\d,]+ \(city-wide/],
  ["school", /Grade: [ABCDF]/],
  ["college", /Places: [\d,]+/],
  ["hospital", /Beds: [\d,]+ \(city-wide/],
  ["jail", /Cells: [\d,]+ \(city-wide [\d,]+ for [\d,]+ arrests\)/],
  ["landfill", /Buried here: [\d,]+ of [\d,]+/],
  ["landfill", /City landfills: \d+% full/],
  ["incinerator", /Burns: [\d,]+ of [\d,]+ tons per month/],
  ["recycling", /Recycles: [\d,]+ of [\d,]+ tons per month/],
  ["wasteenergy", /Burns: [\d,]+ of [\d,]+ tons per month/],
  ["road", /Surface: \d+% — /],
  ["highway", /Surface: \d+% — /],
  ["police", /police coverage radius \d+/],
  ["fire", /fire coverage radius \d+/],
];

describe("query cards report what the player has to manage", () => {
  const cards = new Map();
  for (const [type, pattern] of REQUIRED) {
    test(`${type}: ${pattern.source.slice(0, 40)}`, () => {
      if (!cards.has(type)) cards.set(type, card(type));
      assert.match(cards.get(type).details, pattern);
    });
  }

  test("a bridge is named as one", () => {
    const c = createCity({ seed: 5, starter: false, layout: "river" });
    c.money = 100000;
    const water = c.tiles.find((t) => t.terrain === "water" && t.x > 4 && t.y > 4);
    water.type="road"; // Legacy bridge remains identifiable.
    assert.equal(inspectTile(c, water.x, water.y).description, "Bridge.");
  });

  test("every building with a lifespan reports its age", () => {
    for (const [type, b] of Object.entries(BUILDINGS)) {
      if (!b.lifespan || (!b.powerOut && !b.waterOut)) continue;
      if (!cards.has(type)) cards.set(type, card(type));
      assert.match(cards.get(type).details, /age \d+ of \d+ years/, `${type} does not report its age`);
    }
  });
});
