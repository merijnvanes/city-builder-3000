// construction.test.js — Focused behaviour tests for construction.js
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createCity } from '../src/sim.js';
import { planConstruction, applyConstruction, createUndoManager } from '../src/construction.js';

// ── helpers ─────────────────────────────────────────────────────────────────

function blankCity() {
  return createCity(1, false); // no starter, $50000
}

function tileAt(city, x, y) {
  return city.tiles[y * city.size + x];
}

function assertInvalid(plan, msgContains) {
  assert.equal(plan.valid, false, `Expected invalid plan, got: ${plan.message}`);
  if (msgContains) {
    assert.ok(
      plan.message.toLowerCase().includes(msgContains.toLowerCase()),
      `Expected message to contain "${msgContains}", got: "${plan.message}"`
    );
  }
}

// ── planConstruction — arg validation ────────────────────────────────────────

describe('planConstruction arg validation', () => {
  test('null city returns invalid', () => {
    assertInvalid(planConstruction(null, { x: 0, y: 0 }, { x: 1, y: 1 }, 'road'));
  });

  test('non-object city returns invalid', () => {
    assertInvalid(planConstruction('bad', { x: 0, y: 0 }, { x: 1, y: 1 }, 'road'));
  });

  test('unknown tool returns invalid', () => {
    const city = blankCity();
    assertInvalid(planConstruction(city, { x: 0, y: 0 }, { x: 0, y: 0 }, 'laser'));
  });

  test('non-string tool returns invalid', () => {
    const city = blankCity();
    assertInvalid(planConstruction(city, { x: 0, y: 0 }, { x: 0, y: 0 }, 42));
  });

  test('negative coords produce invalid tiles', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: -1, y: 0 }, { x: -1, y: 0 }, 'road');
    // Single tile plan: -1,0 is out of bounds → invalid
    assert.equal(plan.valid, false);
  });

  test('fractional coords return invalid', () => {
    const city = blankCity();
    assertInvalid(planConstruction(city, { x: 0.5, y: 0 }, { x: 1, y: 1 }, 'road'));
  });

  test('density 0 returns invalid', () => {
    const city = blankCity();
    assertInvalid(planConstruction(city, { x: 0, y: 0 }, { x: 2, y: 2 }, 'residential', { density: 0 }));
  });

  test('density 4 returns invalid', () => {
    const city = blankCity();
    assertInvalid(planConstruction(city, { x: 0, y: 0 }, { x: 2, y: 2 }, 'residential', { density: 4 }));
  });

  test('null start returns invalid', () => {
    const city = blankCity();
    assertInvalid(planConstruction(city, null, { x: 0, y: 0 }, 'road'));
  });
});

// ── planConstruction — new hardening (regression) ───────────────────────────

describe('planConstruction hardening', () => {
  test('enormous coords rejected before allocating arrays', () => {
    const city = blankCity();
    assertInvalid(
      planConstruction(city, { x: 0, y: 0 }, { x: 999999, y: 999999 }, 'residential'),
      'too large'
    );
  });

  test('enormous path coords rejected before allocating arrays', () => {
    const city = blankCity();
    assertInvalid(
      planConstruction(city, { x: 0, y: 0 }, { x: 999999, y: 0 }, 'road'),
      'too large'
    );
  });

  test('null options handled safely (density defaults to 1)', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: 1, y: 1 }, { x: 1, y: 1 }, 'road', null);
    assert.equal(plan.density, 1);
    assert.equal(plan.valid, true);
  });

  test('prototype key "toString" rejected as tool', () => {
    const city = blankCity();
    assertInvalid(planConstruction(city, { x: 0, y: 0 }, { x: 0, y: 0 }, 'toString'));
  });

  test('prototype key "constructor" rejected as tool', () => {
    const city = blankCity();
    assertInvalid(planConstruction(city, { x: 0, y: 0 }, { x: 0, y: 0 }, 'constructor'));
  });

  test('city.size !== 40 rejected', () => {
    const city = blankCity();
    city.size = 20;
    assertInvalid(planConstruction(city, { x: 0, y: 0 }, { x: 0, y: 0 }, 'road'), 'size');
  });

  test('city.tiles.length !== 1600 rejected', () => {
    const city = blankCity();
    city.tiles = city.tiles.slice(0, 800);
    assertInvalid(planConstruction(city, { x: 0, y: 0 }, { x: 0, y: 0 }, 'road'), '1600');
  });

  test('non-safe-integer money rejected', () => {
    const city = blankCity();
    city.money = Number.MAX_SAFE_INTEGER + 1;
    assertInvalid(planConstruction(city, { x: 0, y: 0 }, { x: 0, y: 0 }, 'road'), 'money');
  });

  test('plan.affordable false when cost exceeds city.money', () => {
    const city = blankCity();
    city.money = 10;
    const plan = planConstruction(city, { x: 1, y: 1 }, { x: 1, y: 1 }, 'road');
    assert.equal(plan.valid, true);   // tile itself is buildable
    assert.equal(plan.affordable, false);
    assert.equal(plan.tiles[0].valid, true); // individual tile metadata unchanged
  });

  test('plan.affordable true when cost fits budget', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: 1, y: 1 }, { x: 1, y: 1 }, 'road');
    assert.equal(plan.affordable, true);
  });
});

