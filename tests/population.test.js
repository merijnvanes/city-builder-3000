// Age structure, Education Quotient and Life Expectancy.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, serialize, deserialize, setPolicy, place, refresh } from "../src/sim.js";
import { stationaryPyramid, shares, meanLifespan, MAX_AGE, BASE_LIFE_EXPECTANCY, retirementAge } from "../src/sim/population.js";
import { build, years } from "./city-helpers.mjs";

describe("age structure", () => {
  test("the pyramid keeps a realistic shape at every life expectancy", () => {
    for (const le of [40, 59, 75, 90]) {
      const s = shares({ pyramid: stationaryPyramid(le), le }, 1000);
      assert.ok(s.childShare > 0.2 && s.childShare < 0.35, `children at LE ${le}: ${s.childShare}`);
      assert.ok(s.workforceShare > 0.35 && s.workforceShare < 0.45, `workforce at LE ${le}: ${s.workforceShare}`);
      assert.ok(s.seniorShare >= 0 && s.seniorShare < 0.3, `seniors at LE ${le}: ${s.seniorShare}`);
    }
  });

  // `stationaryPyramid` returns shares that sum to one; `ageOneYear` reads
  // counts. A town founded with residents already in it used to reconcile the
  // two by booking 98% of its own population as new arrivals, which threw the
  // seeded age structure away for the migration profile and handed every
  // resident SimNation's average schooling on the city's first birthday.
  test("a founders' town keeps the age structure it was founded with", () => {
    const c = createCity(21, true);
    const at0 = getStats(c);
    for (let i = 0; i < 12; i++) tick(c);
    const at1 = getStats(c);
    const drift = Math.abs(at1.childShare - at0.childShare);
    assert.ok(drift < 0.04, `children went ${(at0.childShare * 100).toFixed(0)}% to ${(at1.childShare * 100).toFixed(0)}% in one year`);
    // And the share that follows from it, which sets wantedPop = jobs / share
    // and so the demand the mayor is handed on day one.
    assert.ok(Math.abs(at1.workforceShare - at0.workforceShare) < 0.03,
      `workforce share went ${at0.workforceShare.toFixed(3)} to ${at1.workforceShare.toFixed(3)}`);
    // The band the stationary pyramid itself is asserted to sit in, above.
    assert.ok(at1.workforceShare > 0.35 && at1.workforceShare < 0.45, `${at1.workforceShare}`);
  });

  test("a town built on empty land treats its first residents as arrivals", () => {
    // Nothing to preserve there: they really do come from somewhere else.
    const c = createCity({ seed: 21, starter: false });
    assert.equal(getStats(c).population, 0);
  });

  test("longer lives mean longer working lives", () => {
    assert.ok(retirementAge(80) > retirementAge(55));
    assert.equal(retirementAge(BASE_LIFE_EXPECTANCY), 64);
  });

  test("the mortality curve actually produces the stated life expectancy", () => {
    // meanLifespan is what solveShift inverts; if it were wrong, `le` would be
    // a label rather than a measurement.
    for (const le of [45, 59, 72, 88]) {
      let lo = 0, hi = 140;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (meanLifespan(mid) < le) lo = mid; else hi = mid; }
      assert.ok(Math.abs(meanLifespan((lo + hi) / 2) - le) < 0.01);
    }
  });

  test("a new city starts at the average life expectancy from the manual", () => {
    const c = createCity(11, true);
    assert.equal(getStats(c).lifeExpectancy, BASE_LIFE_EXPECTANCY);
    assert.equal(c.people.pyramid.length, MAX_AGE);
  });
});

