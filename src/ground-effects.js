// Clip ground effects without trimming roofs, canopies or other raised artwork.
// Walk every boundary vertex so hills and rotated views retain their outline.
import {groundEdgePoints} from './water-geometry.js';
const boundaries = new WeakMap();
function boundary(r) {
  const key = [r.size, r.corners, r.rotation, r.zoom, r.panX, r.panY, r.w, r.h, r.project];
  const cached = boundaries.get(r);
  if (cached && key.every((v, i) => v === cached.key[i])) return cached;
  const n = r.size, project = (x, y) => r.projectGround ? r.projectGround(x, y) : r.project(x, y);
  const points = [];
  const edge=(ax,ay,bx,by)=>{for(const [x,y] of groundEdgePoints(r,ax,ay,bx,by).slice(0,-1))points.push(project(x,y));};
  for (let x = 0; x < n; x++) edge(x,0,x+1,0);
  for (let y = 0; y < n; y++) edge(n,y,n,y+1);
  for (let x = n; x > 0; x--) edge(x,n,x-1,n);
  for (let y = n; y > 0; y--) edge(0,y,0,y-1);
  const path = typeof Path2D === 'undefined' ? null : new Path2D();
  if (path) trace(path, points);
  const entry = { key, points, path };
  boundaries.set(r, entry);
  return entry;
}
function trace(ctx, points) {
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
}
export function withGroundClip(r, paint, ctx = r.base) {
  const n = r.size;
  if (!n) return paint(); // Standalone artwork renderers have no map.
  const { points, path } = boundary(r);
  ctx.save();
  try {
    if (path) ctx.clip(path);
    else { ctx.beginPath(); trace(ctx, points); ctx.clip(); }
    return paint();
  } finally { ctx.restore(); }
}
