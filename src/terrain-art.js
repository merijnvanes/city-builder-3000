// Broad, continuous color variation keeps natural terrain from reading as a
// checkerboard. The simulation grid remains visible when a tool is selected.
import { noise } from './sim/terrain.js';

const mix = (a, b, amount) => '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('');
const at = (city, x, y) => x >= 0 && y >= 0 && x < city.size && y < city.size ? city.tiles[y * city.size + x] : null;

export function surfaceColor(tile, city) {
  const { x, y, terrain } = tile;
  const variation = noise(x + 0.5, y + 0.5, 6, city.seed);
  if (terrain === 'water') {
    // Shallow teal near the shore, cooler blue in the channel or open sea.
    let distance = 4;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const neighbor = at(city, x + dx, y + dy);
      if (neighbor && neighbor.terrain !== 'water') distance = Math.min(distance, Math.hypot(dx, dy));
    }
    return mix([87, 143, 146], [48, 101, 128], Math.min(1, distance / 4 * 0.87 + variation * 0.13));
  }
  if (terrain === 'sand') return mix([181, 176, 128], [203, 195, 149], variation);
  if (terrain === 'rock') return mix([86, 80, 73], [110, 103, 92], variation);
  const broad = noise(x, y, 19, city.seed + 31);
  return mix([113, 138, 73], [139, 157, 88], broad * 0.6 + variation * 0.4);
}

export function drawShoreline(r, tile, city) {
  const { x, y } = tile;
  // A small waterline follows only genuine land boundaries, never map edges.
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const neighbor = at(city, x + dx, y + dy);
    if (!neighbor || neighbor.terrain === 'water') continue;
    const alongX = dy !== 0;
    const ax = x + (dx === 1 ? 1 : 0), ay = y + (dy === 1 ? 1 : 0);
    const bx = ax + (alongX ? 1 : 0), by = ay + (alongX ? 0 : 1);
    r.line(r.project(ax, ay, 0.1), r.project(bx, by, 0.1), '#c3d1b788', 1.15);
    if (r.zoom > 0.65) {
      r.line(r.project(ax - dx * 0.08, ay - dy * 0.08, 0.1), r.project(bx - dx * 0.08, by - dy * 0.08, 0.1), '#9fc8bd55', 0.6);
    }
  }
}
