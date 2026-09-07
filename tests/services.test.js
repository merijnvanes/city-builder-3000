// Police and fire: budgets widen a precinct, overlapping precincts add up,
// and a city with nowhere to hold arrests loses police effectiveness.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, refresh, setPolicy, serialize, deserialize, inspectTile } from "../src/sim.js";
import { SERVICE_CAP, ARREST_RATE } from "../src/sim/services.js";
import { fireRiskOf } from "../src/sim/disasters.js";
import { BUILDINGS } from "../src/sim/catalog.js";

const at = (c, x, y) => c.tiles[y * c.size + x];
const blank = () => createCity({ seed: 5, starter: false, layout: "plains" });

// A station with a road and power, so it is staffed and running.
function station(city, x, y, type) {
  city.money = 500000;
  assert.equal(place(city, x, y, type).ok, true, `could not place ${type} at ${x},${y}`);
  for (let i = -1; i <= 3; i++) { place(city, x + i, y + 3, "road"); place(city, x + i, y - 1, "powerline"); }
  place(city, x - 1, y - 1, "wind");
  return at(city, x, y);
}

// How far the given service reaches from a station at (x, y).
function reach(city, kind, x, y) {
  let far = 0;
  for (const t of city.tiles) if ((t.svc?.[kind] || 0) > 0) far = Math.max(far, Math.max(Math.abs(t.x - x), Math.abs(t.y - y)));
  return far;
}

describe("funding sets the size of a precinct", () => {
  test("a well-funded police budget reaches further than a starved one", () => {
    const rich = blank();
    station(rich, 20, 20, "police");
    setPolicy(rich, "funding.police", 120);
    const wide = reach(rich, "police", 21, 21);

    const poor = blank();
    station(poor, 20, 20, "police");
    setPolicy(poor, "funding.police", 20);
    const narrow = reach(poor, "police", 21, 21);

    assert.ok(wide > narrow, `${wide} vs ${narrow}`);
    assert.ok(narrow >= 1, "a starved precinct still covers its own street");
  });

  test("fire coverage widens with its budget but stops at a limit", () => {
    const c = blank();
    station(c, 20, 20, "fire");
    setPolicy(c, "funding.fire", 100);
    const normal = reach(c, "fire", 21, 21);
    setPolicy(c, "funding.fire", 120);
    const most = reach(c, "fire", 21, 21);
    assert.ok(most >= normal);
    assert.ok(most <= BUILDINGS.fire.service.maxRadius + 2, `fire reached ${most}`);
  });
});

describe("overlapping precincts are additive", () => {
  test("two police stations protect their shared ground better than one", () => {
    const one = blank();
    station(one, 20, 20, "police");
    const single = at(one, 26, 21).svc.police;
    assert.ok(single > 0, "the tile should be inside a single precinct");

    const two = blank();
    station(two, 20, 20, "police");
    station(two, 30, 20, "police");
    const both = at(two, 26, 21).svc.police;
    assert.ok(both > single * 1.3, `overlap gave ${both}, one station gives ${single}`);
  });

  test("stacked coverage is capped", () => {
    const c = blank();
    for (let i = 0; i < 5; i++) station(c, 14 + i * 4, 26, "fire");
    const peak = Math.max(...c.tiles.map((t) => t.svc?.fire || 0));
    assert.ok(peak <= SERVICE_CAP, `coverage reached ${peak}`);
  });

  test("services with no overlap rule still take the best station", () => {
    const c = blank();
    station(c, 20, 20, "school");
    station(c, 26, 20, "school");
    const overlap = Math.max(...c.tiles.map((t) => t.svc?.education || 0));
    assert.ok(overlap <= BUILDINGS.school.service.strength * 1.25 + 1e-9, `education stacked to ${overlap}`);
  });
});

