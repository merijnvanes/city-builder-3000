// Grid helpers shared by the simulation modules.

export const inBounds = (size, x, y) =>
  Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size;

export const tileAt = (city, x, y) => (inBounds(city.size, x, y) ? city.tiles[y * city.size + x] : null);

export const NEIGHBORS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function* neighbors4(city, t) {
  for (const [dx, dy] of NEIGHBORS4) {
    const n = tileAt(city, t.x + dx, t.y + dy);
    if (n) yield n;
  }
}

// Visit every tile within Manhattan radius r of (cx, cy). fn(tile, distance).
export function forRadius(city, cx, cy, r, fn) {
  const { size, tiles } = city;
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= size) continue;
    const span = r - Math.abs(dy);
    for (let dx = -span; dx <= span; dx++) {
      const x = cx + dx;
      if (x < 0 || x >= size) continue;
      fn(tiles[y * size + x], Math.abs(dx) + Math.abs(dy));
    }
  }
}

// Visit every tile within Chebyshev radius r (a square). fn(tile, distance).
export function forSquare(city, cx, cy, r, fn) {
  const { size, tiles } = city;
  for (let dy = -r; dy <= r; dy++) {
    const y = cy + dy;
    if (y < 0 || y >= size) continue;
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx;
      if (x < 0 || x >= size) continue;
      fn(tiles[y * size + x], Math.max(Math.abs(dx), Math.abs(dy)));
    }
  }
}

export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// Advance the city's deterministic random stream and return 0..1.
export function nextRandom(city) {
  city._rng = (Math.imul(1664525, city._rng >>> 0) + 1013904223) >>> 0;
  return city._rng / 4294967296;
}

// Label connected components of tiles passing `test` (4-neighbor). Returns
// Int32Array of component ids, -1 for tiles outside any component.
export function components(city, test) {
  const { size, tiles } = city;
  const ids = new Int32Array(tiles.length).fill(-1);
  let count = 0;
  const queue = new Int32Array(tiles.length);
  for (let start = 0; start < tiles.length; start++) {
    if (ids[start] !== -1 || !test(tiles[start])) continue;
    let head = 0, tail = 0;
    queue[tail++] = start;
    ids[start] = count;
    while (head < tail) {
      const i = queue[head++];
      const x = i % size, y = (i - x) / size;
      for (const [dx, dy] of NEIGHBORS4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const ni = ny * size + nx;
        if (ids[ni] === -1 && test(tiles[ni])) { ids[ni] = count; queue[tail++] = ni; }
      }
    }
    count++;
  }
  return { ids, count };
}
