// Public gardens, playgrounds and landscaped water. All details live in the
// static lot artwork; the city pays no animation cost for benches or flowers.
function bench(d, x, y, width = 0.18) {
  for (const a of [x + 0.02, x + width - 0.04]) d.box(a, y, 0.018, 0.045, 2.5, '#495e58');
  d.box(x, y - 0.005, width, 0.06, 0.8, '#aa8056', 2.5);
  d.box(x, y + 0.043, width, 0.012, 2.5, '#ba9164', 2.7);
}
function flowers(d, x, y, w, h, color) {
  d.flat(x, y, w, h, 0.35, '#476747');
  for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
    d.flat(x + w * (0.06 + col * 0.19), y + h * (0.1 + row * 0.28), w * 0.1, h * 0.13, 0.55, color);
  }
}
function gazebo(d, x, y, size) {
  d.box(x, y, size, size, 1.5, '#b8ae90');
  for (const a of [x + 0.025, x + size - 0.04]) for (const b of [y + 0.025, y + size - 0.04]) d.box(a, b, 0.015, 0.015, 9, '#d4c9aa', 1.5);
  d.hip(x - 0.015, y - 0.015, size + 0.03, size + 0.03, 10.5, 6, '#597f74');
}
function fountain(d, x, y, radius) {
  d.cyl(x, y, radius, 1.6, '#d2cbb3');
  d.cyl(x, y, radius * 0.82, 0.45, '#589caa', 1.7);
  d.cyl(x, y, radius * 0.22, 3, '#c8d2c4', 2.1);
  d.cyl(x, y, radius * 0.42, 0.8, '#d5d6bc', 5.1);
  d.cyl(x, y, radius * 0.32, 0.3, '#8abfbe', 5.95);
  d.line(x, y, 6, x, y, 9, '#d7ede0', 0.8);
}

export function drawPocketPark(d, t, n) {
  const style = Math.floor(n * 3);
  d.flat(0.025, 0.025, 0.95, 0.95, 0.2, '#6d9153');
  d.flat(0.42, 0.025, 0.16, 0.95, 0.3, '#c9c3a5');
  d.flat(0.025, 0.42, 0.95, 0.16, 0.3, '#c9c3a5');
  const parts = [];
  if (style === 0) {
    flowers(d, 0.08, 0.08, 0.26, 0.24, '#d99592');
    flowers(d, 0.66, 0.66, 0.26, 0.24, '#e6c878');
    parts.push([0.5, 0.5, () => fountain(d, 0.5, 0.5, 0.16)]);
    parts.push([0.2, 0.8, () => d.tree(0.2, 0.8, 0)], [0.8, 0.2, () => d.tree(0.8, 0.2, 1)]);
  } else if (style === 1) {
    flowers(d, 0.08, 0.63, 0.25, 0.28, '#b9bddc');
    parts.push([0.22, 0.21, () => gazebo(d, 0.08, 0.07, 0.29)]);
    parts.push([0.78, 0.23, () => d.tree(0.78, 0.23, 0)], [0.77, 0.78, () => d.tree(0.77, 0.78, 2)]);
  } else {
    d.flat(0.08, 0.08, 0.3, 0.28, 0.4, '#c9ad79');
    parts.push([0.22, 0.22, () => {
      for (const x of [0.12, 0.32]) for (const y of [0.12, 0.29]) d.line(x, y, 0.5, x, 0.2, 10, '#668d91', 1.3);
      d.line(0.1, 0.2, 10, 0.34, 0.2, 10, '#dca856', 1.8);
      for (const x of [0.19, 0.24]) d.line(x, 0.2, 10, x, 0.2, 3, '#75847a', 0.5);
      d.box(0.18, 0.18, 0.075, 0.045, 0.6, '#be6850', 3);
    }]);
    parts.push([0.76, 0.75, () => d.tree(0.76, 0.75, 0)], [0.22, 0.8, () => d.tree(0.22, 0.8, 1)]);
    flowers(d, 0.68, 0.09, 0.23, 0.18, '#dbb778');
  }
  parts.push([0.72, 0.37, () => bench(d, 0.65, 0.36)], [0.25, 0.6, () => bench(d, 0.15, 0.6)]);
  d.parts(parts);
}

export function drawGardenPark(d, t, n) {
  d.flat(0.015, 0.015, 0.97, 0.97, 0.2, '#6b9151');
  d.flat(0.045, 0.045, 0.91, 0.91, 0.3, '#bbc1a0');
  d.flat(0.08, 0.08, 0.84, 0.84, 0.4, '#74995b');
  d.flat(0.465, 0.05, 0.07, 0.9, 0.5, '#d1c9ac');
  d.flat(0.05, 0.45, 0.9, 0.08, 0.5, '#d1c9ac');
  // The stone rim precedes the pond, fixing the old invisible-water bug.
  d.flat(0.57, 0.57, 0.32, 0.29, 0.55, '#c5c5a6');
  d.flat(0.59, 0.59, 0.28, 0.25, 0.65, '#568f9c');
  d.flat(0.61, 0.61, 0.24, 0.21, 0.7, '#68a7ad');
  for (const y of [0.64, 0.71, 0.78]) d.line(0.65, y, 0.75, 0.81, y, 0.75, '#afd3c888', 0.6);
  flowers(d, 0.12, 0.31, 0.25, 0.065, '#d4a0b2');
  flowers(d, 0.6, 0.32, 0.23, 0.065, '#e8c778');
  const parts = [
    [0.25, 0.18, () => gazebo(d, 0.14, 0.08, 0.22)],
    [0.5, 0.49, () => fountain(d, 0.5, 0.49, 0.065)],
    [0.23, 0.57, () => bench(d, 0.15, 0.56, 0.15)],
    [0.71, 0.89, () => bench(d, 0.64, 0.89, 0.15)],
  ];
  for (const [x, y, species] of [[0.1, 0.12, 0], [0.39, 0.16, 1], [0.73, 0.12, 0], [0.9, 0.28, 1], [0.14, 0.72, 2], [0.32, 0.86, 0], [0.08, 0.88, 1], [0.9, 0.92, 0]]) {
    parts.push([x, y, () => d.tree(x, y, species)]);
  }
  // Lily pads and reeds stay on the water surface beneath foreground trees.
  for (const [x, y] of [[0.63, 0.77], [0.78, 0.64], [0.8, 0.78]]) {
    d.flat(x, y, 0.025, 0.025, 0.8, '#689565');
    d.flat(x + 0.009, y + 0.007, 0.009, 0.009, 0.85, '#e5bdc5');
  }
  d.parts(parts);
}
