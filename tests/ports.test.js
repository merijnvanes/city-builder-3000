// Airport and seaport zones. The manual, pages 33-34 and 73:
//
//   "What actually builds in the Residential, Commercial, Industrial, Airport
//   and Seaport zones is up to the Sims."
//   "Available in 1930, airports must be at least 3x5 tiles or larger in order
//   to develop. They also require power, water and a road nearby. They will
//   only develop as your city grows and requires outside sources for commerce
//   and industry."
//   "Seaports must be zoned at least 2x6 tiles or larger in order to develop...
//   They must be located along a shoreline to do anything, but if you want to
//   see real results, build one on a seacoast."
//   "Seaports and airports are considered connections to all neighbors."
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, place, refresh, getStats, serialize, deserialize, inspectTile, BUILDINGS, TOOL_MAP } from "../src/sim.js";
import { updateGrowth } from "../src/sim/growth.js";
import { PORTS, berthFactor, findPortLot, portDemand, portJobs, standingPorts } from "../src/sim/ports.js";
import { dealAvailable, detectConnections } from "../src/sim/neighbors.js";

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

const develop = (city, type) => updateGrowth(city, { residential: 0, commercial: 0, industrial: 0, airport: 100, seaport: 100 }, always);

describe("ports are zoned, not placed", () => {
  test("neither is in the building catalog any more", () => {
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
});

describe("the minimum footprint", () => {
  // "airports must be at least 3x5 tiles or larger in order to develop"
  test("a 3x4 airport zone never develops", () => {
    const c = plains();
    const seed = zonePort(c, "airport", 20, 20, 3, 4);
    assert.equal(findPortLot(c, seed), null);
    develop(c, "airport");
    assert.equal(at(c, 20, 20).lot, null);
  });

  test("3x5 develops, in either orientation", () => {
    for (const [w, h] of [[3, 5], [5, 3]]) {
      const c = plains();
      zonePort(c, "airport", 20, 20, w, h);
      develop(c, "airport");
      const a = at(c, 20, 20);
      assert.ok(a.lot, `${w}x${h} should develop`);
      assert.equal(a.lot.w, w); assert.equal(a.lot.h, h);
      assert.equal(a.level, 1);
    }
  });

  // "Seaports must be zoned at least 2x6 tiles or larger in order to develop."
  test("a seaport needs 2x6", () => {
    const small = plains();
    zonePort(small, "seaport", 20, 20, 2, 5);
    develop(small, "seaport");
    assert.equal(at(small, 20, 20).lot, null);

    const big = plains();
    zonePort(big, "seaport", 20, 20, 2, 6);
    develop(big, "seaport");
    assert.ok(at(big, 20, 20).lot);
  });

  test("a larger block builds a larger terminal", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 6, 5);
    develop(c, "airport");
    const a = at(c, 20, 20);
    assert.equal(a.lot.w, 6); assert.equal(a.lot.h, 5);
    assert.ok(portJobs(c, a) > 0);
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
    develop(c, "airport");
    return at(c, 20, 20).lot;
  };

  for (const missing of ["power", "water", "road"]) {
    test(`no ${missing}, no airport`, () => assert.equal(withoutOne(missing), null));
  }

  test("with all three it opens", () => assert.ok(withoutOne("nothing")));

  test("a port that loses its power closes", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 3, 5);
    develop(c, "airport");
    assert.ok(at(c, 20, 20).lot);
    place(c, 10, 20, "bulldoze");
    refresh(c);
    for (let i = 0; i < 20 && !at(c, 20, 20).abandoned; i++) develop(c, "airport");
    assert.equal(at(c, 20, 20).abandoned, true);
    assert.equal(portJobs(c, at(c, 20, 20)), 0);
  });
});

describe("the query card says why nothing has been built", () => {
  // A terminal is one slab: unlike an RCI block it cannot fall back to a
  // smaller lot, so a zone that will never develop has to say so.
  const firstLine = (c) => inspectTile(c, 20, 20).details[0];

  test("too small", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 3, 4);
    assert.match(firstLine(c), /Not big enough: needs 3×5 tiles/);
  });

  test("stepping up a hill counts as too small", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 3, 5);
    at(c, 22, 24).elev = 1;
    assert.match(firstLine(c), /at one elevation/);
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
    develop(c, "seaport");
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

  test("a full-size want appears at the manual's minimum footprint", () => {
    // A minimum airport is 15 tiles, each carrying 400 commercial jobs.
    assert.equal(want(15 * PORTS.airport.carries, 0).airport, 100);
    assert.equal(want(0, 12 * PORTS.seaport.carries).seaport, 100);
  });

  test("and a built port takes the want away", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 3, 5);
    develop(c, "airport");
    assert.equal(portDemand(c, { jobsCommercial: 15 * PORTS.airport.carries, jobsIndustrial: 0 }).airport, 0);
  });
});

describe("what a port is worth", () => {
  test("an airport lifts commercial demand, a seaport industrial", () => {
    const air = plains();
    zonePort(air, "airport", 20, 20, 3, 5);
    develop(air, "airport");
    refresh(air);
    const a = getStats(air).demandBonus;
    assert.ok(a.commercial > a.industrial && a.industrial > 0, JSON.stringify(a));

    const sea = plains();
    zonePort(sea, "seaport", 20, 20, 2, 6);
    for (let dy = 0; dy < 6; dy++) place(sea, 22, 20 + dy, "makewater");
    refresh(sea);
    develop(sea, "seaport");
    refresh(sea);
    const s = getStats(sea).demandBonus;
    assert.ok(s.industrial > s.commercial && s.commercial > 0, JSON.stringify(s));
  });

  test("it employs Sims and bills the transit budget", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 3, 5);
    develop(c, "airport");
    refresh(c);
    const before = getStats(c).budget.expenses.transit;
    assert.ok(portJobs(c, at(c, 20, 20)) > 100);
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
    develop(c, "seaport");
    refresh(c);
    assert.equal(standingPorts(c).seaport, 1);
    for (const side of ["northeast", "southeast", "southwest", "northwest"]) {
      assert.equal(dealAvailable(detectConnections(c), "garbage", side), true, side);
    }
  });

  test("an inland seaport does not, because it is not on a shoreline", () => {
    const c = plains();
    zonePort(c, "seaport", 20, 20, 2, 6);
    develop(c, "seaport");
    refresh(c);
    assert.equal(standingPorts(c).seaport, 0);
    assert.equal(dealAvailable(detectConnections(c), "garbage", "northeast"), false);
  });
});

describe("ports survive a save", () => {
  test("the lot, its size and its trade come back unchanged", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 6, 5);
    develop(c, "airport");
    refresh(c);
    const back = deserialize(serialize(c));
    const a = at(back, 20, 20);
    assert.equal(a.type, "airport");
    assert.deepEqual(a.lot, { x: 20, y: 20, w: 6, h: 5 });
    assert.equal(portJobs(back, a), portJobs(c, at(c, 20, 20)));
    assert.equal(getStats(back).demandBonus.commercial, getStats(c).demandBonus.commercial);
  });

  test("a tampered port density is rejected", () => {
    const c = plains();
    zonePort(c, "airport", 20, 20, 3, 5);
    develop(c, "airport");
    const raw = JSON.parse(serialize(c));
    const code = raw.types.indexOf("airport");
    const row = raw.tiles.find((r) => r[2] === code);
    row[3] = 2;
    assert.throws(() => deserialize(JSON.stringify(raw)), /bad density/);
  });
});
