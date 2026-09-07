// How utility plants wear out.
//
// The manual says the same thing twice, once for each network. Page 97, on
// power: "As power plants age, they lose efficiency." Page 98, on water: "All
// three pumps lose pumping capacity as they age. Keep an eye on your water
// supply... They may require replacing."
//
// So both networks share one curve: full output through the plant's prime,
// then a slide to a floor it never recovers from. Replacing it is the only
// cure, which is what makes a mature city an ongoing bill rather than a
// finished puzzle.
import { BUILDINGS } from "./catalog.js";

// Share of its life a plant runs at nameplate output, and the fraction of
// that output it keeps once fully worn.
export const PRIME_SHARE = 0.55;
export const WORN = 0.35;

export const lifespanOf = (type) => (BUILDINGS[type]?.lifespan ?? 50) * 12;

export function ageFactor(type, ageMonths) {
  const life = lifespanOf(type);
  const prime = life * PRIME_SHARE;
  if (ageMonths <= prime) return 1;
  const worn = Math.min(1, (ageMonths - prime) / (life - prime));
  return 1 - worn * (1 - WORN);
}

// Buildings that wear out and are worth ageing each month.
export const wears = (t) => {
  const b = BUILDINGS[t.type];
  return !!b && (b.powerOut > 0 || b.waterOut > 0);
};
