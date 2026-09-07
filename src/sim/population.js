// Age structure, Education Quotient and Life Expectancy.
//
// The original game does not treat education as a service radius. Children
// learn at school; adults only *retain* what they learned, and lose it unless
// libraries and museums keep them sharp. So a school built today shows up in
// the workforce twenty years later. Life Expectancy works the same way: it is
// a slow-moving average, not a coverage reading.
//
// Anchors taken from the manual (pages 91-93): an average city's Sims live to
// 59 and a well-run city can reach 90; sustained underfunding provokes
// teacher and healthcare strikes, and a cohort schooled during a strike is
// "held back for their entire life". The constants between those anchors are
// calibrated here, not recovered from the original game.
import { BUILDINGS } from "./catalog.js";
import { isAnchor } from "./lots.js";

// Cohorts run past the highest reachable life expectancy: a *mean* of 90
// needs Sims who live well beyond it, or the curve truncates below target.
export const MAX_AGE = 110;             // cohorts are ages 0 .. MAX_AGE-1
export const SCHOOL_AGES = [5, 17];     // grade school
export const COLLEGE_AGES = [18, 22];
export const WORK_AGES = [18, 64];
// Not every Sim of working age holds or seeks a job: students, carers and
// the early-retired sit outside it. Scaled so a city at the manual's average
// life expectancy puts about four Sims in ten to work.
export const PARTICIPATION = 0.6;
export const NATIONAL_EQ = 55;          // EQ newcomers bring from SimNation
export const BASE_LIFE_EXPECTANCY = 59; // the manual's "average city"
export const MAX_LIFE_EXPECTANCY = 90;

const ADULT_DECAY = 1.15;   // EQ points an unsupported adult loses per year
const SCHOOL_LEARN = 0.30;  // pull toward school quality per school year
const COLLEGE_LEARN = 0.22;
const LE_INERTIA = 0.25;    // life expectancy moves a quarter of the way each year
const STRIKE_FUNDING = 40;  // below this, months of anger accumulate
const STRIKE_MONTHS = 18;   // ...and this many in a row calls a strike
const STRIKE_ENDS = 80;     // funding at or above this ends it
const STRIKE_QUALITY = 0.15;

// Migration skews young: singles and young families move to a growing city.
const MIGRATION_PROFILE = (age) => {
  if (age < 18) return 0.7;
  if (age <= 34) return 2.4;
  if (age <= 49) return 1.3;
  if (age <= 64) return 0.5;
  return 0.15;
};

const MIGRATION_PROFILE_LIST = Array.from({ length: MAX_AGE }, (_, age) => MIGRATION_PROFILE(age));
const MIGRATION_WEIGHT = MIGRATION_PROFILE_LIST.reduce((a, b) => a + b, 0);

// Births replace the dead in a city that is not growing. Calibrated so a
// stable city at the manual's average life expectancy has roughly six Sims
// of working age in ten, which is what PARTICIPATION is scaled against.
const BIRTH_RATE = 0.0155;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = (list, from = 0, to = list.length - 1) => {
  let total = 0;
  for (let i = from; i <= to; i++) total += list[i];
  return total;
};

// Annual death probability. The curve is shifted so that the mean age at
// death equals the city's current life expectancy; solveShift finds the
// shift by bisection, which keeps `le` an honest number rather than a label.
const SPREAD = 9.5;
const hazard = (age, shift) => clamp(0.0009 + 1 - Math.exp(-Math.exp((age - shift) / SPREAD)), 0, 1);

export function meanLifespan(shift) {
  let alive = 1, total = 0;
  for (let age = 0; age < MAX_AGE; age++) {
    const died = alive * hazard(age, shift);
    total += died * (age + 0.5);
    alive -= died;
  }
  return total + alive * MAX_AGE;
}

