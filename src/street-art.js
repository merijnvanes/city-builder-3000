// Connected street surfaces and small, camera-aware street furniture.
const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// A portal is a route tile with a bore running out of one side. Draw the
// mouth of the tunnel into the hillside so the line does not simply stop.
export function tunnelPortal(t, city) {
  for (const [dx, dy] of DIRECTIONS) {
    const x = t.x + dx, y = t.y + dy;
    if (x < 0 || y < 0 || x >= city.size || y >= city.size) continue;
    const n = city.tiles[y * city.size + x];
    if (n.tunnel) return { dx, dy, rail: n.tunnel === 2 };
  }
  return null;
}

export function drawTunnelMouth(r, t, city, portal) {
  const { x, y } = t, { dx, dy } = portal;
  // A retaining wall across the hillside, with the dark bore cut into it.
  const wx = x + 0.5 + dx * 0.42, wy = y + 0.5 + dy * 0.42;
  const across = 0.34;
  const ax = dy ? across : 0.06, ay = dx ? across : 0.06;
  r.box(wx - ax, wy - ay, ax * 2, ay * 2, 9, "#8c8d80");
  const mx = dy ? 0.2 : 0.05, my = dx ? 0.2 : 0.05;
  r.box(wx - mx, wy - my, mx * 2, my * 2, 6, "#26302f");
  r.flat(wx - mx, wy - my, mx * 2, my * 2, 6.1, portal.rail ? "#3a3f42" : "#1d2523");
}
export function streetConnections(t, city) {
  return DIRECTIONS.map(([dx, dy]) => {
    const x = t.x + dx, y = t.y + dy;
    if (x < 0 || y < 0 || x >= city.size || y >= city.size) return false;
    return ['road', 'highway', 'onramp'].includes(city.tiles[y * city.size + x].type);
  });
}

export function drawStreet(r, t, city) {
  const { x, y } = t, highway = t.type === 'highway', ramp = t.type === 'onramp';
  const joins = streetConnections(t, city), junction = !ramp && joins.filter(Boolean).length >= 3;
  const inset = highway ? 0.055 : ramp ? 0.09 : 0.14, width = 1 - inset * 2;
  const asphalt = highway ? '#424c53' : ramp ? '#4a555b' : '#525f63';
  const flat = (a, b, w, d, color, z = 0.5) => r.flat(x + a, y + b, w, d, z, color);
  const line = (a, b, c, d, color, w = 0.7) => r.line(r.project(x + a, y + b, 0.7), r.project(x + c, y + d, 0.7), color, w);
  flat(0, 0, 1, 1, highway ? '#8c9792' : ramp ? '#93a09a' : '#a9afa5', 0.3);
  flat(inset, inset, width, width, asphalt);
  // A ramp carries chevrons so it reads as a slip road rather than a street.
  if (ramp && r.zoom > 0.55) {
    for (let s = 0.2; s < 0.8; s += 0.18) {
      line(0.32, s, 0.5, s + 0.09, '#e6d79a', 0.9);
      line(0.68, s, 0.5, s + 0.09, '#e6d79a', 0.9);
    }
  }
  for (let i = 0; i < 4; i++) {
    const [dx, dy] = DIRECTIONS[i];
    if (joins[i]) {
      flat(dx === 1 ? 0.5 : dx === -1 ? 0 : inset, dy === 1 ? 0.5 : dy === -1 ? 0 : inset, dx ? 0.5 : width, dy ? 0.5 : width, asphalt);
      if (r.zoom > 0.55) {
        if (junction && !highway) {
          // Zebra crossings span each connected arm, leaving the centre clear.
          for (let s = 0.23; s < 0.8; s += 0.11) {
            flat(dx ? (dx > 0 ? 0.83 : 0.08) : s, dy ? (dy > 0 ? 0.83 : 0.08) : s, dx ? 0.09 : 0.055, dy ? 0.09 : 0.055, '#dddcc5', 0.8);
          }
        } else {
          line(0.5 + dx * 0.22, 0.5 + dy * 0.22, 0.5 + dx * 0.44, 0.5 + dy * 0.44, highway ? '#ead28a' : '#c5c9bd', highway ? 1 : 0.65);
        }
        // Curbs run parallel to traffic, never across a connected street.
        for (const side of [-1, 1]) {
          const perpendicular = DIRECTIONS.findIndex(([a, b]) => a === dy * side && b === dx * side);
          const start = joins[perpendicular] ? 0.5 - inset : 0;
          line(0.5 + dx * start + dy * side * (0.5 - inset), 0.5 + dy * start + dx * side * (0.5 - inset), 0.5 + dx * 0.5 + dy * side * (0.5 - inset), 0.5 + dy * 0.5 + dx * side * (0.5 - inset), '#d1d1bb', 0.55);
        }
      }
    } else if (r.zoom > 0.65) {
      if (dx) line(dx > 0 ? 1 - inset : inset, inset, dx > 0 ? 1 - inset : inset, 1 - inset, '#d1d1bb');
      else line(inset, dy > 0 ? 1 - inset : inset, 1 - inset, dy > 0 ? 1 - inset : inset, '#d1d1bb');
    }
  }
  if (t.terrain === 'water') {
    // Railings follow the bridge axis, including north/south highways.
    const alongX = joins[0] || joins[2];
    for (const s of [0.04, 0.96]) {
      const a = alongX ? [0, s] : [s, 0], b = alongX ? [1, s] : [s, 1];
      r.line(r.project(x + a[0], y + a[1], 4), r.project(x + b[0], y + b[1], 4), '#c5cbbf', 1.3);
      for (const k of [0.1, 0.5, 0.9]) {
        const px = x + (alongX ? k : s), py = y + (alongX ? s : k);
        r.line(r.project(px, py, 0.6), r.project(px, py, 4), '#8b9794', 0.75);
      }
    }
  }
}

