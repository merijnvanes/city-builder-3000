// A save the game writes must always be a save the game can read. Long games
// are where this breaks: rare paths (a fire burning out on an undeveloped
// zone, a lot cleared while other tiles of it are still alight) leave tiles in
// states the loader rejects, and the player only finds out when they reload.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, serialize, deserialize, disaster } from "../src/sim.js";
import { ZONE_TYPES } from "../src/sim/catalog.js";

// Every invariant deserialize() enforces, checked against live state so a
// failure points at the tile that broke rather than at a JSON string.
function checkTiles(city, when) {
  for (const t of city.tiles) {
    const zoned = ZONE_TYPES.has(t.type);
    assert.ok(zoned ? t.density > 0 : t.density === 0, `${when}: (${t.x},${t.y}) type ${t.type} density ${t.density}`);
    assert.ok(Number.isInteger(t.fire) && t.fire >= 0 && t.fire <= 6, `${when}: (${t.x},${t.y}) fire ${t.fire}`);
    assert.ok(Number.isInteger(t.age) && t.age >= 0, `${when}: (${t.x},${t.y}) age ${t.age}`);
    assert.ok(!t.lot || t.level >= 0, `${when}: (${t.x},${t.y}) level ${t.level}`);
  }
}

// tick() must mutate the city before it derives anything from it. A change
// made after the refreshes leaves a save whose derived state settle() cannot
// reproduce, and the reloaded city then drifts away from the original: an
// aging plant supplying slightly less power reroutes a brownout, and a
// district develops differently a year later.
describe("a reloaded city keeps ticking down the same path", () => {
  for (const seed of [3, 7, 21, 44, 99, 123]) {
    test(`seed ${seed} after twenty-five years`, () => {
      const c = createCity(seed, true);
      for (let i = 0; i < 12 * 25; i++) tick(c);
      const d = deserialize(serialize(c));
      for (let i = 0; i < 24; i++) { tick(c); tick(d); }
      assert.equal(serialize(d) === serialize(c), true, "the reloaded city diverged within two years");
    });
  }
});

describe("save integrity over long games", () => {
  for (const seed of [21, 44, 777]) {
    test(`seed ${seed} stays loadable for thirty years`, () => {
      const c = createCity(seed, true);
      for (let month = 0; month < 12 * 30; month++) {
        tick(c);
        if (month % 7) continue;
        checkTiles(c, `seed ${seed} month ${month}`);
        deserialize(serialize(c));
      }
    });
  }

  test("a fire that burns out an undeveloped zone clears its density", () => {
    const c = createCity(31, false);
    c.money = 100000;
    // Zone a block but give it nothing to develop with, then set it alight.
    for (let x = 4; x < 10; x++) for (let y = 4; y < 10; y++) {
      c.tiles[y * c.size + x].type = "residential";
      c.tiles[y * c.size + x].density = 3;
    }
    for (let x = 4; x < 10; x++) for (let y = 4; y < 10; y++) c.tiles[y * c.size + x].fire = 1;
    for (let i = 0; i < 4; i++) tick(c);
    checkTiles(c, "after burning an undeveloped zone");
    deserialize(serialize(c));
  });

  test("clearing a burning lot never drives another of its tiles below zero", () => {
    const c = createCity(32, true);
    for (let i = 0; i < 12; i++) {
      disaster(c, "fire");
      disaster(c, "tornado");
      tick(c);
      checkTiles(c, `disaster round ${i}`);
    }
    deserialize(serialize(c));
  });

  test("flood water drains even on a city that has shown no effects", () => {
    const c = createCity(34, true);
    delete c.effects;
    disaster(c, "flood");
    const flooded = c.tiles.filter((t) => t.flooded).length;
    assert.ok(flooded > 0, "the flood should have wetted some tiles");
    for (let i = 0; i < 3; i++) tick(c);
    assert.equal(c.tiles.filter((t) => t.flooded).length, 0, "the water never drained");
  });

  test("every disaster leaves a loadable city", () => {
    // Including a meltdown: its cloud once outlived the save format's limit on
    // effect lifetimes, so the city it left behind could not be reloaded.
    for (const id of ["fire", "earthquake", "tornado", "flood", "riot", "toxic", "ufo", "volcano", "meltdown"]) {
      const c = createCity(33, true);
      disaster(c, id);
      for (let i = 0; i < 8; i++) tick(c);
      checkTiles(c, `after ${id}`);
      deserialize(serialize(c));
    }
  });
});
