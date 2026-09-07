// What kind of industry a lot holds.
//
// The manual (pages 73, 92): "Young cities normally attract heavy polluting
// industries, especially in dense Industrial zones. Sometimes farms will
// develop in light density Industrial zones that are far from the hustle and
// bustle of the city. As your city ages and you raise the education level of
// your Sims, you may be able to attract cleaner, high-tech industries."
//
// So two forces pick the type: SimNation's economy, which drifts from smoke
// toward silicon over the century, and the city's own Education Quotient,
// which decides how much of that drift it can capture. A city that neglects
// its schools keeps the smokestacks whatever year it is.

export const INDUSTRY_TYPES = ["agriculture", "dirty", "manufacturing", "hightech"];

export const INDUSTRY = {
  agriculture:   { label: "Farming",       pollution: 0.2,  jobs: 0.55, value: 0.9,  eq: 0 },
  dirty:         { label: "Heavy industry", pollution: 1.7, jobs: 1.1,  value: 0.85, eq: 0 },
  manufacturing: { label: "Manufacturing", pollution: 1.0,  jobs: 1.0,  value: 1.0,  eq: 60 },
  hightech:      { label: "High tech",     pollution: 0.12, jobs: 0.85, value: 1.5,  eq: 85 },
};

export const industryOf = (t) => (t.industry && INDUSTRY[t.industry] ? t.industry : "manufacturing");
export const industryTraits = (t) => INDUSTRY[industryOf(t)];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// A logistic curve so an era arrives and fades instead of switching on.
const era = (year, midpoint, width) => 1 / (1 + Math.exp(-(year - midpoint) / width));

// SimNation's industrial mix in a given year, before the city's own schooling
// is taken into account. Dirty industry dominates the early century, high
// tech is barely a rumour before the 1970s.
export function nationalMix(year) {
  const tech = era(year, 1990, 20);
  const modern = era(year, 1945, 20);
  return {
    dirty: clamp((1 - modern) * 0.85 + 0.08, 0, 1),
    manufacturing: clamp(modern * (1 - tech) * 0.9 + 0.12, 0, 1),
    hightech: clamp(tech * 0.85, 0, 1),
  };
}

// How willing each kind of industry is to open here this month. Farms are
// handled separately: they are a land-use choice, not an era.
export function industryWeights(year, eq, landValue) {
  const mix = nationalMix(year);
  const weights = {};
  for (const type of ["dirty", "manufacturing", "hightech"]) {
    const need = INDUSTRY[type].eq;
    // Below the schooling a sector needs, interest falls away sharply. Above
    // it there is nothing more to gain, so the era decides which one opens.
    const educated = need === 0 ? 1 : clamp((eq - need + 20) / 35, 0.02, 1);
    weights[type] = mix[type] * educated;
  }
  // Smokestacks avoid expensive land; laboratories seek it out.
  weights.dirty *= clamp(1.3 - landValue / 90, 0.25, 1.3);
  weights.hightech *= clamp(0.6 + landValue / 90, 0.6, 1.5);
  return weights;
}

// Farms need room and quiet: the manual puts them in light density zones far
// from the hustle and bustle.
export function isFarmSite(t) {
  return t.density === 1 && t.lot != null && t.lot.w >= 3 && (t.landValue ?? 40) < 55;
}

export function pickIndustry(t, year, eq, roll) {
  if (isFarmSite(t)) return "agriculture";
  const weights = industryWeights(year, eq, t.landValue ?? 40);
  const total = weights.dirty + weights.manufacturing + weights.hightech;
  if (total <= 0) return "manufacturing";
  let cut = roll * total;
  for (const type of ["hightech", "manufacturing", "dirty"]) {
    cut -= weights[type];
    if (cut <= 0) return type;
  }
  return "manufacturing";
}

// Every developed industrial lot has a kind. Lots that arrive without one -
// from the starter town, a scenario or a save written before industry types
// existed - are assigned from their own stable per-tile variant, so the
// result is the same on every load.
export function ensureIndustry(city, year, eq) {
  for (const t of city.tiles) {
    if (t.type !== "industrial" || !t.lot || t.lot.x !== t.x || t.lot.y !== t.y) continue;
    if (t.industry && INDUSTRY[t.industry]) continue;
    t.industry = pickIndustry(t, year, eq, t.variant ?? 0.5);
  }
}

// An existing plant re-tools when the city has clearly moved on. This is the
// "polluting industries turning into cleaner, high-tech industries" the
// education chart promises. The further behind its own sector has fallen, the
// likelier the site changes hands; a plant that still suits the city stays.
export function convertIndustry(t, year, eq, roll) {
  const current = industryOf(t);
  if (isFarmSite(t)) return "agriculture";
  if (current === "agriculture") return pickIndustry(t, year, eq, roll);
  const weights = industryWeights(year, eq, t.landValue ?? 40);
  const best = Math.max(weights.dirty, weights.manufacturing, weights.hightech);
  if (best <= 0) return current;
  const behind = 1 - weights[current] / best;
  if (roll >= behind) return current;
  return pickIndustry(t, year, eq, roll / behind);
}
