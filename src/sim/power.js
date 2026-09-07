// Power plant ageing and overload.
//
// The manual, page 97: "As power plants age, they lose efficiency. Areas of
// your city that draw power from an aging power plant may experience
// blackouts as the power plant loses capacity. Keep an eye on your power
// plants by querying them to find out their current capacity vs. their
// potential capacity. Power plants can also be destroyed if they are
// systematically overused. Run your plants at beyond full capacity for a
// little while and you can expect to see blackouts. Run them beyond full
// capacity for months on end, and they will explode."
//
// So a plant is never simply "on": it has an age, a capacity that falls with
// it, and a patience that runs out when the network keeps asking for more
// than it can give.
import { BUILDINGS } from "./catalog.js";
import { isAnchor, clearLot } from "./lots.js";
import { forRadius } from "./grid.js";
import { ageFactor, lifespanOf, WORN } from "./wear.js";

// Consecutive months of an overdrawn network before a plant on it gives way.
export const OVERLOAD_MONTHS = 12;
// How overdrawn the network has to be to count as abuse rather than a rough
// patch: the manual distinguishes "a little while" from "months on end".
export const OVERLOAD_RATIO = 1.02;

export const isPlant = (t) => (BUILDINGS[t.type]?.powerOut || 0) > 0;

// What a plant actually delivers this month. "Place these on top of hills to
// be most effective" is the manual's advice on wind, so height matters there.
export function plantOutput(t) {
  const b = BUILDINGS[t.type];
  if (!b?.powerOut) return 0;
  const site = b.hilltop ? 0.55 + Math.min(1, (t.elev || 0) / 8) * 0.75 : 1;
  return b.powerOut * ageFactor(t.type, t.age || 0) * site;
}

// A plant past its prime, worth telling the player about once.
export const isAging = (t) => isPlant(t) && ageFactor(t.type, t.age || 0) < 0.9;

// Every plant ages a month. A plant whose network has been overdrawn for a
// year without relief gives way. Strain is counted on the plant itself, not
// on the network, because network ids change whenever the grid does.
export function agePlants(city, rng) {
  const news = [];
  const overdrawn = city._util?.overdrawn;
  const netOf = city._util?.netOf;
  const failed = [];
  for (const t of city.tiles) {
    if (!isAnchor(t) || !isPlant(t)) continue;
    const before = ageFactor(t.type, t.age || 0);
    t.age = (t.age || 0) + 1;
    const after = ageFactor(t.type, t.age);
    const label = BUILDINGS[t.type].label;
    if (before >= 0.9 && after < 0.9) news.push(`The ${label.toLowerCase()} at (${t.x}, ${t.y}) is past its prime and losing capacity.`);
    if (before > WORN + 1e-9 && after <= WORN + 1e-9) news.push(`The ${label.toLowerCase()} at (${t.x}, ${t.y}) is worn out and needs replacing.`);

    const net = netOf ? netOf[t.y * city.size + t.x] : -1;
    const strained = overdrawn && net >= 0 && overdrawn.has(net);
    t.strain = strained ? (t.strain || 0) + 1 : 0;
    if (t.strain >= OVERLOAD_MONTHS) failed.push(t);
  }
  // Only one plant per month, so a city under strain gets a warning shot.
  if (failed.length) news.push(destroyPlant(city, failed[Math.floor(rng() * failed.length)], rng));
  return news;
}

// A meltdown wrecks the neighbourhood and leaves it contaminated for good.
// "The only time Sims won't return is when an area has been contaminated by
// radiation from a nuclear explosion. Too dangerous."
export const FALLOUT_RADIUS = 7;

export function meltdown(city, x, y, rng, cause) {
  let poisoned = 0;
  forRadius(city, x, y, FALLOUT_RADIUS, (n, d) => {
    if (n.terrain === "water") return;
    if (n.lot && rng() < 0.75 * (1 - d / (FALLOUT_RADIUS + 1))) {
      const a = city.tiles[n.lot.y * city.size + n.lot.x];
      if (a?.lot) clearLot(city, a, { keepZone: true });
    }
    if (rng() < 0.5) n.trees = 0;
    // Fallout is heaviest at the core and patchy at the rim, and it never
    // fades: this ground is finished.
    if (rng() < 1 - d / (FALLOUT_RADIUS + 1)) { n.radiation = true; poisoned++; }
  });
  if (!city.effects) city.effects = [];
  // The visible cloud is short-lived; the contamination it leaves is not.
  // Effect lifetimes are capped by the save format, so permanence lives in
  // the radiation flag rather than in a long-running effect.
  city.effects.push({ type: "toxic", x, y, ttl: 6 });
  city.revision++;
  return `MELTDOWN. The nuclear plant at (${x}, ${y}) ${cause}. ${poisoned} tiles are contaminated for good.`;
}

// The plant fails. A nuclear one takes the neighbourhood with it.
export function destroyPlant(city, t, rng) {
  const b = BUILDINGS[t.type];
  const { x, y } = t;
  const nuclear = t.type === "nuclear";
  clearLot(city, t, { keepZone: false });
  t.strain = 0;
  if (nuclear) return meltdown(city, x, y, rng, "was run past capacity for a year and has exploded");
  city.revision++;
  return `The ${b.label.toLowerCase()} at (${x}, ${y}) was run past capacity for a year and has exploded.`;
}
