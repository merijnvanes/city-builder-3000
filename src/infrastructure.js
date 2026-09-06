// Networks, service coverage, and tile overlays. No browser deps.
export const POWER_CAPACITY = 1000;
export const WATER_CAPACITY = 800;

const ZONES = new Set(["residential", "commercial", "industrial"]);
const ROADS = new Set(["road", "rail"]);
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// Build a network of connected carrier tiles via BFS.
// carrierTest(tile) returns true if the tile participates in this network.
function buildNetworks(tiles, size, carrierTest) {
  const nets = new Int32Array(tiles.length).fill(-1);
  let comp = 0;
  for (let start = 0; start < tiles.length; start++) {
    if (!carrierTest(tiles[start]) || nets[start] !== -1) continue;
    const q = [start];
    nets[start] = comp;
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % size, y = Math.floor(i / size);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const ni = ny * size + nx;
        if (carrierTest(tiles[ni]) && nets[ni] === -1) { nets[ni] = comp; q.push(ni); }
      }
    }
    comp++;
  }
  return nets;
}

// Assign each non-carrier tile to the nearest carrier within radius 3.
function assignProximity(tiles, size, nets, carrierTest, radius = 3) {
  const result = new Int32Array(tiles.length);
  for (let i = 0; i < tiles.length; i++) {
    if (carrierTest(tiles[i])) { result[i] = nets[i]; continue; }
    result[i] = -1;
    const t = tiles[i];
    if (t.terrain === "water") continue;
    search: for (let r = 1; r <= radius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        const dy = r - Math.abs(dx);
        for (const sy of dy === 0 ? [0] : [-dy, dy]) {
          const x = t.x + dx, y = t.y + sy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const cand = nets[y * size + x];
          if (cand >= 0) { result[i] = cand; break search; }
        }
      }
    }
  }
  return result;
}

// Distribute power or water from sources, capacity-limited, to eligible consumers.
function distribute(tiles, netIds, sourceType, targetField, capacity, radius, requirePowered) {
  const sources = tiles.filter(
    (t) => t.type === sourceType && netIds[t.y * 40 + t.x] >= 0 && (!requirePowered || t.powered),
  );
  const budgets = new Map();
  for (const s of sources) {
    const n = netIds[s.y * 40 + s.x];
    budgets.set(n, (budgets.get(n) || 0) + capacity);
  }
  const consumers = tiles
    .filter((t) => t.type !== "empty" || t.powerline || t.pipe)
    .sort((a, b) => (b.level > 0 ? 1 : 0) - (a.level > 0 ? 1 : 0));
  for (const t of consumers) {
    const n = netIds[t.y * 40 + t.x];
    if (n < 0 || !sources.some((s) => netIds[s.y * 40 + s.x] === n && dist(s, t) <= radius)) continue;
    const load = ZONES.has(t.type)
      ? Math.max(1, t.level) * (targetField === "powered" && t.type === "industrial" ? 2 : 1)
      : 0;
    const rem = budgets.get(n) || 0;
    if (rem >= load) { t[targetField] = true; budgets.set(n, rem - load); }
  }
}

function markRadius(tiles, size, source, radius, field) {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const nx = source.x + dx, ny = source.y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      tiles[ny * size + nx][field] = true;
    }
  }
}

