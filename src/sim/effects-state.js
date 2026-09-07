// Only simulation data is persisted; renderer animation flags are transient.
// Keys an effect does not use are left off rather than carried as undefined,
// so a reloaded effect compares equal to the one that was saved.
export function effectState(effects = []) {
  return effects.map(({ type, x, y, ttl, radius, path }) => {
    const out = { type, x, y, ttl };
    if (radius !== undefined) out.radius = radius;
    if (path !== undefined) out.path = path;
    return out;
  });
}

export function parseEffects(effects = [], size) {
  const invalid = () => { throw new Error('Invalid save: bad disaster effects.'); };
  const coordinate = value => Number.isInteger(value) && value >= 0 && value < size;
  if (!Array.isArray(effects) || effects.length > 4096) invalid();
  for (const e of effects) {
    if (!e || !Number.isInteger(e.ttl) || e.ttl < 1 || e.ttl > 6) invalid();
    if (e.type === 'ufo' || e.type === 'tornado') {
      if (!Array.isArray(e.path) || e.path.length < 1 || e.path.length > 18 ||
          e.path.some(p => !p || !coordinate(p.x) || !coordinate(p.y))) invalid();
    } else if (['earthquake', 'toxic', 'lava', 'riot'].includes(e.type)) {
      if (!coordinate(e.x) || !coordinate(e.y)) invalid();
      if (e.type === 'lava' && (!Number.isInteger(e.radius) || e.radius < 1 || e.radius > 5)) invalid();
    } else invalid();
  }
  return effectState(effects);
}
