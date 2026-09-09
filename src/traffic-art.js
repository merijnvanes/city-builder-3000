import { random } from './architecture-variation.js';
import { carriesRoute } from './sim/catalog.js';
import { surfaceStep } from './sim/structures.js';
import { tileAt } from './sim/grid.js';
import { rampAxis } from './sim/highways.js';
import { surfacePlatform } from './deck-geometry.js';
import { drawVehicle } from './street-art.js';
import { drawTrain } from './rail-art.js';

// Animated vehicles are drawn every frame between the ground cache and the
// object cache. A vehicle on an elevated deck goes to the deck layer instead,
// which the deck traffic mask keeps behind nearer solids and railings.

// Which way a car may leave this tile: along x, along y, or not at all.
function lanes(t, city) {
  if (t.type === 'onramp') {
    const axis = rampAxis(city, t);
    return axis ? { x: !!axis.dx, y: !!axis.dy } : null;
  }
  const route = t.type === 'highway' ? 'highway' : 'road';
  const east = tileAt(city, t.x + 1, t.y), south = tileAt(city, t.x, t.y + 1);
  return { x: carriesRoute(east, route) && surfaceStep(t, east), y: carriesRoute(south, route) && surfaceStep(t, south) };
}

const offscreen = (r, p) => p.x < -20 || p.x > r.w + 20 || p.y < -20 || p.y > r.h + 20;
const CAR_COLORS = ['#e9dfbc', '#c5684e', '#739bab', '#e6e4d7', '#dfb45b'];

// Cars: more on busy roads, faster on highways.
export function drawTraffic(r, city, time, deckLayer) {
  const ctx = r.ctx;
  for (let i = 0; i < city.tiles.length; i++) {
    const t = city.tiles[i], highway = t.type === 'highway';
    if (t.type !== 'road' && !highway && t.type !== 'onramp') continue;
    if (random(t.x, t.y, 9) > (highway ? 0.3 : 0.18) + (t.traffic || 0) * 0.008) continue;
    const lane = lanes(t, city);
    if (!lane || (!lane.x && !lane.y)) continue;
    const vertical = lane.y && (!lane.x || i % 2 === 0), back = i % 3 === 0;
    const f = (time * (highway ? 0.0003 : 0.00016) + random(t.x, t.y)) % 1, a = back ? 1 - f : f;
    const x = t.x + (vertical ? (back ? 0.68 : 0.32) : a), y = t.y + (vertical ? a : back ? 0.68 : 0.32);
    const platform = surfacePlatform(r, t, city);
    r.platform = platform;
    try {
      if (offscreen(r, r.project(x, y, 2.1))) continue;
      if (platform !== null && deckLayer) r.ctx = deckLayer;
      const bus = i % 17 === 0;
      drawVehicle(r, x, y, vertical, back, bus ? '#4f9db1' : CAR_COLORS[i % 5], bus);
    } finally { r.ctx = ctx; r.platform = null; }
  }
}

// Trains on busy rails.
export function drawTrains(r, city, time, deckLayer) {
  const ctx = r.ctx;
  for (let i = 0; i < city.tiles.length; i++) {
    const t = city.tiles[i];
    if (!carriesRoute(t, 'rail') || !t.traffic || random(t.x, t.y, 5) > 0.12) continue;
    const f = (time * 0.0002 + random(t.x, t.y, 6)) % 1;
    const platform = surfacePlatform(r, t, city);
    r.platform = platform;
    try {
      if (offscreen(r, r.project(t.x + .5, t.y + .5, 3))) continue;
      if (platform !== null && deckLayer) r.ctx = deckLayer;
      drawTrain(r, t, city, f);
    } finally { r.ctx = ctx; r.platform = null; }
  }
}
