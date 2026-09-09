import { VIADUCT_HEIGHT } from './render-scale.js';
export { VIADUCT_HEIGHT } from './render-scale.js';
import { faceLight } from './sunlight.js';
import { shadeHex } from './art-colors.js';
import { surfacePlatform } from './deck-geometry.js';
import { surfaceStep, isPortal } from './sim/structures.js';
import { outwardConnection } from './sim/neighbor-links.js';
import { carriesRoute } from './sim/catalog.js';
import { tileAt } from './sim/grid.js';
import { rampAxis, rampMeets } from './sim/highways.js';
// Connected street surfaces, elevated decks and small camera-aware furniture.
const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

// Ground-like surfaces painted into the object layer take the same night and
// data-map tint the ground cache received, so a deck or a wall never glows.
const tone = (r, color) => (r.groundTone ? r.groundTone(color) : color);

// A portal is a route tile with a bore running out of one side. Draw the
// mouth of the tunnel into the hillside so the line does not simply stop.
export function tunnelPortal(t, city) {
  const s = t.structure;
  if (s?.kind === 'tunnel' && isPortal(t, s)) {
    const other = t.x === s.from.x && t.y === s.from.y ? s.to : s.from;
    return { dx: Math.sign(other.x - t.x), dy: Math.sign(other.y - t.y), rail: s.route === 'rail' };
  }
  return null;
}

export function drawTunnelMouth(r, t, city, portal) {
  const { x, y } = t, { dx, dy } = portal;
  // A retaining wall across the hillside, with the dark bore cut into it.
  const wx = x + 0.5 + dx * 0.42, wy = y + 0.5 + dy * 0.42;
  const across = 0.34;
  const ax = dy ? across : 0.06, ay = dx ? across : 0.06;
  r.box(wx - ax, wy - ay, ax * 2, ay * 2, 9, tone(r, '#8c8d80'));
  const mx = dy ? 0.2 : 0.05, my = dx ? 0.2 : 0.05;
  r.box(wx - mx, wy - my, mx * 2, my * 2, 6, tone(r, '#26302f'));
  r.flat(wx - mx, wy - my, mx * 2, my * 2, 6.1, tone(r, portal.rail ? '#3a3f42' : '#1d2523'));
}

// Which of the four sides this surface continues through. A street joins
// streets and the foot of a ramp; a highway joins highways and the head of a
// ramp; a ramp joins exactly its highway and its street.
export function streetConnections(t, city, as = t.type) {
  const axis = as === 'onramp' ? rampAxis(city, t) : null;
  return DIRECTIONS.map(([dx, dy]) => {
    const x = t.x + dx, y = t.y + dy;
    if (x < 0 || y < 0 || x >= city.size || y >= city.size) return outwardConnection(city, t, dx, dy, as);
    const n = city.tiles[y * city.size + x];
    if (!surfaceStep(t, n)) return false;
    if (tunnelPortal(t, city)?.dx === dx && tunnelPortal(t, city)?.dy === dy) return true;
    if (as === 'onramp') {
      if (!axis) return carriesRoute(n, 'road');
      if (dx === axis.dx && dy === axis.dy) return carriesRoute(n, 'highway');
      if (dx === -axis.dx && dy === -axis.dy) return carriesRoute(n, 'road');
      return false;
    }
    if (n.type === 'onramp') return rampMeets(city, n, t.x, t.y, as === 'highway' ? 'head' : 'foot');
    return carriesRoute(n, as);
  });
}

const STYLE = {
  road: { inset: 0.14, asphalt: '#525f63', shoulder: '#a9afa5', marking: '#c5c9bd', markingWidth: 0.65 },
  highway: { inset: 0.055, asphalt: '#424c53', shoulder: '#8c9792', marking: '#ead28a', markingWidth: 1 },
  onramp: { inset: 0.09, asphalt: '#4a555b', shoulder: '#93a09a', marking: '#c5c9bd', markingWidth: 0.65 },
};

// `as` overrides the surface drawn, for the street that runs under a viaduct.
// The caller sets r.platform for a deck; the surface follows it. `elevated`
// adds railings along the axis of the span.
export function drawStreet(r, t, city, { as = t.type, elevated = false } = {}) {
  const { x, y } = t, highway = as === 'highway', ramp = as === 'onramp';
  const joins = streetConnections(t, city, as), junction = !ramp && joins.filter(Boolean).length >= 3;
  const { inset, asphalt, shoulder, marking, markingWidth } = STYLE[as] || STYLE.road, width = 1 - inset * 2;
  const flat = (a, b, w, d, color, z = 0.5) => r.flat(x + a, y + b, w, d, z, color);
  const line = (a, b, c, d, color, w = 0.7) => r.line(r.project(x + a, y + b, 0.7), r.project(x + c, y + d, 0.7), color, w);
  flat(0, 0, 1, 1, shoulder, 0.3);
  flat(inset, inset, width, width, asphalt);
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
        } else if (!ramp) {
          line(0.5 + dx * 0.22, 0.5 + dy * 0.22, 0.5 + dx * 0.44, 0.5 + dy * 0.44, marking, markingWidth);
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
  // A ramp carries chevrons pointing up its climb, over the joined arms, so
  // it reads as a slip road.
  if (ramp && r.zoom > 0.55) {
    const axis = rampAxis(city, t) || { dx: 0, dy: 1 };
    const along = (s, w) => axis.dx ? [axis.dx > 0 ? s : 1 - s, w] : [w, axis.dy > 0 ? s : 1 - s];
    for (let s = 0.2; s < 0.8; s += 0.18) {
      line(...along(s, 0.32), ...along(s + 0.09, 0.5), '#e6d79a', 0.9);
      line(...along(s, 0.68), ...along(s + 0.09, 0.5), '#e6d79a', 0.9);
    }
  }
  if (elevated) drawStreetRailings(r, t, joins);
}