// ── planConstruction — shape ─────────────────────────────────────────────────

describe('planConstruction shape', () => {
  test('single tile for inspect', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: 2, y: 2 }, { x: 5, y: 5 }, 'inspect');
    assert.equal(plan.tiles.length, 1);
    assert.equal(plan.tiles[0].x, 5);
    assert.equal(plan.tiles[0].y, 5);
  });

  test('zone gives rectangle inclusive', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: 1, y: 1 }, { x: 3, y: 2 }, 'residential');
    // 3×2 = 6 tiles
    assert.equal(plan.tiles.length, 6);
  });

  test('road gives L-path horizontal first when dx >= dy', () => {
    const city = blankCity();
    // dx=3, dy=1 → horizontal leg first
    const plan = planConstruction(city, { x: 0, y: 0 }, { x: 3, y: 1 }, 'road');
    // Horizontal: 0,0 1,0 2,0 3,0 then vertical: 3,1 → 5 tiles
    assert.equal(plan.tiles.length, 5);
    assert.equal(plan.tiles[0].x, 0); assert.equal(plan.tiles[0].y, 0);
    assert.equal(plan.tiles[3].x, 3); assert.equal(plan.tiles[3].y, 0);
    assert.equal(plan.tiles[4].x, 3); assert.equal(plan.tiles[4].y, 1);
  });

  test('road gives L-path vertical first when dy > dx', () => {
    const city = blankCity();
    // dx=1, dy=3 → vertical leg first
    const plan = planConstruction(city, { x: 0, y: 0 }, { x: 1, y: 3 }, 'road');
    // Vertical: 0,0 0,1 0,2 0,3 then horizontal: 1,3 → 5 tiles
    assert.equal(plan.tiles.length, 5);
    assert.equal(plan.tiles[0].x, 0); assert.equal(plan.tiles[0].y, 0);
    assert.equal(plan.tiles[3].x, 0); assert.equal(plan.tiles[3].y, 3);
    assert.equal(plan.tiles[4].x, 1); assert.equal(plan.tiles[4].y, 3);
  });

  test('single-point path gives one tile', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: 5, y: 5 }, { x: 5, y: 5 }, 'road');
    assert.equal(plan.tiles.length, 1);
  });

  test('park zone gives rectangle', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: 0, y: 0 }, { x: 1, y: 1 }, 'park');
    assert.equal(plan.tiles.length, 4);
  });
});

// ── planConstruction — eligibility ───────────────────────────────────────────

