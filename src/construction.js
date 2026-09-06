// construction.js — plan/apply/undo for city construction. Pure JS, no DOM.
import { TOOLS, place, getStats } from './sim.js';
import { updateInfrastructure } from './infrastructure.js';

const ZONE_TYPES = new Set(['residential', 'commercial', 'industrial']);
const RECT_TOOLS = new Set(['residential', 'commercial', 'industrial', 'park', 'landfill']);
const PATH_TOOLS = new Set(['road', 'rail', 'powerline', 'pipe']);
const OVERLAY_TOOLS = new Set(['powerline', 'pipe']);
const MAX_TILES = 1600;

// Fallback costs for tools sim.js worker adds concurrently.
const FALLBACK_TOOLS = {
  powerline: { id: 'powerline', label: 'Powerline', cost: 25, description: 'Build powerline ($25)' },
  pipe:      { id: 'pipe',      label: 'Pipe',      cost: 25, description: 'Build pipe ($25)' },
  rail:      { id: 'rail',      label: 'Rail',      cost: 150, description: 'Build rail ($150)' },
  landfill:  { id: 'landfill',  label: 'Landfill',  cost: 300, description: 'Build landfill ($300)' },
  school:    { id: 'school',    label: 'School',    cost: 5000, description: 'Build school ($5,000)' },
  hospital:  { id: 'hospital',  label: 'Hospital',  cost: 8000, description: 'Build hospital ($8,000)' },
  bus:       { id: 'bus',       label: 'Bus Stop',  cost: 500, description: 'Build bus stop ($500)' },
};

function getToolMap() {
  const map = Object.fromEntries(TOOLS.map(t => [t.id, t]));
  for (const [id, def] of Object.entries(FALLBACK_TOOLS)) {
    if (!map[id]) map[id] = def;
  }
  return map;
}

function inBounds(size, x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < size && y < size;
}

function tileAt(city, x, y) {
  return city.tiles[y * city.size + x];
}

function coordsForTool(x1, y1, x2, y2, tool) {
  if (RECT_TOOLS.has(tool)) {
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);
    const out = [];
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++)
        out.push({ x, y });
    return out;
  }
  if (PATH_TOOLS.has(tool)) {
    const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
    const out = [];
    if (dx >= dy) {
      const sx = x2 >= x1 ? 1 : -1;
      for (let x = x1; x !== x2 + sx; x += sx) out.push({ x, y: y1 });
      if (y2 !== y1) {
        const sy = y2 > y1 ? 1 : -1;
        for (let y = y1 + sy; y !== y2 + sy; y += sy) out.push({ x: x2, y });
      }
    } else {
      const sy = y2 >= y1 ? 1 : -1;
      for (let y = y1; y !== y2 + sy; y += sy) out.push({ x: x1, y });
      if (x2 !== x1) {
        const sx = x2 > x1 ? 1 : -1;
        for (let x = x1 + sx; x !== x2 + sx; x += sx) out.push({ x, y: y2 });
      }
    }
    return out;
  }
  // Single tile at end point
  return [{ x: x2, y: y2 }];
}