// Railings follow the outline of the deck: every edge of the tile that the
// surface does not continue through gets one, so a junction stays open
// where its arms meet and a straight span is fenced along both sides. Kept
// separate so the traffic mask can hide vehicles behind them.
export function drawStreetRailings(r, t, joins) {
  const { x, y } = t;
  for (let i = 0; i < 4; i++) {
    if (joins[i]) continue;
    const [dx, dy] = DIRECTIONS[i], s = dx > 0 || dy > 0 ? 0.96 : 0.04;
    // The edge runs across the direction it faces; joined neighbours on the
    // sides keep the rail from poking into their surface.
    const along = dx ? [0, 1] : [1, 0];
    const from = joins[DIRECTIONS.findIndex(([a, b]) => a === -along[0] && b === -along[1])] ? 0.04 : 0;
    const to = joins[DIRECTIONS.findIndex(([a, b]) => a === along[0] && b === along[1])] ? 0.96 : 1;
    const point = (k, z) => r.project(x + (dx ? s : k), y + (dx ? k : s), z);
    r.line(point(from, 4), point(to, 4), '#c5cbbf', 1.3);
    for (const k of [0.1, 0.5, 0.9]) if (k >= from && k <= to) r.line(point(k, 0.6), point(k, 4), '#8b9794', 0.75);
  }
}

// "Highways are basically elevated, high capacity roads." The deck rides on
// piers wherever it goes; a street it crosses stays on the ground below.
// Piers stand at the deck's outline vertices, once per vertex: a following
// deck tile shares the vertex and does not repeat the pier.
export function drawViaduct(r, t, city, platform) {
  const { x, y } = t;
  const deckAt = (dx, dy) => {
    const n = tileAt(city, x + dx, y + dy);
    return !!n && (carriesRoute(n, 'highway') || n.type === 'onramp');
  };
  const old = r.platform;
  r.platform = null;
  try {
    const piers = [[0.04, 0.04]];
    if (!deckAt(1, 0)) piers.push([0.84, 0.04]);
    if (!deckAt(0, 1)) piers.push([0.04, 0.84]);
    if (!deckAt(1, 0) && !deckAt(0, 1) && !deckAt(1, 1)) piers.push([0.84, 0.84]);
    for (const [a, b] of piers) r.box(x + a, y + b, 0.12, 0.12, VIADUCT_HEIGHT - 1.5, '#79837f');
    r.platform = platform;
    r.box(x, y, 1, 1, 1.6, '#8f9791', -1.6);
    drawStreet(r, t, city, { as: 'highway', elevated: true });
  } finally { r.platform = old; }
}

// A ramp is an embankment: two retaining walls climb from the street to the
// deck, and the road surface climbs on top of them.
export function drawRamp(r, t, city, platform) {
  const { x, y } = t, axis = rampAxis(city, t) || { dx: 0, dy: 1 };
  const old = r.platform;
  r.platform = null;
  try {
    const walls = [];
    for (const side of [0, 1]) {
      // The wall runs along the axis at this side of the tile.
      const a = axis.dx ? [x, y + side] : [x + side, y], b = axis.dx ? [x + 1, y + side] : [x + side, y + 1];
      const normal = axis.dx ? [0, side ? 1 : -1] : [side ? 1 : -1, 0];
      const center = r.orient(x + 0.5, y + 0.5), out = r.orient(x + 0.5 + normal[0], y + 0.5 + normal[1]);
      walls.push({ a, b, facing: out.x + out.y > center.x + center.y, shade: shadeHex('#9c9480', faceLight(...normal)) });
    }
    // Rear wall first: the surface covers it, and the front wall stays whole.
    for (const wall of walls.sort((m, n) => Number(m.facing) - Number(n.facing))) {
      const ground = [wall.a, wall.b].map(([px, py]) => r.project(px, py));
      r.platform = platform;
      const top = [wall.b, wall.a].map(([px, py]) => r.project(px, py));
      r.platform = null;
      r.poly([...ground, ...top], wall.shade);
    }
    r.platform = platform;
    drawStreet(r, t, city, { as: 'onramp', elevated: true });
  } finally { r.platform = old; }
}

export function hasStreetLamp(t) {
  return t.type === 'road' && t.terrain !== 'water' && (t.x + t.y) % 4 === 0;
}
export function drawStreetLamp(r, t, glow = false) {
  const platform = r.platform;
  r.platform = surfacePlatform(r, t);
  try {
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
  } finally { r.platform = platform; }
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