describe('planConstruction eligibility', () => {
  test('empty grass tile is valid for road', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: 5, y: 5 }, { x: 5, y: 5 }, 'road');
    assert.equal(plan.tiles[0].valid, true);
    assert.equal(plan.tiles[0].cost, 50);
    assert.equal(plan.valid, true);
  });

  test('water tile is valid for road (bridge)', () => {
    const city = blankCity();
    // Find a water tile
    const waterTile = city.tiles.find(t => t.terrain === 'water');
    assert.ok(waterTile, 'No water tile found');
    const plan = planConstruction(city, { x: waterTile.x, y: waterTile.y }, { x: waterTile.x, y: waterTile.y }, 'road');
    assert.equal(plan.tiles[0].valid, true);
  });

  test('water tile is invalid for residential', () => {
    const city = blankCity();
    const waterTile = city.tiles.find(t => t.terrain === 'water');
    assert.ok(waterTile);
    const plan = planConstruction(city, { x: waterTile.x, y: waterTile.y }, { x: waterTile.x, y: waterTile.y }, 'residential');
    assert.equal(plan.tiles[0].valid, false);
    assert.equal(plan.valid, false);
  });

  test('water tile is invalid for rail', () => {
    const city = blankCity();
    const waterTile = city.tiles.find(t => t.terrain === 'water');
    assert.ok(waterTile);
    const plan = planConstruction(city, { x: waterTile.x, y: waterTile.y }, { x: waterTile.x, y: waterTile.y }, 'rail');
    assert.equal(plan.tiles[0].valid, false);
  });

  test('occupied tile blocked for residential', () => {
    const city = blankCity();
    // Place a road first by direct mutation
    tileAt(city, 10, 10).type = 'road';
    const plan = planConstruction(city, { x: 10, y: 10 }, { x: 10, y: 10 }, 'residential');
    assert.equal(plan.tiles[0].valid, false);
    assert.equal(plan.valid, false);
  });

  test('road on existing road is noop (zero cost, valid)', () => {
    const city = blankCity();
    tileAt(city, 5, 5).type = 'road';
    const plan = planConstruction(city, { x: 5, y: 5 }, { x: 5, y: 5 }, 'road');
    assert.equal(plan.tiles[0].valid, true);
    assert.equal(plan.tiles[0].cost, 0);
    // Noop tiles don't count toward eligible count
    assert.equal(plan.count, 0);
    assert.equal(plan.valid, false); // no actionable tiles
  });

  test('same zone same density is noop', () => {
    const city = blankCity();
    const t = tileAt(city, 3, 3);
    t.type = 'residential';
    t.density = 2;
    const plan = planConstruction(city, { x: 3, y: 3 }, { x: 3, y: 3 }, 'residential', { density: 2 });
    assert.equal(plan.tiles[0].valid, true);
    assert.equal(plan.tiles[0].cost, 0);
    assert.equal(plan.count, 0);
  });

  test('same zone different density is valid rezone', () => {
    const city = blankCity();
    const t = tileAt(city, 3, 3);
    t.type = 'residential';
    t.density = 1;
    const plan = planConstruction(city, { x: 3, y: 3 }, { x: 3, y: 3 }, 'residential', { density: 3 });
    assert.equal(plan.tiles[0].valid, true);
    assert.ok(plan.tiles[0].cost > 0);
    assert.equal(plan.count, 1);
  });

  test('zone cost scales with density', () => {
    const city = blankCity();
    const plan1 = planConstruction(city, { x: 2, y: 2 }, { x: 2, y: 2 }, 'residential', { density: 1 });
    const plan3 = planConstruction(city, { x: 4, y: 4 }, { x: 4, y: 4 }, 'residential', { density: 3 });
    assert.equal(plan3.tiles[0].cost, plan1.tiles[0].cost * 3);
  });

  test('mixed valid/blocked rectangle: partial validity', () => {
    const city = blankCity();
    // Block tile (2,2)
    tileAt(city, 2, 2).type = 'road';
    const plan = planConstruction(city, { x: 1, y: 1 }, { x: 3, y: 3 }, 'residential');
    // 9 tiles total, 1 blocked (road), 8 empty grass tiles
    const validCount = plan.tiles.filter(t => t.valid).length;
    const invalidCount = plan.tiles.filter(t => !t.valid).length;
    assert.equal(plan.tiles.length, 9);
    assert.ok(invalidCount >= 1); // at least the road tile is blocked
    assert.equal(plan.valid, true); // still has valid tiles
  });

  test('powerline can overlay road tile', () => {
    const city = blankCity();
    tileAt(city, 5, 5).type = 'road';
    const plan = planConstruction(city, { x: 5, y: 5 }, { x: 5, y: 5 }, 'powerline');
    assert.equal(plan.tiles[0].valid, true);
    assert.ok(plan.tiles[0].cost > 0);
  });

  test('powerline blocked on water (no road)', () => {
    const city = blankCity();
    const waterTile = city.tiles.find(t => t.terrain === 'water');
    assert.ok(waterTile);
    const plan = planConstruction(city, { x: waterTile.x, y: waterTile.y }, { x: waterTile.x, y: waterTile.y }, 'powerline');
    assert.equal(plan.tiles[0].valid, false);
  });

  test('bulldoze on empty tile is invalid', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: 1, y: 1 }, { x: 1, y: 1 }, 'bulldoze');
    assert.equal(plan.tiles[0].valid, false);
  });

  test('bulldoze on occupied tile is valid with net cost', () => {
    const city = blankCity();
    tileAt(city, 5, 5).type = 'road';
    const plan = planConstruction(city, { x: 5, y: 5 }, { x: 5, y: 5 }, 'bulldoze');
    assert.equal(plan.tiles[0].valid, true);
    assert.equal(plan.count, 1);
    // Road costs 50, refund = floor(50*0.25)=12, fee=25, net = 25-12 = 13
    assert.equal(plan.tiles[0].cost, 13);
  });
});

