// Long-run scenarios: not rules in isolation, but whether a city that runs for
// decades behaves like a city.
//
// Every bug this suite exists to catch was found by playing, never by a unit
// test, and each was found while every other test passed. They share a shape:
// two pieces that are individually correct, composed into a loop that runs
// away. A trip range that fed one pass's traffic into the next pass's jam
// penalty oscillated between gridlock and empty roads. A power report that
// summed across networks hid the one grid that was overdrawn until its plant
// exploded and the city emptied out.
//
// So the assertions here are about shape over time, and they are deliberately
// loose. The measured spread across nine seeds at sixty years is end/peak
// 0.84-1.00, trough/peak 0.80-0.96, and a worst year-on-year swing of 0.9-20.4%.
// The bounds sit well outside that: they are there to catch a collapse or an
// oscillation, not to pin down balance, which moves whenever the model does.
//
// That 20.4% is seed 99 taking two earthquakes in the same year, so the swing
// bound has to clear a genuinely bad year while still catching a feedback loop
// with no damping, which is a far larger and repeating figure.
//
// `maintainUtilities` stands in for a mayor who reads the news and keeps the
// lights on. That makes these end-to-end tests of the simulation *and* of what
// it reports, which is the point: the seed-44 collapse happened because the
// figures a competent player acts on were wrong.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats } from "../src/sim.js";
import { maintainUtilities } from "./city-helpers.mjs";

const SEEDS = [1, 21, 44, 99];
const YEARS = 60;
// Growth is still finding its level in the first few years; a starter town
// sheds a fifth of its residents before it settles. Judge from year five.
const SETTLED = 5;

// Sixty simulated years costs about eight seconds, so each seed is run once
// and the year-by-year log is shared between the assertions about it.
const runs = new Map();
function run(seed) {
  if (runs.has(seed)) return runs.get(seed);
  const c = createCity(seed, true);
  const log = [];
  for (let y = 0; y < YEARS; y++) {
    for (let m = 0; m < 12; m++) {
      const result=tick(c);
      // Surface wiring is vulnerable to earthquakes. A maintained town
      // repairs a reported outage promptly instead of waiting up to a year.
      if(result.disaster && (getStats(c).power<85 || getStats(c).water<85))maintainUtilities(c);
    }
    maintainUtilities(c);
    const s = getStats(c);
    log.push({ year: y, pop: s.population, power: s.power, water: s.water, money: s.money, demand: s.demand.residential });
  }
  runs.set(seed, { city: c, log });
  return runs.get(seed);
}

describe("a maintained city holds its shape for sixty years", () => {
  for (const seed of SEEDS) {
    test(`seed ${seed} plateaus rather than collapsing`, () => {
      const { log } = run(seed);
      const pops = log.map((r) => r.pop);
      const peak = Math.max(...pops);
      const end = pops[pops.length - 1];
      const trough = Math.min(...pops.slice(SETTLED));
      const where = (p) => `year ${pops.indexOf(p)}`;
      assert.ok(peak > 5000, `the starter town never grew: peak ${peak}`);
      assert.ok(end >= peak * 0.6, `ended at ${end}, down from a peak of ${peak}`);
      assert.ok(trough >= peak * 0.65, `bottomed out at ${trough} (${where(trough)}) against a peak of ${peak}`);
    });

    test(`seed ${seed} keeps the lights on`, () => {
      const { log } = run(seed);
      // The utilities helper builds a plant on whichever grid is short, so a
      // year spent below full coverage means the report it acts on was wrong.
      const dark = log.filter((r) => r.year >= SETTLED && r.power < 85);
      assert.equal(dark.length, 0, `years below 85% power: ${dark.map((r) => `${r.year}(${r.power}%)`).join(", ")}`);
    });

    test(`seed ${seed} does not oscillate`, () => {
      const { log } = run(seed);
      // A feedback loop with no damping shows up here long before it shows up
      // in any single-month figure.
      let worst = 0, at = 0;
      for (let i = SETTLED + 1; i < log.length; i++) {
        const swing = Math.abs(log[i].pop - log[i - 1].pop) / Math.max(1, log[i - 1].pop);
        if (swing > worst) { worst = swing; at = log[i].year; }
      }
      assert.ok(worst < 0.35, `population swung ${Math.round(worst * 100)}% in year ${at}`);
    });
  }
});

describe("a city does not die with money in the bank", () => {
  // The failure this is named for: seed 44 ran to zero residents over four
  // years while holding $5M and residential demand pegged at 100, because one
  // grid was overdrawn and every figure the mayor could see said otherwise.
  for (const seed of SEEDS) {
    test(`seed ${seed} never empties out while it can afford not to`, () => {
      const { log } = run(seed);
      const dead = log.filter((r) => r.year >= SETTLED && r.pop === 0 && r.money > 0);
      assert.equal(dead.length, 0, `emptied out in ${dead.map((r) => `year ${r.year}`).join(", ")}`);
      // Demand pegged at its ceiling for years on end means the city wants to
      // grow and something is stopping it. A healthy city's demand moves.
      const pegged = log.filter((r) => r.year >= SETTLED && r.demand >= 100).length;
      assert.ok(pegged < 10, `residential demand sat at 100 for ${pegged} of ${YEARS} years`);
    });
  }
});
