// Small architectural details shared by civic campuses. All geometry remains
// in lot coordinates and is painted inside its owning camera-sorted part.
export const CIVIC = { stone: '#e6d9be', trim: '#fff0d3', slate: '#394f63', glass: '#66a9b7', paving: '#c8c2af', lawn: '#7eaa72', gold: '#e9b951' };

export function campus(d, accent = CIVIC.lawn) {
  d.flat(0.025, 0.025, 0.95, 0.95, 0.2, accent);
  d.flat(0.045, 0.7, 0.91, 0.255, 0.3, CIVIC.paving);
  d.flat(0.45, 0.04, 0.1, 0.91, 0.4, '#e4dcc7');
}

export function hall(d, t, x, y, w, h, height, wall, roof = CIVIC.slate, base = 0) {
  d.box(x, y, w, h, height, wall, base);
  d.windows(x, y, w, h, height, t.x + t.y, false, base);
  d.box(x - 0.01, y - 0.01, w + 0.02, h + 0.02, 1.5, CIVIC.trim, base + height);
  d.flat(x, y, w, h, base + height + 1.6, roof);
}

export function steps(d, x, y, w, count = 3) {
  d.parts(Array.from({ length: count }, (_, i) => [x + w / 2, y + i * 0.035 + 0.0175, () => {
    d.box(x, y + i * 0.035, w, 0.035, count - i, CIVIC.stone);
  }]));
}

export function flag(d, x, y, height, color) {
  d.line(x, y, 0, x, y, height, CIVIC.trim, 1);
  d.box(x, y, 0.1, 0.008, 4, color, height - 4);
}

export function cross(d, x, y, size, z, color) {
  d.flat(x + size / 3, y, size / 3, size, z, color);
  d.flat(x, y + size / 3, size, size / 3, z + 0.01, color);
}

export function clockFaces(d, x, y, w, h, z) {
  // Four vertical clock faces; unlike a roof decal these survive rotation.
  for (const [side, fy] of [['northeast', y - 0.002], ['southwest', y + h + 0.002]]) {
    if (!d.visible(side)) continue;
    d.box(x + w * 0.25, fy, w * 0.5, 0.002, 6, CIVIC.trim, z);
    const faceY = fy + (side === 'southwest' ? 0.002 : -0.001);
    d.line(x + w * 0.5, faceY, z + 3, x + w * 0.5, faceY, z + 5, CIVIC.slate, 0.8);
    d.line(x + w * 0.5, faceY, z + 3, x + w * 0.7, faceY, z + 3, CIVIC.slate, 0.8);
  }
  for (const [side, fx] of [['northwest', x - 0.002], ['southeast', x + w + 0.002]]) {
    if (!d.visible(side)) continue;
    d.box(fx, y + h * 0.25, 0.002, h * 0.5, 6, CIVIC.trim, z);
    const faceX = fx + (side === 'southeast' ? 0.002 : -0.001);
    d.line(faceX, y + h * 0.5, z + 3, faceX, y + h * 0.5, z + 5, CIVIC.slate, 0.8);
    d.line(faceX, y + h * 0.5, z + 3, faceX, y + h * 0.7, z + 3, CIVIC.slate, 0.8);
  }
}
