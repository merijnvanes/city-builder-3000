// Stadium seating and floodlights are sorted as independent parts.
export function drawStadium(d, t, n) {
  d.flat(0.02, 0.02, 0.96, 0.96, 0.2, '#a5b09d');
  d.box(0.075, 0.075, 0.85, 0.85, 5, '#a1afa6');
  d.flat(0.24, 0.24, 0.52, 0.52, 5.1, '#559356');
  for (let i = 0; i < 8; i++) d.flat(0.27, 0.27 + i * 0.0575, 0.46, 0.0575, 5.2, i % 2 ? '#65a665' : '#70ae69');
  for (const [a, b, c, e] of [[0.28, 0.28, 0.72, 0.28], [0.28, 0.72, 0.72, 0.72], [0.28, 0.28, 0.28, 0.72], [0.72, 0.28, 0.72, 0.72], [0.28, 0.5, 0.72, 0.5]]) d.line(a, b, 5.4, c, e, 5.4, '#e1e5cc', 0.75);
  for (const y of [0.28, 0.65]) {
    d.line(0.39, y, 5.4, 0.61, y, 5.4, '#e1e5cc', 0.7);
    d.line(0.39, y + 0.07, 5.4, 0.61, y + 0.07, 5.4, '#e1e5cc', 0.7);
    d.line(0.39, y, 5.4, 0.39, y + 0.07, 5.4, '#e1e5cc', 0.7);
    d.line(0.61, y, 5.4, 0.61, y + 0.07, 5.4, '#e1e5cc', 0.7);
  }
  const parts = [], seats = n < 0.5 ? ['#6d919a', '#91b3b3'] : ['#a47768', '#c39781'];
  for (let tier = 0; tier < 6; tier++) {
    const near = 0.225 - tier * 0.024, far = 0.75 + tier * 0.024, rise = 4 + tier * 2.5;
    for (const y of [near, far]) parts.push([0.5, y + 0.011, () => {
      d.box(0.105, y, 0.79, 0.023, rise, '#adbbb1', 5);
      d.flat(0.11, y + 0.003, 0.78, 0.015, 5 + rise + 0.1, seats[tier % 2]);
      for (const x of [0.28, 0.49, 0.7]) d.flat(x, y, 0.018, 0.023, 5 + rise + 0.2, '#d4d8c5');
    }]);
    for (const x of [near, far]) parts.push([x + 0.011, 0.5, () => {
      d.box(x, 0.255, 0.023, 0.49, rise - 2, '#adbbb1', 5);
      d.flat(x + 0.003, 0.26, 0.015, 0.48, 3 + rise + 0.1, seats[tier % 2]);
    }]);
  }
  for (const y of [0.268, 0.723]) parts.push([0.5, y, () => {
    d.line(0.455, y, 5.3, 0.455, y, 9, '#e0e4d2', 0.7);
    d.line(0.545, y, 5.3, 0.545, y, 9, '#e0e4d2', 0.7);
    d.line(0.455, y, 9, 0.545, y, 9, '#e0e4d2', 0.8);
  }]);
  for (const [x, y] of [[0.095, 0.095], [0.9, 0.095], [0.095, 0.9], [0.9, 0.9]]) parts.push([x, y, () => {
    d.line(x, y, 5, x, y, 39, '#718989', 1.8);
    d.box(x - 0.032, y - 0.01, 0.065, 0.02, 3, '#dce0ce', 39);
  }]);
  d.parts(parts);
}
