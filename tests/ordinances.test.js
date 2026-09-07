// Every ordinance does what its own card says it does.
//
// An ordinance is a promise printed on a button: the player reads "Cuts crime
// 15% city-wide", pays for it every month, and has no way to check. Two of them
// were charging for nothing. The Youth Curfew said "Lowers crime a little" and
// Legalized Gambling said "Raises crime", and neither appeared anywhere in the
// crime model — the curfew's two points of lost approval and the gambling
// revenue were the only things either one did.
//
// The manual asks for both directions:
//
//   "Enacting some ordinances can reduce crime, though you should weigh the
//   cost of the ordinance against the cost of providing additional police
//   protection. Be aware that some ordinances, like some buildings, tend to
//   increase crime levels."
//
// So this file measures each headline claim against a city that differs only
// by that one law. Anything asserted here is quoted from the ordinance's own
// description in city.js; if a description changes, the number here changes.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, setPolicy, refresh, serialize, deserialize, ORDINANCES } from "../src/sim.js";
import { flammability } from "../src/sim/fire.js";
import { isAnchor } from "../src/sim/lots.js";

// One settled city, saved, so every ordinance runs against the same start.
let SAVED;
function saved() {
  if (!SAVED) {
    const c = createCity(21, true);
    for (let i = 0; i < 240; i++) tick(c);
    SAVED = serialize(c);
  }
  return SAVED;
}
// The same city, `years` on, with `key` enacted (or untouched when key is null).
function withOrdinance(key, years = 5) {
  const c = deserialize(saved());
  if (key) assert.equal(setPolicy(c, `ordinance.${key}`, true).ok, true, `could not enact ${key}`);
  for (let i = 0; i < years * 12; i++) tick(c);
  return getStats(c);
}

describe("ordinances keep the promise on the card", () => {
  test("every ordinance can be enacted and repealed", () => {
    const c = deserialize(saved());
    for (const key of Object.keys(ORDINANCES)) {
      assert.equal(setPolicy(c, `ordinance.${key}`, true).ok, true, key);
      assert.equal(c.ordinances[key], true, key);
      assert.equal(setPolicy(c, `ordinance.${key}`, false).ok, true, key);
      assert.equal(c.ordinances[key], false, key);
    }
  });

  // "Cuts crime 15% city-wide."
  test("the Neighborhood Watch cuts crime", () => {
    const base = withOrdinance(null), watch = withOrdinance("neighborhoodWatch");
    assert.ok(watch.crime < base.crime, `${watch.crime} vs ${base.crime}`);
  });

  // "Lowers crime a little; residents grumble." A little, and less than the
  // Watch: it costs two points of approval, so it has to be the worse deal.
  test("the Youth Curfew lowers crime, by less than the Watch", () => {
    const base = withOrdinance(null);
    const curfew = withOrdinance("youthCurfew"), watch = withOrdinance("neighborhoodWatch");
    assert.ok(curfew.crime < base.crime, `curfew left crime at ${curfew.crime} against ${base.crime}`);
    assert.ok(curfew.crime > watch.crime, `curfew ${curfew.crime} should beat the Watch's ${watch.crime} by less`);
    assert.ok(curfew.happiness < base.happiness, "residents should grumble");
  });

  // "Earns $0.05 per resident. Raises crime."
  test("Legalized Gambling pays for itself in crime", () => {
    const base = withOrdinance(null), vice = withOrdinance("gambling");
    assert.ok(vice.crime > base.crime, `crime stayed at ${vice.crime} against ${base.crime}`);
    assert.ok(vice.balance > base.balance, `it should earn money: ${vice.balance} vs ${base.balance}`);
  });

  // "Reduces power demand 15%." / "Reduces water demand 15%."
  test("the conservation acts cut demand by the figure they name", () => {
    const base = withOrdinance(null, 1);
    for (const [key, meter] of [["energyConservation", "power"], ["waterConservation", "water"]]) {
      const after = withOrdinance(key, 1);
      const cut = 1 - after.utilities[meter].demand / base.utilities[meter].demand;
      assert.ok(Math.abs(cut - 0.15) < 0.03, `${key} cut ${meter} demand by ${(cut * 100).toFixed(1)}%, not 15%`);
    }
  });

  // "Sprinklers and inspections cut flammability across the city by 30%."
  test("the Fire Code cuts flammability by the figure it names", () => {
    const c = deserialize(saved());
    const lots = () => c.tiles.filter((t) => isAnchor(t) && t.lot && t.level);
    const mean = () => { const l = lots(); return l.reduce((s, t) => s + flammability(c, t), 0) / l.length; };
    const before = mean();
    setPolicy(c, "ordinance.fireCode", true);
    refresh(c);
    const cut = 1 - mean() / before;
    assert.ok(Math.abs(cut - 0.30) < 0.03, `flammability fell ${(cut * 100).toFixed(1)}%, not 30%`);
  });

  // "Boosts commercial demand."
  test("Tourism Promotion boosts commercial demand", () => {
    const base = withOrdinance(null, 3), tour = withOrdinance("tourismPromotion", 3);
    assert.ok(tour.demand.commercial > base.demand.commercial, `${tour.demand.commercial} vs ${base.demand.commercial}`);
  });

  // "Cuts road traffic 10%." / "Cuts road traffic 25%. Drivers hate it."
  test("the driving ordinances take cars off the road", () => {
    const base = withOrdinance(null, 2);
    const pool = withOrdinance("carpool", 2), alt = withOrdinance("alternateDriving", 2);
    assert.ok(pool.traffic < base.traffic, `carpool: ${pool.traffic} vs ${base.traffic}`);
    assert.ok(alt.traffic < pool.traffic, `alternate-day driving should beat carpooling: ${alt.traffic} vs ${pool.traffic}`);
    assert.ok(alt.happiness < base.happiness, "drivers should hate it");
  });

  // "Reduces air pollution 30%. Industry dislikes it."
  test("the Clean Air Act clears the air", () => {
    const base = withOrdinance(null, 3), clean = withOrdinance("cleanAir", 3);
    assert.ok(clean.pollution < base.pollution, `${clean.pollution} vs ${base.pollution}`);
  });

  // "Improves health coverage everywhere."
  test("Free Clinics lengthen lives", () => {
    const base = withOrdinance(null, 3), clinics = withOrdinance("freeClinics", 3);
    assert.ok(clinics.health > base.health, `${clinics.health} vs ${base.health}`);
    assert.ok(clinics.lifeExpectancy > base.lifeExpectancy, `${clinics.lifeExpectancy} vs ${base.lifeExpectancy}`);
  });

  // "Improves education coverage everywhere." Coverage teaches children, and
  // children take a working lifetime to become the workforce, so this is
  // measured on the Education Quotient over ten years rather than on a rounded
  // percentage over three: at three years both round to the same integer.
  test("the Pro-Reading Campaign raises schooling, slowly", () => {
    const base = withOrdinance(null, 10), reading = withOrdinance("readingCampaign", 10);
    assert.ok(reading.eq > base.eq + 0.5, `EQ ${reading.eq} vs ${base.eq} after ten years`);
  });

  // "Earns $0.02 per resident." / "Earns $0.05 per resident."
  test("the money-raising ordinances raise money and cost approval", () => {
    const base = withOrdinance(null, 1);
    for (const key of ["parkingFines", "gambling"]) {
      const after = withOrdinance(key, 1);
      assert.ok(after.balance > base.balance, `${key} earned nothing`);
      assert.ok(after.happiness < base.happiness, `${key} cost no approval`);
    }
  });
});
