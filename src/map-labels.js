import { EDGE_DIRECTIONS } from './sim/neighbor-links.js';

// Text and signs around the map: compass corners, neighbour names with their
// connection icons, and the sign at every purchased county connection.
const CONNECTION_ICONS = {
  transport: 'M4 2L2 14M12 2L14 14M8 2V4M8 7V9M8 12V14',
  power: 'M9 1L3 9H7L6 15L13 6H9Z',
  water: 'M8 1C6 4 3 7 3 10A5 5 0 0 0 13 10C13 7 10 4 8 1Z',
};
let icons = null;
const iconPaths = () => icons ??= Object.fromEntries(Object.entries(CONNECTION_ICONS).map(([key, d]) => [key, new Path2D(d)]));

export function drawMapLabels(r, city) {
  const ctx = r.ctx;
  // Cardinal directions belong to corners and follow the world through rotation.
  ctx.font = '700 14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const [label, x, y] of [['N', -1, -1], ['E', city.size + 1, -1], ['S', city.size + 1, city.size + 1], ['W', -1, city.size + 1]]) {
    const p = r.project(x, y, 0);
    ctx.lineWidth = 4; ctx.strokeStyle = '#101820cc'; ctx.strokeText(label, p.x, p.y);
    ctx.fillStyle = label === 'N' ? '#f4d58a' : '#e8f0d8'; ctx.fillText(label, p.x, p.y);
  }

  // Neighbour names along the map edges.
  if (city._connections && r.zoom > 0.4) {
    const n = city.size;
    const spots = { northeast: [n / 2, -1.5], southwest: [n / 2, n + 1.5], northwest: [-1.5, n / 2], southeast: [n + 1.5, n / 2] };
    ctx.font = `700 ${Math.max(10, 12 * r.zoom)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const iconSize = Math.max(10, 12 * r.zoom), iconGap = iconSize * 0.45, paths = iconPaths();
    for (const [side, [x, y]] of Object.entries(spots)) {
      const c = city._connections[side];
      if (!c) continue;
      const p = r.project(x, y, 0);
      if (p.x < 0 || p.x > r.w || p.y < 0 || p.y > r.h) continue;
      const connected = c.road || c.rail || c.power || c.water;
      // Show active connection categories, with one transport icon for road/rail.
      // Keep the whole label centred and use the name's colour and terrain halo.
      const keys = [c.road || c.rail ? 'transport' : null, c.power ? 'power' : null, c.water ? 'water' : null].filter(Boolean);
      const textWidth = ctx.measureText(c.name).width;
      const labelX = p.x - keys.length * (iconSize + iconGap) / 2;
      ctx.lineWidth = 3; ctx.strokeStyle = '#101820cc'; ctx.strokeText(c.name, labelX, p.y);
      const color = connected ? '#e8f0d8' : '#b8c4b0';
      ctx.fillStyle = color; ctx.fillText(c.name, labelX, p.y);
      for (const [index, key] of keys.entries()) {
        ctx.save();
        ctx.translate(labelX + textWidth / 2 + iconGap + index * (iconSize + iconGap), p.y - iconSize / 2);
        ctx.scale(iconSize / 16, iconSize / 16);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = '#101820cc'; ctx.lineWidth = 1.6 + 3 * 16 / iconSize;
        ctx.stroke(paths[key]);
        ctx.strokeStyle = color; ctx.lineWidth = 1.6;
        ctx.stroke(paths[key]);
        ctx.restore();
      }
    }
  }

  // Purchased endpoints have a sign and an outward arrow on the route.
  for (const link of city.transportConnections || []) {
    const [dx, dy] = EDGE_DIRECTIONS[link.side], x = link.x + .5 + dx * .35, y = link.y + .5 + dy * .35;
    const p = r.project(x, y, 10), foot = r.project(x, y, 0);
    r.line(foot, p, '#dae2bf', 1, ctx);
    ctx.fillStyle = '#245a43'; ctx.fillRect(p.x - 8 * r.zoom, p.y - 5 * r.zoom, 16 * r.zoom, 10 * r.zoom);
    const direction = r.project(x + dx * .2, y + dy * .2, 10);
    const length = Math.hypot(direction.x - p.x, direction.y - p.y), ux = (direction.x - p.x) / length, uy = (direction.y - p.y) / length;
    const a = { x: p.x - ux * 5 * r.zoom, y: p.y - uy * 5 * r.zoom }, b = { x: p.x + ux * 5 * r.zoom, y: p.y + uy * 5 * r.zoom };
    r.line(a, b, '#f3dfa2', 1.5, ctx);
    for (const side of [-1, 1]) r.line(b, { x: b.x - ux * 4 * r.zoom - uy * side * 3 * r.zoom, y: b.y - uy * 4 * r.zoom + ux * side * 3 * r.zoom }, '#f3dfa2', 1.2, ctx);
  }
}
