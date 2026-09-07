import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { CIVIC_SPRITES } from '../src/civic-sprite-manifest.js';
import { belongsToFamily, FAMILY_COUNTS, EXPECTED_VARIANTS } from './art-families.mjs';
import { BUILDINGS } from '../src/sim/catalog.js';

test('every authored building family ships all four angles and three lighting states', () => {
  const expected = Object.entries(BUILDINGS).filter(([, s]) => Object.keys(FAMILY_COUNTS).some(f => belongsToFamily(s, f))).map(([type]) => type).sort();
  assert.deepEqual(Object.keys(CIVIC_SPRITES).sort(), expected);
  const registry = JSON.parse(readFileSync(new URL('../tools/civic_art/registry.json', import.meta.url)));
  assert.deepEqual(Object.keys(registry).sort(), expected);
  let compressedBytes = 0, parksBytes = 0, transportBytes = 0;
  for (const [type, spec] of Object.entries(CIVIC_SPRITES)) {
    assert.equal(spec.label, registry[type].label);
    assert.equal(spec.description, registry[type].description);
    assert.ok(spec.label && spec.description);
    assert.equal(spec.family, Object.keys(FAMILY_COUNTS).find(f => belongsToFamily(BUILDINGS[type], f)));
    const footprint = spec.footprint || { w: spec.tiles, h: spec.tiles };
    assert.deepEqual(footprint, registry[type].footprint || { w: registry[type].tiles, h: registry[type].tiles });
    assert.deepEqual(footprint, { w: BUILDINGS[type].w, h: BUILDINGS[type].h });
    const variants = EXPECTED_VARIANTS[type] || 1;
    assert.equal(spec.variants?.length || 1, variants);
    assert.deepEqual(spec.variants, registry[type].variants);
    assert.equal(Object.keys(spec.frames).length, 12 * variants);
    assert.ok(spec.height > 0 && spec.height < 150);
    for (let variant = 0; variant < variants; variant++)
    for (const state of ['day', 'night', 'unpowered']) for (let rotation = 0; rotation < 4; rotation++) {
      const frame = spec.frames[`${state}-${rotation}${variant?`-v${variant}`:''}`];
      const url = new URL(`../public/assets/civic/${frame.file}`, import.meta.url);
      const data = readFileSync(url);
      assert.equal(data.toString('ascii', 0, 4), 'RIFF');
      assert.equal(data.toString('ascii', 8, 12), 'WEBP');
      assert.ok(frame.width > 0 && frame.height > 0);
      assert.ok(frame.anchor[0] > 0 && frame.anchor[0] < frame.width);
      assert.ok(frame.anchor[1] > 0 && frame.anchor[1] < frame.height);
      if (spec.family === 'transport') transportBytes += statSync(url).size;
      else if (spec.family === 'parks') parksBytes += statSync(url).size;
      else compressedBytes += statSync(url).size;
    }
  }
  // Each new family has a separate budget; earlier ceilings remain unchanged.
  assert.ok(transportBytes < 4 * 1024 * 1024, '108 transport frames stay below 4 MiB');
  assert.ok(parksBytes < 0.75 * 1024 * 1024, '60 park frames stay below 0.75 MiB');
  assert.ok(compressedBytes < 6 * 1024 * 1024, 'the combined civic/power/water asset set stays below 6 MiB');
});
