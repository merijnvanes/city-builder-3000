// Where drinking water comes from.
//
// The manual, page 98, describes three sources and gives each a distinct
// weakness:
//
//   Water pumping station - "pump water from fresh water lakes and rivers...
//     will pull up more water than any other kind of pump. They must be built
//     very near a fresh water source, or they won't work. Pay attention to
//     water pollution levels, as high pollution really slows down the
//     efficiency of water pumping stations."
//   Water tower - "pump water from hidden underground springs. These springs
//     exist everywhere, so water towers can be built anywhere. The problem
//     with water towers is that they don't pump very much water."
//   Desalinization plant - "pump water from the sea... These pumps must be
//     built on a seacoast to be of any use, they are less efficient than a
//     water pumping station, and they lose efficiency when water pollution is
//     present."
//
// All three also lose capacity with age, on the shared curve in wear.js.
import { BUILDINGS } from "./catalog.js";
import { isAnchor } from "./lots.js";
import { forRadius } from "./grid.js";
import { ageFactor, WORN } from "./wear.js";

// How far a pump may sit from the water it draws. The manual gives two tiles
// for a pumping station; the same reach reads naturally for the sea.
export const SOURCE_REACH = 2;

export const isPump = (t) => (BUILDINGS[t.type]?.waterOut || 0) > 0;

// Is the right kind of water within reach? `source` is "fresh", "salt" or
// null for a tower, which draws on springs and needs nothing.
// Measured from the whole footprint, not just the anchor: a three-tile
// desalinization plant sitting on the beach has its anchor well inland.
export function hasSource(city, t) {
  const source = BUILDINGS[t.type]?.source;
  if (!source) return true;
  const lot = t.lot || { x: t.x, y: t.y, w: 1, h: 1 };
  let found = false;
  for (let y = lot.y; y < lot.y + lot.h && !found; y++) {
    for (let x = lot.x; x < lot.x + lot.w && !found; x++) {
      forRadius(city, x, y, SOURCE_REACH, (n) => {
        if (n.terrain !== "water") return;
        if (source === "salt" ? n.salt : !n.salt) found = true;
      });
    }
  }
  return found;
}

// What a pump actually delivers. A pump with nothing to draw from delivers
// nothing at all: the manual is explicit that a misplaced pumping station
// "will have no pumping capacity".
export function pumpOutput(city, t, waterPollution = 0) {
  const b = BUILDINGS[t.type];
  if (!b?.waterOut) return 0;
  if (!hasSource(city, t)) return 0;
  const fouled = 1 - Math.min(1, waterPollution / 100) * (b.pollutionSensitivity ?? 0);
  return b.waterOut * ageFactor(t.type, t.age || 0) * fouled;
}

// Pumps age like power plants, and warn on the same two milestones.
export function agePumps(city) {
  const news = [];
  for (const t of city.tiles) {
    if (!isAnchor(t) || !isPump(t)) continue;
    const before = ageFactor(t.type, t.age || 0);
    t.age = (t.age || 0) + 1;
    const after = ageFactor(t.type, t.age);
    const label = BUILDINGS[t.type].label.toLowerCase();
    if (before >= 0.9 && after < 0.9) news.push(`The ${label} at (${t.x}, ${t.y}) is pumping less than it used to.`);
    if (before > WORN + 1e-9 && after <= WORN + 1e-9) news.push(`The ${label} at (${t.x}, ${t.y}) is worn out and needs replacing.`);
  }
  return news;
}

// Water pollution: "Invisible contaminants, primarily from industry, can
// invade your water supply." Treatment plants clean it; the clean air and
// waste ordinances help at the source.
export function waterPollutionOf(city, industrialLoad) {
  const ord = city.ordinances || {};
  let treatment = 0, treated = 0;
  for (const t of city.tiles) {
    if (!isAnchor(t) || !BUILDINGS[t.type]?.cleansWater) continue;
    treatment++;
    treated += t.powered ? 1 : 0.25;
  }
  let level = industrialLoad;
  if (ord.wasteTax) level *= 0.85;
  if (ord.cleanAir) level *= 0.92;
  // Each working treatment plant removes a share of what is left.
  level *= Math.pow(0.55, treated);
  return { waterPollution: Math.round(Math.max(0, Math.min(100, level))), treatment };
}
