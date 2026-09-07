import test from 'node:test';
import assert from 'node:assert/strict';
import { drawArchitecture, heightOf } from '../src/building-art.js';
import { CityRenderer } from '../src/renderer.js';
import { BUILDINGS } from '../src/sim/catalog.js';

const civic = Object.entries(BUILDINGS).filter(([, spec]) => spec.group === 'civic');

test('every civic campus keeps solid geometry inside its lot and advertised height', () => {
  for (const [type, spec] of civic) for (let rotation = 0; rotation < 4; rotation++) {
    const tile = { type, x: 0, y: 0, lot: { x: 0, y: 0, w: spec.w, h: spec.h }, age: 10 };
    const check = (x, y, z = 0) => {
      assert.ok([x, y, z].every(Number.isFinite), `${type}: finite coordinates`);
      assert.ok(x >= 0 && x <= spec.w && y >= 0 && y <= spec.h, `${type}: lot overflow at ${x},${y}`);
      assert.ok(z <= heightOf(tile) + 0.01, `${type}: height ${z} exceeds ${heightOf(tile)}`);
    };
    const flat = (x, y, w, h, z) => { check(x, y, z); check(x + w, y + h, z); };
    const r = {
      rotation, size: spec.w, orient: CityRenderer.prototype.orient,
      flat, box: (x, y, w, h, height, color, z = 0) => flat(x, y, w, h, z + height),
      roof: (x, y, w, h, z, height) => flat(x, y, w, h, z + height),
      pyramid: (x, y, w, h, z, height) => flat(x, y, w, h, z + height),
      cylinder: (x, y, radius, height, color, z = 0) => flat(x - radius, y - radius, radius * 2, radius * 2, z + height),
      project: (x, y, z) => ({ x, y, z }),
      line: (a, b) => { check(a.x, a.y, a.z); check(b.x, b.y, b.z); },
      faces: () => [], windows: () => {}, fence: (x, y, w, h) => flat(x, y, w, h, 0), tree: (x, y) => check(x, y),
    };
    drawArchitecture(r, tile);
  }
});

test('hospital facade crosses appear only on the visible wall at every camera angle', () => {
  for (let rotation = 0; rotation < 4; rotation++) {
    const crosses = [];
    const r = {
      rotation, size: 3, orient: CityRenderer.prototype.orient,
      box: (x, y, w, h, height, color) => { if (color === '#d9504b') crosses.push(y); },
      flat() {}, windows() {}, tree() {}, faces: () => [], project: (x, y, z) => ({ x, y, z }), line() {},
    };
    drawArchitecture(r, { type: 'hospital', x: 0, y: 0, lot: { x: 0, y: 0, w: 3, h: 3 }, age: 10 });
    assert.equal(crosses.length, 2);
    assert.ok(crosses.every(y => Math.abs(y - ([0, 3].includes(rotation) ? 0.552 : 0.168) * 3) < 1e-8));
  }
});
