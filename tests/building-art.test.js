import test from 'node:test';
import assert from 'node:assert/strict';
import { drawArchitecture } from '../src/building-art.js';
import { CityRenderer } from '../src/renderer.js';
import { PORT_PARTS } from '../src/sim/port-layout.js';

test('detached home structures and paving stay inside their lot at every stage', () => {
  for (const variant of [0.1, 0.35, 0.6, 0.85]) for (let level = 1; level <= 4; level++) {
    const footprints = [];
    const rectangle = (x, y, w, h) => footprints.push([x, y, x + w, y + h]);
    const r = {
      size: 1, rotation: 0, orient: CityRenderer.prototype.orient,
      flat: rectangle, box: rectangle, roof: rectangle, pyramid: rectangle,
      windows: rectangle, fence: rectangle,
      tree: (x, y) => rectangle(x, y, 0, 0),
      project: (x, y, z) => ({ x, y, z }),
      line: (a, b) => footprints.push([a.x, a.y, b.x, b.y]),
    };
    drawArchitecture(r, { x: 0, y: 0, lot: { x: 0, y: 0, w: 1, h: 1 }, type: 'residential', density: 1, level, variant, age: 10 });
    for (const footprint of footprints) assert.ok(footprint.every(v => v >= 0 && v <= 1), `Lot overflow for style ${variant}, stage ${level}: ${footprint}`);
  }
});

// Every port module has a fixed footprint; its procedural recipe stays inside it.
test('port module artwork stays inside its lot', () => {
  for (const [type, parts] of Object.entries(PORT_PARTS)) {
    for (const [part, spec] of Object.entries(parts)) {
      const { w, h } = spec;
      const footprints = [];
      const rectangle = (x, y, bw, bh) => footprints.push([x, y, x + bw, y + bh]);
      const r = {
        size: 1, rotation: 0, orient: CityRenderer.prototype.orient,
        flat: rectangle, box: rectangle, roof: rectangle, pyramid: rectangle,
        windows: rectangle, fence: rectangle,
        cylinder: (x, y, rad) => rectangle(x - rad, y - rad, rad * 2, rad * 2),
        tree: (x, y) => rectangle(x, y, 0, 0),
        project: (x, y, z) => ({ x, y, z }),
        line: (a, b) => footprints.push([a.x, a.y, b.x, b.y]),
      };
      drawArchitecture(r, { x: 0, y: 0, lot: { x: 0, y: 0, w, h }, type, part, density: 1, level: 1, variant: 0.4, age: 10 });
      assert.ok(footprints.length > 4, `${type} ${part} drew almost nothing`);
      for (const f of footprints) {
        assert.ok(f[0] >= -0.01 && f[2] <= w + 0.01 && f[1] >= -0.01 && f[3] <= h + 0.01,
          `${type} ${w}x${h} overflows its lot: ${f}`);
      }
    }
  }
});
