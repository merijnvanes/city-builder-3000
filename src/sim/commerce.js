// Shops or offices.
//
// The manual, pages 34 and 73, lists what a commercial zone builds by density:
// light is "mom and pop stores, gas stations"; medium adds "medium size office
// buildings and stores"; dense has "large office buildings and large stores".
// And: "The type of Commercial buildings that get built depends on the density
// of the zone, as well its land value... You'll need light or medium density
// Commercial zones to let the small business Sim get a foot in the door. The
// demand for Commercial zones typically rises as a city ages."
//
// So shops come first and follow their customers; offices arrive with density,
// land value and an educated workforce, and they are what a mature city fills
// its towers with.
export const COMMERCE_TYPES = ["shops", "offices"];

export const COMMERCE = {
  shops:   { label: "Shops",   jobs: 1,     value: 1,    traffic: 1,    pollution: 1 },
  // A floor of desks holds more people than a shop floor, is worth more per
  // head, and brings no delivery lorries.
  offices: { label: "Offices", jobs: 1.35,  value: 1.45, traffic: 0.65, pollution: 0.35 },
};

export const commerceOf = (t) => (t.commerce && COMMERCE[t.commerce] ? t.commerce : "shops");
export const commerceTraits = (t) => COMMERCE[commerceOf(t)];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// How willing offices are to take a given lot, 0..1. The manual leads with
// density - light is "mom and pop stores, gas stations", medium adds "medium
// size office buildings", dense "large office buildings" - and names land
// value second. An educated workforce is what makes desks worth building.
export function officeAppeal(t, eq) {
  const density = t.density || 1;
  if (density < 2) return 0;
  const room = density === 3 ? 0.85 : 0.45;
  const workforce = clamp((eq - 45) / 35, 0, 1);
  const address = 0.7 + clamp(((t.landValue ?? 40) - 20) / 40, 0, 1) * 0.45;
  return clamp(room * workforce * address, 0, 1);
}

// Below this, a block is shops whatever the roll: offices are what a good,
// dense, well-schooled address attracts, not a coin toss on a retail strip.
export const OFFICE_BAR = 0.35;

// What this block is, given its street. Each lot decides from its own stable
// variant rather than a fresh roll, so a corner shop does not become a tower
// and back again every decade: the same sites hold the desks, and the mix
// only moves when the street itself does.
export function pickCommerce(t, eq) {
  const appeal = officeAppeal(t, eq);
  return appeal >= OFFICE_BAR && (t.variant ?? 0.5) < appeal ? "offices" : "shops";
}

export const convertCommerce = pickCommerce;

// Every developed commercial lot has a kind. Lots that arrive without one are
// assigned from their own stable per-tile variant, so a reload matches.
export function ensureCommerce(city, eq) {
  for (const t of city.tiles) {
    if (t.type !== "commercial" || !t.lot || t.lot.x !== t.x || t.lot.y !== t.y) continue;
    if (t.commerce && COMMERCE[t.commerce]) continue;
    t.commerce = pickCommerce(t, eq);
  }
}
