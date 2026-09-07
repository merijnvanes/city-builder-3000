// Landfills fill up, and decompose what is in them.
//
// The manual, pages 34 and 79: "Each tile of landfill can hold up to a certain
// amount of trash. As the landfill fills up you will notice piles of garbage...
// When a landfill is full, garbage will accumulate around the city unless you
// have other means in place to dispose of it... You can't bulldoze over
// landfills; however, you can decommission them by removing road or rail
// access. Over time the landfill will decompose all of its accumulated
// garbage, at which time you can de-zone it."
//
// So a landfill is a store with a slow drain, not a monthly allowance, and
// siting one is a decision the mayor lives with.
import { BUILDINGS } from "./catalog.js";

// Trash a single landfill tile breaks down each month.
export const DECAY = 10;

export const isLandfill = (t) => !!BUILDINGS[t.type]?.hold;

// Spread this month's buried garbage across the landfill tiles that trucks
// can actually reach, then let every tile decompose a little.
export function fillLandfills(city, buried) {
  const open = [];
  for (const t of city.tiles) {
    if (!isLandfill(t)) continue;
    if (t.roadAccess && (t.fill || 0) < BUILDINGS[t.type].hold) open.push(t);
  }
  let left = buried;
  // Level the tips: the emptiest tile takes the next load, so a landfill
  // fills evenly rather than piling up on whichever tile comes first.
  open.sort((a, b) => (a.fill || 0) - (b.fill || 0));
  while (left > 0.01 && open.length) {
    const share = left / open.length;
    let spilled = 0;
    for (const t of open) {
      const room = BUILDINGS[t.type].hold - (t.fill || 0);
      const put = Math.min(room, share);
      t.fill = (t.fill || 0) + put;
      spilled += share - put;
    }
    left = spilled;
    const before = open.length;
    for (let i = open.length - 1; i >= 0; i--) if ((open[i].fill || 0) >= BUILDINGS[open[i].type].hold - 0.01) open.splice(i, 1);
    if (open.length === before) break;
  }
  for (const t of city.tiles) {
    if (!isLandfill(t) || !t.fill) continue;
    t.fill = Math.max(0, Math.round((t.fill - DECAY) * 100) / 100);
  }
}

// Warn once as the tips run out, and again when they are gone. The mayor
// needs time to zone more land or build an incinerator.
export function landfillNews(city, before, after) {
  // Decomposition keeps the load a shade under 1 even when every tip is
  // refusing loads, so "full" is judged just short of it.
  for (const [mark, message] of [[0.97, "The city's landfills are full. Garbage is piling up in the streets."],
                                 [0.85, "The city's landfills are nearly full. Zone more, or build an incinerator."]]) {
    if (before < mark && after >= mark) return [message];
  }
  return [];
}

// How full the city's landfills are, 0..1.
export function landfillLoad(city) {
  let fill = 0, hold = 0;
  for (const t of city.tiles) {
    if (!isLandfill(t)) continue;
    fill += t.fill || 0;
    hold += BUILDINGS[t.type].hold;
  }
  return hold ? fill / hold : 0;
}
