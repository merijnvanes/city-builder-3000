// Airport and seaport zones. The manual, pages 33-34 and 73:
//
//   "What actually builds in the Residential, Commercial, Industrial, Airport
//   and Seaport zones is up to the Sims."
//   "Available in 1930, airports must be at least 3x5 tiles or larger in order
//   to develop. They also require power, water and a road nearby. They will
//   only develop as your city grows and requires outside sources for commerce
//   and industry."
//   "Seaports... require power, water, and a road nearby. They must be located
//   along a shoreline to do anything, but if you want to see real results,
//   build one on a seacoast."
//   "Seaports and airports are considered connections to all neighbors."
//
// A port fills its zone with modules: a runway and terminal, then hangars and
// aprons; a freight shed and quays, then piers and yards. See port-layout.js.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, place, evaluate, refresh, getStats, serialize, deserialize, inspectTile, BUILDINGS, TOOL_MAP } from "../src/sim.js";
import { updateGrowth } from "../src/sim/growth.js";
import { PORTS, berthFactor, portDemand, portJobs, portComponentJobs, standingPorts } from "../src/sim/ports.js";
import { portOf, portModules, planPortCore, isRunwayPart, PORT_PARTS, RUNWAY_MIN, RUNWAY_MAX } from "../src/sim/port-layout.js";
import { dealAvailable, detectConnections } from "../src/sim/neighbors.js";
import { SAVE_VERSION } from "../src/sim/city.js";

const at = (c, x, y) => c.tiles[y * c.size + x];
const plains = (seed = 5) => createCity({ seed, starter: false, layout: "plains", startYear: 2000, hills: 0 });
// Every roll succeeds, so a development that can happen does.
const always = () => 0;

// A block of port zone with power, water and a road nearby - the three things
// the manual says a port needs - and nothing else on the map.
function zonePort(city, type, x, y, w, h) {
  city.money = 5_000_000;
  place(city, 10, 20, "coal");
  for (let i = 14; i <= 18; i++) place(city, i, 20, "powerline");
  place(city, 19, 20, "watertower");
  for (let i = x - 1; i <= x + w; i++) place(city, i, y - 2, "road");
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) place(city, x + dx, y + dy, type);
  refresh(city);
  return at(city, x, y);
}

const develop = (city, months = 1) => { for (let i = 0; i < months; i++) updateGrowth(city, { residential: 0, commercial: 0, industrial: 0, airport: 100, seaport: 100 }, always); };
const modulesOf = (city, t) => portModules(portOf(city, t));
const parts = (city, t) => modulesOf(city, t).map((a) => a.part).sort();

describe("ports are zoned, not placed", () => {
  test("neither is in the building catalog", () => {
    assert.equal(BUILDINGS.airport, undefined);
    assert.equal(BUILDINGS.seaport, undefined);
  });

  test("both are zone tools, priced per tile", () => {
    for (const id of ["airport", "seaport"]) {
      assert.equal(TOOL_MAP[id].group, "zone", id);
      assert.ok(TOOL_MAP[id].cost > 0, id);
    }
  });

  test("zoning marks the tile and charges by the tile", () => {
    const c = plains();
    c.money = 5_000_000;
    const before = c.money;
    assert.equal(place(c, 20, 20, "seaport").ok, true);
    assert.equal(at(c, 20, 20).type, "seaport");
    assert.equal(at(c, 20, 20).density, 1);
    assert.equal(at(c, 20, 20).lot, null, "the Sims build it, not the mayor");
    assert.equal(before - c.money, TOOL_MAP.seaport.cost);
  });

  test("a seaport may reach into the water along the shore, an airport may not", () => {
    const c = plains();
    c.money = 5_000_000;
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 2; dx++) place(c, 22 + dx, 20 + dy, "makewater");
    assert.equal(place(c, 22, 21, "seaport").ok, true, "water beside land");
    assert.equal(at(c, 22, 21).type, "seaport");
    assert.equal(evaluate(c, 22, 21, "airport").ok, false);
    assert.match(evaluate(c, 20, 30, "airport").message || "", /.*/);
    // Open water with no shore is out of reach.
    for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 5; dx++) place(c, 40 + dx, 40 + dy, "makewater");
    assert.equal(evaluate(c, 42, 42, "seaport").ok, false);
    assert.match(evaluate(c, 42, 42, "seaport").message, /beside dry land/);
  });
});