export function updateInfrastructure(city) {
  const { size, tiles } = city;
  const funding = city.funding ?? {};
  const pct = (k) => (funding[k] ?? 100) / 100;
  const ord = city.ordinances ?? {};

  // ── 1. Road network (road + rail only, for road access) ──────
  const roadNets = buildNetworks(tiles, size, (t) => ROADS.has(t.type));
  const roadNetIds = assignProximity(tiles, size, roadNets, (t) => ROADS.has(t.type));
  for (const t of tiles) {
    t.roadNetwork = roadNetIds[t.y * size + t.x];
    t.roadAccess = t.roadNetwork >= 0;
    t.powered = false;
    t.watered = false;
  }

  // ── 2. Power network (road + rail + powerline overlays) ──────
  const powerNets = buildNetworks(tiles, size, (t) => ROADS.has(t.type) || t.powerline === true);
  const powerNetIds = assignProximity(tiles, size, powerNets, (t) => ROADS.has(t.type) || t.powerline === true);
  distribute(tiles, powerNetIds, "power", "powered", POWER_CAPACITY, 30, false);
  for (const t of tiles) if (t.type === "power") t.powered = true;

  // ── 3. Water network (road + rail + pipe overlays) ───────────
  const waterNets = buildNetworks(tiles, size, (t) => ROADS.has(t.type) || t.pipe === true);
  const waterNetIds = assignProximity(tiles, size, waterNets, (t) => ROADS.has(t.type) || t.pipe === true);
  distribute(tiles, waterNetIds, "water", "watered", WATER_CAPACITY, 25, true);
  for (const t of tiles) if (t.type === "water") t.watered = t.powered;

  // ── 4. Service coverage (funding-dependent radii) ────────────
  const policeR = Math.round(15 * pct("police"));
  const fireR = Math.round(12 * pct("fire"));
  const hospitalR = Math.round(18 * pct("health"));
  const schoolR = Math.round(12 * pct("education"));
  const busR = Math.round(8 * pct("transport"));
  const landfillR = 10;

  for (const t of tiles) {
    t.policeCoverage = false;
    t.fireCoverage = false;
    t.hospitalCoverage = false;
    t.schoolCoverage = false;
    t.landfillCoverage = false;
    t.busCoverage = false;
  }
  for (const t of tiles) {
    if (t.type === "police") markRadius(tiles, size, t, policeR, "policeCoverage");
    else if (t.type === "fire") markRadius(tiles, size, t, fireR, "fireCoverage");
    else if (t.type === "hospital") markRadius(tiles, size, t, hospitalR, "hospitalCoverage");
    else if (t.type === "school") markRadius(tiles, size, t, schoolR, "schoolCoverage");
    else if (t.type === "landfill") markRadius(tiles, size, t, landfillR, "landfillCoverage");
    else if (t.type === "bus") markRadius(tiles, size, t, busR, "busCoverage");
  }

  // ── 5. Pollution overlay ─────────────────────────────────────
  const indTiles = tiles.filter((t) => t.type === "industrial");
  for (const t of tiles) {
    let poll = 0;
    for (const src of indTiles) {
      const d = dist(src, t);
      if (d > 12) continue;
      poll = Math.max(poll, (25 + src.level * 14) * (1 - d / 12));
    }
    if (ord.cleanAir) poll *= 0.65;
    t.pollution = Math.round(Math.max(0, Math.min(100, poll)));
  }

  // ── 6. Crime overlay ─────────────────────────────────────────
  for (const t of tiles) {
    let crime = ZONES.has(t.type) ? Math.min(75, t.level * 14 + 18) : 0;
    if (t.policeCoverage) crime = Math.round(crime * 0.25);
    if (ord.neighborhoodWatch) crime = Math.round(crime * 0.8);
    t.crime = Math.max(0, Math.min(100, crime));
  }

  // ── 7. Traffic overlay ───────────────────────────────────────
  const trafficScale = pct("transport") > 0 ? 2 - pct("transport") : 2;
  for (const t of tiles) {
    if (!ROADS.has(t.type)) { t.traffic = 0; continue; }
    let traffic = 0;
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const nx = t.x + dx, ny = t.y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const nb = tiles[ny * size + nx];
        if (ZONES.has(nb.type)) traffic += nb.level * 2;
      }
    }
    t.traffic = Math.round(Math.max(0, Math.min(100, traffic * trafficScale * (t.busCoverage ? 0.7 : 1))));
  }
  for (const t of tiles) {
    if (ROADS.has(t.type)) continue;
    let max = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = t.x + dx, ny = t.y + dy;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const nb = tiles[ny * size + nx];
        if (ROADS.has(nb.type)) max = Math.max(max, nb.traffic || 0);
      }
    }
    t.traffic = max;
  }

  // ── 8. Land value ────────────────────────────────────────────
  const amenities = tiles.filter((t) => ["park", "police", "fire", "school", "hospital", "bus"].includes(t.type));
  for (const t of tiles) {
    let val = 45 + (t.powered ? 10 : 0) + (t.watered ? 10 : 0) + (t.roadAccess ? 5 : 0);
    val -= Math.round(t.pollution * 0.3);
    val -= Math.round(t.crime * 0.2);
    for (const a of amenities) {
      const d = dist(a, t);
      if (d > 5) continue;
      val += 1.5 * (6 - d);
    }
    for (const ind of indTiles) {
      const d = dist(ind, t);
      if (d > 5) continue;
      val -= 2.2 * (6 - d);
    }
    t.landValue = Math.round(Math.max(0, Math.min(100, val)));
  }
}
