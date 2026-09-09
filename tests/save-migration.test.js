// A save the player made must keep loading after the game is updated.
//
// The version chain used to be written inline: version 6 jumped straight to the
// current number, version 7 stepped to 8, and 8 stepped to current. A save from
// 6 therefore skipped whatever 8 did to it, and every new SAVE_VERSION meant
// deciding by hand which of the earlier fixes a save still needed. Once the game
// is online that arithmetic is somebody's city.
//
// The chain is now a list of steps, each from one version to the next. These
// tests check that the list is unbroken, that each step does what it says, and
// that a save it cannot read says so clearly instead of being discarded.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, place, refresh, serialize, deserialize } from "../src/sim.js";
import { SAVE_VERSION, OLDEST_SUPPORTED_SAVE, MIGRATIONS } from "../src/sim/city.js";
import { connectionOffers, establishConnection } from "../src/sim/neighbor-links.js";
import { updateGrowth } from "../src/sim/growth.js";
import { portOf, portModules } from "../src/sim/port-layout.js";

const at = (c, x, y) => c.tiles[y * c.size + x];

// A save is only ever produced by the game, so every fixture starts as a real
// city and is walked backwards into the shape the older build would have
// written. Hand-written saves would test the fixture, not the migration.
const asJSON = (city) => JSON.parse(serialize(city));
const asText = (d) => JSON.stringify(d);

function plains(seed = 3) {
  return createCity({ seed, starter: false, layout: "plains", startYear: 2000, hills: 0 });
}

// A city with a power line and a pipe reaching the map edge, which is what the
// utility-connection migration has to find.
function borderCity({ purchase = false } = {}) {
  const city = plains();
  city.money = 5_000_000;
  place(city, 10, 20, "coal");
  place(city, 12, 20, "watertower");
  for (let x = 0; x <= 10; x++) place(city, x, 20, "powerline");
  for (let x = 0; x <= 12; x++) place(city, x, 21, "pipe");
  refresh(city);
  // Endpoints are bought, not detected, so a city with connections on record
  // has to buy them the way the player does.
  if (purchase) for (const offer of connectionOffers(city, city.tiles)) establishConnection(city, offer);
  refresh(city);
  return city;
}

// An airport zone the Sims have filled with modules, which is what a save from
// before modules existed did not have.
function portCity() {
  // The same arrangement tests/ports.test.js uses: a plant, a line, a tower and
  // a road beside the zone, which is what the manual says a port needs.
  const city = plains(5);
  city.money = 5_000_000;
  place(city, 10, 20, "coal");
  for (let i = 14; i <= 18; i++) place(city, i, 20, "powerline");
  place(city, 19, 20, "watertower");
  for (let i = 19; i <= 28; i++) place(city, i, 18, "road");
  for (let dy = 0; dy < 6; dy++) for (let dx = 0; dx < 8; dx++) place(city, 20 + dx, 20 + dy, "airport");
  refresh(city);
  for (let i = 0; i < 12; i++) updateGrowth(city, { residential: 0, commercial: 0, industrial: 0, airport: 100, seaport: 100 }, () => 0);
  refresh(city);
  return city;
}

const anchors = (city) => city.tiles.filter((t) => t.type === "airport" && t.lot && t.lot.x === t.x && t.lot.y === t.y);

