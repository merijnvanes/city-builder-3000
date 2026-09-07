// construction.js — plan, apply and undo player construction. Pure JS.
//
// planConstruction prices a drag (rectangle, path or single footprint)
// without touching the city. applyConstruction re-plans against the live
// city, checks funds, then commits every eligible tile through sim.place().
import { TOOL_MAP, BUILDINGS, ZONED_TYPES, evaluate, place, refresh } from "./sim/index.js";

const MAX_TILES = 128 * 128;

const isRect = (tool) => ZONED_TYPES.has(tool) || tool === "bulldoze" || !!BUILDINGS[tool]?.rect;
const isPath = (tool) => !!BUILDINGS[tool]?.path;
const footprint = (tool) => (BUILDINGS[tool] && !BUILDINGS[tool].rect && !BUILDINGS[tool].path ? BUILDINGS[tool] : null);

// Where a footprint building lands when the cursor is at (x, y): centred.
export function anchorFor(tool, x, y) {
  const b = footprint(tool);
  if (!b) return { x, y };
  return { x: x - Math.floor((b.w - 1) / 2), y: y - Math.floor((b.h - 1) / 2) };
}

function coordsFor(x1, y1, x2, y2, tool) {
  if (isRect(tool)) {
    const out = [];
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
      for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) out.push({ x, y });
    return out;
  }
  if (isPath(tool)) {
    // Manhattan L: dominant axis first.
    const out = [];
    const dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
    if (dx >= dy) {
      const sx = x2 >= x1 ? 1 : -1;
      for (let x = x1; x !== x2 + sx; x += sx) out.push({ x, y: y1 });
      const sy = y2 > y1 ? 1 : -1;
      for (let y = y1 + sy; y2 !== y1 && y !== y2 + sy; y += sy) out.push({ x: x2, y });
    } else {
      const sy = y2 >= y1 ? 1 : -1;
      for (let y = y1; y !== y2 + sy; y += sy) out.push({ x: x1, y });
      const sx = x2 > x1 ? 1 : -1;
      for (let x = x1 + sx; x2 !== x1 && x !== x2 + sx; x += sx) out.push({ x, y: y2 });
    }
    return out;
  }
  return [anchorFor(tool, x2, y2)];
}

const invalid = (tool, density, message) => ({ tiles: [], actions: [], cost: 0, count: 0, valid: false, affordable: false, message, tool: String(tool ?? ""), density });

export function planConstruction(city, start, end, tool, options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const density = opts.density ?? 1;
  if (!city || typeof city !== "object" || !Array.isArray(city.tiles) || !Number.isSafeInteger(city.size)) return invalid(tool, density, "Invalid city");
  if (typeof tool !== "string" || !Object.hasOwn(TOOL_MAP, tool)) return invalid(tool, density, `Unknown tool: ${tool}`);
  if (![1, 2, 3].includes(density)) return invalid(tool, density, "Density must be 1, 2, or 3");
  if (!start || !end || typeof start !== "object" || typeof end !== "object") return invalid(tool, density, "Invalid coordinates");
  const { x: sx, y: sy } = start, { x: ex, y: ey } = end;
  if (![sx, sy, ex, ey].every(Number.isSafeInteger)) return invalid(tool, density, "Coordinates must be integers");
  if ((Math.abs(ex - sx) + 1) * (Math.abs(ey - sy) + 1) > MAX_TILES) return invalid(tool, density, "Selection too large");
  if (tool === "inspect") return { ...invalid(tool, density, ""), valid: true, affordable: true };

  const coords = coordsFor(sx, sy, ex, ey, tool);
  const seen = new Set();
  const tiles = [], actions = [];
  let cost = 0;
  const b = footprint(tool);
  // Level flattens the whole drag to the height of the tile it started on.
  const elev = tool === "level" ? city.tiles[sy * city.size + sx]?.elev : undefined;
  for (const c of coords) {
    const ev = evaluate(city, c.x, c.y, tool, { density, elev });
    if (ev.ok && ev.noop) {
      if (!seen.has(`${c.x},${c.y}`)) { seen.add(`${c.x},${c.y}`); tiles.push({ x: c.x, y: c.y, valid: true, noop: true, cost: 0, message: ev.message }); }
      continue;
    }
    if (!ev.ok) {
      // Show the whole intended footprint in red for buildings.
      const shape = b ? [] : [{ x: c.x, y: c.y }];
      if (b) for (let yy = c.y; yy < c.y + b.h; yy++) for (let xx = c.x; xx < c.x + b.w; xx++) shape.push({ x: xx, y: yy });
      for (const s of shape) if (!seen.has(`${s.x},${s.y}`)) { seen.add(`${s.x},${s.y}`); tiles.push({ x: s.x, y: s.y, valid: false, noop: false, cost: 0, message: ev.message }); }
      continue;
    }
    let fresh = false;
    for (const s of ev.tiles) {
      if (seen.has(`${s.x},${s.y}`)) continue;
      seen.add(`${s.x},${s.y}`);
      fresh = true;
      tiles.push({ x: s.x, y: s.y, valid: true, noop: false, cost: 0, message: ev.message });
    }
    if (!fresh) continue;
    tiles[tiles.length - 1].cost = ev.cost;
    actions.push({ x: c.x, y: c.y, cost: ev.cost });
    cost += ev.cost;
  }
  const count = actions.length;
  const valid = count > 0;
  const affordable = valid && cost <= city.money;
  let message = "";
  if (!valid) message = tiles.find((t) => !t.valid)?.message || (tiles.length ? "Nothing to build here" : "No tiles selected");
  else if (!affordable) message = `Insufficient funds: need $${cost.toLocaleString()}, have $${Math.floor(city.money).toLocaleString()}`;
  else {
    const blocked = tiles.filter((t) => !t.valid).length;
    if (blocked) message = `${blocked} tile${blocked === 1 ? "" : "s"} blocked`;
  }
  return { tiles, actions, cost, count, valid, affordable, message, tool, density, elev };
}

