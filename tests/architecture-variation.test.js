import test from 'node:test';
import assert from 'node:assert/strict';
import { random, spriteVariant, spriteFrameKey } from '../src/architecture-variation.js';

test('small parks preserve the original three layout ranges, including boundaries', () => {
  for (const [seed, expected] of [[0,0],[1/3-Number.EPSILON,0],[1/3,1],[2/3-Number.EPSILON,1],[2/3,2],[.999999,2]]) {
    const tile = { type:'park', x:5, y:9, variant:seed };
    assert.equal(spriteVariant(tile, 3), expected);
    assert.equal(spriteVariant(JSON.parse(JSON.stringify(tile)), 3), expected);
    assert.equal(spriteVariant({...tile,x:90,y:13}, 3), expected, 'saved seed takes precedence over coordinates');
  }
});

test('parks without a saved seed retain original coordinate selection', () => {
  const seen = new Set();
  for (let y=0;y<16;y++) for (let x=0;x<16;x++) {
    const value = Math.sin(x*127.1+y*311.7)*43758.5453;
    const expected = Math.floor((value-Math.floor(value))*3);
    assert.equal(random(x,y), value-Math.floor(value));
    assert.equal(spriteVariant({x,y},3),expected);
    seen.add(expected);
  }
  assert.equal(seen.size,3);
});

test('single-layout assets keep legacy frame keys; variants have distinct stable keys', () => {
  assert.equal(spriteVariant({},1),0);
  for (const state of ['day','night','unpowered']) for (let rotation=0;rotation<4;rotation++) {
    assert.equal(spriteFrameKey(state,rotation,0),`${state}-${rotation}`);
    assert.equal(spriteFrameKey(state,rotation,1),`${state}-${rotation}-v1`);
    assert.equal(spriteFrameKey(state,rotation,2),`${state}-${rotation}-v2`);
  }
});


test('five-way palettes preserve all five normalized seed ranges', () => {
  for (let index = 0; index < 5; index++) {
    const tile = { x: 7, y: 13, variant: index / 5 };
    assert.equal(spriteVariant(tile, 5), index);
    assert.equal(spriteVariant(JSON.parse(JSON.stringify(tile)), 5), index);
    if (index) assert.equal(spriteVariant({ ...tile, variant: index / 5 - Number.EPSILON }, 5), index - 1);
  }
  for (let x = 0; x < 20; x++) assert.equal(spriteVariant({ x, y: 13 }, 5), Math.floor(random(x, 13) * 5));
});


test('stadium palettes preserve the original half-seed boundary', () => {
  for (const [variant, expected] of [[0,0],[.5-Number.EPSILON,0],[.5,1],[.9999,1]]) {
    const tile = { x: 3, y: 5, variant };
    assert.equal(spriteVariant(tile, 2), expected);
    assert.equal(spriteVariant(JSON.parse(JSON.stringify(tile)), 2), expected);
  }
});

test('business deal palettes remain deterministic across saves and coordinates', () => {
  for (const count of [3,4,5]) for (let index=0;index<count;index++) {
    const tile={x:7,y:11,variant:(index+.5)/count};
    assert.equal(spriteVariant(tile,count),index);
    assert.equal(spriteVariant({...JSON.parse(JSON.stringify(tile)),x:40},count),index);
  }
});
