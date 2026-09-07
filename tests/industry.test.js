// Industrial subtypes: farms, heavy industry, manufacturing and high tech.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, serialize, deserialize, setPolicy, inspectTile } from "../src/sim.js";
import { nationalMix, industryWeights, pickIndustry, convertIndustry, INDUSTRY } from "../src/sim/industry.js";

const years = (city, n) => { for (let i = 0; i < n * 12; i++) tick(city); };

// A campus of civic buildings, each with road and power, well funded.
function educate(city) {
  const put = (type, span, count) => {
    let placed = 0;
    for (let y = 1; y + span + 1 < city.size && placed < count; y += span + 2) {
      for (let x = 1; x + span + 1 < city.size && placed < count; x += span + 2) {
        city.money = 2_000_000;
        if (!place(city, x, y, type).ok) continue;
        for (let i = -1; i <= span; i++) { place(city, x + i, y + span, "road"); place(city, x + i, y - 1, "powerline"); }
        for (let i = 0; i < span; i++) place(city, x - 1, y + i, "powerline");
        placed++;
      }
    }
    return placed;
  };
  put("school", 3, 14); put("college", 4, 5); put("library", 2, 14); put("museum", 3, 6);
  setPolicy(city, "funding.education", 120);
}

describe("the national economy", () => {
  test("moves from smoke to silicon over the century", () => {
    const early = nationalMix(1900), mid = nationalMix(1950), late = nationalMix(2050);
    assert.ok(early.dirty > early.manufacturing && early.dirty > early.hightech);
    assert.ok(mid.manufacturing > mid.dirty && mid.manufacturing > mid.hightech);
    assert.ok(late.hightech > late.manufacturing && late.hightech > late.dirty);
  });

  test("high tech does not exist before it is invented, however clever the city", () => {
    const w = industryWeights(1900, 130, 60);
    assert.ok(w.hightech < w.dirty / 10, `high tech in 1900: ${JSON.stringify(w)}`);
  });

  test("a badly schooled city cannot attract high tech in any year", () => {
    for (const year of [1950, 2000, 2050]) {
      const w = industryWeights(year, 35, 40);
      assert.ok(w.hightech < w.dirty, `EQ 35 in ${year}: ${JSON.stringify(w)}`);
    }
  });
});

describe("choosing an industry", () => {
  test("roomy, cheap low-density lots become farms", () => {
    const farm = { density: 1, lot: { w: 3, h: 3 }, landValue: 30 };
    for (const year of [1900, 2000, 2050]) assert.equal(pickIndustry(farm, year, 100, 0.5), "agriculture");
  });

  test("dense lots never become farms", () => {
    const dense = { density: 3, lot: { w: 3, h: 3 }, landValue: 30 };
    for (let i = 0; i < 50; i++) assert.notEqual(pickIndustry(dense, 2000, 100, i / 50), "agriculture");
  });

  test("a plant that still suits the city keeps working", () => {
    const t = { density: 2, lot: { w: 2, h: 2 }, landValue: 30, industry: "dirty" };
    // In 1900 heavy industry is the obvious use, so no roll should retool it.
    for (let i = 0; i < 50; i++) assert.equal(convertIndustry(t, 1900, 40, i / 50), "dirty");
  });

  test("a plant the city has outgrown eventually retools", () => {
    const t = { density: 2, lot: { w: 2, h: 2 }, landValue: 60, industry: "dirty" };
    const seen = new Set();
    for (let i = 0; i < 200; i++) seen.add(convertIndustry(t, 2040, 120, i / 200));
    assert.ok(seen.has("hightech"), `never reached high tech: ${[...seen]}`);
  });
});

describe("industry in a running city", () => {
  test("every developed industrial lot has a kind from the first frame", () => {
    const c = createCity(9, true);
    for (const t of c.tiles) {
      if (t.type !== "industrial" || !t.lot || t.lot.x !== t.x || t.lot.y !== t.y || !t.level) continue;
      assert.ok(INDUSTRY[t.industry], `lot at ${t.x},${t.y} has industry ${t.industry}`);
    }
    const mix = getStats(c).industryMix;
    assert.ok(mix.agriculture > 0, "a starter town should have some farmland");
  });

  test("schooling turns smokestacks into laboratories and clears the air", () => {
    const taught = createCity(9, true, { startYear: 1900 });
    educate(taught);
    years(taught, 140);
    const neglected = createCity(9, true, { startYear: 1900 });
    setPolicy(neglected, "funding.education", 0);
    years(neglected, 140);

    const a = getStats(taught), b = getStats(neglected);
    assert.ok(a.industryMix.hightech > a.industryMix.dirty, `taught city mix: ${JSON.stringify(a.industryMix)}`);
    assert.equal(b.industryMix.hightech, 0, `neglected city should have no high tech: ${JSON.stringify(b.industryMix)}`);
    assert.ok(b.industryMix.dirty > 0);
    assert.ok(a.pollution < b.pollution, `pollution ${a.pollution} vs ${b.pollution}`);
  });

  test("the query card names the industry", () => {
    const c = createCity(9, true);
    const t = c.tiles.find((t) => t.type === "industrial" && t.lot?.x === t.x && t.lot?.y === t.y && t.level);
    const labels = Object.values(INDUSTRY).map((i) => i.label);
    assert.ok(labels.some((l) => inspectTile(c, t.x, t.y).description.startsWith(l)));
  });

  test("industry kinds survive a round trip", () => {
    const c = createCity(9, true, { startYear: 1900 });
    educate(c);
    years(c, 60);
    const d = deserialize(serialize(c));
    assert.deepEqual(getStats(d).industryMix, getStats(c).industryMix);
    years(c, 5); years(d, 5);
    assert.equal(serialize(d), serialize(c));
  });

  test("a tampered industry code is rejected", () => {
    const c = createCity(9, true);
    const bad = JSON.parse(serialize(c));
    bad.tiles[0][18] = 99;
    assert.throws(() => deserialize(JSON.stringify(bad)), /bad industry/);
  });
});
