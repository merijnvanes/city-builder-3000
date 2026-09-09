// Procedural port modules. The authored sprites in the transport collection
// draw these in the game; the recipes here stand in where a sprite is not
// available (tests, a failed load, a footprint the catalog does not carry),
// and they supply the module heights the shadow and culling contract needs.
//
// A recipe draws into the module's lot in fractions, like every other lot
// recipe, so a 1×1 quay and a 2×2 shed use the same helpers.

// Approximate roof heights in renderer z units, for depth, shadows and fire.
const HEIGHTS = {
  'threshold-x': 2, 'runway-x': 2, 'threshold-y': 2, 'runway-y': 2, apron: 2,
  terminal: 22, tower: 44, hangar: 24, cargo: 14, fuel: 12,
  warehouse: 22, quay: 20, pier: 6, gantry: 38, office: 20, tanks: 14, containers: 10,
};
export const partHeight = part => HEIGHTS[part] ?? 12;

const CARGO = ['#b8624c', '#587f98', '#c7a45a', '#65876c', '#9b756c'];

function runway(d, along, threshold) {
  d.flat(0, 0, 1, 1, 0.2, '#5c6362');
  const bar = (a, b, w, h) => d.flat(along === 'x' ? a : b, along === 'x' ? b : a, along === 'x' ? w : h, along === 'x' ? h : w, 0.45, '#e6e2c8');
  bar(0, 0.08, 1, 0.025); bar(0, 0.895, 1, 0.025);
  if (threshold) for (let i = 0; i < 6; i++) bar(0.2, 0.17 + i * 0.12, 0.6, 0.05);
  else for (let a = 0.08; a < 0.9; a += 0.25) bar(a, 0.485, 0.14, 0.03);
}

