// Small, deterministic tree silhouettes shared by lots and natural forests.
// Screen-space crowns stay legible at city scale as the map rotates.
import { random } from './building-art.js';

export function drawTree(r, x, y, variant = 0) {
  const z = r.zoom, ctx = r.base;
  const seed = random(x, y, variant);
  const species = ((variant % 3) + 3) % 3;
  const height = 13 + seed * 9;
  const foot = r.project(x, y);
  const crown = r.project(x, y, height);
  const colors = r.night
    ? ['#203e32', '#2a4d3b', '#385b42', '#486849', '#55744e']
    : ['#304d2b', '#416432', '#587d3b', '#71934b', '#8aa75a'];

  // Contact shadow and a longer soft cast shadow underneath the trunk.
  ctx.fillStyle = '#24352328';
  ctx.beginPath(); ctx.ellipse(foot.x - 4 * z, foot.y + 2 * z, 9 * z, 3.4 * z, -0.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#24352336';
  ctx.beginPath(); ctx.ellipse(foot.x, foot.y, 2.3 * z, 1.1 * z, 0, 0, Math.PI * 2); ctx.fill();
  r.line(foot, r.project(x, y, height + 1), '#655239', 1.6);
  if (z >= 0.85) r.line({ x: foot.x + 0.45 * z, y: foot.y - z }, { x: foot.x + 0.45 * z, y: crown.y + 3 * z }, '#9b8054', 0.45);

  if (species === 2) {
    // Conifer: overlapping boughs, shaded toward the right.
    for (let tier = 0; tier < 3; tier++) {
      const width = (7.3 - tier * 1.7) * z;
      const cy = crown.y + (7 - tier * 5) * z;
      const tip = { x: crown.x - 0.5 * z, y: cy - 10 * z };
      const left = { x: crown.x - width, y: cy };
      const bottom = { x: crown.x, y: cy + 2 * z };
      const right = { x: crown.x + width, y: cy };
      r.poly([tip, left, bottom, right], colors[1]);
      r.poly([tip, left, bottom], colors[2]);
      r.poly([tip, { x: crown.x - width * 0.4, y: cy - z }, bottom], colors[3]);
    }
    return;
  }

  const narrow = species === 1;
  const width = (narrow ? 4.2 : 7.4) * z;
  const depth = (narrow ? 9.8 : 6.5) * z;
  const lobes = narrow ? 5 : 7;
  // Lower lobes first, then the sunlit upper crown; unequal contours avoid
  // the repeated oval "lollipop" appearance of the original trees.
  for (let i = 0; i < lobes; i++) {
    const a = i * 2.399;
    const offset = i === lobes - 1 ? 0 : 0.48;
    const cx = crown.x + Math.cos(a) * width * offset;
    const cy = crown.y + Math.sin(a) * depth * offset - (i === lobes - 1 ? 2 * z : 0);
    const rx = width * (0.56 + random(x, y, i + 20) * 0.16);
    const ry = depth * (0.59 + random(y, x, i + 31) * 0.16);
    const points = Array.from({ length: 9 }, (_, j) => {
      const angle = j * Math.PI * 2 / 9;
      const uneven = 0.9 + random(x + i, y + j, 41) * 0.2;
      return { x: cx + Math.cos(angle) * rx * uneven, y: cy + Math.sin(angle) * ry * uneven };
    });
    r.poly(points, colors[1 + (i % 3)]);
    if (z >= 0.65) {
      r.poly([points[4], points[5], points[6], points[7], { x: cx, y: cy }], colors[Math.min(4, 2 + (i % 3))]);
    }
  }
}