export function hasStreetLamp(t) {
  return t.type === 'road' && t.terrain !== 'water' && (t.x + t.y) % 4 === 0;
}
export function drawStreetLamp(r, t, glow = false) {
  const x = t.x + 0.075, y = t.y + 0.075;
  const foot = r.project(x, y, 0.6), top = r.project(x, y, 13), head = r.project(x + 0.1, y, 13);
  if (glow) {
    const p = r.project(x + 0.35, y + 0.25), ctx = r.base;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 24 * r.zoom);
    g.addColorStop(0, '#ffdb9359'); g.addColorStop(1, '#ffdb9300');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, 24 * r.zoom, 12 * r.zoom, 0, 0, Math.PI * 2); ctx.fill();
    return;
  }
  r.line(foot, top, '#46575b', 1);
  r.line(top, head, '#697879', 1.3);
  r.line(head, { x: head.x + 2 * r.zoom, y: head.y }, r.night ? '#ffe3a0' : '#cdd6c9', 1.5);
}

export function drawVehicle(r, x, y, vertical, back, color, bus = false) {
  // Use the same isometric projection as the road, including rotated views.
  const length = bus ? 0.28 : 0.17, width = 0.075;
  const w = vertical ? width : length, d = vertical ? length : width;
  const ctx = r.ctx, px = x - w / 2, py = y - d / 2;
  r.flat(px - 0.02, py - 0.02, w + 0.04, d + 0.04, 0.7, '#172b3344', null, ctx);
  for (const f of r.faces(px, py, w, d, 2.2, 1)) r.poly(f.points, '#34434b', null, ctx);
  r.flat(px, py, w, d, 3.2, color, null, ctx);
  r.flat(px + (vertical ? 0 : w * 0.28), py + (vertical ? d * 0.28 : 0), vertical ? w : w * 0.42, vertical ? d * 0.42 : d, 3.4, '#b5d4d6', null, ctx);
  if (r.night) {
    const ax = vertical ? px : back ? px : px + w, ay = vertical ? back ? py : py + d : py;
    r.line(r.project(ax, ay, 2), r.project(ax + (vertical ? w : 0), ay + (vertical ? 0 : d), 2), '#ffebb5', 1, ctx);
  }
}