function evalTile(city, x, y, tool, density, toolDef, toolMap) {
  if (!inBounds(city.size, x, y)) {
    return { x, y, valid: false, cost: 0, noop: false, message: 'Out of bounds' };
  }

  const t = tileAt(city, x, y);

  if (tool === 'inspect') {
    return { x, y, valid: true, cost: 0, noop: true, message: '' };
  }

  if (tool === 'bulldoze') {
    if (t.type === 'empty') {
      // Overlay demolition on empty underlay tile
      if (t.powerline || t.pipe) {
        return { x, y, valid: true, cost: toolDef.cost, noop: false, message: 'Remove overlay' };
      }
      return { x, y, valid: false, cost: 0, noop: false, message: 'Nothing to demolish' };
    }
    const refund = Math.floor((toolMap[t.type]?.cost ?? 0) * 0.25);
    const net = toolDef.cost - refund;
    return { x, y, valid: true, cost: net, noop: false, message: net >= 0 ? `Net cost $${net}` : `Salvage $${-net}` };
  }

  if (OVERLAY_TOOLS.has(tool)) {
    if (t.terrain === 'water' && t.type !== 'road') {
      return { x, y, valid: false, cost: 0, noop: false, message: 'Cannot overlay on water' };
    }
    const flag = tool === 'powerline' ? 'powerline' : 'pipe';
    if (t[flag]) {
      return { x, y, valid: true, cost: 0, noop: true, message: 'Already present' };
    }
    return { x, y, valid: true, cost: toolDef.cost, noop: false, message: '' };
  }

  if (tool === 'road') {
    if (t.type === 'road') {
      return { x, y, valid: true, cost: 0, noop: true, message: 'Road already here' };
    }
    if (t.type !== 'empty') {
      return { x, y, valid: false, cost: 0, noop: false, message: 'Tile occupied' };
    }
    return { x, y, valid: true, cost: toolDef.cost, noop: false, message: '' };
  }

  if (tool === 'rail') {
    if (t.terrain === 'water') {
      return { x, y, valid: false, cost: 0, noop: false, message: 'Rail cannot cross water' };
    }
    if (t.type === 'rail') {
      return { x, y, valid: true, cost: 0, noop: true, message: 'Rail already here' };
    }
    if (t.type !== 'empty') {
      return { x, y, valid: false, cost: 0, noop: false, message: 'Tile occupied' };
    }
    return { x, y, valid: true, cost: toolDef.cost, noop: false, message: '' };
  }

  if (ZONE_TYPES.has(tool)) {
    if (t.terrain === 'water') {
      return { x, y, valid: false, cost: 0, noop: false, message: 'Cannot zone on water' };
    }
    if (t.type === tool) {
      const cur = t.density ?? 1;
      if (cur === density) {
        return { x, y, valid: true, cost: 0, noop: true, message: 'Same zone and density' };
      }
      const cost = toolDef.cost * density;
      return { x, y, valid: true, cost, noop: false, message: `Rezone density ${cur}→${density}` };
    }
    if (t.type !== 'empty') {
      return { x, y, valid: false, cost: 0, noop: false, message: 'Tile occupied, bulldoze first' };
    }
    return { x, y, valid: true, cost: toolDef.cost * density, noop: false, message: '' };
  }

  // park, landfill, civic (power plant, water tower, police, fire, school, hospital, bus, etc.)
  if (t.terrain === 'water') {
    return { x, y, valid: false, cost: 0, noop: false, message: 'Cannot build on water' };
  }
  if (t.type === tool) {
    return { x, y, valid: true, cost: 0, noop: true, message: 'Already present' };
  }
  if (t.type !== 'empty') {
    return { x, y, valid: false, cost: 0, noop: false, message: 'Tile occupied' };
  }
  return { x, y, valid: true, cost: toolDef.cost, noop: false, message: '' };
}

