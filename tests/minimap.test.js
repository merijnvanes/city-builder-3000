import test from 'node:test';
import assert from 'node:assert/strict';
import { mapPoint, worldPoint, visibleMapPolygon } from '../src/minimap-geometry.js';

test('minimap corners point up, right, down and left', () => {
  assert.deepEqual(mapPoint(0, 0, 64), { x: 80, y: 16 });
  assert.deepEqual(mapPoint(64, 0, 64), { x: 144, y: 80 });
  assert.deepEqual(mapPoint(64, 64, 64), { x: 80, y: 144 });
  assert.deepEqual(mapPoint(0, 64, 64), { x: 16, y: 80 });
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
