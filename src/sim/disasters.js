// Disasters: fire, earthquake, tornado, flood, riot. Fires spread month by
// month unless fire coverage is strong. Burned lots are cleared.
import { tileAt, forRadius, NEIGHBORS4 } from "./grid.js";
import { ZONE_TYPES, BUILDINGS } from "./catalog.js";
import { isAnchor, anchorOf, clearLot, lotTiles } from "./lots.js";

export const DISASTERS = {
  fire:       { label: "Fire",       description: "A building catches fire. Spreads without fire coverage." },
  earthquake: { label: "Earthquake", description: "Shakes a district: roads crack and buildings lose stories." },
  tornado:    { label: "Tornado",    description: "Carves a path of destruction across the map." },
  flood:      { label: "Flood",      description: "Rivers and coasts overflow into nearby lots." },
  riot:       { label: "Riot",       description: "Unrest in high-crime districts. Fires break out." },
};

function developedTiles(city) {
  return city.tiles.filter((t) => isAnchor(t) && (ZONE_TYPES.has(t.type) ? t.level > 0 : true));
}

export function ignite(city, t, strength = 2) {
  const a = t.lot ? anchorOf(city, t) : t;
  if (!a) return false;
  if (a.terrain === "water") return false;
  if (a.type === "empty" && !a.trees) return false;
  if (a.fire) return false;
  a.fire = strength;
  return true;
}

function damageLot(city, a, rng, severe = false) {
  if (ZONE_TYPES.has(a.type)) {
    if (a.level > 1 && !severe) a.level--; else clearLot(city, a, { keepZone: true });
  } else if (severe || !rng || rng() < 0.35) {
    clearLot(city, a, { keepZone: false });
  }
}

// Zones burn most readily; utilities and civic buildings are built tougher.
function fireTargets(city) {
  const pool = [];
  for (const t of developedTiles(city)) {
    if (ZONE_TYPES.has(t.type)) { for (let i = 0; i < t.density; i++) pool.push(t); }
    else if (!BUILDINGS[t.type]?.powerOut && !BUILDINGS[t.type]?.waterOut) pool.push(t);
  }
  return pool;
}

export function triggerDisaster(city, id, rng) {
  const targets = developedTiles(city);
  if (id === "flood") {
    let hit = 0;
    for (const w of city.tiles) {
      if (w.terrain !== "water" || rng() > 0.25) continue;
      forRadius(city, w.x, w.y, 2, (n) => {
        if (n.terrain === "water" || !n.lot || rng() > 0.35) return;
        const a = anchorOf(city, n);
        if (!a || a._flooded) return;
        a._flooded = true; damageLot(city, a, rng); hit++;
      });
    }
    for (const t of city.tiles) delete t._flooded;
    city.revision++;
    return hit ? `Flood waters damaged ${hit} buildings along the shore.` : "The river rose, but nothing was damaged.";
  }
  if (!targets.length) return "There is nothing built to affect.";
  const center = targets[Math.floor(rng() * targets.length)];
  if (id === "earthquake") {
    let hit = 0;
    forRadius(city, center.x, center.y, 7, (t, d) => {
      const p = 0.65 * (1 - d / 8);
      if (rng() > p) return;
      if (t.type === "road" && t.terrain !== "water") { t.type = "empty"; hit++; }
      else if (t.lot) { const a = anchorOf(city, t); if (a && !a._quake) { a._quake = true; damageLot(city, a, rng, rng() < 0.4); hit++; } }
    });
    for (const t of city.tiles) delete t._quake;
    if (rng() < 0.5) ignite(city, center, 2);
    city.revision++;
    return `Earthquake near (${center.x}, ${center.y}): ${hit} roads and buildings damaged.`;
  }
  if (id === "tornado") {
    let x = center.x, y = center.y, hit = 0;
    let dx = rng() < 0.5 ? 1 : -1, dy = rng() < 0.5 ? 1 : -1;
    for (let step = 0; step < 18; step++) {
      const t = tileAt(city, x, y);
      if (!t) break;
      forRadius(city, x, y, 1, (n) => {
        if (n.lot) { const a = anchorOf(city, n); if (a && !a._torn) { a._torn = true; damageLot(city, a, rng, true); hit++; } }
        else if (n.trees && rng() < 0.5) n.trees = 0;
      });
      if (rng() < 0.6) x += dx; else y += dy;
      if (rng() < 0.15) dx = -dx;
      if (rng() < 0.15) dy = -dy;
    }
    for (const t of city.tiles) delete t._torn;
    city.revision++;
    return `A tornado tore through the city, wrecking ${hit} buildings.`;
  }
  if (id === "riot") {
    const hot = targets.filter((t) => ZONE_TYPES.has(t.type) && t.crime > 40);
    const pool = hot.length ? hot : targets;
    let fires = 0;
    for (let i = 0; i < 4; i++) if (ignite(city, pool[Math.floor(rng() * pool.length)], 3)) fires++;
    city.revision++;
    return `Rioting in high-crime districts. ${fires} fires set.`;
  }
  const pool = fireTargets(city);
  const origin = pool.length ? pool[Math.floor(rng() * pool.length)] : center;
  ignite(city, origin, 3);
  city.revision++;
  return `Fire reported at (${origin.x}, ${origin.y}). Fire crews nearby will contain it.`;
}

// One month of fire behaviour. Returns a summary message or null.
export function advanceFires(city, rng) {
  const burning = city.tiles.filter((t) => t.fire > 0);
  if (!burning.length) return null;
  let destroyed = 0, contained = 0;
  for (const t of burning) {
    const cover = t.svc?.fire || 0;
    if (rng() < cover / 110) { t.fire = 0; contained++; continue; }
    // Spread to neighbouring buildings and woods.
    const edge = t.lot ? lotTiles(city, t.lot) : [t];
    for (const e of edge) {
      for (const [dx, dy] of NEIGHBORS4) {
        const n = tileAt(city, e.x + dx, e.y + dy);
        if (!n || n.terrain === "water" || (n.lot && n.lot.x === t.lot?.x && n.lot.y === t.lot?.y)) continue;
        if (rng() < 0.12 * (1 - (n.svc?.fire || 0) / 130)) ignite(city, n, 2);
      }
    }
    t.fire--;
    if (t.fire === 0) {
      if (t.lot) damageLot(city, anchorOf(city, t) || t, rng);
      else if (t.type === "empty") t.trees = 0;
      else if (t.type !== "road") t.type = "empty";
      destroyed++;
    }
  }
  city.revision++;
  if (destroyed && contained) return `Fire crews contained ${contained} fires; ${destroyed} buildings burned.`;
  if (destroyed) return `${destroyed} buildings burned down. Improve fire coverage.`;
  if (contained) return `Fire crews contained ${contained} fires.`;
  return null;
}

// Random disaster roll for a month. Returns message or null.
export function randomDisaster(city, stats, rng) {
  if (city.disasters === false) return null;
  if (stats.population < 200) return null;
  const roll = rng();
  const fireRisk = 0.0015 * (1.5 - (stats.fireCover || 0) / 100);
  if (roll < fireRisk) return triggerDisaster(city, "fire", rng);
  if (roll < fireRisk + 0.0008) return triggerDisaster(city, "earthquake", rng);
  if (roll < fireRisk + 0.0016) return triggerDisaster(city, "tornado", rng);
  if (roll < fireRisk + 0.0022 && city.tiles.some((t) => t.terrain === "water")) return triggerDisaster(city, "flood", rng);
  if (stats.crime > 55 && stats.happiness < 35 && roll < fireRisk + 0.02) return triggerDisaster(city, "riot", rng);
  return null;
}
