// Fixed world orientation, with room around the diamond for compass labels.
export function mapPoint(x, y, size) {
  return { x: 80 + (x - y) * 64 / size, y: 16 + (x + y) * 64 / size };
}

export function worldPoint(x, y, size) {
  const u = (x - 80) / 64, v = (y - 16) / 64;
  const point = { x: (u + v) * size / 2, y: (v - u) * size / 2 };
  return point.x >= 0 && point.y >= 0 && point.x <= size && point.y <= size ? point : null;
}

// Intersect the visible world polygon with the map before drawing its outline.
export function visibleMapPolygon(points, size) {
  for (const [axis, edge, sign] of [['x', 0, 1], ['x', size, -1], ['y', 0, 1], ['y', size, -1]]) {
    const input = points;
    points = [];
    input.forEach((b, i) => {
      const a = input[(i + input.length - 1) % input.length];
      const aInside = (a[axis] - edge) * sign >= 0, bInside = (b[axis] - edge) * sign >= 0;
      if (aInside !== bInside) {
        const t = (edge - a[axis]) / (b[axis] - a[axis]);
        points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
      if (bInside) points.push(b);
    });
  }
  return points;
}
