// Stable asset identity; the normalized seed chooses a layout within this entry.
export function zoneArtKey(tile) {
  if (!['residential','commercial','industrial'].includes(tile.type) || !tile.lot) return null;
  return `${tile.type}-d${tile.density}-l${Math.max(1, tile.level || 1)}-s${tile.lot.w}`;
}