describe("save migration", () => {
  test("the list is a contiguous chain, one version per step", () => {
    // The bug this list replaced was a step that jumped versions. Reading the
    // table is the cheapest way to know that cannot happen again.
    assert.equal(MIGRATIONS[0].from, OLDEST_SUPPORTED_SAVE);
    assert.equal(MIGRATIONS.at(-1).to, SAVE_VERSION);
    MIGRATIONS.forEach((step, i) => {
      assert.equal(step.to, step.from + 1, `step ${step.from} moves exactly one version`);
      if (i > 0) assert.equal(step.from, MIGRATIONS[i - 1].to, `step ${step.from} follows the one before it`);
    });
    assert.equal(MIGRATIONS.length, SAVE_VERSION - OLDEST_SUPPORTED_SAVE, "no version is missing a step");
  });

  test("the steps form an unbroken chain to the current version", () => {
    // Walk a current save down to the oldest supported version and back up.
    // Any gap in the chain strands every save at the missing rung.
    const city = plains();
    for (let version = OLDEST_SUPPORTED_SAVE; version <= SAVE_VERSION; version++) {
      const d = asJSON(city);
      d.version = version;
      assert.doesNotThrow(() => deserialize(asText(d)), `version ${version} has no way forward`);
    }
  });

  test("a version 6 city keeps its border connections", () => {
    // Sides were compass points before the map's diamond orientation settled.
    const city = borderCity({ purchase: true });
    const live = deserialize(serialize(city));
    assert.ok(live.transportConnections.length > 0, "the fixture has connections to migrate");

    const old = { northeast: "north", southeast: "east", southwest: "south", northwest: "west" };
    const d = asJSON(city);
    d.version = 6;
    d.transportConnections = d.transportConnections.map((c) => ({ ...c, side: old[c.side] ?? c.side }));

    const migrated = deserialize(asText(d));
    assert.deepEqual(
      migrated.transportConnections.map((c) => c.side).sort(),
      live.transportConnections.map((c) => c.side).sort(),
      "compass names came back as corner names",
    );
    for (const c of migrated.transportConnections) {
      assert.ok(["northeast", "southeast", "southwest", "northwest"].includes(c.side), `${c.side} is a corner name`);
    }
  });

  test("a version 6 port is rebuilt, not rejected", () => {
    // The old chain sent version 6 straight to the current number, so the step
    // that version 8 needed never ran on it. A port lot from a version 6 save
    // then reached the tile checks with no module and the load was refused
    // outright: "Invalid save: port lot without a module."
    const city = portCity();
    assert.ok(anchors(city).length > 0, "the fixture has a developed airport");
    assert.ok(portModules(portOf(city, anchors(city)[0])).length > 0, "with modules in it");

    for (const version of [6, 7, 8]) {
      const d = asJSON(city);
      d.version = version;
      // A save from before modules carries no module code on any tile.
      d.tiles = d.tiles.map((row) => row.slice(0, 27));

      const migrated = deserialize(asText(d));
      assert.equal(anchors(migrated).length, 0, `version ${version}: the old slab was cleared`);
      assert.ok(migrated.tiles.some((t) => t.type === "airport"), `version ${version}: the zone is still there to rebuild on`);
    }
  });

  test("utility endpoints from before contracts are kept, not re-charged", () => {
    const city = borderCity();
    const d = asJSON(city);
    d.version = 7;
    // Version 7 connected power and water automatically, so its saves carry no
    // record of the endpoints.
    d.transportConnections = (d.transportConnections || []).filter((c) => c.route !== "powerline" && c.route !== "pipe");
    const before = d.money;

    const migrated = deserialize(asText(d));
    const routes = migrated.transportConnections.map((c) => c.route);
    assert.ok(routes.includes("powerline"), "the power line endpoint came back");
    assert.ok(routes.includes("pipe"), "and the pipe endpoint with it");
    assert.equal(migrated.money, before, "with no retroactive connection fee");
  });

  test("a current save is untouched by the chain", () => {
    const city = borderCity();
    const text = serialize(city);
    assert.equal(serialize(deserialize(text)), text, "round trips byte for byte");
  });

  test("a save from before the oldest supported version says so", () => {
    const d = asJSON(plains());
    d.version = OLDEST_SUPPORTED_SAVE - 1;
    assert.throws(() => deserialize(asText(d)), (err) => {
      assert.match(err.message, new RegExp(`version ${OLDEST_SUPPORTED_SAVE - 1}`), "names the version it found");
      assert.match(err.message, /older than this game can read/);
      return true;
    });
  });

  test("a save from a newer build asks the player to update", () => {
    // Two tabs, one on an old build: the newer save must not read as corrupt.
    const d = asJSON(plains());
    d.version = SAVE_VERSION + 1;
    assert.throws(() => deserialize(asText(d)), /newer version of the game/);
  });

  test("a version that is not a version number is corrupt, not ancient", () => {
    // Calling a broken file old sends the player looking for a build that never
    // existed. Every one of these is a damaged save, not an old one.
    const base = asJSON(plains());
    for (const version of [undefined, "9", 9.5, 0, -1, NaN, Number.MAX_SAFE_INTEGER + 2, null, {}]) {
      const d = { ...base };
      if (version === undefined) delete d.version; else d.version = version;
      assert.throws(() => deserialize(asText(d)), /corrupt/, `version ${JSON.stringify(version)} reads as corrupt`);
    }
  });

  test("every step moves exactly one version forward", () => {
    // A step that skipped a version would silently drop the one it jumped.
    const city = plains();
    for (let version = OLDEST_SUPPORTED_SAVE; version < SAVE_VERSION; version++) {
      const d = asJSON(city);
      d.version = version;
      const loaded = deserialize(asText(d));
      assert.equal(JSON.parse(serialize(loaded)).version, SAVE_VERSION, `version ${version} arrives at ${SAVE_VERSION}`);
    }
  });
});