describe("jails", () => {
  test("without cells the police lose their effect", () => {
    const withJail = createCity(21, true);
    const noJail = createCity(21, true);
    for (const t of [...noJail.tiles]) {
      if (t.type === "jail" && t.lot?.x === t.x && t.lot?.y === t.y) place(noJail, t.x, t.y, "bulldoze");
    }
    const a = getStats(withJail), b = getStats(noJail);
    assert.equal(a.jailFactor, 1);
    assert.ok(b.jailFactor < 1, `no jail should cut effectiveness, got ${b.jailFactor}`);
    assert.ok(b.police < a.police, `police ${b.police} vs ${a.police}`);
    assert.ok(b.crime > a.crime, `crime ${b.crime} vs ${a.crime}`);
  });

  test("cells are needed in proportion to the population", () => {
    const c = createCity(21, true);
    const s = getStats(c);
    assert.ok(Math.abs(s.arrestable - s.population * ARREST_RATE) < 2, `${s.arrestable} for ${s.population}`);
    assert.ok(s.cells >= BUILDINGS.jail.cells * 0.9);
  });

  test("the maximum security prison holds prisoners too", () => {
    assert.ok(BUILDINGS.prison.cells > BUILDINGS.jail.cells);
  });
});

describe("fire risk", () => {
  test("stations do not stop fires starting, dry zones make them likelier", () => {
    // "Though a fire is just as likely to break out in an area with fire
    // protection as in one without."
    assert.equal(fireRiskOf({ dryShare: 0, fireCover: 0 }), fireRiskOf({ dryShare: 0, fireCover: 100 }));
    assert.ok(fireRiskOf({ dryShare: 0.5 }) > fireRiskOf({ dryShare: 0 }));
  });

  test("a city that waters its zones reports no dry share", () => {
    const c = createCity(21, true);
    for (let i = 0; i < 12; i++) tick(c);
    assert.ok(getStats(c).dryShare < 0.05, `dry share ${getStats(c).dryShare}`);
  });
});

describe("transit workers walk out", () => {
  // "The mass transit budget pays for the upkeep of rail and subway track, and
  // also the salaries of conductors, and bus drivers. If the mass transit
  // budget is low, things will start deteriorating and Sims will be less
  // likely to use the system. If the budget is far below adequate, transit
  // workers will go out on strike."
  const starve = (c) => { setPolicy(c, "funding.transit", 0); for (let i = 0; i < 30; i++) tick(c); };

  test("sustained underfunding calls a strike", () => {
    const c = createCity(21, true);
    assert.equal(c.people.strikes.transit, 0);
    starve(c);
    assert.ok(c.people.strikes.transit > 0, "the drivers should be out");
    assert.ok(c.news.some((n) => /Bus drivers and conductors walk out/.test(n)));
  });

  test("and every stop and station closes with them", () => {
    const c = createCity(21, true);
    const cover = (city) => city.tiles.reduce((a, t) => a + (t.svc?.bus || 0) + (t.svc?.rail || 0), 0);
    assert.ok(cover(c) > 0, "the town has stops to close");
    starve(c);
    assert.equal(cover(c), 0);
  });

  test("funding them properly again sends them back", () => {
    const c = createCity(21, true);
    starve(c);
    assert.ok(c.people.strikes.transit > 0);
    setPolicy(c, "funding.transit", 100);
    for (let i = 0; i < 6; i++) tick(c);
    assert.equal(c.people.strikes.transit, 0);
    assert.ok(c.news.some((n) => /Bus drivers and conductors return to work/.test(n)));
  });

  test("the strike survives a save", () => {
    const c = createCity(21, true);
    starve(c);
    assert.equal(deserialize(serialize(c)).people.strikes.transit, c.people.strikes.transit);
  });
});

