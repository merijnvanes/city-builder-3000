import { heightOf } from './building-art.js';
import { withGroundClip } from './ground-effects.js';
import { lotPlatform } from './deck-geometry.js';

// Fires, flood water and the moving hazards, drawn every frame on top of the
// scene. Nothing here is cached; each effect repaints from the city's state.
export function drawFires(r, city, time) {
  const ctx = r.ctx;
  for (const t of city.tiles) {
    if (!t.fire) continue;
    const w = t.lot?.w || 1, h = t.lot?.h || 1;
    r.platform = t.lot ? lotPlatform(t) : null;
    for (let i = 0; i < w * h; i++) {
      const p = r.project(t.x + 0.5 + (i % w), t.y + 0.5 + Math.floor(i / w), heightOf(t) * 0.5);
      ctx.fillStyle = i % 2 ? '#e79731' : '#f2c14e';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 5 * r.zoom, (8 + Math.sin(time * 0.012 + t.x + i) * 3) * r.zoom, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a5a5a66';
      ctx.beginPath(); ctx.ellipse(p.x + 3 * r.zoom, p.y - 18 * r.zoom - ((time * 0.02 + i * 7) % 20) * r.zoom, 7 * r.zoom, 5 * r.zoom, 0, 0, Math.PI * 2); ctx.fill();
    }
    r.platform = null;
  }
}

export function drawHazards(r, city, time) {
  const ctx = r.ctx;
  for (const t of city.tiles) {
    if (!t.flooded) continue;
    const p = r.project(t.x + 0.5, t.y + 0.5, 0.6);
    if (p.x < -40 || p.x > r.w + 40 || p.y < -40 || p.y > r.h + 40) continue;
    r.flat(t.x, t.y, 1, 1, 0.6, `rgba(70,130,170,${0.35 + 0.1 * Math.sin(time * 0.003 + t.x)})`, null, ctx);
  }
  for (const e of city.effects || []) {
    if (e.type === 'tornado') {
      const f = (time * 0.0005) % 1;
      const at = e.path[Math.min(e.path.length - 1, Math.floor(f * e.path.length))];
      const base = r.project(at.x + 0.5, at.y + 0.5, 0);
      for (let i = 0; i < 7; i++) {
        const w = (3 + i * 3.2) * r.zoom, y = base.y - i * 9 * r.zoom, wob = Math.sin(time * 0.02 + i) * 3 * r.zoom;
        ctx.fillStyle = `rgba(90,95,100,${0.55 - i * 0.05})`;
        ctx.beginPath(); ctx.ellipse(base.x + wob, y, w, w * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (e.type === 'ufo') {
      const z = r.zoom, f = (time * 0.0004) % 1;
      const at = e.path[Math.min(e.path.length - 1, Math.floor(f * e.path.length))];
      const p = r.project(at.x + 0.5, at.y + 0.5, 72 + Math.sin(time * 0.004) * 4), g = r.project(at.x + 0.5, at.y + 0.5, 0);
      if (Math.min(e.path.length - 1, Math.floor(f * e.path.length)) % 3 === 2) {
        ctx.fillStyle = `rgba(170,255,200,${0.22 + 0.1 * Math.sin(time * 0.03)})`;
        ctx.beginPath(); ctx.moveTo(p.x - 5 * z, p.y); ctx.lineTo(p.x + 5 * z, p.y); ctx.lineTo(g.x + 18 * z, g.y + 4 * z); ctx.lineTo(g.x - 18 * z, g.y + 4 * z); ctx.closePath(); ctx.fill();
      }
      withGroundClip(r, () => { ctx.fillStyle = '#00000022'; ctx.beginPath(); ctx.ellipse(g.x, g.y + 2 * z, 18 * z, 6 * z, 0, 0, Math.PI * 2); ctx.fill(); }, ctx);
      ctx.fillStyle = '#59616d'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 2 * z, 28 * z, 8 * z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7d8794'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 28 * z, 8 * z, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#b7cad9'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 5 * z, 11 * z, 7.5 * z, 0, Math.PI, 0); ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = i * 0.785 + time * 0.003;
        ctx.fillStyle = Math.floor(time / 180 + i) % 3 ? '#f2d36b' : '#ff6b6b';
        ctx.beginPath(); ctx.arc(p.x + Math.cos(a) * 22 * z, p.y + Math.sin(a) * 6 * z + 2 * z, 1.8 * z, 0, Math.PI * 2); ctx.fill();
      }
    } else if (e.type === 'lava') {
      const z = r.zoom;
      for (let dy = -e.radius; dy <= e.radius; dy++) for (let dx = -e.radius; dx <= e.radius; dx++) {
        const x = e.x + dx, y = e.y + dy;
        if (x < 0 || y < 0 || x >= city.size || y >= city.size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const a = (0.75 - d * 0.18) * (0.8 + 0.2 * Math.sin(time * 0.004 + dx * 1.7 + dy * 2.3));
        r.flat(x, y, 1, 1, 0.6, `rgba(255,${110 - d * 20},30,${Math.max(0.1, a)})`, null, ctx);
      }
      const top = r.project(e.x + 0.5, e.y + 0.5, 4);
      for (let i = 0; i < 6; i++) {
        const rise = ((time * 0.03 + i * 17) % 90);
        ctx.fillStyle = `rgba(70,60,55,${0.5 - rise / 200})`;
        ctx.beginPath(); ctx.ellipse(top.x + Math.sin(i * 2 + time * 0.002) * 6 * z, top.y - rise * z * 0.8, (8 + rise * 0.25) * z, (5 + rise * 0.15) * z, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (e.type === 'riot') {
      // The block that is out of hand, and a crowd milling about in it, so
      // the mayor can see where a patrol car has to go.
      const z = r.zoom, reach = 3;
      const pulse = 0.16 + 0.06 * Math.sin(time * 0.004);
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > reach) continue;
          r.flat(e.x + dx, e.y + dy, 1, 1, 0.45, `rgba(214,72,58,${pulse})`, null, ctx);
        }
      }
      for (let i = 0; i < 34; i++) {
        const a = i * 2.4 + time * 0.0012 * (i % 2 ? 1 : -1), d = 0.4 + (i % 6) * 0.45;
        const bob = (i + Math.floor(time / 180)) % 2;
        const p = r.project(e.x + 0.5 + Math.cos(a) * d, e.y + 0.5 + Math.sin(a) * d, 1 + bob);
        ctx.fillStyle = ['#3a3f46', '#7a4c42', '#4a5560', '#6b5a44'][i % 4];
        ctx.fillRect(p.x - 1.1 * z, p.y - 6 * z, 2.2 * z, 6 * z);
        ctx.fillStyle = '#c9a98a';
        ctx.fillRect(p.x - 1.1 * z, p.y - 8 * z, 2.2 * z, 2 * z);
      }
    } else if (e.type === 'toxic') {
      const z = r.zoom, c = r.project(e.x + 0.5, e.y + 0.5, 16);
      for (let i = 0; i < 16; i++) {
        const a = i * 0.39 + time * 0.0006, radius = (20 + (i % 5) * 16) * z;
        ctx.fillStyle = `rgba(${150 + (i % 2) * 30},${190 + (i % 3) * 20},60,${0.42 + 0.1 * Math.sin(time * 0.002 + i)})`;
        ctx.beginPath(); ctx.ellipse(c.x + Math.cos(a) * radius, c.y + Math.sin(a) * radius * 0.45 - (i % 3) * 6 * z, (20 + (i % 5) * 5) * z, (11 + (i % 3) * 3) * z, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}
