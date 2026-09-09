import { CIVIC as C, hall } from './civic-details.js';

function yard(d) {
  d.flat(0.025, 0.025, 0.95, 0.95, 0.2, '#8da18e');
  d.flat(0.055, 0.055, 0.89, 0.89, 0.4, '#78898a');
  d.flat(0.06, 0.73, 0.88, 0.2, 0.5, '#566a70');
  for (const x of [0.14, 0.36, 0.58, 0.8]) d.flat(x, 0.81, 0.1, 0.016, 0.6, '#e8d9a9');
}

function stack(d, x, y, height, band) {
  d.cyl(x, y, 0.055, height, '#e0d4b9');
  for (const z of [height - 15, height - 6]) d.cyl(x, y, 0.057, 4, band, z);
  d.cyl(x, y, 0.059, 1.2, '#42535a', height);
  d.cyl(x, y, 0.037, 0.3, '#263c45', height + 1.2);
}

export function drawLandfill(d, t) {
  const variation = Math.abs(t.x * 17 + t.y * 31) % 3;
  d.flat(0.025, 0.025, 0.95, 0.95, 0.2, '#8a9970');
  d.flat(0.06, 0.09, 0.88, 0.61, 0.3, '#82735e');
  d.flat(0.07, 0.75, 0.86, 0.17, 0.4, '#b5a482');
  d.parts([
    ...[[0.13, 0.14], [0.54, 0.18], [0.31, 0.43]].map(([x, y], i) => [x + 0.14, y + 0.1, () => {
      d.box(x, y, 0.28, 0.2, 2.5, '#a39575');
      d.hip(x, y, 0.28, 0.2, 2.5, 3 + (i + variation) % 3, '#a7a084');
      for (let j = 0; j < 4; j++) d.box(x + 0.04 + (j % 2) * 0.12, y + 0.025 + Math.floor(j / 2) * 0.09, 0.045, 0.04, 1.3, ['#d4c9a0', '#6d8b8e', '#b89b77', '#bdbda7'][(j + i + variation) % 4], 3);
    }]),
    [0.74, 0.83, () => {
      // Yellow compactor with a broad roller and exhaust.
      d.box(0.62, 0.78, 0.2, 0.1, 2, '#dcb34c');
      d.box(0.68, 0.79, 0.06, 0.08, 3, '#537e88', 2);
      d.box(0.8, 0.755, 0.06, 0.15, 2.3, '#57626a');
      d.line(0.64, 0.81, 2, 0.64, 0.81, 6, '#475963', 0.8);
    }],
    [0.5, 0.96, () => d.fence(0.04, 0.96, 0.92, 0, '#788576')],
  ]);
}

export function drawIncinerator(d, t) {
  yard(d);
  d.parts([
    [0.74, 0.23, () => stack(d, 0.74, 0.23, 44, '#c8784c')],
    [0.88, 0.4, () => stack(d, 0.88, 0.4, 34, '#c8784c')],
    [0.37, 0.4, () => {
      hall(d, t, 0.09, 0.16, 0.53, 0.46, 19, '#c68d67', '#785b50');
      d.roof(0.07, 0.14, 0.57, 0.5, 20.5, 7, '#985c45');
      if (d.visible('southwest')) for (const x of [0.16, 0.34, 0.52]) {
        d.box(x, 0.617, 0.065, 0.008, 8, '#443e36', 2);
        d.box(x + 0.015, 0.627, 0.035, 0.008, 3, '#e5a350', 3);
      }
    }],
    [0.76, 0.62, () => {
      d.box(0.66, 0.52, 0.23, 0.16, 6, '#58686b');
      d.flat(0.68, 0.54, 0.19, 0.12, 6.1, '#b7a37f');
      d.line(0.67, 0.6, 7, 0.57, 0.52, 15, C.gold, 2);
    }],
  ]);
}

export function drawRecycling(d, t) {
  yard(d);
  d.parts([
    [0.5, 0.3, () => {
      hall(d, t, 0.09, 0.1, 0.82, 0.4, 13, '#b8d1ac', '#388b78');
      for (const x of [0.1, 0.37, 0.64]) d.roof(x, 0.09, 0.26, 0.42, 14.5, 5, '#459c85');
      // A framed roof sign rests on posts above the sawtooth valleys.
      for (const x of [0.35, 0.6]) d.box(x, 0.24, 0.025, 0.17, 5, '#317364', 14.5);
      d.box(0.33, 0.22, 0.31, 0.22, 0.4, '#317364', 19.5);
      // Three large bent arrows form the material-reuse loop on the roof.
      const arrows = [[0.36, 0.25, 0.6, 0.25], [0.6, 0.25, 0.53, 0.41], [0.53, 0.41, 0.36, 0.25]];
      for (const [x, y, a, b] of arrows) {
        d.line(x, y, 20, a, b, 20, '#f2eec7', 2.2);
        const dx = a - x, dy = b - y;
        d.line(a, b, 20, a - dx * 0.3 - dy * 0.2, b - dy * 0.3 + dx * 0.2, 20, '#f2eec7', 2);
      }
    }],
    ...['#5694bd', '#edbd54', '#65a66e', '#cc7960'].map((color, i) => [0.17 + i * 0.22, 0.63, () => {
      const x = 0.085 + i * 0.22;
      d.box(x, 0.55, 0.17, 0.15, 5, color);
      d.box(x - 0.005, 0.545, 0.18, 0.16, 1, '#d1d5bd', 5);
      d.flat(x + 0.025, 0.575, 0.12, 0.07, 6.1, '#40595d');
    }]),
  ]);
}

export function drawWasteEnergy(d, t) {
  yard(d);
  d.parts([
    [0.8, 0.21, () => stack(d, 0.8, 0.21, 49, '#3f9a9b')],
    [0.35, 0.35, () => {
      hall(d, t, 0.08, 0.12, 0.52, 0.46, 25, '#c5d9d3', '#367d8c');
      d.roof(0.06, 0.1, 0.56, 0.5, 26.5, 7, '#4995a1');
      d.box(0.23, 0.22, 0.2, 0.2, 1.5, '#315a6b', 33.5);
      // Gold lightning bolt, distinct from the incinerator's brick furnace.
      for (const [x, y, a, b] of [[0.36, 0.24, 0.29, 0.32], [0.29, 0.32, 0.37, 0.32], [0.37, 0.32, 0.3, 0.4]]) d.line(x, y, 35.1, a, b, 35.1, '#ffe092', 2.5);
    }],
    [0.77, 0.52, () => {
      hall(d, t, 0.65, 0.4, 0.25, 0.25, 12, '#b0c6c4', '#4e91a1');
      for (const x of [0.7, 0.83]) d.cyl(x, 0.5, 0.035, 4, '#dae2d3', 13.6);
    }],
    ...[0.16, 0.36, 0.56].map(x => [x, 0.67, () => {
      d.box(x - 0.05, 0.63, 0.1, 0.07, 5, '#788e99');
      for (const dx of [-0.025, 0.025]) d.line(x + dx, 0.665, 5, x + dx, 0.665, 10, C.gold, 1);
      d.line(x - 0.04, 0.665, 10, x + 0.04, 0.665, 10, C.trim, 1);
    }]),
  ]);
}
