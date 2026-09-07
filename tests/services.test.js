// Police and fire: budgets widen a precinct, overlapping precincts add up,
// and a city with nowhere to hold arrests loses police effectiveness.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, setPolicy, inspectTile } from "../src/sim.js";
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