export function planConstruction(city, start, end, tool, options = {}) {
  // Handle null/non-object options safely
  const opts = (options !== null && typeof options === 'object') ? options : {};
  const density = opts.density ?? 1;

  const fail = (msg) => ({ tiles: [], cost: 0, count: 0, valid: false, affordable: false, message: msg, tool: String(tool ?? ''), density });

  if (!city || typeof city !== 'object') return fail('Invalid city object');
  if (!Array.isArray(city.tiles)) return fail('Invalid city object');
  if (!Number.isSafeInteger(city.size) || city.size !== 40) return fail('Invalid city: size must be 40');
  if (city.tiles.length !== MAX_TILES) return fail('Invalid city: tiles.length must be 1600');
  if (!Number.isSafeInteger(city.money)) return fail('Invalid city: money must be a safe integer');

  if (typeof tool !== 'string') return fail('Tool must be a string');

  const toolMap = getToolMap();
  // Object.hasOwn rejects prototype keys (toString, constructor, etc.)
  if (!Object.hasOwn(toolMap, tool)) return fail(`Unknown tool: ${tool}`);
  const toolDef = toolMap[tool];

  if (!start || typeof start !== 'object') return fail('Invalid start coordinates');
  if (!end || typeof end !== 'object') return fail('Invalid end coordinates');

  const { x: sx, y: sy } = start;
  const { x: ex, y: ey } = end;
  // Require safe integers to prevent arithmetic overflow before pre-size check
  if (!Number.isSafeInteger(sx) || !Number.isSafeInteger(sy) || !Number.isSafeInteger(ex) || !Number.isSafeInteger(ey)) {
    return fail('Coordinates must be integers');
  }

  // Reject enormous selections BEFORE allocating coordinate arrays
  if (RECT_TOOLS.has(tool)) {
    const w = Math.abs(ex - sx) + 1;
    const h = Math.abs(ey - sy) + 1;
    if (w * h > MAX_TILES) return fail(`Selection too large (max ${MAX_TILES} tiles)`);
  } else if (PATH_TOOLS.has(tool)) {
    const est = Math.abs(ex - sx) + Math.abs(ey - sy) + 1;
    if (est > MAX_TILES) return fail(`Selection too large (max ${MAX_TILES} tiles)`);
  }

  if (![1, 2, 3].includes(density)) return fail('Density must be 1, 2, or 3');

  const coords = coordsForTool(sx, sy, ex, ey, tool);
  // Defensive guard; should not be reached after the pre-check above
  if (coords.length > MAX_TILES) return fail(`Selection too large (max ${MAX_TILES} tiles)`);

  const tiles = coords.map(({ x, y }) => evalTile(city, x, y, tool, density, toolDef, toolMap));
  const eligible = tiles.filter(t => t.valid && !t.noop);
  const cost = eligible.reduce((s, t) => s + t.cost, 0);
  const count = eligible.length;
  const valid = count > 0;
  const affordable = valid && cost <= city.money;

  let message = '';
  if (!valid) {
    message = tiles.length === 0 ? 'No tiles selected' : (tiles.find(t => !t.valid)?.message ?? 'No valid tiles');
  } else if (!affordable) {
    message = `Insufficient funds: need $${cost}, have $${city.money}`;
  } else if (count < tiles.length) {
    const blocked = tiles.filter(t => !t.valid).length;
    message = blocked > 0 ? `${blocked} tile${blocked !== 1 ? 's' : ''} blocked` : '';
  }

  return { tiles, cost, count, valid, affordable, message, tool, density };
}

// Local mutation for cases place() does not support: overlays, rezones, overlay demolition.
function commitTileLocal(city, info, tool, density, toolMap) {
  const t = tileAt(city, info.x, info.y);
  const toolDef = toolMap[tool];

  if (tool === 'bulldoze') {
    if (t.type === 'empty') {
      // Clear overlay flags only
      delete t.powerline;
      delete t.pipe;
      city.money -= toolDef.cost;
      return;
    }
    const refund = Math.floor((toolMap[t.type]?.cost ?? 0) * 0.25);
    city.money += refund - toolDef.cost;
    t.type = 'empty';
    t.level = 0;
    delete t.density;
    return;
  }

  if (OVERLAY_TOOLS.has(tool)) {
    const flag = tool === 'powerline' ? 'powerline' : 'pipe';
    t[flag] = true;
    city.money -= info.cost;
    return;
  }

  if (ZONE_TYPES.has(tool) && t.type === tool) {
    // Rezone: same type, different density. Cap level on downgrade.
    city.money -= info.cost;
    t.density = density;
    t.level = Math.min(t.level ?? 0, density);
    return;
  }

  // Fallback for any unsupported path
  city.money -= info.cost;
  t.type = tool;
  t.level = 0;
}