describe("an airport opens with a runway and a terminal", () => {
  // "airports must be at least 3x5 tiles or larger in order to develop"
  test("a 3x4 zone has no room for a five-tile runway", () => {
    const c = plains();
    const seed = zonePort(c, "airport", 20, 20, 3, 4);
    assert.equal(planPortCore(c, portOf(c, seed)), null);
    develop(c);
    assert.equal(at(c, 20, 20).lot, null);
  });

  test("3x5 develops, in either orientation, as a runway strip and a 2x2 terminal", () => {
    for (const [w, h] of [[3, 5], [5, 3]]) {
      const c = plains();
      const seed = zonePort(c, "airport", 20, 20, w, h);
      develop(c);
      const modules = modulesOf(c, seed);
      const runway = modules.filter((a) => isRunwayPart(a.part));
      assert.equal(runway.length, RUNWAY_MIN, `${w}x${h} runway`);
      assert.equal(runway.filter((a) => a.part.startsWith("threshold")).length, 2, "a threshold at each end");
      assert.ok(runway.every((a) => a.part.endsWith(h > w ? "-y" : "-x")), "the strip follows the long side");
      const terminal = modules.find((a) => a.part === "terminal");
      assert.deepEqual([terminal.lot.w, terminal.lot.h], [2, 2]);
      assert.equal(terminal.level, 1);
    }
  });

  test("a larger zone fills in over the months, tower first, and never beyond its bounds", () => {
    const c = plains();
    const seed = zonePort(c, "airport", 20, 20, 8, 6);
    develop(c);
    assert.equal(modulesOf(c, seed).filter((a) => isRunwayPart(a.part)).length, RUNWAY_MAX, "the strip uses the room it has, up to the limit");
    develop(c);
    assert.ok(parts(c, seed).includes("tower"), "the control tower comes next");
    develop(c, 40);
    const modules = modulesOf(c, seed);
    for (const a of modules) for (let y = a.lot.y; y < a.lot.y + a.lot.h; y++) for (let x = a.lot.x; x < a.lot.x + a.lot.w; x++) {
      assert.equal(at(c, x, y).type, "airport");
      assert.deepEqual(at(c, x, y).lot, a.lot, "modules never overlap");
    }
    assert.ok(parts(c, seed).includes("hangar"));
    assert.equal(portOf(c, seed).tiles.filter((t) => !t.lot).length, 0, "the zone is full");
    assert.ok(portComponentJobs(c, seed) > 0);
  });
});

describe("a seaport opens with a freight shed and grows quays along the shore", () => {
  function harbour(w = 3, h = 4) {
    const c = plains();
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < 2; dx++) place(c, 23 + dx, 20 + dy, "makewater");
    zonePort(c, "seaport", 20, 20, w, h);
    return c;
  }

  test("the shed comes first, then every shore tile becomes a quay", () => {
    const c = harbour();
    develop(c);
    assert.deepEqual(parts(c, at(c, 20, 20)), ["warehouse"]);
    develop(c, 6);
    const quays = modulesOf(c, at(c, 20, 20)).filter((a) => a.part === "quay");
    assert.ok(quays.length >= 3, `quays along the water: ${quays.length}`);
    assert.ok(quays.every((a) => at(c, a.x + 1, a.y).terrain === "water"), "each quay touches the water");
  });

  test("zoned water grows piers", () => {
    const c = harbour();
    c.money = 5_000_000;
    for (let dy = 0; dy < 4; dy++) place(c, 23, 20 + dy, "seaport");
    refresh(c);
    develop(c, 12);
    const piers = modulesOf(c, at(c, 20, 20)).filter((a) => a.part === "pier");
    assert.ok(piers.length >= 1, "piers on the zoned water");
    assert.ok(piers.every((a) => a.terrain === "water"));
  });

  test("a zone with no dry land cannot open, and says so", () => {
    const c = plains();
    c.money = 5_000_000;
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) place(c, 22 + dx, 20 + dy, "makewater");
    zonePort(c, "seaport", 20, 20, 1, 1);
    place(c, 20, 20, "bulldoze");
    // Power reaches the water zone along a line; nothing else is built.
    place(c, 20, 20, "powerline"); place(c, 21, 20, "powerline");
    for (let dy = 0; dy < 3; dy++) place(c, 22, 20 + dy, "seaport");
    refresh(c);
    develop(c);
    assert.equal(at(c, 22, 20).lot, null);
    assert.match(inspectTile(c, 22, 20).details[0], /dry land/);
  });
});