// ── applyConstruction ────────────────────────────────────────────────────────

describe('applyConstruction', () => {
  test('applies valid single road tile', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: 1, y: 1 }, { x: 1, y: 1 }, 'road');
    const before = city.money;
    const result = applyConstruction(city, plan);
    assert.equal(result.ok, true);
    assert.equal(result.changed, 1);
    assert.equal(tileAt(city, 1, 1).type, 'road');
    assert.equal(city.money, before - 50);
  });

  test('returns false with no mutation when insufficient funds', () => {
    const city = blankCity();
    city.money = 10; // too low
    const plan = planConstruction(city, { x: 1, y: 1 }, { x: 1, y: 1 }, 'road');
    const result = applyConstruction(city, plan);
    assert.equal(result.ok, false);
    assert.equal(result.changed, 0);
    assert.equal(tileAt(city, 1, 1).type, 'empty'); // unchanged
    assert.equal(city.money, 10); // unchanged
  });

  test('returns false when plan has no valid tiles', () => {
    const city = blankCity();
    tileAt(city, 5, 5).type = 'road';
    const plan = planConstruction(city, { x: 5, y: 5 }, { x: 5, y: 5 }, 'residential');
    const result = applyConstruction(city, plan);
    assert.equal(result.ok, false);
    assert.equal(result.changed, 0);
  });

  test('skips blocked tiles but commits eligible ones (batch atomic per eligible)', () => {
    const city = blankCity();
    // Block (2,2), leave (1,1) and (3,3) free
    tileAt(city, 2, 2).type = 'road';
    // Plan a 3x3 residential zone (9 tiles, 1 blocked)
    const plan = planConstruction(city, { x: 1, y: 1 }, { x: 3, y: 3 }, 'residential');
    assert.ok(plan.valid);
    const result = applyConstruction(city, plan);
    assert.equal(result.ok, true);
    assert.ok(result.changed >= 1);
    // The road tile must remain road
    assert.equal(tileAt(city, 2, 2).type, 'road');
    // Other tiles should be residential
    assert.equal(tileAt(city, 1, 1).type, 'residential');
  });

  test('zone applies correct density', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: 5, y: 5 }, { x: 5, y: 5 }, 'residential', { density: 3 });
    applyConstruction(city, plan);
    assert.equal(tileAt(city, 5, 5).type, 'residential');
    assert.equal(tileAt(city, 5, 5).density, 3);
  });

  test('powerline sets powerline flag on tile', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: 3, y: 3 }, { x: 3, y: 3 }, 'powerline');
    const result = applyConstruction(city, plan);
    assert.equal(result.ok, true);
    assert.equal(tileAt(city, 3, 3).powerline, true);
  });

  test('pipe sets pipe flag on tile', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: 3, y: 3 }, { x: 3, y: 3 }, 'pipe');
    const result = applyConstruction(city, plan);
    assert.equal(result.ok, true);
    assert.equal(tileAt(city, 3, 3).pipe, true);
  });

  test('returns false when null plan', () => {
    const city = blankCity();
    const result = applyConstruction(city, null);
    assert.equal(result.ok, false);
  });

  test('revalidates plan against current city (stale plan)', () => {
    const city = blankCity();
    // Make plan when tile is empty
    const plan = planConstruction(city, { x: 7, y: 7 }, { x: 7, y: 7 }, 'residential');
    assert.equal(plan.valid, true);
    // Now occupy the tile before applying
    tileAt(city, 7, 7).type = 'road';
    const result = applyConstruction(city, plan);
    // Should find no eligible tiles and fail
    assert.equal(result.ok, false);
    assert.equal(result.changed, 0);
  });

  test('city revision bumps on successful apply', () => {
    const city = blankCity();
    const rev = city.revision;
    const plan = planConstruction(city, { x: 1, y: 1 }, { x: 1, y: 1 }, 'road');
    applyConstruction(city, plan);
    assert.ok(city.revision > rev);
  });

  test('cost matches plan.cost for simple build', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: 2, y: 2 }, { x: 4, y: 2 }, 'road');
    const result = applyConstruction(city, plan);
    assert.equal(result.cost, plan.cost);
  });
});

// ── applyConstruction — regression tests ────────────────────────────────────

