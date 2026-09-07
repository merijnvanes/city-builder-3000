// Starter town: a 7×7-block grid town with mixed densities, civic services,
// a coal plant on the outskirts and pumps at the waterside.
import { place } from "./place.js";
import { findLot, assignLot } from "./lots.js";
import { refreshCity } from "./refresh.js";
import { tileAt, forRadius, NEIGHBORS4 } from "./grid.js";
import { lcg } from "./terrain.js";

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

// Shortest 4-neighbour path over land from a to b (tiles), or null.
export function landPath(city, a, b) {
  const { size, tiles } = city;
  const prev = new Int32Array(tiles.length).fill(-2);
  const queue = [a.y * size + a.x];
  prev[queue[0]] = -1;
  const goal = b.y * size + b.x;
  for (let h = 0; h < queue.length; h++) {
    const i = queue[h];
    if (i === goal) break;
    const x = i % size, y = (i - x) / size;
    for (const [dx, dy] of NEIGHBORS4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const ni = ny * size + nx;
      if (prev[ni] !== -2 || tiles[ni].terrain === "water") continue;
      prev[ni] = i; queue.push(ni);
    }
  }
  if (prev[goal] === -2) return null;
  const path = [];
  for (let i = goal; i !== -1; i = prev[i]) path.push(tiles[i]);
  return path.reverse();
}