const RECIPES = {
  'runway-x': d => runway(d, 'x', false),
  'runway-y': d => runway(d, 'y', false),
  'threshold-x': d => runway(d, 'x', true),
  'threshold-y': d => runway(d, 'y', true),
  apron(d) {
    d.flat(0, 0, 1, 1, 0.2, '#666d6c');
    d.flat(0, 0.47, 1, 0.06, 0.4, '#d9c05a');
    for (const [a, b] of [[0.08, 0.88], [0.5, 0.88], [0.88, 0.88]]) d.box(a, b, 0.04, 0.04, 3, '#7f9fb0');
  },
  terminal(d, t) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, '#9aa39a');
    d.flat(0.05, 0.72, 0.9, 0.24, 0.35, '#767b76');
    d.box(0.08, 0.14, 0.84, 0.5, 18, '#cfd3ca'); d.windows(0.08, 0.14, 0.84, 0.5, 18, t.x + t.y, true);
    d.flat(0.06, 0.12, 0.88, 0.54, 18.1, '#7f8a83');
    d.box(0.3, 0.62, 0.4, 0.1, 8, '#b9bdb5');
    d.box(0.62, 0.05, 0.3, 0.06, 6, '#c7cbc2', 6);
  },
  tower(d) {
    d.flat(0.1, 0.1, 0.8, 0.8, 0.2, '#9aa39a');
    d.cyl(0.5, 0.5, 0.16, 30, '#d3d0c2'); d.cyl(0.5, 0.5, 0.3, 6, '#7f9fa8', 30); d.cyl(0.5, 0.5, 0.32, 2, '#c9c3ad', 36);
    d.line(0.5, 0.5, 38, 0.5, 0.5, 44, '#e8ecdf', 1.2);
  },
  hangar(d, t) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, '#8f9a86');
    d.flat(0.05, 0.8, 0.9, 0.16, 0.35, '#6d7370');
    d.box(0.08, 0.1, 0.84, 0.66, 16, '#b3b9b4'); d.roof(0.06, 0.08, 0.88, 0.7, 16, 8, '#6f7a78');
    d.flat(0.14, 0.759, 0.72, 0.01, 12, '#33403f');
    d.windows(0.08, 0.1, 0.84, 0.66, 16, t.x + t.y);
  },
  cargo(d, t) {
    d.flat(0.03, 0.03, 0.94, 0.94, 0.2, '#8f9a86');
    d.box(0.1, 0.12, 0.8, 0.5, 11, '#b8beb7'); d.roof(0.08, 0.1, 0.84, 0.54, 11, 4, '#7a8480');
    d.windows(0.1, 0.12, 0.8, 0.5, 11, t.x + t.y);
    for (let i = 0; i < 3; i++) d.box(0.15 + i * 0.26, 0.74, 0.16, 0.14, 3, CARGO[i]);
  },
  fuel(d) {
    d.flat(0.04, 0.04, 0.92, 0.92, 0.2, '#8f9a86');
    d.fence(0.06, 0.94, 0.88, 0, '#8b8c77');
    for (const [a, b] of [[0.3, 0.32], [0.7, 0.32], [0.5, 0.68]]) { d.cyl(a, b, 0.13, 9, '#d9dcd2'); d.cyl(a, b, 0.135, 1.5, '#8a9591', 9); }
    d.line(0.3, 0.32, 3, 0.7, 0.32, 3, '#6f8f9c', 1.5);
  },
  warehouse(d, t) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, '#a4aea5');
    d.flat(0.04, 0.76, 0.92, 0.2, 0.3, '#718286');
    d.box(0.07, 0.1, 0.86, 0.6, 18, '#a2795f'); d.windows(0.07, 0.1, 0.86, 0.6, 18, t.x + t.y);
    d.roof(0.055, 0.085, 0.89, 0.63, 18, 5, '#64868d');
    for (const a of [0.16, 0.44, 0.72]) d.box(a, 0.69, 0.16, 0.012, 9, '#2e6e72');
  },
  quay(d) {
    d.flat(0, 0, 1, 1, 0.2, '#a4aea5');
    for (const a of [0.15, 0.5, 0.85]) for (const b of [0.06, 0.94]) { d.cyl(a, b, 0.03, 3, '#556c73'); d.cyl(b, a, 0.03, 3, '#556c73'); }
    d.box(0.38, 0.38, 0.24, 0.24, 4, '#546d75');
    d.box(0.44, 0.44, 0.12, 0.12, 12, '#c5a663', 4);
    d.line(0.5, 0.5, 15, 0.5, 0.92, 9, '#d7bf86', 1.5);
    d.line(0.5, 0.92, 9, 0.5, 0.92, 3, '#5c7479', 0.7);
  },
  pier(d) {
    for (const a of [0.08, 0.92]) for (const b of [0.08, 0.5, 0.92]) d.cyl(a, b, 0.03, 4, '#6b5a44', -6);
    d.flat(0.02, 0.02, 0.96, 0.96, 4, '#c5ac83');
    for (let a = 0.06; a < 0.96; a += 0.06) d.line(a, 0.03, 4.2, a, 0.97, 4.2, '#917e64', 0.45);
    for (const [a, b] of [[0.1, 0.5], [0.9, 0.5]]) d.cyl(a, b, 0.025, 2.5, '#556c73', 4);
  },
  gantry(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, '#a4aea5');
    for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
      const x = 0.12 + col * 0.28, y = 0.2 + row * 0.34;
      d.box(x, y, 0.2, 0.12, 4.5, CARGO[(col + row + Math.floor(n * 5)) % 5]);
    }
    for (const x of [0.1, 0.86]) {
      d.box(x, 0.06, 0.04, 0.88, 2, '#546d75');
      for (const y of [0.12, 0.86]) d.line(x + 0.02, y, 2, x + 0.02, y, 32, '#c5a663', 2.2);
    }
    for (const y of [0.12, 0.86]) d.box(0.08, y - 0.03, 0.84, 0.06, 2, '#d4b774', 32);
    d.box(0.42, 0.1, 0.12, 0.8, 2, '#75909a', 34);
  },
  office(d, t) {
    d.flat(0.04, 0.04, 0.92, 0.92, 0.2, '#a4aea5');
    d.box(0.16, 0.2, 0.68, 0.56, 16, '#d8cbb0'); d.windows(0.16, 0.2, 0.68, 0.56, 16, t.x + t.y);
    d.roof(0.13, 0.17, 0.74, 0.62, 16, 5, '#5f6b66');
    d.line(0.9, 0.12, 0, 0.9, 0.12, 20, '#cfcfc0', 1); d.flat(0.86, 0.08, 0.07, 0.04, 18, '#c8443a');
  },
  tanks(d) {
    d.flat(0.04, 0.04, 0.92, 0.92, 0.2, '#a4aea5');
    for (const [a, b] of [[0.32, 0.36], [0.68, 0.64]]) { d.cyl(a, b, 0.2, 11, '#d5dad0'); d.cyl(a, b, 0.205, 2, '#8a9591', 11); }
    d.line(0.32, 0.36, 4, 0.68, 0.64, 4, '#6f8f9c', 1.5);
  },
  containers(d, t, n) {
    d.flat(0.02, 0.02, 0.96, 0.96, 0.2, '#a4aea5');
    const palette = Math.floor(n * 3);
    for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
      const x = 0.1 + col * 0.42, y = 0.16 + row * 0.38;
      d.box(x, y, 0.36, 0.22, 4.5, CARGO[(col + row + palette) % 5]);
      if ((col + row) % 2 === 0) d.box(x, y, 0.36, 0.22, 4, CARGO[(col + row + 2 + palette) % 5], 4.6);
    }
  },
};

export function drawPortPart(d, t, n) {
  const recipe = RECIPES[t.part];
  if (recipe) recipe(d, t, n);
  else d.flat(0.02, 0.02, 0.96, 0.96, 0.2, '#a4aea5');
}
