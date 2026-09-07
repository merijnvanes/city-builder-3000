import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { CIVIC_SPRITES } from '../src/civic-sprite-manifest.js';
import { BUILDINGS } from '../src/sim/catalog.js';

test('every civic building ships all four angles and three lighting states', () => {
  const expected = Object.entries(BUILDINGS).filter(([, s]) => s.group === 'civic').map(([type]) => type).sort();
  assert.deepEqual(Object.keys(CIVIC_SPRITES).sort(), expected);
  let compressedBytes = 0;
  for (const [type, spec] of Object.entries(CIVIC_SPRITES)) {
    assert.equal(spec.tiles, BUILDINGS[type].w);
    assert.equal(BUILDINGS[type].w, BUILDINGS[type].h);
    assert.equal(Object.keys(spec.frames).length, 12);
    assert.ok(spec.height > 0 && spec.height < 150);
    for (const state of ['day', 'night', 'unpowered']) for (let rotation = 0; rotation < 4; rotation++) {
      const frame = spec.frames[`${state}-${rotation}`];
      const url = new URL(`../public/assets/civic/${frame.file}`, import.meta.url);
      const data = readFileSync(url);
      assert.equal(data.toString('ascii', 0, 4), 'RIFF');
      assert.equal(data.toString('ascii', 8, 12), 'WEBP');
      assert.ok(frame.width > 0 && frame.height > 0);
      assert.ok(frame.anchor[0] > 0 && frame.anchor[0] < frame.width);
      assert.ok(frame.anchor[1] > 0 && frame.anchor[1] < frame.height);
      compressedBytes += statSync(url).size;
    }
  }
  assert.ok(compressedBytes < 6 * 1024 * 1024, 'the full civic asset set stays below 6 MiB');
});