describe("what a port needs to open", () => {
  // "They also require power, water and a road nearby."
  const withoutOne = (missing) => {
    const c = plains();
    c.money = 5_000_000;
    if (missing !== "power") place(c, 10, 20, "coal");
    for (let i = 14; i <= 18; i++) place(c, i, 20, "powerline");
    if (missing !== "water") place(c, 19, 20, "watertower");
    if (missing !== "road") for (let i = 19; i <= 23; i++) place(c, i, 18, "road");
    for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 3; dx++) place(c, 20 + dx, 20 + dy, "airport");
    refresh(c);
    develop(c);
    return at(c, 20, 20).lot;
  };

  for (const missing of ["power", "water", "road"]) {
    test(`no ${missing}, no airport`, () => assert.equal(withoutOne(missing), null));
  }

  test("with all three it opens", () => assert.ok(withoutOne("nothing")));

  test("a port that loses its power closes as a whole, and reopens as a whole", () => {
    const c = plains();
    const seed = zonePort(c, "airport", 20, 20, 3, 5);
    develop(c);
    assert.ok(at(c, 20, 20).lot);
    place(c, 10, 20, "bulldoze");
    refresh(c);
    for (let i = 0; i < 20 && !modulesOf(c, seed).every((a) => a.abandoned); i++) develop(c);
    assert.ok(modulesOf(c, seed).every((a) => a.abandoned), "every module closes together");
    assert.equal(portComponentJobs(c, seed), 0);
    c.money = 5_000_000; place(c, 10, 20, "coal"); refresh(c);
    develop(c);
    assert.ok(modulesOf(c, seed).every((a) => !a.abandoned), "and reopens together");
  });
});

describe("the query card says why nothing has been built", () => {
  const firstLine = (c) => inspectTile(c, 20, 20).details[0];

  test("too small", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 3, 4);
    assert.match(firstLine(c), /straight run of 5 level tiles/);
  });

  test("stepping up a hill counts as too small", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 3, 5);
    at(c, 22, 24).elev = 1; at(c, 21, 24).elev = 1; at(c, 20, 24).elev = 1;
    c.revision++;
    assert.match(firstLine(c), /level tiles/);
  });

  test("missing a utility", () => {
    const c = plains();
    c.money = 5_000_000;
    place(c, 10, 20, "coal");
    for (let i = 14; i <= 19; i++) place(c, i, 20, "powerline");
    for (let i = 19; i <= 23; i++) place(c, i, 18, "road");
    for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 3; dx++) place(c, 20 + dx, 20 + dy, "airport");
    refresh(c);
    assert.match(firstLine(c), /Waiting on water/);
  });

  test("and nothing at all when it is only waiting for demand", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 3, 5);
    assert.match(firstLine(c), /Ready to build/);
  });

  test("a built module names itself and the whole port's jobs", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 3, 5);
    develop(c);
    const terminal = modulesOf(c, at(c, 20, 20)).find((a) => a.part === "terminal");
    const card = inspectTile(c, terminal.x, terminal.y);
    assert.match(card.title, /Airport · Terminal/);
    assert.match(card.details.join(" | "), /Jobs: [\d,]+ across the airport/);
  });
});

