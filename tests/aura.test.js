// Aura: a per-neighbourhood mood map whose weighted average is the mayoral
// approval rating.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, setPolicy, ORDINANCES } from "../src/sim.js";
import { AURA_BASE } from "../src/sim/services.js";

const at = (c, x, y) => c.tiles[y * c.size + x];
const residential = (c) => c.tiles.filter((t) => t.type === "residential" && t.lot && !t.abandoned);

describe("aura is a map, not a number", () => {
  test("neighbourhoods differ from one another", () => {
    const c = createCity(21, true);
    const values = residential(c).map((t) => t.aura);
    assert.ok(values.length > 20);
    assert.ok(Math.max(...values) - Math.min(...values) > 15, "every neighbourhood scored the same");
  });

  test("every tile gets an aura, water included", () => {
    const c = createCity(21, true);
    for (const t of c.tiles) assert.ok(Number.isInteger(t.aura) && t.aura >= 0 && t.aura <= 100, `(${t.x},${t.y}) aura ${t.aura}`);
  });

  test("a park lifts the ground around it and a landfill drags it down", () => {
    const c = createCity({ seed: 5, starter: false, layout: "plains" });
    c.money = 500000;
    const plain = at(c, 40, 40).aura;
    place(c, 20, 20, "largepark");
    place(c, 50, 20, "landfill");
    tick(c);
    assert.ok(at(c, 22, 22).aura > plain, `park ${at(c, 22, 22).aura} vs plain ${plain}`);
    assert.ok(at(c, 51, 21).aura < plain, `landfill ${at(c, 51, 21).aura} vs plain ${plain}`);
  });

  test("open ground sits near the base value", () => {
    const c = createCity({ seed: 5, starter: false, layout: "plains" });
    assert.ok(Math.abs(at(c, 40, 40).aura - AURA_BASE) < 12);
  });
});

describe("approval is the average of the map", () => {
  test("it matches the population-weighted mean of where people live", () => {
    const c = createCity(21, true);
    const s = getStats(c);
    // `aura` is that mean; approval starts there before the two city-wide
    // adjustments (unemployment and blackouts) are applied.
    assert.ok(Math.abs(s.aura - s.happiness) <= 10, `aura ${s.aura} vs approval ${s.happiness}`);
    assert.ok(s.happiness >= 5 && s.happiness <= 100);
  });

  test("a new starter town is content but not delighted", () => {
    for (const seed of [21, 42, 44, 99]) {
      const h = getStats(createCity(seed, true)).happiness;
      assert.ok(h > 40 && h < 75, `seed ${seed} approval ${h}`);
    }
  });
});

describe("what the manual says moves aura", () => {
  const approval = (setup) => {
    const c = createCity(21, true);
    setup(c);
    return getStats(c).happiness;
  };

  test("high taxes lower it", () => {
    const base = approval(() => {});
    const taxed = approval((c) => { for (const k of ["residential", "commercial", "industrial"]) setPolicy(c, `tax.${k}`, 18); });
    assert.ok(taxed < base - 10, `${taxed} vs ${base}`);
  });

  test("excessive regulation lowers it even when each rule is popular", () => {
    const liked = Object.entries(ORDINANCES).filter(([, o]) => (o.mood || 0) >= 0).map(([k]) => k);
    assert.ok(liked.length > 5, "need several inoffensive ordinances to test red tape");
    const base = approval(() => {});
    const regulated = approval((c) => { for (const k of liked) setPolicy(c, `ordinance.${k}`, true); });
    assert.ok(regulated < base, `${regulated} vs ${base}: red tape should still cost something`);
  });

  test("a hated ordinance costs more than a welcome one", () => {
    const base = approval(() => {});
    const hated = approval((c) => setPolicy(c, "ordinance.alternateDriving", true));
    const welcome = approval((c) => setPolicy(c, "ordinance.freeClinics", true));
    assert.ok(hated < base);
    assert.ok(welcome > hated, `welcome ${welcome} vs hated ${hated}`);
  });

  test("a teachers' strike is felt across the whole city", () => {
    const c = createCity(21, true);
    const before = getStats(c).happiness;
    setPolicy(c, "funding.education", 5);
    for (let i = 0; i < 20; i++) tick(c);
    assert.ok(getStats(c).strikes.education > 0);
    assert.ok(getStats(c).happiness < before, "a strike should be unpopular");
  });
});
