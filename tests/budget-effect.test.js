// What the budget actually buys. The manual: "An over funded branch will
// waste money. Underfunding causes a loss of effectiveness of the branch",
// and "Road Budget - Pays for road and highway maintenance, and keeps roads
// from falling apart."
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, serialize, deserialize, setPolicy, inspectTile } from "../src/sim.js";
import { targetCondition, roadCapacity, WORST } from "../src/sim/roads.js";
import { FUNDED_DEPARTMENTS, BUILDINGS } from "../src/sim/catalog.js";

const years = (city, n) => { for (let i = 0; i < n * 12; i++) tick(city); };

describe("the six city services", () => {
  // "The Mayor makes the final decision on how to fund six city services...
  // Education Budget... Public Health Budget... Fire Budget... Road Budget...
  // Police Budget... Mass Transit Budget."
  test("are exactly the six the manual names", () => {
    assert.deepEqual([...FUNDED_DEPARTMENTS].sort(),
      ["education", "fire", "health", "police", "road", "transit"]);
  });

  test("streets bill the road budget and timetabled services bill transit", () => {
    for (const type of ["road", "highway", "onramp", "tunnel"]) assert.equal(BUILDINGS[type].dept, "road", type);
    for (const type of ["rail", "railstation", "subway", "substation", "bus"]) assert.equal(BUILDINGS[type].dept, "transit", type);
  });

  test("both appear in the budget as separate lines", () => {
    const c = createCity(21, true);
    const { expenses } = getStats(c).budget;
    assert.ok(expenses.road > 0, "a town with streets pays a road bill");
    assert.ok(Number.isFinite(expenses.transit));
  });

  test("starving mass transit weakens its stations", () => {
    const funded = createCity(21, true);
    const starved = createCity(21, true);
    setPolicy(starved, "funding.transit", 20);
    const cover = (city) => city.tiles.reduce((a, t) => a + (t.svc?.bus || 0) + (t.svc?.rail || 0), 0);
    assert.ok(cover(starved) < cover(funded), `${cover(starved)} vs ${cover(funded)}`);
  });

  test("and does not touch the road surface", () => {
    const c = createCity(21, true);
    setPolicy(c, "funding.transit", 0);
    years(c, 5);
    assert.equal(c.roadCondition, 100, "mass transit does not resurface streets");
  });
});

// Every funded department has to change something the player can see, or the
// budget slider is decoration. The mass transit budget was: every level from
// 0% to 120% produced byte-identical traffic, and only a strike did anything.
// This sweeps the other five on the timescale each one actually works over,
// because a cohort statistic like schooling cannot move in a month and a road
// surface cannot decay in one either.
describe("every department budget moves something", () => {
  const settled = () => { const c = createCity(21, true); for (let i = 0; i < 240; i++) tick(c); return c; };
  // Same city, same span, one budget the only difference.
  function compare(dept, years, read) {
    const saved = serialize(settled());
    const at = (pct) => {
      const c = deserialize(saved);
      setPolicy(c, `funding.${dept}`, pct);
      for (let i = 0; i < years * 12; i++) tick(c);
      return read(c, getStats(c));
    };
    return { full: at(100), starved: at(20), lavish: at(120) };
  }

  test("police funding holds crime down", () => {
    const r = compare("police", 0, (c, s) => s.crime);
    assert.ok(r.starved > r.full, `crime ${r.starved} starved against ${r.full} funded`);
  });

  test("fire funding widens coverage", () => {
    const r = compare("fire", 0, (c, s) => s.fireCover);
    assert.ok(r.starved < r.full, `coverage ${r.starved} starved against ${r.full} funded`);
  });

  test("health funding lengthens lives", () => {
    const r = compare("health", 5, (c, s) => s.lifeExpectancy);
    assert.ok(r.starved < r.full - 5, `life expectancy ${r.starved} starved against ${r.full} funded`);
  });

  test("education funding teaches children", () => {
    const r = compare("education", 8, (c, s) => s.youthEq);
    assert.ok(r.starved < r.full - 5, `youth EQ ${r.starved} starved against ${r.full} funded`);
  });

  test("the road budget keeps the surface up", () => {
    const r = compare("road", 5, (c) => c.roadCondition);
    assert.ok(r.starved < r.full, `condition ${r.starved} starved against ${r.full} funded`);
    assert.equal(r.full, 100, "a fully funded road budget should hold the surface");
  });

  // "An over funded branch will waste money."
  test("no department does better than adequate on more than adequate", () => {
    for (const [dept, years, read] of [["police", 0, (c, s) => s.crime], ["fire", 0, (c, s) => s.fireCover], ["road", 5, (c) => c.roadCondition]]) {
      const r = compare(dept, years, read);
      assert.equal(r.lavish, r.full, `${dept} bought something with the extra 20%`);
    }
  });
});

describe("over-funding is waste", () => {
  test("paying a department more than it asks buys no extra coverage", () => {
    const full = createCity(21, true);
    const lavish = createCity(21, true);
    setPolicy(lavish, "funding.police", 120);
    setPolicy(lavish, "funding.fire", 120);
    assert.equal(getStats(lavish).police, getStats(full).police);
    assert.equal(getStats(lavish).fireCover, getStats(full).fireCover);
  });

  test("but it does cost more", () => {
    const full = createCity(21, true);
    const lavish = createCity(21, true);
    setPolicy(lavish, "funding.police", 120);
    assert.ok(getStats(lavish).budget.expenses.police > getStats(full).budget.expenses.police);
  });

  test("under-funding does lose effectiveness", () => {
    const full = createCity(21, true);
    const starved = createCity(21, true);
    setPolicy(starved, "funding.police", 30);
    assert.ok(getStats(starved).police < getStats(full).police);
  });

  test("over-funding schools buys no extra teaching either", () => {
    const full = createCity(21, true);
    const lavish = createCity(21, true);
    setPolicy(lavish, "funding.education", 120);
    years(full, 12); years(lavish, 12);
    assert.equal(getStats(lavish).eq, getStats(full).eq);
  });
});