describe("airports arrive in 1930", () => {
  test("not before", () => {
    const early = createCity({ seed: 5, starter: false, layout: "plains", startYear: 1900, hills: 0 });
    early.money = 5_000_000;
    const r = place(early, 20, 20, "airport");
    assert.equal(r.ok, false);
    assert.match(r.message, /1930/);
  });

  test("but seaports always", () => {
    const early = createCity({ seed: 5, starter: false, layout: "plains", startYear: 1900, hills: 0 });
    early.money = 5_000_000;
    assert.equal(place(early, 20, 20, "seaport").ok, true);
  });
});

describe("a seaport wants a seacoast", () => {
  // "They must be located along a shoreline to do anything, but if you want to
  // see real results, build one on a seacoast."
  function berth(kind) {
    const c = plains();
    zonePort(c, "seaport", 20, 20, 2, 6);
    if (kind !== "inland") {
      for (let dy = 0; dy < 6; dy++) place(c, 22, 20 + dy, "makewater");
      if (kind === "sea") for (let dy = 0; dy < 6; dy++) at(c, 22, 20 + dy).salt = true;
    }
    refresh(c);
    develop(c);
    return c;
  }

  test("a berth with no water at all does nothing", () => {
    const c = berth("inland");
    const a = at(c, 20, 20);
    assert.ok(a.lot, "it is still built");
    assert.equal(berthFactor(c, a), 0);
    assert.equal(portJobs(c, a), 0);
  });

  test("a river berth works, but not as well as a sea one", () => {
    const river = berth("river"), sea = berth("sea");
    const a = (c) => at(c, 20, 20);
    assert.equal(berthFactor(sea, a(sea)), 1);
    const factor = berthFactor(river, a(river));
    assert.ok(factor > 0 && factor < 1, `an inland port should work, but not as well: ${factor}`);
    assert.ok(portJobs(sea, a(sea)) > portJobs(river, a(river)));
  });

  test("and the query card says which it is", () => {
    assert.match(inspectTile(berth("river"), 20, 20).details.join(" | "), /seacoast berth/);
    assert.match(inspectTile(berth("inland"), 20, 20).details.join(" | "), /Not on a shoreline/);
    assert.doesNotMatch(inspectTile(berth("sea"), 20, 20).details.join(" | "), /berth|shoreline/);
  });
});

describe("only as the city grows", () => {
  // "They will only develop as your city grows and requires outside sources
  // for commerce and industry."
  const want = (jobsCommercial, jobsIndustrial) =>
    portDemand(plains(), { jobsCommercial, jobsIndustrial });

  test("a village wants no terminal", () => {
    const d = want(200, 200);
    assert.ok(d.airport < 10, `airport demand ${d.airport}`);
    assert.ok(d.seaport < 10, `seaport demand ${d.seaport}`);
  });

  test("commerce pulls the airport, industry the seaport", () => {
    assert.ok(want(6000, 0).airport > want(0, 6000).airport);
    assert.ok(want(0, 3600).seaport > want(6000, 0).seaport);
  });

  test("a full-size want appears at the manual's minimum port", () => {
    assert.equal(PORTS.airport.scale, 9, "a five-tile runway and a 2x2 terminal");
    assert.equal(PORTS.seaport.scale, 12, "a 2x6 harbour");
    assert.equal(want(PORTS.airport.scale * PORTS.airport.carries, 0).airport, 100);
    assert.equal(want(0, PORTS.seaport.scale * PORTS.seaport.carries).seaport, 100);
  });

  test("and a built port takes the want away", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 3, 5);
    develop(c);
    assert.equal(portDemand(c, { jobsCommercial: PORTS.airport.scale * PORTS.airport.carries, jobsIndustrial: 0 }).airport, 0);
  });
});

