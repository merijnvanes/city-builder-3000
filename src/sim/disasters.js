// Disasters: fire, earthquake, tornado, flood, riot, toxic cloud, flying
// saucer, volcano. Fires spread month by month unless fire coverage is
// strong. Burned lots are cleared.
import { tileAt, forRadius, NEIGHBORS4 } from "./grid.js";
import { ZONE_TYPES, BUILDINGS } from "./catalog.js";
import { isAnchor, anchorOf, clearLot, lotTiles } from "./lots.js";
import { MAX_ELEVATION } from "./terrain.js";
import { meltdown } from "./power.js";
import { shelter } from "./siren.js";

export const DISASTERS = {
  fire:       { label: "Fire",       description: "A building catches fire. Spreads without fire coverage." },
  earthquake: { label: "Earthquake", description: "Shakes a district: roads crack and buildings lose stories." },
  tornado:    { label: "Tornado",    description: "Carves a path of destruction across the map." },
  flood:      { label: "Flood",      description: "Rivers and coasts overflow into nearby lots." },
  riot:       { label: "Riot",       description: "Unrest in high-crime districts. Fires break out." },
  toxic:      { label: "Toxic Cloud", description: "A leak at a factory or plant. The cloud poisons the air for months and empties nearby homes." },
  ufo:        { label: "Flying Saucer", description: "Visitors from elsewhere vaporize whatever they hover over." },
  volcano:    { label: "Volcano",    description: "A new mountain erupts in the middle of town. Lava clears everything on its slopes." },
  meltdown:   { label: "Nuclear Meltdown", description: "A reactor fails. The blast flattens the district and leaves it contaminated for good." },
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

// Visual effects for the renderer: { type, x, y, ttl (months), ... }.
export function addEffect(city, effect) {
  if (!city.effects) city.effects = [];
  city.effects.push(effect);
}

export function advanceEffects(city) {
  // Flood water drains whether or not any on-screen effect is running. An
  // early return here left a city that had never shown one under water for
  // good, and a reloaded copy - which always gets an effects array - drained
  // normally and drifted away from it.
  city.effects = (city.effects || []).map((e) => ({ ...e, ttl: e.ttl - 1 })).filter((e) => e.ttl > 0);
  for (const t of city.tiles) if (t.flooded) t.flooded--;
}

export function triggerDisaster(city, id, rng) {
  // "If you can get your Sims off the streets and inside before a disaster
  // strikes, the damage from the disaster will be much less." A sounding
  // siren spares a share of everything the disaster would otherwise hit.
  const spared = shelter(city);
  // With no siren sounding this consumes exactly the rolls the disaster would
  // have consumed anyway, so a quiet city behaves precisely as before and the
  // siren's effect is the only thing being measured.
  const hits = (chance) => (spared === 0 && chance >= 1 ? true : rng() < chance * (1 - spared));
  const targets = developedTiles(city);
  if (id === "flood") {
    let hit = 0;
    for (const w of city.tiles) {
      if (w.terrain !== "water" || rng() > 0.25) continue;
      forRadius(city, w.x, w.y, 2, (n) => {
        if (n.terrain === "water") return;
        if (n.elev <= 1 && rng() < 0.7) n.flooded = 2;
        if (!n.lot || !hits(0.35)) return;
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
      if (!hits(0.65 * (1 - d / 8))) return;
      if (t.type === "road" && t.terrain !== "water") { t.type = "empty"; hit++; }
      else if (t.lot) { const a = anchorOf(city, t); if (a && !a._quake) { a._quake = true; damageLot(city, a, rng, rng() < 0.4); hit++; } }
    });
    for (const t of city.tiles) delete t._quake;
    if (rng() < 0.5) ignite(city, center, 2);
    addEffect(city, { type: "earthquake", x: center.x, y: center.y, ttl: 1 });
    city.revision++;
    return `Earthquake near (${center.x}, ${center.y}): ${hit} roads and buildings damaged.`;
  }
  if (id === "tornado") {
    let x = center.x, y = center.y, hit = 0;
    let dx = rng() < 0.5 ? 1 : -1, dy = rng() < 0.5 ? 1 : -1;
    const path = [];
    for (let step = 0; step < 18; step++) {
      const t = tileAt(city, x, y);
      if (!t) break;
      path.push({ x, y });
      forRadius(city, x, y, 1, (n) => {
        if (n.lot) { const a = anchorOf(city, n); if (a && !a._torn && hits(1)) { a._torn = true; damageLot(city, a, rng, true); hit++; } }
        else if (n.trees && rng() < 0.5) n.trees = 0;
      });
      if (rng() < 0.6) x += dx; else y += dy;
      if (rng() < 0.15) dx = -dx;
      if (rng() < 0.15) dy = -dy;
    }
    for (const t of city.tiles) delete t._torn;
    addEffect(city, { type: "tornado", path, ttl: 2 });
    city.revision++;
    return `A tornado tore through the city, wrecking ${hit} buildings.`;
  }
  if (id === "ufo") {
    let x = center.x, y = center.y, hit = 0;
    const path = [];
    for (let step = 0; step < 14; step++) {
      const t = tileAt(city, x, y);
      if (!t) break;
      path.push({ x, y });
      // Every third stop the saucer fires its beam.
      if (step % 3 === 2) forRadius(city, x, y, 1, (n) => {
        if (n.lot) { const a = anchorOf(city, n); if (a && !a._zap && hits(1)) { a._zap = true; damageLot(city, a, rng, true); hit++; } }
        else if (n.trees) n.trees = 0;
      });
      const r = rng();
      if (r < 0.3) x++; else if (r < 0.6) x--; else if (r < 0.8) y++; else y--;
    }
    for (const t of city.tiles) delete t._zap;
    addEffect(city, { type: "ufo", path, ttl: 2 });
    city.revision++;
    return `A flying saucer strafed the city and vaporized ${hit} buildings.`;
  }
  if (id === "toxic") {
    const sources = targets.filter((t) => t.type === "industrial" || (BUILDINGS[t.type]?.pollution || BUILDINGS[t.type]?.effects?.pollution || 0) >= 18);
    const origin = sources.length ? sources[Math.floor(rng() * sources.length)] : center;
    let hit = 0;
    forRadius(city, origin.x, origin.y, 6, (n, d) => {
      if (n.trees && rng() < 0.6) n.trees = 0;
      if (!n.lot || n.type !== "residential" || rng() > 0.3 * (1 - d / 7)) return;
      const a = anchorOf(city, n);
      if (a && a.level && !a.abandoned) { a.abandoned = true; hit++; }
    });
    addEffect(city, { type: "toxic", x: origin.x, y: origin.y, ttl: 3 });
    city.revision++;
    return `A toxic cloud leaked near (${origin.x}, ${origin.y}). ${hit} homes were evacuated.`;
  }
  if (id === "meltdown") {
    const reactors = city.tiles.filter((t) => isAnchor(t) && t.type === "nuclear");
    if (!reactors.length) return "There is no nuclear plant to fail.";
    const plant = reactors[Math.floor(rng() * reactors.length)];
    const { x, y } = plant;
    clearLot(city, plant, { keepZone: false });
    return meltdown(city, x, y, rng, "has suffered a catastrophic failure");
  }
  if (id === "volcano") {
    const peak = Math.min(MAX_ELEVATION, (center.elev || 0) + 6), R = peak - 1;
    let hit = 0;
    for (let dy = -R - 2; dy <= R + 2; dy++) for (let dx = -R - 2; dx <= R + 2; dx++) {
      const t = tileAt(city, center.x + dx, center.y + dy);
      if (!t) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d > R) { if (rng() < 0.4) ignite(city, t, 2); continue; }
      // The cone rises one step per tile toward the crater and buries everything on it.
      t.terrain = "rock";
      // The maximum of two gentle height fields remains gentle at the rim.
      t.elev = Math.max(t.elev || 0, peak - d);
      if (t.lot) { const a = anchorOf(city, t); if (a) { clearLot(city, a, { keepZone: false }); hit++; } }
      else if (t.type !== "empty") { t.type = "empty"; hit++; }
      t.density = 0; t.level = 0; t.abandoned = false; t.trees = 0; t.powerline = false; t.pipe = false; t.subway = false; t.fire = 0;
    }
    addEffect(city, { type: "lava", x: center.x, y: center.y, radius: 3, ttl: 6 });
    addEffect(city, { type: "earthquake", x: center.x, y: center.y, ttl: 1 });
    city.revision++;
    return `A volcano erupted at (${center.x}, ${center.y}) and buried ${hit} buildings under lava.`;
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
    // Clearing a lot earlier in this pass puts out fires on the rest of its
    // footprint, so a tile listed here may already be out.
    if (t.fire <= 0) continue;
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
      // Burning out a zoned but undeveloped tile has to clear its density
      // too, or the tile is left as empty land still marked high density.
      else if (t.type !== "road") { t.type = "empty"; t.density = 0; }
      destroyed++;
    }
  }
  city.revision++;
  if (destroyed && contained) return `Fire crews contained ${contained} fires; ${destroyed} buildings burned.`;
  if (destroyed) return `${destroyed} buildings burned down. Improve fire coverage.`;
  if (contained) return `Fire crews contained ${contained} fires.`;
  return null;
}