export function buildStarterTown(city) {
  const rng = lcg(city.seed ^ 0x51ed270b);
  const savedMoney = city.money;
  city.money = 1e9;
  const put = (x, y, tool, options = {}) => place(city, x, y, tool, { ...options, deferRefresh: true });
  const line = (x1, y1, x2, y2, tool) => {
    const sx = Math.sign(x2 - x1) || 1, sy = Math.sign(y2 - y1) || 1;
    for (let x = x1; x !== x2 + sx; x += sx) put(x, y1, tool);
    for (let y = y1 + sy; y !== y2 + sy; y += sy) put(x2, y, tool);
  };
  const route = (from, to, tools) => {
    const path = landPath(city, from, to);
    if (!path) return false;
    for (const t of path) for (const tool of tools) put(t.x, t.y, tool);
    return true;
  };
  const zone = (x0, y0, w, h, type, density) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, type, { density });
  };
  const siteFree = (x, y, w, h) => {
    const base = tileAt(city, x, y)?.elev;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      const t = tileAt(city, xx, yy);
      if (!t || t.terrain === "water" || t.type !== "empty" || Math.abs(t.elev - base) > 1) return false;
    }
    return true;
  };
  const findSite = (px, py, w, h, maxR = 12) => {
    for (let r = 0; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (siteFree(px + dx, py + dy, w, h)) return { x: px + dx, y: py + dy };
      }
    }
    return null;
  };
  const nearWater = (t) => { let near = false; forRadius(city, t.x, t.y, 1, (n) => { if (n.terrain === "water") near = true; }); return near; };
  // A pumping station only works beside fresh water. On a sea coast the town
  // is founded on water towers instead, and the mayor can build a
  // desalinization plant once it is invented.
  const nearFresh = (t) => { let near = false; forRadius(city, t.x, t.y, 2, (n) => { if (n.terrain === "water" && !n.salt) near = true; }); return near; };

  const size = city.size;
  const span = 28;
  // Site the town on the driest 29×29 window, preferring the west-centre.
  const prefX = Math.round(size * 0.12), prefY = Math.round(size * 0.2);
  let ox = prefX, oy = prefY, bestScore = Infinity;
  for (let cy = 3; cy + span < size - 3; cy += 2) {
    for (let cx = 3; cx + span < size - 3; cx += 2) {
      let wet = 0, rough = 0;
      const h0 = tileAt(city, cx + 14, cy + 14).elev;
      for (let y = cy; y <= cy + span; y++) for (let x = cx; x <= cx + span; x++) { const t = tileAt(city, x, y); if (t.terrain !== "grass") wet++; rough += Math.abs(t.elev - h0); }
      const score = wet * 4 + rough * 0.6 + Math.abs(cx - prefX) + Math.abs(cy - prefY);
      if (score < bestScore) { bestScore = score; ox = cx; oy = cy; }
    }
  }
  // Grade the town site flat, easing the edges down to the surrounding land.
  {
    const counts = new Map();
    for (let y = oy; y <= oy + span; y++) for (let x = ox; x <= ox + span; x++) { const t = tileAt(city, x, y); if (t.terrain !== "water") counts.set(t.elev, (counts.get(t.elev) || 0) + 1); }
    const grade = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    for (let y = oy - 1; y <= oy + span + 1; y++) for (let x = ox - 1; x <= ox + span + 1; x++) { const t = tileAt(city, x, y); if (t && t.terrain !== "water") t.elev = grade; }
    let ring = 2;
    let changed = true;
    while (changed && ring < 12) {
      changed = false;
      for (let y = oy - ring; y <= oy + span + ring; y++) for (let x = ox - ring; x <= ox + span + ring; x++) {
        const t = tileAt(city, x, y);
        if (!t || t.terrain === "water") continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = tileAt(city, x + dx, y + dy);
          if (n && Math.abs(n.elev - t.elev) > 1) { t.elev = n.elev + Math.sign(t.elev - n.elev); changed = true; }
        }
      }
      ring++;
    }
  }

  // Road grid: 8 streets each way, 49 blocks of 3×3.
  for (let i = 0; i <= 7; i++) {
    line(ox + i * 4, oy, ox + i * 4, oy + span, "road");
    line(ox, oy + i * 4, ox + span, oy + i * 4, "road");
  }
  const blockAt = (i, j) => ({ x: ox + 1 + i * 4, y: oy + 1 + j * 4 });

  // Civic sites first so zones do not claim them.
  // A jail comes with the police station: without cells to put people in,
  // arrests are released and the precinct loses its effect.
  const civic = { "1,1": "police", "2,0": "jail", "5,1": "fire", "1,5": "school", "5,5": "hospital", "3,6": "largepark", "0,6": "landfill", "4,0": "school" };
  for (const [key, type] of Object.entries(civic)) {
    const [i, j] = key.split(",").map(Number);
    const b = blockAt(i, j);
    if (type === "landfill") { for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) put(b.x + x, b.y + y, "landfill"); }
    else if (siteFree(b.x, b.y, 3, 3)) put(b.x, b.y, type);
  }
  const lib = blockAt(3, 0);
  if (siteFree(lib.x, lib.y, 3, 3)) {
    put(lib.x, lib.y, "library");
    for (const [dx, dy] of [[2, 0], [2, 1], [0, 2], [1, 2], [2, 2]]) put(lib.x + dx, lib.y + dy, "park");
  }

  // Zones: commercial core, residential towers beside it, medium ring,
  // low-density edge, industry along the west and north-east edges.
  const plan = (i, j) => {
    if (i === 3 && j === 3) return ["commercial", 3];
    if ((i === 3 && (j === 2 || j === 4)) || (j === 3 && (i === 2 || i === 4))) return ["commercial", 2];
    if (i >= 2 && i <= 4 && j >= 2 && j <= 4) return ["residential", 3];
    if (j === 3 && (i === 1 || i === 5)) return ["residential", 2];
    if (i === 0 && j >= 3) return ["industrial", 2];
    if (i === 6 && j <= 3) return ["industrial", 1];
    if (i === 0 || i === 6 || j === 0 || j === 6) return ["residential", 1];
    return ["residential", 2];
  };
  for (let j = 0; j <= 6; j++) {
    for (let i = 0; i <= 6; i++) {
      if (civic[`${i},${j}`] || (i === 3 && j === 0)) continue;
      const b = blockAt(i, j);
      const [type, density] = plan(i, j);
      zone(b.x, b.y, 3, 3, type, density);
      if (density === 1 && type === "residential" && rng() < 0.5) { put(b.x + 1, b.y + 1, "bulldoze"); put(b.x + 1, b.y + 1, "park"); }
    }
  }
  // Bus stops on downtown block corners.
  for (const [i, j] of [[2, 2], [4, 4], [2, 4], [4, 2]]) {
    const b = blockAt(i, j);
    put(b.x, b.y, "bulldoze"); put(b.x, b.y, "bus");
  }

  // Coal plant on the outskirts, wired to the nearest block over land.
  const corners = [[ox - 7, oy - 7], [ox + span + 4, oy - 7], [ox - 7, oy + span + 4], [ox + span + 4, oy + span + 4], [ox - 8, oy + 12], [ox + 12, oy - 8]];
  const plantType = city.startYear >= 2000 ? "gas" : "coal";
  const plantSize = plantType === "gas" ? 3 : 4;
  for (const [px, py] of corners) {
    const plant = findSite(px, py, plantSize, plantSize, 6);
    if (!plant) continue;
    const near = [[0, 0], [6, 0], [0, 6], [6, 6], [3, 0], [0, 3], [6, 3], [3, 6]]
      .map(([i, j]) => blockAt(i, j))
      .sort((a, b) => Math.abs(a.x - plant.x) + Math.abs(a.y - plant.y) - Math.abs(b.x - plant.x) - Math.abs(b.y - plant.y))[0];
    let done = false;
    for (const [ex, ey] of [[plantSize, 1], [1, plantSize], [-1, 1], [1, -1]]) {
      const from = tileAt(city, plant.x + ex, plant.y + ey);
      if (!from || from.terrain === "water") continue;
      const path = landPath(city, from, tileAt(city, near.x, near.y));
      if (!path) continue;
      if (!put(plant.x, plant.y, plantType).ok) break;
      for (const t of path) put(t.x, t.y, "powerline");
      done = true;
      break;
    }
    if (done) break;
  }

  // Pumps on the nearest shore to downtown; a land route carries pipe and
  // power line back to the grid; pipes run under three east-west streets.
  const cx = ox + span / 2, cy = oy + span / 2;
  let shore = null, best = Infinity;
  for (const t of city.tiles) {
    if (t.terrain === "water" || t.type !== "empty" || !nearFresh(t)) continue;
    const d = Math.abs(t.x - cx) + Math.abs(t.y - cy);
    if (d < best) { best = d; shore = t; }
  }
  const pumps = [];
  if (shore) forRadius(city, shore.x, shore.y, 3, (t) => { if (pumps.length < 3 && t.terrain !== "water" && t.type === "empty" && nearFresh(t)) pumps.push(t); });
  let sourceTool = "waterpump";
  if (!pumps.length) {
    sourceTool = "watertower";
    // Towers yield far less than a pumping station, so the town needs more.
    for (let i = 0; i < 6; i++) {
      const site = findSite(ox + span + 2, oy + 4 + i * 4, 2, 1, 10);
      if (site) pumps.push(tileAt(city, site.x, site.y), tileAt(city, site.x + 1, site.y));
    }
  }
  for (const p of pumps) put(p.x, p.y, sourceTool);
  // Nearest dry tile to a point, so routes never start or end on a bridge.
  const dry = (x, y) => {
    let best = null, bestD = Infinity;
    forRadius(city, x, y, 6, (t, d) => { if (t.terrain !== "water" && d < bestD) { bestD = d; best = t; } });
    return best;
  };
  // Nearest zoned or civic block tile: those conduct power, road corners do not.
  const nearestBlockTile = (x, y) => {
    let best = null, bestD = Infinity;
    for (let j = 0; j <= 6; j++) for (let i = 0; i <= 6; i++) {
      const b = blockAt(i, j), t = tileAt(city, b.x, b.y);
      if (!t || t.terrain === "water" || t.type === "empty") continue;
      const d = Math.abs(b.x - x) + Math.abs(b.y - y);
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  };
  if (pumps.length) {
    const p = pumps[0];
    const rowY = [oy, oy + 8, oy + 16, oy + 24].sort((a, b) => Math.abs(a - p.y) - Math.abs(b - p.y))[0];
    const edgeX = p.x > cx ? ox + span : ox;
    const edge = dry(edgeX, rowY);
    if (edge) {
      route(p, edge, ["pipe", "powerline"]);
      const block = nearestBlockTile(edge.x, edge.y);
      if (block) route(edge, block, ["powerline"]);
    }
    for (const other of pumps.slice(1)) route(other, p, ["pipe", "powerline"]);
    // Pipe mains under every other street and two avenues, detouring around water.
    for (const y of [oy, oy + 8, oy + 16, oy + 24]) { const a = dry(ox, y), b = dry(ox + span, y); if (a && b) route(a, b, ["pipe"]); }
    for (const x of [ox + 8, ox + 20]) { const a = dry(x, oy), b = dry(x, oy + span); if (a && b) route(a, b, ["pipe"]); }
  }

  // Develop lots.
  // Workplaces start a stage ahead so the first commute finds enough jobs.
  const levels = { 1: [1, 1, 2, 2, 3], 2: [1, 2, 2, 3, 3], 3: [1, 2, 2, 3, 3, 4] };
  const jobLevels = { 1: [2, 2, 3, 3], 2: [2, 3, 3, 4], 3: [3, 3, 4, 4] };
  for (const t of city.tiles) {
    if (!["residential", "commercial", "industrial"].includes(t.type) || t.lot) continue;
    const lot = findLot(city, t);
    if (!lot) continue;
    if (rng() < 0.12) continue; // leave a few empty lots
    const anchor = assignLot(city, lot, pick(rng, (t.type === "residential" ? levels : jobLevels)[t.density]), rng());
    anchor.age = 1 + Math.floor(rng() * 24); // established, not under construction
  }

  city.money = savedMoney;
  refreshCity(city);
  city.revision++;
  return city;
}
