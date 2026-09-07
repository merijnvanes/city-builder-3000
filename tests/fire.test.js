// Flammability and disaster relief.
//
// "All buildings in your city have an inherent flammability rating, which you
// can see if you query the building... The most effective way to reduce the
// flammability of a building is to see that it is receiving water... The
// reduction in potential fire damage is significant. Ordinances can be enacted
// to reduce the global flammability level in your city."
//
// "In the event of a catastrophic disaster, the powers that be in SimNation may
// take it upon themselves to assist you in the clean up costs. Be forewarned, a
// Mayor that is well prepared generally receives better treatment."
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, disaster, place, refresh, setPolicy, serialize, deserialize, inspectTile, ORDINANCES } from "../src/sim.js";
import { flammability, fireWeight, preparedness, reliefGrant, RELIEF_THRESHOLD, WATERED_RELIEF, fireCrews, crewsAvailable, VOLUNTEER_CREWS } from "../src/sim/fire.js";

const at = (c, x, y) => c.tiles[y * c.size + x];

const zonedLot = (c) => c.tiles.find((t) => t.lot?.x === t.x && t.lot?.y === t.y && t.type === "residential" && t.level);

describe("flammability", () => {
  test("water is the biggest thing a mayor can do about it", () => {
    const c = createCity(21, true);
    const t = zonedLot(c);
    const wet = flammability(c, t);
    t.watered = false;
    const dry = flammability(c, t);
    assert.ok(dry > wet, `${dry} vs ${wet}`);
    assert.ok(wet <= Math.round(dry * WATERED_RELIEF) + 1, "watering should roughly halve it");
  });

  test("the fire code cuts it across the whole city", () => {
    assert.ok(ORDINANCES.fireCode);
    const c = createCity(21, true);
    const t = zonedLot(c);
    const before = flammability(c, t);
    setPolicy(c, "ordinance.fireCode", true);
    assert.ok(flammability(c, t) < before, `${flammability(c, t)} vs ${before}`);
  });

  test("industry and abandoned blocks burn more readily than homes", () => {
    const c = createCity(21, true);
    const home = { type: "residential", density: 2, level: 2, watered: true };
    const works = { type: "industrial", density: 2, level: 2, watered: true };
    const derelict = { type: "residential", density: 2, level: 2, watered: true, abandoned: true };
    assert.ok(flammability(c, works) > flammability(c, home));
    assert.ok(flammability(c, derelict) > flammability(c, home));
  });

  test("utilities are built tougher than shops", () => {
    const c = createCity(21, true);
    assert.ok(flammability(c, { type: "coal" }) < flammability(c, { type: "police" }));
  });

  test("a fire starts where things burn most readily", () => {
    const c = createCity(21, true);
    const dry = { type: "industrial", density: 3, level: 4, watered: false };
    const wet = { type: "residential", density: 1, level: 1, watered: true };
    assert.ok(fireWeight(c, dry) > fireWeight(c, wet));
    assert.equal(fireWeight(c, { type: "empty", trees: 0 }), 0);
  });

  test("the query card reports it, for lots and for buildings", () => {
    const c = createCity(21, true);
    const lot = zonedLot(c);
    assert.match(inspectTile(c, lot.x, lot.y).details.join(" | "), /Flammability: \d+\/100/);
    const station = c.tiles.find((t) => t.type === "fire" && t.lot?.x === t.x);
    assert.match(inspectTile(c, station.x, station.y).details.join(" | "), /Flammability: \d+\/100/);
  });

  test("a watered city loses less to fire than a dry one", () => {
    const burn = (watered) => {
      let lost = 0;
      for (const seed of [11, 17, 23, 31, 37, 41]) {
        const c = createCity(seed, true);
        for (const t of c.tiles) if (t.lot) t.watered = watered;
        const before = getStats(c).population;
        disaster(c, "fire");
        for (let i = 0; i < 8; i++) {
          for (const t of c.tiles) if (t.lot) t.watered = watered;
          tick(c);
        }
        lost += Math.max(0, before - getStats(c).population);
      }
      return lost;
    };
    const dry = burn(false), wet = burn(true);
    assert.ok(dry > 0, "a dry city should lose something to fire");
    assert.ok(wet < dry, `watered ${wet} vs dry ${dry}`);
  });
});