function solveShift(le) {
  let lo = 0, hi = 140;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (meanLifespan(mid) < le) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// The age distribution a city settles into at a given life expectancy, with
// migration replacing the dead. Used to seed a new city so year one is not
// all newborns.
export function stationaryPyramid(le) {
  let pyramid = new Array(MAX_AGE).fill(1 / MAX_AGE);
  for (let pass = 0; pass < 600; pass++) pyramid = ageOneYear(pyramid, le, 1).pyramid;
  const total = sum(pyramid) || 1;
  return pyramid.map((v) => v / total);
}

// One year of ageing: mortality, then births, then migration to reconcile
// with the population the city's buildings actually hold. Returns the new
// pyramid plus how many arrived at each age, which EQ bookkeeping needs.
export function ageOneYear(pyramid, le, population) {
  const shift = solveShift(le);
  const next = new Array(MAX_AGE).fill(0);
  for (let age = 1; age < MAX_AGE; age++) next[age] = pyramid[age - 1] * (1 - hazard(age - 1, shift));
  next[0] = population * BIRTH_RATE;
  const arrivals = new Array(MAX_AGE).fill(0);
  const living = sum(next);
  if (population <= 0) return { pyramid: next.fill(0), arrivals, births: 0 };
  const delta = population - living;
  if (delta > 0) {
    for (let age = 0; age < MAX_AGE; age++) {
      arrivals[age] = delta * MIGRATION_PROFILE_LIST[age] / MIGRATION_WEIGHT;
      next[age] += arrivals[age];
    }
  } else if (living > 0) {
    const scale = population / living;
    for (let age = 0; age < MAX_AGE; age++) next[age] *= scale;
  }
  return { pyramid: next, arrivals, births: population * BIRTH_RATE };
}

export function blankPopulation(le = BASE_LIFE_EXPECTANCY) {
  return quantize({
    le,
    pyramid: stationaryPyramid(le),
    eq: new Array(MAX_AGE).fill(NATIONAL_EQ),
    strikes: { education: 0, health: 0 },
    anger: { education: 0, health: 0 },
  });
}

// How well the city's schools, colleges, hospitals and adult learning serve
// the people who need them. Capacity is physical; funding buys the staff.
export function serviceQuality(city, pop) {
  const funding = city.funding || {};
  const ord = city.ordinances || {};
  const seats = { school: 0, college: 0, hospital: 0 };
  let adultReach = 0, adultTiles = 0;

  for (const t of city.tiles) {
    if (!isAnchor(t)) continue;
    const b = BUILDINGS[t.type];
    if (!b?.capacity) continue;
    // A building with no road or no power runs at a fraction of its size.
    const usable = (t.roadAccess ? 1 : 0.4) * (b.powerUse && !t.powered ? 0.3 : 1);
    seats[b.capacity.kind] = (seats[b.capacity.kind] || 0) + b.capacity.seats * usable;
  }
  for (const t of city.tiles) {
    if (t.type !== "residential" || !t.lot) continue;
    adultTiles++;
    adultReach += Math.min(100, (t.svc?.education || 0) * 0.6 + (t.svc?.culture || 0));
  }

  const staffing = (dept, strike) => (strike ? STRIKE_QUALITY : clamp((funding[dept] ?? 100) / 100, 0, 1.2));
  const eduStaff = staffing("education", pop.strikes.education > 0);
  const healthStaff = staffing("health", pop.strikes.health > 0);

  const students = pop.school || 0, undergrads = pop.college || 0, patients = pop.population || 0;
  const attend = (available, needed) => (needed > 0 ? clamp(available / needed, 0, 1.15) : 1);

  const schoolQuality = 100 * attend(seats.school, students) * eduStaff + (ord.readingCampaign ? 8 : 0) + (ord.juniorSports ? 3 : 0);
  const collegeQuality = 118 * attend(seats.college, undergrads) * eduStaff;
  const hospitalService = attend(seats.hospital, patients) * healthStaff;
  const adultSupport = adultTiles ? clamp(adultReach / adultTiles / 70, 0, 1) : 0;

  return {
    schoolQuality: clamp(schoolQuality, 0, 145),
    collegeQuality: clamp(collegeQuality, 0, 150),
    hospitalService,
    adultSupport,
    seats,
    schoolDemand: students,
    collegeDemand: undergrads,
  };
}

// Shares of the current population by role. Population magnitude comes from
// the buildings, so the pyramid only supplies the shape.
export function shares(pop, population) {
  const total = sum(pop.pyramid) || 1;
  const part = (from, to) => sum(pop.pyramid, from, to) / total;
  const retire = retirementAge(pop.le ?? BASE_LIFE_EXPECTANCY);
  const working = part(WORK_AGES[0], retire);
  return {
    population,
    school: part(SCHOOL_AGES[0], SCHOOL_AGES[1]) * population,
    college: part(COLLEGE_AGES[0], COLLEGE_AGES[1]) * population,
    workingAgeShare: working,
    workforceShare: working * PARTICIPATION,
    retirementAge: retire,
    childShare: part(0, 17),
    seniorShare: part(retire + 1, MAX_AGE - 1),
  };
}

// Sims who live longer work longer, so the retirement age tracks life
// expectancy rather than sitting at a fixed 65.
export const retirementAge = (le) => clamp(Math.round(le * 0.85 + 14), 55, 80);

// Population-weighted EQ over an age range.
function meanEq(pop, from, to) {
  let weight = 0, total = 0;
  for (let age = from; age <= to; age++) { weight += pop.pyramid[age]; total += pop.pyramid[age] * pop.eq[age]; }
  return weight > 0 ? total / weight : NATIONAL_EQ;
}

export function readPopulation(city, population) {
  const pop = city.people;
  const s = shares(pop, population);
  return {
    ...s,
    le: pop.le,
    eq: meanEq(pop, WORK_AGES[0], retirementAge(pop.le)),
    cityEq: meanEq(pop, 0, MAX_AGE - 1),
    youthEq: meanEq(pop, SCHOOL_AGES[0], SCHOOL_AGES[1]),
    strikes: { ...pop.strikes },
    pyramid: pop.pyramid.slice(),
    eqByAge: pop.eq.slice(),
  };
}

// Monthly: only strike bookkeeping. Departments do not walk out overnight.
export function updateStrikes(city) {
  const pop = city.people;
  const funding = city.funding || {};
  for (const dept of ["education", "health"]) {
    const level = funding[dept] ?? 100;
    if (pop.strikes[dept] > 0) {
      pop.strikes[dept] = level >= STRIKE_ENDS ? 0 : pop.strikes[dept] + 1;
      if (pop.strikes[dept] === 0) pop.anger[dept] = 0;
      continue;
    }
    pop.anger[dept] = level < STRIKE_FUNDING ? pop.anger[dept] + 1 : 0;
    if (pop.anger[dept] >= STRIKE_MONTHS) { pop.strikes[dept] = 1; pop.anger[dept] = 0; }
  }
  return pop.strikes;
}

// Yearly: age everyone, school the children, let adults forget, then move
// life expectancy toward what the city's hospitals and pollution support.
export function advanceYear(city, population, environment) {
  const pop = city.people;
  const quality = serviceQuality(city, { ...shares(pop, population), strikes: pop.strikes });

  // ── Age one year, then reconcile with the buildings' population ──
  const { pyramid: nextPyramid, arrivals } = ageOneYear(pop.pyramid, pop.le, population);
  const nextEq = new Array(MAX_AGE).fill(NATIONAL_EQ);
  for (let age = 1; age < MAX_AGE; age++) nextEq[age] = pop.eq[age - 1];
  nextEq[0] = NATIONAL_EQ * 0.2; // newborns know nothing yet
  // Newcomers bring SimNation's average schooling; leavers change no average.
  for (let age = 0; age < MAX_AGE; age++) {
    const held = nextPyramid[age] - arrivals[age];
    const total = held + arrivals[age];
    if (arrivals[age] > 0 && total > 0) nextEq[age] = (held * nextEq[age] + arrivals[age] * NATIONAL_EQ) / total;
  }

  // ── Learning and forgetting ──────────────────────────────────────
  for (let age = 0; age < MAX_AGE; age++) {
    if (age >= SCHOOL_AGES[0] && age <= SCHOOL_AGES[1]) {
      nextEq[age] += (quality.schoolQuality - nextEq[age]) * SCHOOL_LEARN;
    } else if (age >= COLLEGE_AGES[0] && age <= COLLEGE_AGES[1]) {
      if (quality.collegeQuality > nextEq[age]) nextEq[age] += (quality.collegeQuality - nextEq[age]) * COLLEGE_LEARN;
      else nextEq[age] -= ADULT_DECAY * (1 - quality.adultSupport);
    } else if (age > COLLEGE_AGES[1]) {
      nextEq[age] -= ADULT_DECAY * (1 - quality.adultSupport);
    }
    nextEq[age] = clamp(nextEq[age], 0, 150);
  }

  // ── Life expectancy ──────────────────────────────────────────────
  const ord = city.ordinances || {};
  let target = 35 + quality.hospitalService * 40;
  target -= (environment.pollution || 0) * 0.22;
  target -= (environment.waterPollution || 0) * 0.18;
  target -= (environment.traffic || 0) * 0.05;
  target -= (environment.garbage || 0) * 0.04;
  if (ord.freeClinics) target += 3;
  if (ord.smokingBan) target += 2;
  if (ord.juniorSports) target += 1.5;
  if (ord.cprTraining) target += 1.5;
  target = clamp(target, 25, MAX_LIFE_EXPECTANCY);

  pop.pyramid = nextPyramid;
  pop.eq = nextEq;
  pop.le = clamp(pop.le + (target - pop.le) * LE_INERTIA, 25, MAX_LIFE_EXPECTANCY);
  quantize(pop);
  return { quality, target };
}

// ── save / load ───────────────────────────────────────────────────
// Live state is kept at exactly the precision the save file holds, so a
// reloaded city keeps ticking down the same path as the one it was saved
// from instead of drifting apart in the seventh decimal.
const round3 = (v) => Math.round(v * 1000) / 1000;
const round7 = (v) => Math.round(v * 1e7) / 1e7;

export function quantize(pop) {
  pop.le = round3(pop.le);
  pop.pyramid = pop.pyramid.map(round7);
  pop.eq = pop.eq.map(round3);
  return pop;
}

export function serializePopulation(pop) {
  return {
    le: pop.le,
    pyramid: pop.pyramid.slice(),
    eq: pop.eq.slice(),
    strikes: { ...pop.strikes },
    anger: { ...pop.anger },
  };
}

export function parsePopulation(raw) {
  const blank = blankPopulation();
  if (!raw || typeof raw !== "object") return blank;
  const numbers = (list, length) => Array.isArray(list) && list.length === length && list.every((v) => Number.isFinite(v));
  if (!Number.isFinite(raw.le) || raw.le < 10 || raw.le > 120) throw new Error("Invalid save: bad life expectancy.");
  if (!numbers(raw.pyramid, MAX_AGE) || raw.pyramid.some((v) => v < 0)) throw new Error("Invalid save: bad age pyramid.");
  if (!numbers(raw.eq, MAX_AGE) || raw.eq.some((v) => v < 0 || v > 200)) throw new Error("Invalid save: bad education quotients.");
  const counter = (v) => (Number.isInteger(v) && v >= 0 && v < 10000 ? v : 0);
  return {
    le: raw.le,
    pyramid: raw.pyramid.slice(),
    eq: raw.eq.slice(),
    strikes: { education: counter(raw.strikes?.education), health: counter(raw.strikes?.health) },
    anger: { education: counter(raw.anger?.education), health: counter(raw.anger?.health) },
  };
}