export function applyConstruction(city, plan) {
  if (!city || !plan || typeof plan !== 'object') {
    return { ok: false, message: 'Invalid arguments', changed: 0, cost: 0 };
  }

  // Validate plan structure before any work
  if (typeof plan.tool !== 'string' || !Array.isArray(plan.tiles)) {
    return { ok: false, message: 'Malformed plan', changed: 0, cost: 0 };
  }
  if (plan.tiles.length > MAX_TILES) {
    return { ok: false, message: 'Plan too large', changed: 0, cost: 0 };
  }
  if (![1, 2, 3].includes(plan.density)) {
    return { ok: false, message: 'Invalid plan density', changed: 0, cost: 0 };
  }

  const toolMap = getToolMap();
  if (!Object.hasOwn(toolMap, plan.tool)) {
    return { ok: false, message: `Unknown tool: ${plan.tool}`, changed: 0, cost: 0 };
  }
  const toolDef = toolMap[plan.tool];

  // Deduplicate plan tiles by (x, y) — no stale plan trust
  const seen = new Set();
  const dedupedTiles = plan.tiles.filter(tile => {
    if (!tile || !Number.isSafeInteger(tile.x) || !Number.isSafeInteger(tile.y)) return false;
    const key = `${tile.x},${tile.y}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Re-evaluate all tiles against current city state
  const fresh = dedupedTiles.map(tile =>
    evalTile(city, tile.x, tile.y, plan.tool, plan.density, toolDef, toolMap)
  );
  const actionable = fresh.filter(t => t.valid && !t.noop);

  if (actionable.length === 0) {
    return { ok: false, message: 'No eligible tiles to build', changed: 0, cost: 0 };
  }

  // Sort ascending by cost so salvage (negative net) tiles run first,
  // ensuring per-tile affordability checks pass consistently.
  actionable.sort((a, b) => a.cost - b.cost);

  const totalCost = actionable.reduce((s, t) => s + t.cost, 0);
  if (totalCost > city.money) {
    return {
      ok: false,
      message: `Insufficient funds: need $${totalCost}, have $${city.money}`,
      changed: 0,
      cost: 0,
    };
  }

  const snapshot = structuredClone(city);

  try {
    for (const tile of actionable) {
      const t = tileAt(city, tile.x, tile.y);
      const isOverlay = OVERLAY_TOOLS.has(plan.tool);
      const isRezone = ZONE_TYPES.has(plan.tool) && t.type === plan.tool;
      const isOverlayBulldoze = plan.tool === 'bulldoze' && t.type === 'empty';

      if (isOverlay || isRezone || isOverlayBulldoze) {
        // place() does not support overlays, rezones, or overlay-only bulldoze
        commitTileLocal(city, tile, plan.tool, plan.density, toolMap);
      } else {
        // Use public place() with options for future deferRefresh support
        const result = place(city, tile.x, tile.y, plan.tool, { density: plan.density, deferRefresh: true });
        if (!result.ok) throw new Error(result.message);

        // place() charges base cost; deduct density premium separately
        if (ZONE_TYPES.has(plan.tool) && plan.density > 1) {
          const freshTile = tileAt(city, tile.x, tile.y);
          freshTile.density = plan.density;
          const extra = toolDef.cost * (plan.density - 1);
          if (city.money < extra) throw new Error('Insufficient funds for density upgrade');
          city.money -= extra;
        }
      }
    }

    // Single infrastructure pass after all mutations (deferRefresh intent)
    updateInfrastructure(city);
    const stats = getStats(city);
    city.population = stats.population;
    city.happiness = stats.happiness;
    city.demand = { ...stats.demand };
    city.revision = (city.revision ?? 0) + 1;
  } catch (err) {
    // Restore city in-place; preserve exact snapshot revision (no bump on failure)
    const keys = new Set([...Object.keys(city), ...Object.keys(snapshot)]);
    for (const k of keys) {
      if (k in snapshot) city[k] = structuredClone(snapshot[k]);
      else delete city[k];
    }
    return { ok: false, message: `Unexpected error: ${err.message}`, changed: 0, cost: 0 };
  }

  return { ok: true, message: '', changed: actionable.length, cost: totalCost };
}

export function createUndoManager(limit = 20) {
  const stack = [];

  return {
    record(city) {
      stack.push(structuredClone(city));
      if (stack.length > limit) stack.shift();
    },
    undo(city) {
      if (stack.length === 0) return false;
      const snap = stack.pop();
      const keys = new Set([...Object.keys(city), ...Object.keys(snap)]);
      for (const k of keys) {
        if (k in snap) city[k] = structuredClone(snap[k]);
        else delete city[k];
      }
      city.revision = (city.revision ?? 0) + 1;
      return true;
    },
    clear() {
      stack.length = 0;
    },
    get size() {
      return stack.length;
    },
  };
}
