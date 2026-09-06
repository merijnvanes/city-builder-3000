// Procedural terrain: river, coast or lakes, beaches and forests.
// Deterministic for a seed. No browser deps.

export function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

// Value noise in 0..1 with lattice spacing `scale`.
export function noise(x, y, scale, seed) {
  const gx = Math.floor(x / scale), gy = Math.floor(y / scale);
  const fx = smooth(x / scale - gx), fy = smooth(y / scale - gy);
  const a = hash(gx, gy, seed), b = hash(gx + 1, gy, seed);
  const c = hash(gx, gy + 1, seed), d = hash(gx + 1, gy + 1, seed);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}

export function fbm(x, y, seed, scale = 12) {
  return noise(x, y, scale, seed) * 0.6 + noise(x, y, scale / 2, seed + 7) * 0.28 + noise(x, y, scale / 4, seed + 13) * 0.12;
}

export const LAYOUTS = ["river", "coast", "lakes", "delta", "plains"];

// Returns { terrain: Array<'grass'|'water'|'sand'>, trees: Array<0..3>, layout }.
export function generateTerrain(size, seed, layout) {
  // Random maps never pick plains; it is the flat option for a deliberate choice.
  layout = LAYOUTS.includes(layout) ? layout : LAYOUTS[seed % 4];
  const rng = lcg(seed ^ 0x9e3779b9);
  const water = new Uint8Array(size * size);
  const terrain = new Array(size * size).fill("grass");
  const trees = new Uint8Array(size * size);

  const riverPath = () => {
    // Winding river running north to south, kept away from the west edge
    // so the starter town has room.
    const base = size * (0.62 + rng() * 0.16);
    const amp = size * (0.05 + rng() * 0.06);
    const phase = rng() * 6.28;
    const width = 2 + rng() * 2;
    for (let y = 0; y < size; y++) {
      const cx = base + Math.sin(y * 0.11 + phase) * amp + (noise(0, y, 9, seed) - 0.5) * size * 0.12;
      const w = width + noise(0, y, 6, seed + 3) * 2;
      for (let x = 0; x < size; x++) if (Math.abs(x - cx) < w) water[y * size + x] = 1;
    }
  };
  const coastline = () => {
    // Ocean along the east edge with a rippled shoreline and a bay.
    const inset = size * (0.18 + rng() * 0.1);
    for (let y = 0; y < size; y++) {
      const edge = size - inset + (noise(0, y, 10, seed + 5) - 0.5) * size * 0.16 + Math.sin(y * 0.2) * 1.5;
      for (let x = 0; x < size; x++) if (x > edge) water[y * size + x] = 1;
    }
  };
  const lakes = (threshold) => {
    for (let y = 2; y < size - 2; y++) {
      for (let x = 2; x < size - 2; x++) {
        if (fbm(x, y, seed + 21, 14) > threshold) water[y * size + x] = 1;
      }
    }
  };

  if (layout === "river") riverPath();
  else if (layout === "coast") coastline();
  else if (layout === "lakes") lakes(0.66);
  else if (layout === "plains") lakes(0.8);
  else { riverPath(); lakes(0.71); }

  // Remove single-tile water specks so bridges and lots behave.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (!water[i]) continue;
      let n = 0;
      if (x > 0 && water[i - 1]) n++;
      if (x < size - 1 && water[i + 1]) n++;
      if (y > 0 && water[i - size]) n++;
      if (y < size - 1 && water[i + size]) n++;
      if (n === 0) water[i] = 0;
    }
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (water[i]) { terrain[i] = "water"; continue; }
      const nearWater =
        (x > 0 && water[i - 1]) || (x < size - 1 && water[i + 1]) ||
        (y > 0 && water[i - size]) || (y < size - 1 && water[i + size]);
      if (nearWater && noise(x, y, 5, seed + 31) > 0.35) { terrain[i] = "sand"; continue; }
      const forest = fbm(x, y, seed + 41, 10);
      if (forest > 0.56) trees[i] = forest > 0.7 ? 3 : forest > 0.63 ? 2 : 1;
      else if (hash(x, y, seed + 51) > 0.93) trees[i] = 1;
    }
  }
  return { terrain, trees: Array.from(trees), layout };
}