describe('applyConstruction hardening', () => {
  test('malformed plan (tiles not array) returns false without mutation', () => {
    const city = blankCity();
    const moneyBefore = city.money;
    const result = applyConstruction(city, { tool: 'road', tiles: 'not-array', density: 1 });
    assert.equal(result.ok, false);
    assert.equal(city.money, moneyBefore);
  });

  test('malformed plan (tool not string) returns false without mutation', () => {
    const city = blankCity();
    const moneyBefore = city.money;
    const result = applyConstruction(city, { tool: 42, tiles: [], density: 1 });
    assert.equal(result.ok, false);
    assert.equal(city.money, moneyBefore);
  });

  test('plan with >1600 tile entries returns false without mutation', () => {
    const city = blankCity();
    const moneyBefore = city.money;
    const manyTiles = Array.from({ length: 1601 }, () => ({ x: 0, y: 0 }));
    const result = applyConstruction(city, { tool: 'road', tiles: manyTiles, density: 1 });
    assert.equal(result.ok, false);
    assert.equal(city.money, moneyBefore);
  });

  test('invalid plan density returns false without mutation', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: 1, y: 1 }, { x: 1, y: 1 }, 'residential');
    plan.density = 5; // force invalid
    const moneyBefore = city.money;
    const result = applyConstruction(city, plan);
    assert.equal(result.ok, false);
    assert.equal(city.money, moneyBefore);
  });

  test('duplicate coordinates in plan tiles are deduplicated (placed once)', () => {
    const city = blankCity();
    const plan = planConstruction(city, { x: 1, y: 1 }, { x: 1, y: 1 }, 'road');
    // Inject duplicate tile entries
    plan.tiles = [...plan.tiles, ...plan.tiles];
    const result = applyConstruction(city, plan);
    assert.equal(result.ok, true);
    assert.equal(result.changed, 1); // only the one unique tile
  });

  test('density downgrade caps tile level to new density', () => {
    const city = blankCity();
    const t = tileAt(city, 5, 5);
    t.type = 'residential';
    t.density = 3;
    t.level = 3;
    const plan = planConstruction(city, { x: 5, y: 5 }, { x: 5, y: 5 }, 'residential', { density: 1 });
    assert.equal(plan.valid, true);
    const result = applyConstruction(city, plan);
    assert.equal(result.ok, true);
    assert.equal(tileAt(city, 5, 5).density, 1);
    assert.equal(tileAt(city, 5, 5).level, 1); // capped at new density
  });

  test('failed apply (no eligible tiles) leaves city state and revision unchanged', () => {
    const city = blankCity();
    // Build road first so revision advances
    const roadPlan = planConstruction(city, { x: 0, y: 0 }, { x: 0, y: 0 }, 'road');
    applyConstruction(city, roadPlan);
    const revAfterBuild = city.revision;
    const moneyAfterBuild = city.money;

    // Plan was valid but now the tile is occupied — stale plan, no eligible tiles
    const stalePlan = planConstruction(city, { x: 0, y: 0 }, { x: 0, y: 0 }, 'residential');
    // Force stale: tile was road, residential blocked
    const result = applyConstruction(city, stalePlan);
    assert.equal(result.ok, false);
    assert.equal(result.changed, 0);
    // City state must be exactly as before the failed apply
    assert.equal(city.revision, revAfterBuild);
    assert.equal(city.money, moneyAfterBuild);
    assert.equal(tileAt(city, 0, 0).type, 'road');
  });

  test('no revision change when pre-check fails (insufficient funds)', () => {
    const city = blankCity();
    const rev = city.revision;
    city.money = 10;
    const plan = planConstruction(city, { x: 1, y: 1 }, { x: 1, y: 1 }, 'road');
    const result = applyConstruction(city, plan);
    assert.equal(result.ok, false);
    assert.equal(city.revision, rev);
  });

  test('bulldoze on empty tile with overlay flags removes flags', () => {
    const city = blankCity();
    const t = tileAt(city, 4, 4);
    t.powerline = true;
    const plan = planConstruction(city, { x: 4, y: 4 }, { x: 4, y: 4 }, 'bulldoze');
    assert.equal(plan.valid, true);
    const result = applyConstruction(city, plan);
    assert.equal(result.ok, true);
    assert.equal(tileAt(city, 4, 4).powerline, undefined);
  });
});

// ── createUndoManager ────────────────────────────────────────────────────────