describe("roads fall apart without maintenance", () => {
  test("a new city starts with a sound network", () => {
    const c = createCity(21, true);
    assert.equal(c.roadCondition, 100);
    assert.equal(targetCondition(c), 100);
    assert.equal(roadCapacity(c), 1);
  });

  test("cutting the road budget wears the surface down and jams traffic", () => {
    const kept = createCity(21, true);
    const cut = createCity(21, true);
    setPolicy(cut, "funding.road", 20);
    years(kept, 5); years(cut, 5);
    assert.ok(cut.roadCondition < 60, `condition only fell to ${cut.roadCondition}`);
    assert.ok(cut.roadCondition >= WORST);
    assert.ok(getStats(cut).traffic > getStats(kept).traffic, `traffic ${getStats(cut).traffic} vs ${getStats(kept).traffic}`);
  });

  test("restoring the budget repairs them, but not overnight", () => {
    const c = createCity(21, true);
    setPolicy(c, "funding.road", 0);
    years(c, 5);
    const worn = c.roadCondition;
    setPolicy(c, "funding.road", 100);
    for (let i = 0; i < 6; i++) tick(c);
    assert.ok(c.roadCondition > worn, "repairs should have begun");
    assert.ok(c.roadCondition < 100, "and should not be finished in half a year");
    years(c, 4);
    assert.ok(c.roadCondition > 95, `condition reached only ${c.roadCondition}`);
  });

  test("the mayor is warned as the surface goes and told when it is fixed", () => {
    const c = createCity(21, true);
    setPolicy(c, "funding.road", 10);
    const heard = [];
    for (let i = 0; i < 60; i++) for (const n of tick(c).news) if (/[Rr]oad (surfaces|repairs)|breaking up/.test(n)) heard.push(n);
    assert.ok(heard.some((n) => /deteriorating/.test(n)), heard.join(" | "));
    assert.ok(heard.some((n) => /breaking up/.test(n)), heard.join(" | "));
    setPolicy(c, "funding.road", 100);
    const fixed = [];
    for (let i = 0; i < 40; i++) for (const n of tick(c).news) if (/repairs are complete/.test(n)) fixed.push(n);
    assert.equal(fixed.length, 1, "the all-clear should be announced once");
  });

  test("querying a road reports its surface", () => {
    const c = createCity(21, true);
    const road = c.tiles.find((t) => t.type === "road" && t.terrain !== "water");
    assert.match(inspectTile(c, road.x, road.y).details.join(" | "), /Surface: 100% — well maintained/);
    setPolicy(c, "funding.road", 0);
    years(c, 6);
    assert.match(inspectTile(c, road.x, road.y).details.join(" | "), /Surface: \d+% — breaking up/);
  });

  test("road condition survives a save", () => {
    const c = createCity(21, true);
    setPolicy(c, "funding.road", 40);
    years(c, 3);
    const d = deserialize(serialize(c));
    assert.equal(d.roadCondition, c.roadCondition);
    years(c, 2); years(d, 2);
    assert.equal(serialize(d), serialize(c));
  });
});

// "Typically, when you lower tax rates for any sector, demand for that sector
// will increase. If you raise taxes, demand decreases."
//
// And the harder half, which the model gets right: "Raising taxes may either
// raise or lower city income. It just depends on the current conditions in the
// city." A rate high enough to empty the city earns less than a moderate one.
describe("taxes", () => {
  const settled = () => { const c = createCity(21, true); for (let i = 0; i < 240; i++) tick(c); return c; };

  test("demand falls as the rate rises, in every sector", () => {
    const saved = serialize(settled());
    for (const kind of ["residential", "commercial", "industrial"]) {
      let last = Infinity;
      for (const rate of [0, 4, 7, 10, 14, 20]) {
        const c = deserialize(saved);
        setPolicy(c, `tax.${kind}`, rate);
        tick(c);
        const d = getStats(c).demand[kind];
        assert.ok(d <= last, `${kind} demand rose from ${last} to ${d} when tax went to ${rate}%`);
        last = d;
      }
    }
  });

  test("a punishing rate earns less than a moderate one", () => {
    const saved = serialize(settled());
    const income = (rate) => {
      const c = deserialize(saved);
      for (const k of ["residential", "commercial", "industrial"]) setPolicy(c, `tax.${k}`, rate);
      for (let i = 0; i < 180; i++) tick(c);
      const s = getStats(c);
      return { income: s.budget.income.total, pop: s.population };
    };
    const moderate = income(14), punishing = income(20);
    assert.ok(punishing.pop < moderate.pop * 0.6, `20% left ${punishing.pop} of ${moderate.pop} residents`);
    assert.ok(punishing.income < moderate.income, `20% earned ${punishing.income} against 14%'s ${moderate.income}`);
  });

  test("the rate is held to the range the budget window allows", () => {
    const c = createCity(21, true);
    assert.equal(setPolicy(c, "tax.residential", 21).ok, false);
    assert.equal(setPolicy(c, "tax.residential", -1).ok, false);
    assert.equal(setPolicy(c, "tax.residential", 20).ok, true);
    assert.equal(setPolicy(c, "tax.residential", 0).ok, true);
  });
});
