import test from 'node:test';
import { expectedZoneEntries } from './zone-art-contract.mjs';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { CIVIC_SPRITES } from '../src/civic-sprite-manifest.js';
import { belongsToFamily, FAMILY_COUNTS, EXPECTED_VARIANTS } from './art-families.mjs';
import { BUILDINGS, PORT_TYPES } from '../src/sim/catalog.js';

test('every authored building family ships all four angles and three lighting states', () => {
  const expected = Object.entries(BUILDINGS).filter(([, s]) => Object.keys(FAMILY_COUNTS).some(f => belongsToFamily(s, f))).map(([type]) => type).sort();
  const zones=expectedZoneEntries();
  // Ports left BUILDINGS when they became zones the player sizes, but they
  // still ship authored transport art. civic-footprint.test.js pins the rest
  // of that arrangement: the sprite draws on a lot matching its baked
  // footprint, and every other size falls back to procedural art.
  const ports=new Set(PORT_TYPES);
  expected.push(...ports);
  expected.push(...zones.map(z=>z.key));expected.sort();
  assert.deepEqual(Object.keys(CIVIC_SPRITES).sort(), expected);
  const registry = JSON.parse(readFileSync(new URL('../tools/civic_art/registry.json', import.meta.url)));
  assert.deepEqual(Object.keys(registry).sort(), expected);
  let compressedBytes = 0, parksBytes = 0, transportBytes = 0, rewardsBytes = 0, dealsBytes = 0, landmarksBytes = 0, residentialBytes = 0, commercialBytes = 0, industrialBytes = 0;
  for (const [type, spec] of Object.entries(CIVIC_SPRITES)) {
    const lighting=JSON.parse(readFileSync(new URL('../src/sunlight-config.json',import.meta.url)));
    assert.equal(spec.lighting,lighting.version,`${type} uses the current world lighting`);
    assert.equal(spec.label, registry[type].label);
    assert.equal(spec.description, registry[type].description);
    assert.ok(spec.label && spec.description);
    const zone=zones.find(z=>z.key===type);
    assert.equal(spec.family, zone?.type || (ports.has(type) ? 'transport' : Object.keys(FAMILY_COUNTS).find(f => belongsToFamily(BUILDINGS[type], f))));
    assert.deepEqual(spec.zone, zone ? {type:zone.type,density:zone.density,level:zone.level} : undefined);
    const footprint = spec.footprint || { w: spec.tiles, h: spec.tiles };
    assert.deepEqual(footprint, registry[type].footprint || { w: registry[type].tiles, h: registry[type].tiles });
    // A port has no catalog footprint to check the baked art against; the
    // player draws the lot. Manifest and registry must still agree, above.
    if (!ports.has(type)) assert.deepEqual(footprint, zone ? {w:zone.size,h:zone.size} : { w: BUILDINGS[type].w, h: BUILDINGS[type].h });
    const variants = zone?.variants || EXPECTED_VARIANTS[type] || 1;
    assert.equal(spec.variants?.length || 1, variants);
    assert.deepEqual(spec.variants, registry[type].variants);
    assert.equal(Object.keys(spec.frames).length, 12 * variants);
    assert.ok(spec.height > 0 && spec.height < (spec.family==='commercial'?200:150));
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
      if (spec.family === 'industrial') industrialBytes += statSync(url).size;
      else if (spec.family === 'commercial') commercialBytes += statSync(url).size;
      else if (spec.family === 'residential') residentialBytes += statSync(url).size;
      else if (spec.family === 'landmarks') landmarksBytes += statSync(url).size;
      else if (spec.family === 'deals') dealsBytes += statSync(url).size;
      else if (spec.family === 'rewards') rewardsBytes += statSync(url).size;
      else if (spec.family === 'transport') transportBytes += statSync(url).size;
      else if (spec.family === 'parks') parksBytes += statSync(url).size;
      else compressedBytes += statSync(url).size;
    }
  }
  // Each new family has a separate budget; earlier ceilings remain unchanged.
  assert.ok(industrialBytes < 32 * 1024 * 1024, '1824 industrial frames stay below 32 MiB');
  assert.ok(commercialBytes < 32 * 1024 * 1024, '1632 commercial frames stay below 32 MiB');
  assert.ok(residentialBytes < 24 * 1024 * 1024, '1200 residential frames stay below 24 MiB');
  assert.ok(landmarksBytes < 2 * 1024 * 1024, '60 landmark frames stay below 2 MiB');
  assert.ok(dealsBytes < 5 * 1024 * 1024, '168 business deal frames stay below 5 MiB');
  assert.ok(rewardsBytes < 4 * 1024 * 1024, '108 reward frames stay below 4 MiB');
  assert.ok(transportBytes < 4 * 1024 * 1024, '108 transport frames stay below 4 MiB');
  assert.ok(parksBytes < 0.75 * 1024 * 1024, '60 park frames stay below 0.75 MiB');
  assert.ok(compressedBytes < 6 * 1024 * 1024, 'the combined civic/power/water asset set stays below 6 MiB');
});
