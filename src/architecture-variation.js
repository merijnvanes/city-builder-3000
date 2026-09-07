export const random = (x, y, n = 0) => {
  const v = Math.sin(x * 127.1 + y * 311.7 + n * 73.3) * 43758.5453;
  return v - Math.floor(v);
};

// Tile.variant is the original normalized seed, not a discrete model index.
export function spriteVariant(tile, count = 1) {
  if (count <= 1) return 0;
  const seed = tile.variant ?? random(tile.x, tile.y);
  return Math.max(0, Math.min(count - 1, Math.floor((Number.isFinite(seed) ? seed : 0) * count)));
}

export function spriteFrameKey(state, rotation, variant = 0) {
  return `${state}-${rotation}${variant ? `-v${variant}` : ''}`;
}
