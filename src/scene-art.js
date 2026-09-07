// Cached presentation around the map. The skirt follows actual terrain
// heights; it adds depth at the city boundary without changing tile geometry.
export function drawMapBackdrop(r, city) {
  const ctx = r.base;
  const sky = ctx.createLinearGradient(0, 0, 0, r.h);
  sky.addColorStop(0, r.night ? '#152b3a' : '#b2c7c1');
  sky.addColorStop(1, r.night ? '#0d1d2c' : '#7f9e98');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, r.w, r.h);
  const n = city.size;
  const edges = [
    [[0, n], [n, n]], [[n, n], [n, 0]],
    [[n, 0], [0, 0]], [[0, 0], [0, n]],
  ];
  for (const edge of [[0, 1], [1, 2], [2, 3], [3, 0]][r.rotation || 0]) {
    const [[ax, ay], [bx, by]] = edges[edge];
    const dx = (bx - ax) / n, dy = (by - ay) / n;
    for (let i = 0; i < n; i++) {
      const x = ax + dx * i, y = ay + dy * i, ex = x + dx, ey = y + dy;
      const a = r.project(x, y), b = r.project(ex, ey);
      if (Math.max(a.x, b.x) < -40 || Math.min(a.x, b.x) > r.w + 40 || Math.min(a.y, b.y) > r.h + 40) continue;
      const c = r.project(ex, ey, -r.groundZ(ex, ey) - 20), d = r.project(x, y, -r.groundZ(x, y) - 20);
      const tx = Math.max(0, Math.min(n - 1, Math.floor((x + ex) / 2))), ty = Math.max(0, Math.min(n - 1, Math.floor((y + ey) / 2)));
      const water = city.tiles[ty * n + tx].terrain === 'water';
      const face = ctx.createLinearGradient(0, Math.min(a.y, b.y), 0, Math.max(c.y, d.y));
      face.addColorStop(0, water ? '#416e7d' : r.night ? '#425652' : '#8c9a83');
      face.addColorStop(1, water ? '#315362' : r.night ? '#283c3c' : '#617b70');
      r.poly([a, b, c, d], face);
    }
  }
}

// A compact hull and cabin aligned with the boat's heading in map space.
export function drawBoat(r, x, y, heading, time, seed = 0) {
  const ctx = r.ctx, z = r.zoom;
  const c = Math.cos(heading), s = Math.sin(heading);
  const p = (forward, side, height = 0) => r.project(x + forward * c - side * s, y + forward * s + side * c, height);
  const center = p(0, 0);
  if (center.x < -30 || center.x > r.w + 30 || center.y < -30 || center.y > r.h + 30) return;
  const hull = [[0.24, 0], [0.1, 0.1], [-0.21, 0.09], [-0.24, 0], [-0.21, -0.09], [0.1, -0.1]];
  // The wake is drawn first, below the hull.
  const wake = 0.08 + 0.025 * Math.sin(time * 0.004 + seed);
  r.line(p(-0.2, -0.07), p(-0.7, -wake - 0.06), '#c6ded16b', 1.1, ctx);
  r.line(p(-0.2, 0.07), p(-0.7, wake + 0.06), '#c6ded16b', 1.1, ctx);
  r.poly(hull.map(([a, b]) => p(a, b, 1)), '#425f6d', null, ctx);
  r.poly(hull.map(([a, b]) => p(a * 0.92, b * 0.87, 3)), r.night ? '#a7b6b2' : '#e6e6d5', null, ctx);
  r.poly([p(-0.07, -0.05, 3), p(0.09, -0.05, 3), p(0.09, -0.05, 6), p(-0.07, -0.05, 6)], '#789da8', null, ctx);
  r.poly([p(-0.07, -0.05, 6), p(0.09, -0.05, 6), p(0.09, 0.05, 6), p(-0.07, 0.05, 6)], '#cedbd2', null, ctx);
  if (r.night) { ctx.fillStyle = '#ead9a0'; ctx.fillRect(center.x, center.y - 4 * z, 1.2 * z, 1.2 * z); }
}

export function drawOutageMarkers(r, time) {
  if (r.overlay !== 'none' || r.zoom < 0.65 || ['pipe', 'subway', 'substation'].includes(r.tool)) return;
  const ctx = r.ctx, radius = Math.min(8, 5 + r.zoom * 1.5);
  for (const warning of r.outages || []) {
    const { t, height } = warning;
    r.platform = t.elev * 8;
    const p = r.project(t.x + t.lot.w / 2, t.y + t.lot.h / 2, height + 12);
    r.platform = null;
    if (p.x < -15 || p.x > r.w + 15 || p.y < -15 || p.y > r.h + 15) continue;
    ctx.globalAlpha = 0.8 + 0.2 * Math.sin(time * 0.003);
    ctx.fillStyle = '#283b43eb'; ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e9c478'; ctx.lineWidth = 0.8; ctx.stroke();
    const bolt = [[0.12, -0.76], [-0.47, 0.09], [-0.07, 0.09], [-0.2, 0.76], [0.48, -0.14], [0.07, -0.14]];
    r.poly(bolt.map(([x, y]) => ({ x: p.x + x * radius, y: p.y + y * radius })), '#ffe0a0', null, ctx);
  }
  ctx.globalAlpha = 1;
}

export function drawAirplane(r, point, heading, time) {
  const ctx = r.ctx, z = r.zoom;
  if (point.x < -40 || point.x > r.w + 40 || point.y < -40 || point.y > r.h + 40) return;
  ctx.save(); ctx.translate(point.x, point.y); ctx.rotate(heading); ctx.scale(z, z);
  const shape = points => {
    ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
  };
  ctx.fillStyle = r.night ? '#b7c9cb' : '#e9eee8';
  shape([[13, 0], [9, -1.7], [2, -1.7], [-5, -11], [-8, -11], [-3, -1.6], [-9, -1.3], [-12, -5], [-14, -5], [-12, 0], [-14, 5], [-12, 5], [-9, 1.3], [-3, 1.6], [-8, 11], [-5, 11], [2, 1.7], [9, 1.7]]);
  ctx.fillStyle = '#92aeb4'; shape([[0, 1.6], [-5, 11], [-8, 11], [-3, 1.6]]);
  ctx.fillStyle = '#4c7f91'; shape([[-9, -1.3], [-12, -5], [-14, -5], [-12, 0], [-9, 1.3]]);
  ctx.fillStyle = '#6b919f'; shape([[8, -1.25], [10.4, -0.7], [10.4, 0.7], [8, 1.25]]);
  if (r.night) {
    ctx.fillStyle = '#ef7867'; ctx.fillRect(-7, -11, 1.6, 1.6);
    ctx.fillStyle = '#83d9b6'; ctx.fillRect(-7, 9.5, 1.6, 1.6);
    if (Math.floor(time / 450) % 2) { ctx.fillStyle = '#edf4dc'; ctx.fillRect(1, -1, 1.5, 1.5); }
  }
  ctx.restore();
}
