import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPoint, worldPoint, visibleMapPolygon, cameraMarker, minimapView } from '../src/minimap-geometry.js';

test('minimap corners point up, right, down and left', () => {
  assert.deepEqual(mapPoint(0, 0, 64), { x: 80, y: 16 });
  assert.deepEqual(mapPoint(64, 0, 64), { x: 144, y: 80 });
  assert.deepEqual(mapPoint(64, 64, 64), { x: 80, y: 144 });
  assert.deepEqual(mapPoint(0, 64, 64), { x: 16, y: 80 });
});

test('camera marker follows the near edge through all four rotations', () => {
  let view = [{x:16,y:16}, {x:48,y:16}, {x:48,y:48}, {x:16,y:48}];
  for (let rotation = 0; rotation < 4; rotation++) {
    const marker = cameraMarker(view, 64);
    const near = mapPoint((view[2].x + view[3].x) / 2, (view[2].y + view[3].y) / 2, 64);
    assert.ok(Math.hypot(marker.x - near.x, marker.y - near.y) < 1e-9);
    view = view.map(p => ({x:p.y, y:64-p.x}));
  }
});

test('tiny camera movements update the footprint without tile snapping', () => {
  const renderer = { w:640, h:480, cx:320, cy:240, panX:0, panY:0, size:64, zoom:2, unorient:(x,y)=>({x,y}) };
  const before = minimapView(renderer);
  renderer.panX += .01;
  const after = minimapView(renderer);
  assert.ok(Math.abs(after[0].x - before[0].x) > 0);
  assert.ok(Math.abs(after[0].x - before[0].x) < .001);
  const dotBefore = cameraMarker(before, 64), dotAfter = cameraMarker(after, 64);
  assert.ok(Math.hypot(dotAfter.x-dotBefore.x, dotAfter.y-dotBefore.y) > 0);
  assert.ok(Math.hypot(dotAfter.x-dotBefore.x, dotAfter.y-dotBefore.y) < .001);
});

test('zooming across clipping transitions keeps the dot continuous in every rotation', () => {
  for (let rotation = 0; rotation < 4; rotation++) {
    let previous;
    for (let step = 0; step <= 4000; step++) {
      const scale = .4 + step * .0002;
      let view = [{x:0,y:-40},{x:60,y:20},{x:0,y:80},{x:-60,y:20}].map(p => ({x:35+p.x*scale,y:28+p.y*scale}));
      for (let turn = 0; turn < rotation; turn++) view = view.map(p => ({x:p.y,y:64-p.x}));
      const dot = cameraMarker(view, 64);
      assert.ok(dot);
      if (previous) assert.ok(Math.hypot(dot.x-previous.x,dot.y-previous.y) < .1, 'Small zoom steps must not cause marker jumps');
      const edges = visibleMapPolygon(view,64).map(p=>mapPoint(p.x,p.y,64));
      assert.ok(edges.some((a,i) => {
        const b=edges[(i+1)%edges.length];
        return Math.abs((dot.x-a.x)*(b.y-a.y)-(dot.y-a.y)*(b.x-a.x)) < 1e-6
          && dot.x >= Math.min(a.x,b.x)-1e-6 && dot.x <= Math.max(a.x,b.x)+1e-6
          && dot.y >= Math.min(a.y,b.y)-1e-6 && dot.y <= Math.max(a.y,b.y)+1e-6;
      }), 'The dot remains attached to the clipped outline');
      previous=dot;
    }
  }
});

test('camera marker stays on a clipped outline and disappears off-map', () => {
  const view = [{x:-20,y:-20}, {x:100,y:-20}, {x:100,y:100}, {x:-20,y:100}];
  const marker = cameraMarker(view, 64), expected = mapPoint(32, 64, 64);
  assert.equal(marker.x, expected.x); assert.equal(marker.y, expected.y);
  assert.equal(cameraMarker(view.map(p => ({x:p.x+200,y:p.y})), 64), null);
  assert.equal(cameraMarker(Array(4).fill({x:32,y:32}), 64), null);
});

test('click mapping round trips across map sizes and ignores the margins', () => {
  for (const size of [64, 96, 128]) for (const [x, y] of [[0, 0], [size, 0], [0, size], [size, size], [12.5, 21.25], [size / 2, size / 2]]) {
    const p = mapPoint(x, y, size), world = worldPoint(p.x, p.y, size);
    assert.ok(Math.abs(world.x - x) < 1e-10);
    assert.ok(Math.abs(world.y - y) < 1e-10);
  }
  for (const [x, y] of [[10, 10], [150, 10], [150, 150], [10, 150]]) assert.equal(worldPoint(x, y, 64), null);
});

test('a viewport outside the map keeps a closed outline of the visible region', () => {
  const rect = (x1, y1, x2, y2) => [{x:x1,y:y1}, {x:x2,y:y1}, {x:x2,y:y2}, {x:x1,y:y2}];
  const whole = visibleMapPolygon(rect(-100, -100, 100, 100), 64);
  assert.equal(whole.length, 4);
  assert.deepEqual(whole.map(p => `${p.x},${p.y}`).sort(), ['0,0', '0,64', '64,0', '64,64']);
  assert.equal(visibleMapPolygon(rect(-100, -100, -10, -10), 64).length, 0);
  const partial = visibleMapPolygon(rect(-10, 10, 20, 40), 64);
  assert.equal(partial.length, 4);
  assert.ok(partial.every(p => p.x >= 0 && p.x <= 20 && p.y >= 10 && p.y <= 40));
});
