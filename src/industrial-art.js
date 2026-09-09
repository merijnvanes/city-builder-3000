// Modular industrial yards. Ground markings precede the sorted solids so
// containers, sheds and tanks keep their correct overlap in every view.
const COLORS = ['#b8624c', '#587f98', '#c7a45a', '#65876c', '#9b756c'];
export function container(d, x, y, w, h, height, color, z = 0) {
  d.box(x, y, w, h, height, color, z);
  d.flat(x + 0.008, y + 0.008, w - 0.016, h - 0.016, z + height + 0.1, '#9aa59a');
  for (let i = 1; i < 7; i++) {
    const a = x + w * i / 7;
    d.line(a, y, z + height + 0.15, a, y + h, z + height + 0.15, color, 0.8);
  }
}
function tank(d, x, y, radius, height) {
  d.cyl(x, y, radius, height, '#b8c6bd');
  d.cyl(x, y, radius * 1.02, 0.8, '#d2d8c7', height);
  d.cyl(x, y, radius * 0.84, 0.4, '#8faaa7', height + 0.85);
  d.line(x + radius * 0.72, y, 0, x + radius * 0.72, y, height + 2, '#6c8584', 0.8);
}
function loadingYard(d) {
  d.flat(0.035, 0.035, 0.93, 0.93, 0.25, '#8c958a');
  d.flat(0.04, 0.64, 0.92, 0.29, 0.35, '#647477');
  for (let x = 0.08; x < 0.93; x += 0.11) d.flat(x, 0.84, 0.05, 0.012, 0.5, '#d1c792');
  for (let x = 0.11; x < 0.5; x += 0.12) d.flat(x, 0.67, 0.012, 0.1, 0.5, '#bdbca5');
}
export function drawIndustrialYard(d, t, n, level) {
  loadingYard(d);
  const heavy = t.density === 3, warehouse = !heavy && Math.floor(n * 3) === 1;
  const rise = warehouse ? 13 : 17 + level * 2;
  const width = heavy ? 0.53 : 0.86;
  const parts = [[0.08 + width / 2, 0.32, () => {
    d.box(0.08, 0.1, width, 0.47, rise, warehouse ? '#aab7b6' : '#b49377');
    d.windows(0.08, 0.1, width, 0.47, rise, t.x + t.y, false, 0, true, 8);
    if (warehouse) {
      d.flat(0.07, 0.09, width + 0.02, 0.49, rise + 0.2, '#708b91');
      for (let y = 0.16; y < 0.53; y += 0.11) d.flat(0.16, y, width - 0.16, 0.04, rise + 0.4, '#a9c5c4');
    } else {
      for (let i = 0; i < 3; i++) d.roof(0.08 + i * width / 3, 0.1, width / 3, 0.47, rise, 5, '#8b9c97');
      // Chimneys emerge above the roof; no tank can paint through them.
      for (let i = 0; i < (heavy ? 3 : 2); i++) {
        const x = 0.16 + i * (heavy ? 0.16 : 0.32), height = 22 + level * 3 + i * 3;
        d.cyl(x, 0.29, 0.025, height, '#c9bda2', rise);
        d.cyl(x, 0.29, 0.027, 3, '#b2765c', rise + height - 7);
        d.cyl(x, 0.29, 0.02, 0.4, '#536462', rise + height + 0.1);
      }
    }
  }]];
  for (let i = 0; i < (heavy ? 3 : 4); i++) {
    const x = 0.11 + i * (heavy ? 0.15 : 0.2);
    parts.push([x + 0.055, 0.595, () => {
      d.box(x, 0.57, 0.105, 0.035, 6, '#53686b');
      d.box(x - 0.006, 0.57, 0.117, 0.052, 0.7, '#b9c0b0', 6);
      d.flat(x, 0.615, 0.105, 0.045, 0.5, '#c5af6d');
    }]);
  }
  if (heavy) {
    for (const [x, y, radius, height] of [[0.77, 0.23, 0.1, 17], [0.77, 0.49, 0.1, 22]]) parts.push([x, y, () => tank(d, x, y, radius, height)]);
    parts.push([0.76, 0.71, () => {
      d.box(0.61, 0.65, 0.3, 0.13, 7, '#769497');
      d.windows(0.61, 0.65, 0.3, 0.13, 7, t.y, true);
      d.flat(0.6, 0.64, 0.32, 0.15, 7.2, '#c1c9bb');
    }]);
  }
  for (let i = 0; i < 2; i++) {
    const x = 0.12 + i * 0.27;
    parts.push([x + 0.105, 0.73, () => container(d, x, 0.68, 0.21, 0.1, 4 + i * 1.5, COLORS[(Math.floor(n * 5) + i) % COLORS.length])]);
  }
  d.parts(parts);
}

export function drawMarina(d, t, n) {
  d.flat(0.015, 0.015, 0.97, 0.97, 0.2, '#548e9e');
  d.flat(0.04, 0.3, 0.92, 0.65, 0.25, '#659fa9');
  d.flat(0.02, 0.02, 0.96, 0.28, 0.35, '#d0c7ad');
  for (let y = 0.4; y < 0.92; y += 0.11) d.line(0.06, y, 0.3, 0.94, y, 0.3, '#9cc7c344', 0.5);
  // Decking first; every cabin, mast and tree participates in depth sorting.
  for (const x of [0.22, 0.5, 0.78]) {
    d.flat(x - 0.025, 0.29, 0.05, 0.64, 1.2, '#c5ac83');
    for (let y = 0.32; y < 0.92; y += 0.035) d.line(x - 0.025, y, 1.3, x + 0.025, y, 1.3, '#917e64', 0.45);
    for (const y of [0.48, 0.73]) d.flat(x - 0.12, y, 0.145, 0.025, 1.2, '#c5ac83');
  }
  const parts = [[0.26, 0.16, () => {
    d.box(0.08, 0.055, 0.36, 0.21, 10, '#e0ddc8');
    d.windows(0.08, 0.055, 0.36, 0.21, 10, t.x + t.y, true);
    d.roof(0.065, 0.04, 0.39, 0.24, 10, 5, '#67867e');
    d.box(0.1, 0.25, 0.31, 0.045, 1, '#c4b79b', 7);
  }], [0.89, 0.13, () => d.tree(0.89, 0.13, 1)]];
  for (const x of [0.22, 0.5, 0.78]) for (const y of [0.42, 0.68]) {
    parts.push([x - 0.073, y + 0.07, () => {
      const bx = x - 0.11;
      d.box(bx, y, 0.075, 0.15, 1.6, '#e4e5d8', 0.45);
      d.flat(bx + 0.009, y + 0.016, 0.057, 0.12, 2.1, '#c4cabb');
      d.box(bx + 0.012, y + 0.045, 0.051, 0.06, 2.1, '#f0ecd9', 2.1);
      d.flat(bx + 0.018, y + 0.05, 0.039, 0.048, 4.25, '#87afb7');
      d.line(bx + 0.038, y + 0.038, 2, bx + 0.038, y + 0.038, 17, '#cbd5ca', 0.75);
      d.line(bx + 0.038, y + 0.038, 15, bx + 0.038, y + 0.135, 3, '#c3d1ca', 0.4);
      d.line(bx + 0.065, y + 0.08, 1.5, x - 0.025, y + 0.08, 1.5, '#566f70', 0.5);
    }]);
  }
  parts.push([0.57, 0.16, () => {
    d.line(0.57, 0.16, 0.4, 0.57, 0.16, 19, '#d6d6c3', 1);
    d.flat(0.57, 0.16, 0.065, 0.035, 17, '#5b8ca5');
  }]);
  d.parts(parts);
}