describe("what a port is worth", () => {
  test("an airport lifts commercial demand, a seaport industrial", () => {
    const air = plains();
    zonePort(air, "airport", 20, 20, 3, 5);
    develop(air);
    refresh(air);
    const a = getStats(air).demandBonus;
    assert.ok(a.commercial > a.industrial && a.industrial > 0, JSON.stringify(a));

    const sea = plains();
    zonePort(sea, "seaport", 20, 20, 2, 6);
    for (let dy = 0; dy < 6; dy++) place(sea, 22, 20 + dy, "makewater");
    refresh(sea);
    develop(sea);
    refresh(sea);
    const s = getStats(sea).demandBonus;
    assert.ok(s.industrial > s.commercial && s.commercial > 0, JSON.stringify(s));
  });

  test("it employs Sims and bills the transit budget", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 3, 5);
    develop(c);
    refresh(c);
    const before = getStats(c).budget.expenses.transit;
    assert.ok(portComponentJobs(c, at(c, 20, 20)) > 100);
    assert.ok(before > 0, "a terminal costs the transit department something");
  });
});

describe("a terminal is a connection to every neighbour", () => {
  // "Seaports and airports are considered connections to all neighbors", and
  // garbage travels by "road, highway, rail, or seaport connection".
  test("no port, no garbage deal on a landlocked map", () => {
    const c = plains();
    for (const side of ["northeast", "southeast", "southwest", "northwest"]) {
      assert.equal(dealAvailable(detectConnections(c), "garbage", side), false, side);
    }
  });

  test("a working seaport opens one on every side", () => {
    const c = plains();
    zonePort(c, "seaport", 20, 20, 2, 6);
    for (let dy = 0; dy < 6; dy++) place(c, 22, 20 + dy, "makewater");
    refresh(c);
    develop(c);
    refresh(c);
    assert.equal(standingPorts(c).seaport, 1);
    for (const side of ["northeast", "southeast", "southwest", "northwest"]) {
      assert.equal(dealAvailable(detectConnections(c), "garbage", side), true, side);
    }
  });

  test("an inland seaport does not, because it is not on a shoreline", () => {
    const c = plains();
    zonePort(c, "seaport", 20, 20, 2, 6);
    develop(c);
    refresh(c);
    assert.equal(standingPorts(c).seaport, 0);
    assert.equal(dealAvailable(detectConnections(c), "garbage", "northeast"), false);
  });
});

describe("ports survive a save", () => {
  test("every module, its kind and its trade come back unchanged", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 6, 5);
    develop(c, 8);
    refresh(c);
    const back = deserialize(serialize(c));
    assert.deepEqual(parts(back, at(back, 20, 20)), parts(c, at(c, 20, 20)));
    assert.equal(portComponentJobs(back, at(back, 20, 20)), portComponentJobs(c, at(c, 20, 20)));
    assert.equal(getStats(back).demandBonus.commercial, getStats(c).demandBonus.commercial);
    assert.equal(serialize(back), serialize(c));
  });

  test("a tampered module is rejected", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 3, 5);
    develop(c);
    const raw = JSON.parse(serialize(c));
    const terminal = raw.tiles.findIndex((r) => r[27] === 1 + Object.keys(PORT_PARTS.airport).indexOf("terminal"));
    assert.ok(terminal >= 0);
    const density = JSON.parse(JSON.stringify(raw)); density.tiles[terminal][3] = 2;
    assert.throws(() => deserialize(JSON.stringify(density)), /bad density/);
    const quay = JSON.parse(JSON.stringify(raw)); quay.tiles[terminal][27] = 1 + Object.keys(PORT_PARTS.airport).length + Object.keys(PORT_PARTS.seaport).indexOf("quay");
    assert.throws(() => deserialize(JSON.stringify(quay)), /bad port module/);
    const bare = JSON.parse(JSON.stringify(raw)); bare.tiles[terminal][27] = 0;
    assert.throws(() => deserialize(JSON.stringify(bare)), /without a module/);
  });

  test("a version 8 city with a one-slab port keeps the zone and loses the slab", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 3, 5);
    develop(c);
    const raw = JSON.parse(serialize(c));
    raw.version = 8;
    for (const row of raw.tiles) row.length = 27;
    const back = deserialize(JSON.stringify(raw));
    assert.equal(back.version, SAVE_VERSION);
    assert.equal(at(back, 20, 20).type, "airport");
    assert.equal(at(back, 20, 20).lot, null, "the old slab is gone");
    develop(back);
    assert.ok(at(back, 20, 20).lot, "and the Sims build it again as modules");
  });
});