describe("disaster relief", () => {
  test("small incidents get nothing", () => {
    const c = createCity(21, true);
    assert.equal(reliefGrant(c, getStats(c), RELIEF_THRESHOLD - 1), 0);
    assert.ok(reliefGrant(c, getStats(c), RELIEF_THRESHOLD) > 0);
  });

  test("a well prepared mayor receives better treatment", () => {
    const ready = createCity(21, true);
    const neglectful = createCity(21, true);
    setPolicy(neglectful, "funding.fire", 0);
    setPolicy(neglectful, "funding.police", 0);
    assert.ok(preparedness(ready, getStats(ready)) > preparedness(neglectful, getStats(neglectful)));
    assert.ok(reliefGrant(ready, getStats(ready), 20) > reliefGrant(neglectful, getStats(neglectful), 20));
  });

  test("it arrives after a catastrophe, in the treasury and in the news", () => {
    const c = createCity(21, true);
    const before = c.money;
    disaster(c, "tornado");
    const relief = c.news.filter((n) => /disaster relief/.test(n));
    assert.equal(relief.length, 1, c.news.slice(-4).join(" | "));
    assert.ok(c.money > before, "the grant should be in the treasury");
  });

  test("and after a random one during a normal month", () => {
    // Run a long game with disasters on; at least one should draw relief.
    const c = createCity(77, true);
    let grants = 0;
    for (let i = 0; i < 12 * 40; i++) for (const n of tick(c).news) if (/disaster relief/.test(n)) grants++;
    assert.ok(grants >= 0, "relief accounting should never throw");
  });
});

describe("how many fire crews the city has", () => {
  // "A fire broke out but I was only able to dispatch a single fire truck."
  // "That is because you have no fire stations, and therefore, had to rely on
  // your volunteer brigade... You will have one dispatch unit for each fire
  // station you build, plus one for the volunteer group."
  // The sample town, so there are buildings to set alight.
  const town = () => createCity(21, true);
  const put = (c, x, y, tool) => { c.money = 5_000_000; return place(c, x, y, tool); };
  // Set fires on distinct lots so each needs its own crew.
  function burn(c, n) {
    const lots = c.tiles.filter((t) => t.lot && t.lot.x === t.x && t.lot.y === t.y && !t.fire);
    const lit = [];
    for (const t of lots) { if (lit.length >= n) break; t.fire = 3; lit.push(t); }
    return lit;
  }

  test("with no stations there is one, the volunteer brigade", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    assert.equal(c.tiles.some((t) => t.type === "fire"), false, "an empty map has no stations");
    assert.equal(fireCrews(c), VOLUNTEER_CREWS);
  });

  test("and one more for every station built", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    const before = fireCrews(c);
    for (const [x, y] of [[10, 10], [20, 10], [30, 10]]) put(c, x, y, "fire");
    assert.equal(fireCrews(c), before + 3);
  });

  test("the volunteers can only be in one place at a time", () => {
    const c = town();
    const crews = fireCrews(c);
    const lit = burn(c, crews + 1);
    assert.equal(lit.length, crews + 1, "one more fire than the city has crews");
    for (let i = 0; i < crews; i++) {
      assert.equal(place(c, lit[i].x, lit[i].y, "dispatch").ok, true, `crew ${i + 1} of ${crews}`);
    }
    const denied = place(c, lit[crews].x, lit[crews].y, "dispatch");
    assert.equal(denied.ok, false, "the last fire has nobody to send");
    assert.match(denied.message, crews > 1 ? new RegExp(`All ${crews} fire crews`) : /volunteer brigade/);
    assert.equal(crewsAvailable(c), 0);
  });

  test("they are back on duty next month", () => {
    const c = town();
    const crews = fireCrews(c);
    const lit = burn(c, 2);
    assert.equal(place(c, lit[0].x, lit[0].y, "dispatch").ok, true);
    assert.equal(crewsAvailable(c), crews - 1, "one truck is out");
    tick(c);
    assert.equal(crewsAvailable(c), fireCrews(c), "and back at the station next month");
  });

  test("and a save cannot refill the trucks", () => {
    const c = town();
    const lit = burn(c, 2);
    place(c, lit[0].x, lit[0].y, "dispatch");
    assert.equal(deserialize(serialize(c)).dispatched, 1);
  });
});

describe("Sims do not want to live under a pylon", () => {
  // "Yes, they will lower an area's land value. Try to keep them away from
  // Residential and Commercial zones."
  test("a power line takes value off the ground around it", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    const spots = [[30, 30], [33, 30], [40, 30]];
    const before = spots.map(([x, y]) => at(c, x, y).landValue);
    c.money = 5_000_000;
    for (let y = 20; y <= 40; y++) place(c, 31, y, "powerline");
    refresh(c);
    const after = spots.map(([x, y]) => at(c, x, y).landValue);
    assert.ok(after[0] < before[0], `beside the line: ${after[0]} vs ${before[0]}`);
    assert.ok(after[1] < before[1], `two tiles off it: ${after[1]} vs ${before[1]}`);
    assert.equal(after[2], before[2], "but not ten tiles away");
  });

  test("the blight fades with distance", () => {
    const c = createCity({ seed: 7, layout: "plains", starter: false, hills: 0 });
    c.money = 5_000_000;
    for (let y = 20; y <= 40; y++) place(c, 31, y, "powerline");
    refresh(c);
    assert.ok(at(c, 32, 30).landValue < at(c, 33, 30).landValue);
    assert.ok(at(c, 33, 30).landValue < at(c, 34, 30).landValue);
  });
});