describe("education quotient", () => {
  test("schools raise the workforce slowly, over a working lifetime", () => {
    const c = createCity(21, true);
    build(c, "school", 8);
    build(c, "college", 3);
    const start = getStats(c).eq;
    years(c, 5);
    const early = getStats(c).eq;
    years(c, 35);
    const late = getStats(c).eq;
    // Children schooled in year one are not in the workforce in year five.
    assert.ok(early - start < 8, `EQ jumped ${early - start} in five years`);
    assert.ok(late > early + 10, `EQ only reached ${late} after forty years`);
  });

  test("children learn before the workforce does", () => {
    const c = createCity(22, true);
    build(c, "school", 8);
    years(c, 6);
    const s = getStats(c);
    assert.ok(s.youthEq > s.eq + 5, `youth ${s.youthEq} vs workforce ${s.eq}`);
  });

  test("without libraries or museums adult knowledge decays", () => {
    const c = createCity(23, true);
    // The founders' town comes with schools and a library, so take them away:
    // otherwise this measures well-taught children ageing into the workforce,
    // which is a different rule and pulls the other way.
    c.money = 5_000_000;
    for (const t of [...c.tiles]) {
      if (["school", "college", "library", "museum"].includes(t.type)) place(c, t.x, t.y, "bulldoze");
    }
    refresh(c);
    const before = getStats(c).eq;
    years(c, 25);
    assert.ok(getStats(c).eq < before, `EQ should fall in a city with no adult learning: ${before} -> ${getStats(c).eq}`);
  });

  test("a teachers' strike follows sustained underfunding and ends when it is restored", () => {
    const c = createCity(24, true);
    setPolicy(c, "funding.education", 10);
    for (let i = 0; i < 24; i++) tick(c);
    assert.ok(getStats(c).strikes.education > 0, "teachers should have walked out");
    assert.ok(c.news.some((n) => /Teachers walk out/.test(n)));
    setPolicy(c, "funding.education", 100);
    for (let i = 0; i < 3; i++) tick(c);
    assert.equal(getStats(c).strikes.education, 0);
  });
});

describe("life expectancy", () => {
  test("hospitals raise it and their absence lowers it", () => {
    const good = createCity(31, true);
    build(good, "hospital", 6);
    years(good, 30);
    const bad = createCity(31, true);
    years(bad, 30);
    assert.ok(getStats(good).lifeExpectancy > getStats(bad).lifeExpectancy + 5,
      `${getStats(good).lifeExpectancy} vs ${getStats(bad).lifeExpectancy}`);
  });

  test("it never leaves the range the manual gives", () => {
    const c = createCity(32, true);
    build(c, "hospital", 12);
    for (const k of ["freeClinics", "smokingBan", "juniorSports", "cprTraining"]) setPolicy(c, `ordinance.${k}`, true);
    years(c, 40);
    const le = getStats(c).lifeExpectancy;
    assert.ok(le > 70, `well-served city only reached ${le}`);
    assert.ok(le <= 90, `life expectancy exceeded the maximum: ${le}`);
  });

  test("cutting health funding to nothing calls a strike and shortens lives", () => {
    const c = createCity(33, true);
    build(c, "hospital", 6);
    years(c, 20);
    const healthy = getStats(c).lifeExpectancy;
    setPolicy(c, "funding.health", 0);
    years(c, 10);
    const s = getStats(c);
    assert.ok(s.strikes.health > 0);
    assert.ok(s.lifeExpectancy < healthy - 5, `${s.lifeExpectancy} vs ${healthy}`);
  });
});

describe("population saves", () => {
  test("age structure, schooling and strikes survive a round trip", () => {
    const c = createCity(41, true);
    build(c, "school", 4);
    setPolicy(c, "funding.education", 20);
    years(c, 8);
    const raw = serialize(c);
    const d = deserialize(raw);
    assert.equal(getStats(d).eq, getStats(c).eq);
    assert.equal(getStats(d).lifeExpectancy, getStats(c).lifeExpectancy);
    assert.deepEqual(getStats(d).strikes, getStats(c).strikes);
    years(c, 5); years(d, 5);
    assert.equal(serialize(d), serialize(c));
  });

  test("a tampered pyramid is rejected", () => {
    const c = createCity(42, true);
    const bad = JSON.parse(serialize(c));
    bad.people.pyramid = [1, 2, 3];
    assert.throws(() => deserialize(JSON.stringify(bad)), /age pyramid/);
    const bad2 = JSON.parse(serialize(c));
    bad2.people.le = 500;
    assert.throws(() => deserialize(JSON.stringify(bad2)), /life expectancy/);
  });
});