// "Though a fire is just as likely to break out in an area with fire
// protection as in one without" - stations decide whether a blaze does damage,
// not whether it starts. What raises the risk is dry development: "Zones that
// are not watered... are at a high risk of fire disasters."
export const fireRiskOf = (stats) => 0.0015 * (0.75 + (stats.dryShare || 0) * 2.4);

// Random disaster roll for a month. Returns message or null.
export function randomDisaster(city, stats, rng) {
  if (city.disasters === false) return null;
  if (stats.population < 200) return null;
  const roll = rng();
  const fireRisk = fireRiskOf(stats);
  if (roll < fireRisk) return triggerDisaster(city, "fire", rng);
  if (roll < fireRisk + 0.0008) return triggerDisaster(city, "earthquake", rng);
  if (roll < fireRisk + 0.0016) return triggerDisaster(city, "tornado", rng);
  if (roll < fireRisk + 0.0022) return city.tiles.some((t) => t.terrain === "water") ? triggerDisaster(city, "flood", rng) : null;
  if (roll < fireRisk + 0.0028) return (stats.pollution || 0) > 20 ? triggerDisaster(city, "toxic", rng) : null;
  if (roll < fireRisk + 0.0031) return triggerDisaster(city, "ufo", rng);
  if (roll < fireRisk + 0.0033) return triggerDisaster(city, "volcano", rng);
  if (stats.crime > 55 && stats.happiness < 35 && roll < fireRisk + 0.02) return triggerDisaster(city, "riot", rng);
  return null;
}
