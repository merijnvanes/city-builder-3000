import test from 'node:test';
import assert from 'node:assert/strict';
import { CIVIC_SPRITES } from '../src/civic-sprite-manifest.js';
import { drawCivicSprite, preloadCivicSprites, civicSpriteSpec } from '../src/civic-sprites.js';
import { heightOf } from '../src/building-art.js';
import { CityRenderer } from '../src/renderer.js';

test('rectangular frames retain their scale and world-center anchor in every view', async () => {
  const previousImage = globalThis.Image, previousDocument = globalThis.document;
  globalThis.Image = class { set src(value) { queueMicrotask(() => this.onload()); } };
  globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }) }) };
  // Deliberately asymmetric frames catch swapped dimensions and square centering.
  CIVIC_SPRITES.rectangleFixture = { footprint: { w: 6, h: 5 }, scale: 3, frames: Object.fromEntries(
    ['day', 'night', 'unpowered'].flatMap(state => Array.from({ length: 4 }, (_, rotation) => [
      `${state}-${rotation}`, { file: `fixture-${state}-${rotation}`, width: 900, height: 600, anchor: [413, 477] },
    ]))) };
  try {
    const lot = { x: 3, y: 7, w: 6, h: 5 };
    for (const state of ['day', 'night', 'unpowered']) for (let rotation = 0; rotation < 4; rotation++) {
      const night = state !== 'day', powered = state !== 'unpowered';
      await preloadCivicSprites({ types: ['rectangleFixture'], rotation, night, powered });
      const draws = [];
      const r = Object.assign(Object.create(CityRenderer.prototype), {
        size: 32, w: 900, h: 700, panX: 0, panY: 0, platform: 0, zoom: 1.75, dpr: 2, rotation, night,
        base: { save() {}, restore() {}, drawImage(...args) { draws.push(args); } },
      });
      const tile = { type: 'rectangleFixture', lot, powered };
      const bounds = drawCivicSprite(r, tile), center = r.project(6, 9.5);
      assert.equal(draws.length, 1);
      assert.equal(bounds.w, 900 * 1.75 / 3);
      assert.equal(bounds.h, 600 * 1.75 / 3);
      assert.ok(Math.abs(bounds.x + 413 * 1.75 / 3 - center.x) <= .25);
      assert.ok(Math.abs(bounds.y + 477 * 1.75 / 3 - center.y) <= .25);
      for (const [w, h] of [[5, 6], [6, 6], [5, 5]]) {
        assert.equal(drawCivicSprite(r, { ...tile, lot: { ...lot, w, h } }), null);
      }
    }
  } finally {
    delete CIVIC_SPRITES.rectangleFixture;
    globalThis.Image = previousImage; globalThis.document = previousDocument;
  }
});


test('port modules draw their own sprite and keep a procedural height otherwise', () => {
  for (const [type, part, w, h, fallbackHeight] of [['airport', 'terminal', 2, 2, 22], ['seaport', 'quay', 1, 1, 20]]) {
    const tile = { type, part, lot: { x: 0, y: 0, w, h } };
    assert.equal(civicSpriteSpec(tile), CIVIC_SPRITES[`${type}-${part}`]);
    assert.equal(heightOf(tile), CIVIC_SPRITES[`${type}-${part}`].height);
    for (const lot of [{ ...tile.lot, w: w + 1 }, { ...tile.lot, h: h + 1 }]) {
      assert.equal(civicSpriteSpec({ ...tile, lot }), null);
      assert.equal(heightOf({ ...tile, lot }), fallbackHeight);
    }
    // A port lot without a module, or a zone tile without a lot, has no art.
    assert.equal(civicSpriteSpec({ type, lot: tile.lot }), null);
    assert.equal(civicSpriteSpec({ type }), null);
    assert.equal(heightOf({ type }), 0);
  }
});