describe('createUndoManager', () => {
  test('starts empty', () => {
    const mgr = createUndoManager();
    assert.equal(mgr.size, 0);
  });

  test('undo on empty returns false', () => {
    const city = blankCity();
    const mgr = createUndoManager();
    assert.equal(mgr.undo(city), false);
  });

  test('record and undo restores city', () => {
    const city = blankCity();
    const mgr = createUndoManager();
    mgr.record(city);
    // Mutate
    tileAt(city, 0, 0).type = 'road';
    city.money -= 50;
    const result = mgr.undo(city);
    assert.equal(result, true);
    assert.equal(tileAt(city, 0, 0).type, 'empty');
  });

  test('undo bumps revision', () => {
    const city = blankCity();
    const mgr = createUndoManager();
    mgr.record(city);
    const rev = city.revision;
    mgr.undo(city);
    assert.ok(city.revision > rev);
  });

  test('size increments with record', () => {
    const city = blankCity();
    const mgr = createUndoManager();
    mgr.record(city);
    mgr.record(city);
    assert.equal(mgr.size, 2);
  });

  test('clear empties the stack', () => {
    const city = blankCity();
    const mgr = createUndoManager();
    mgr.record(city);
    mgr.record(city);
    mgr.clear();
    assert.equal(mgr.size, 0);
    assert.equal(mgr.undo(city), false);
  });

  test('respects limit — oldest snapshot evicted', () => {
    const city = blankCity();
    const mgr = createUndoManager(3);
    // Record snapshots at 1000, 2000, 3000 — limit 3, stack=[1000,2000,3000]
    city.money = 1000; mgr.record(city);
    city.money = 2000; mgr.record(city);
    city.money = 3000; mgr.record(city);
    // 4th record evicts $1000 snapshot; stack=[2000,3000,4000]
    city.money = 4000; mgr.record(city);
    assert.equal(mgr.size, 3);
    // Undo 1: pops $4000 snapshot → city.money=4000 (no visible change, was 4000)
    mgr.undo(city);
    // Undo 2: pops $3000 snapshot → city.money=3000
    mgr.undo(city);
    assert.equal(city.money, 3000);
    // Undo 3: pops $2000 snapshot → city.money=2000 (1000 was evicted, 2000 is oldest)
    mgr.undo(city);
    assert.equal(city.money, 2000);
    // Stack exhausted
    assert.equal(mgr.size, 0);
    assert.equal(mgr.undo(city), false);
  });

  test('multiple undos stack correctly', () => {
    const city = blankCity();
    const mgr = createUndoManager();
    city.money = 100;
    mgr.record(city);
    city.money = 200;
    mgr.record(city);
    city.money = 300;
    // Undo to 200
    mgr.undo(city);
    assert.equal(city.money, 200);
    // Undo to 100
    mgr.undo(city);
    assert.equal(city.money, 100);
  });
});

// ── integration: full plan → apply → undo cycle ─────────────────────────────

describe('plan → apply → undo integration', () => {
  test('build road path then undo restores city', () => {
    const city = blankCity();
    const mgr = createUndoManager();
    mgr.record(city);
    const moneyBefore = city.money;
    const plan = planConstruction(city, { x: 0, y: 5 }, { x: 0, y: 8 }, 'road');
    assert.equal(plan.valid, true);
    const result = applyConstruction(city, plan);
    assert.equal(result.ok, true);
    assert.ok(city.money < moneyBefore);
    // Undo
    mgr.undo(city);
    assert.equal(city.money, moneyBefore);
    assert.equal(tileAt(city, 0, 5).type, 'empty');
  });

  test('zone rectangle then check road cost sum', () => {
    const city = blankCity();
    // 2x2 residential at density 2
    const plan = planConstruction(city, { x: 1, y: 1 }, { x: 2, y: 2 }, 'residential', { density: 2 });
    assert.equal(plan.tiles.length, 4);
    // Each tile: residential cost 100 * density 2 = 200
    assert.equal(plan.cost, 800);
  });

  test('not enough funds for large zone is rejected cleanly', () => {
    const city = blankCity();
    city.money = 100;
    const plan = planConstruction(city, { x: 0, y: 0 }, { x: 9, y: 9 }, 'commercial');
    // 100 tiles * 150 = 15000, have 100
    const result = applyConstruction(city, plan);
    assert.equal(result.ok, false);
    assert.equal(result.changed, 0);
    // No tiles should have changed
    for (let y = 0; y <= 9; y++)
      for (let x = 0; x <= 9; x++)
        if (tileAt(city, x, y).terrain !== 'water')
          assert.equal(tileAt(city, x, y).type, 'empty');
  });
});
