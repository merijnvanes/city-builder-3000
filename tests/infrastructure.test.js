import test from "node:test";
import assert from "node:assert/strict";
import { createCity } from "../src/sim.js";
import { updateInfrastructure, POWER_CAPACITY } from "../src/infrastructure.js";

test("capacity limits serviced buildings and another connected plant restores supply", () => {
  const city = createCity(42, false);
  // A dense, connected industrial district whose demand exceeds one plant.
  for (const t of city.tiles) {
    if (t.x < 26) {
      t.type = t.y % 3 === 0 || t.x === 1 ? "road" : "industrial";
      t.level = t.type === "industrial" ? 4 : 0;
    }
  }
  const plant = city.tiles[18 * 40 + 13];
  plant.type = "power";
  plant.level = 0;
  updateInfrastructure(city);
  const zones = city.tiles.filter((t) => t.type === "industrial");
  const before = zones.filter((t) => t.powered).length;
  assert.ok(before > 0 && before < zones.length);
  assert.ok(before * 8 <= POWER_CAPACITY);
  const second = city.tiles[19 * 40 + 13];
  second.type = "power";
  second.level = 0;
  updateInfrastructure(city);
  assert.ok(zones.filter((t) => t.powered).length > before);
});

test("unpowered water towers do not supply their network", () => {
  const city = createCity(42, false);
  const road = city.tiles[5 * 40 + 5],
    tower = city.tiles[5 * 40 + 6],
    zone = city.tiles[5 * 40 + 7];
  road.type = "road";
  tower.type = "water";
  zone.type = "residential";
  updateInfrastructure(city);
  assert.equal(tower.roadAccess, true);
  assert.equal(tower.powered, false);
  assert.equal(zone.watered, false);
});
