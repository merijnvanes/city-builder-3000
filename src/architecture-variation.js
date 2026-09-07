export const random = (x, y, n = 0) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + n * 73.3) * 43758.5453;
  return v - Math.floor(v);
};

// Tile.variant is the original normalized seed, not a discrete model index.
export function spriteVariant(tile, count = 1) {
  if (count <= 1) return 0;
  const seed = tile.variant ?? random(tile.x, tile.y);
  if (tile.type === 'industrial') {
    // Legacy palette lookups wrap at the save format's inclusive terminal seed.
    if (seed === 1) return 0;
    if (tile.density === 2 && count === 7) {
      // Union of warehouse thirds and cargo-color fifths, not seven equal bins.
      const value = Math.max(0, Math.min(1 - Number.EPSILON, Number.isFinite(seed) ? seed : 0));
      return [.2, 1/3, .4, .6, 2/3, .8, 1].findIndex(limit => value < limit);
    }
  }
  if (tile.type === 'commercial') {
    if (seed === 1 && tile.density === 1 && count === 5) return 2;
    if (seed === 1 && tile.density === 2 && count === 7) return 4;
    if (tile.density === 3 && (count === 3 || count === 6)) {
      const signature = count === 6 && random(tile.x, tile.y, 37) < .45;
      const style = seed === 1 ? signature ? 2 : 0 : Math.max(0, Math.min(2, Math.floor((Number.isFinite(seed) ? seed : 0) * 3)));
      return style + (signature ? 3 : 0);
    }
  }
  if (tile.type === 'residential' && tile.density === 2 && tile.lot?.w >= 2 && count === 3 && seed === 1) return 0;
  // Save serialization can round the terminal seed to 1. The legacy high
  // residential recipe then selects floor(1*5)%3: the balcony family.
  if (tile.type === 'residential' && tile.density === 3 && count === 5 && seed === 1) return 2;
  return Math.max(0, Math.min(count - 1, Math.floor((Number.isFinite(seed) ? seed : 0) * count)));
}

export function spriteFrameKey(state, rotation, variant = 0) {
  return `${state}-${rotation}${variant ? `-v${variant}` : ''}`;
}