function restore(city, snapshot) {
  for (const k of new Set([...Object.keys(city), ...Object.keys(snapshot)])) {
    if (k in snapshot) city[k] = snapshot[k]; else delete city[k];
  }
}

export function applyConstruction(city, plan) {
  if (!city || !plan || typeof plan !== "object" || typeof plan.tool !== "string" || !Array.isArray(plan.actions ?? plan.tiles))
    return { ok: false, message: "Malformed plan", changed: 0, cost: 0 };
  if (!Object.hasOwn(TOOL_MAP, plan.tool)) return { ok: false, message: `Unknown tool: ${plan.tool}`, changed: 0, cost: 0 };
  if (![1, 2, 3].includes(plan.density)) return { ok: false, message: "Invalid plan density", changed: 0, cost: 0 };
  const source = plan.actions ?? plan.tiles;
  if (source.length > MAX_TILES) return { ok: false, message: "Plan too large", changed: 0, cost: 0 };

  // Re-evaluate against the live city; never trust a stale plan.
  const seen = new Set();
  const actions = [];
  let cost = 0;
  for (const a of source) {
    if (!a || !Number.isSafeInteger(a.x) || !Number.isSafeInteger(a.y)) continue;
    const key = `${a.x},${a.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const ev = evaluate(city, a.x, a.y, plan.tool, { density: plan.density, elev: plan.elev });
    if (!ev.ok || ev.noop) continue;
    actions.push({ x: a.x, y: a.y, cost: ev.cost, tiles: ev.tiles });
    cost += ev.cost;
  }
  if (!actions.length) return { ok: false, message: "No eligible tiles to build", changed: 0, cost: 0 };
  if (cost > city.money) return { ok: false, message: `Insufficient funds: need $${cost.toLocaleString()}, have $${Math.floor(city.money).toLocaleString()}`, changed: 0, cost: 0 };

  const snapshot = structuredClone(city);
  let changed = 0;
  try {
    // Bulldozing a lot or dragging terrain changes several planned tiles at
    // once; place() re-checks each, so skip ones already settled.
    const cleared = new Set();
    for (const a of actions) {
      if (cleared.has(`${a.x},${a.y}`)) continue;
      if (plan.tool === "raise" || plan.tool === "lower" || plan.tool === "level") {
        const again = evaluate(city, a.x, a.y, plan.tool, { density: plan.density, elev: plan.elev });
        if (!again.ok || again.noop) continue;
        if (cost + 0 > city.money) break;
      }
      const r = place(city, a.x, a.y, plan.tool, { density: plan.density, elev: plan.elev, deferRefresh: true });
      if (!r.ok) throw new Error(r.message);
      if (!r.noop) { changed += r.changed || 1; for (const t of a.tiles) cleared.add(`${t.x},${t.y}`); }
    }
    refresh(city);
  } catch (err) {
    restore(city, snapshot);
    return { ok: false, message: `Construction failed: ${err.message}`, changed: 0, cost: 0 };
  }
  return { ok: true, message: "", changed, cost: Math.round((snapshot.money - city.money) * 100) / 100 };
}

export function createUndoManager(limit = 20) {
  const stack = [];
  return {
    record(city) {
      stack.push(structuredClone(city));
      if (stack.length > limit) stack.shift();
    },
    undo(city) {
      if (!stack.length) return false;
      restore(city, stack.pop());
      city.revision = (city.revision ?? 0) + 1;
      return true;
    },
    clear() { stack.length = 0; },
    get size() { return stack.length; },
  };
}