describe("safety is worth something on the ground", () => {
  // "Good police and fire coverage raises land values in a city, which makes
  // Sims happy and proud to be citizens."
  test("a precinct lifts the value of the streets it covers", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    const spot = [36, 30];
    const before = at(c, spot[0], spot[1]).landValue;
    c.money = 5_000_000;
    place(c, 30, 30, "police");
    for (let i = -1; i <= 3; i++) place(c, 30 + i, 33, "road");
    refresh(c);
    assert.ok(at(c, spot[0], spot[1]).landValue > before,
      `${at(c, spot[0], spot[1]).landValue} vs ${before}`);
  });

  test("and so does a fire station", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    const spot = [36, 30];
    const before = at(c, spot[0], spot[1]).landValue;
    c.money = 5_000_000;
    place(c, 30, 30, "fire");
    for (let i = -1; i <= 3; i++) place(c, 30 + i, 33, "road");
    refresh(c);
    assert.ok(at(c, spot[0], spot[1]).landValue > before,
      `${at(c, spot[0], spot[1]).landValue} vs ${before}`);
  });
});

describe("convenient transport is worth something", () => {
  // "Land value is influenced by many factors, including pollution levels,
  // crime levels and the availability of convenient transportation."
  test("a bus stop lifts the value of the streets it serves", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    c.money = 5_000_000;
    for (let x = 24; x <= 36; x++) place(c, x, 30, "road");
    for (let y = 20; y <= 29; y++) place(c, 30, y, "powerline");
    refresh(c);
    const before = at(c, 33, 31).landValue;
    place(c, 30, 31, "bus");
    refresh(c);
    assert.ok(at(c, 33, 31).landValue > before, `${at(c, 33, 31).landValue} vs ${before}`);
  });

  test("and a stop nobody can reach is worth nothing", () => {
    // "Bus stops must be placed along the side of roads to be effective."
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    c.money = 5_000_000;
    for (let y = 20; y <= 29; y++) place(c, 30, y, "powerline");
    refresh(c);
    const before = at(c, 33, 31).landValue;
    place(c, 30, 31, "bus");
    refresh(c);
    assert.equal(at(c, 33, 31).landValue, before);
  });
});

// "Underfunding causes a loss of effectiveness of the branch, and may even
// prod the workers into going out on strike."
//
// A starved department keeps its buildings, so every symptom of it reads as
// though the city needs more of them. A mayor who had cut the health budget to
// nothing used to be told to build a hospital, next door to the unfunded one
// already standing there.
describe("advisors name a starved budget before they ask for buildings", () => {
  const settled = () => {
    const c = createCity(21, true);
    for (let i = 0; i < 240; i++) tick(c);
    return c;
  };
  const advice = (c, id) => getStats(c).advisors.find((a) => a.id === id);

  test("a fully funded city is never told to restore a budget", () => {
    const c = settled();
    for (const id of ["safety", "health", "transport"]) {
      assert.doesNotMatch(advice(c, id).message, /budget is at \d+%/, `${id} complained about a budget nobody cut`);
    }
  });

  test("Maria names the police budget rather than asking for stations", () => {
    const c = settled();
    setPolicy(c, "funding.police", 0);
    tick(c);
    const maria = advice(c, "safety");
    assert.equal(maria.mood, "bad");
    assert.match(maria.message, /police budget is at 0%/, maria.message);
  });

  test("the health advisor names the budget rather than asking for a hospital", () => {
    const c = settled();
    setPolicy(c, "funding.health", 0);
    tick(c);
    const doc = advice(c, "health");
    assert.match(doc.message, /health budget is at 0%/, doc.message);
    // The old advice was to build one, beside the hospital already standing.
    assert.doesNotMatch(doc.message, /Build a hospital/);
  });

  test("a walkout outranks the budget line that caused it", () => {
    const c = settled();
    setPolicy(c, "funding.health", 0);
    // "If funding levels wallow in inadequacy for an extended period of time,
    // you not only damage health levels, but risk your healthcare workers
    // calling a strike."
    for (let i = 0; i < 30; i++) tick(c);
    assert.equal(getStats(c).strikes.health > 0, true, "the doctors should have walked out by now");
    assert.match(advice(c, "health").message, /on strike/);
  });
});
