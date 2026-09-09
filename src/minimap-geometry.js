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

// Screen corners arrive clockwise from top-left. Cast toward the camera
// (screen bottom) to keep its marker on the outline, even at the map boundary.
export function cameraMarker(view, size) {
  const polygon = visibleMapPolygon(view, size);
  if (polygon.length < 3) return null;
  const center = polygon.reduce((sum, p) => ({ x: sum.x + p.x / polygon.length, y: sum.y + p.y / polygon.length }), { x: 0, y: 0 });
  const direction = { x: view[2].x + view[3].x - view[0].x - view[1].x, y: view[2].y + view[3].y - view[0].y - view[1].y };
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  let distance = Infinity;
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    const edge = { x: b.x - a.x, y: b.y - a.y };
    const offset = { x: a.x - center.x, y: a.y - center.y };
    const denominator = cross(direction, edge);
    if (Math.abs(denominator) < 1e-9) return;
    const t = cross(offset, edge) / denominator;
    const u = cross(offset, direction) / denominator;
    if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) distance = Math.min(distance, t);
  });
  if (!Number.isFinite(distance)) return null;
  const point = mapPoint(center.x + direction.x * distance, center.y + direction.y * distance, size);
  const middle = mapPoint(center.x, center.y, size);
  const length = Math.hypot(middle.x - point.x, middle.y - point.y);
  if (length < 1e-9) return null;
  return { ...point, dx: (middle.x - point.x) / length, dy: (middle.y - point.y) / length };
}
