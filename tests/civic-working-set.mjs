// Full-library pressure at city zoom, followed by close-up and async failure races.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const url = process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173';

async function setup(page, portraitHistory = false, zoom = .8) {
  await page.route('**/working-set', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' }));
  await page.goto(`${url}/working-set`);
  return page.evaluate(async ({ portraitHistory, zoom }) => {
    const { CityRenderer } = await import('/src/renderer.js');
    const { preloadCivicSprites, civicSpriteStats, civicSpriteSpec } = await import('/src/building-art.js');
    const { drawCachedArchitecture } = await import('/src/architecture-cache.js');
    const { CIVIC_SPRITES } = await import('/src/civic-sprite-manifest.js');
    let requests = 0;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    Object.defineProperty(HTMLImageElement.prototype, 'src', { ...descriptor, set(value) {
      requests++;
      // Chrome can fulfill a second Image from its document image cache without
      // a network request. Inject decoder faults here so the race is deterministic.
      if (window.artworkFault && value.endsWith(window.artworkFault.file)) {
        if (window.artworkFault.kind === 'error') queueMicrotask(() => this.onerror?.());
        else window.artworkPending = () => descriptor.set.call(this, value);
        return;
      }
      descriptor.set.call(this, value);
    } });
    const canvas = document.createElement('canvas'); canvas.width = 2400; canvas.height = 2000;
    const base = canvas.getContext('2d'); base.scale(2, 2);
    const r = Object.assign(Object.create(CityRenderer.prototype), { base, w: 1200, h: 1000, size: 64, zoom, dpr: 2, rotation: 0, night: false, panX: 0, panY: 0, platform: 0, paintEpoch: 1, pickables: [] });
    r.pick = () => ({ miss: true });
    const tiles = Object.entries(CIVIC_SPRITES).map(([type, spec], index) => {
      const x = index % 8 * 7, y = Math.floor(index / 8) * 7;
      return { type, x, y, lot: { x, y, w: spec.footprint?.w ?? spec.tiles, h: spec.footprint?.h ?? spec.tiles }, powered: true, age: 10, variant: 0 };
    });
    if (portraitHistory) {
      const { createPortrait } = await import('/src/portrait.js');
      const portraitCanvas = document.createElement('canvas');
      portraitCanvas.style.cssText = 'width:200px;height:160px'; document.body.append(portraitCanvas);
      const portrait = createPortrait(portraitCanvas); window.retainedPortrait = portrait;
      for (const tile of tiles) {
        await preloadCivicSprites({ types: [tile.type], variant: 0 });
        portrait.draw(tile);
      }
      const statue = tiles.find(tile => tile.type === 'statue');
      await preloadCivicSprites({ types: ['statue'] });
      portrait.draw(statue); portrait.draw(statue);
    }
    let peak = 0;
    for (const tile of tiles) {
      const ready = await preloadCivicSprites({ types: [tile.type], variant: 0, owner: r });
      if (ready.some(value => value instanceof HTMLCanvasElement)) throw new Error('Readiness promise retains a decoded canvas');
      drawCachedArchitecture(r, tile, { tiles: [] });
      const stats = civicSpriteStats(); peak = Math.max(peak, stats.decodedBytes);
      if (stats.decodedBytes > stats.maxDecodedBytes) throw new Error('Warm-up exceeds the decoded budget');
    }
    const before = requests;
    r.paintEpoch++; r.pickables = [];
    for (const tile of tiles) drawCachedArchitecture(r, tile, { tiles: [] });
    if (requests !== before) throw new Error('A second paint reloaded visible frames');
    if (r.pickables.length !== tiles.length) throw new Error('Missing shared sprite pickables');
    const reduced = [];
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i], hit = r.pickables[i], frame = CIVIC_SPRITES[tile.type].frames['day-0'];
      if (hit.canvas.width < frame.width) reduced.push({ type: tile.type, file: frame.file });
    }
    if (!reduced.length) throw new Error('The fixture did not exercise active-frame reduction');
    const target = tiles.find(t => t.type === reduced[0].type), hit = r.pickables[tiles.indexOf(target)];
    const mask = hit.canvas.getContext('2d').getImageData(0, 0, hit.canvas.width, hit.canvas.height).data;
    let pixel = 0; while (pixel < mask.length / 4 && mask[pixel * 4 + 3] < 240) pixel++;
    r.pickables = [hit]; r.dirty = false;
    const x = hit.x + (pixel % hit.canvas.width + .5) / hit.canvas.width * hit.w;
    const y = hit.y + (Math.floor(pixel / hit.canvas.width) + .5) / hit.canvas.height * hit.h;
    if (r.pickObject(x, y).x !== target.x) throw new Error('Reduced alpha mask lost picking alignment');
    window.artTest = { r, tiles, target, hit, preloadCivicSprites, civicSpriteStats, civicSpriteSpec, drawCachedArchitecture, CIVIC_SPRITES, get requests() { return requests; } };
    return { types: tiles.length, reduced, requests, peak };
  }, { portraitHistory, zoom });
}

try {
  let page = await browser.newPage();
  const initial = await setup(page);
  assert.equal(initial.types, 50);
  assert.equal(initial.requests, 50, 'one load per gameplay type');
  const upgrade = await page.evaluate(async () => {
    const s = artTest, old = s.hit.canvas, before = s.requests;
    s.r.zoom = 2.4; s.r.paintEpoch++; s.r.pickables = [];
    s.drawCachedArchitecture(s.r, s.target, { tiles: [] });
    const pendingHit = s.r.pickables[0];
    if (s.r.pickables[0].canvas !== old) throw new Error('Upgrade did not retain the usable smaller frame');
    await s.preloadCivicSprites({ types: [s.target.type], variant: 0, owner: s.r });
    if (pendingHit.canvas === old) throw new Error('Upgrade left a retired canvas in picking records');
    s.r.pickables = []; s.drawCachedArchitecture(s.r, s.target, { tiles: [] });
    if (s.r.pickables[0].canvas.width !== s.CIVIC_SPRITES[s.target.type].frames['day-0'].width) throw new Error('Close-up did not regain full resolution');
    return { requests: s.requests - before, stats: s.civicSpriteStats() };
  });
  assert.equal(upgrade.requests, 1);
  assert.ok(upgrade.stats.decodedBytes <= upgrade.stats.maxDecodedBytes);
  await page.close();

  page = await browser.newPage();
  const failed = await setup(page);
  await page.evaluate(file => { window.artworkFault = { file, kind: 'error' }; }, failed.reduced[0].file);
  const failure = await page.evaluate(async () => {
    const s = artTest, old = s.hit.canvas, before = s.requests;
    s.r.zoom = 2.4; s.r.paintEpoch++; s.r.pickables = [];
    s.drawCachedArchitecture(s.r, s.target, { tiles: [] });
    await s.preloadCivicSprites({ types: [s.target.type], variant: 0, owner: s.r });
    for (let i = 0; i < 3; i++) {
      s.r.pickables = []; s.drawCachedArchitecture(s.r, s.target, { tiles: [] });
      if (s.r.pickables[0].canvas !== old) throw new Error('Failed upgrade discarded usable artwork');
    }
    return s.requests - before;
  });
  assert.equal(failure, 1, 'failed upgrades do not retry on every paint');
  await page.close();

  page = await browser.newPage();
  const delayed = await setup(page);
  await page.evaluate(file => { window.artworkFault = { file, kind: 'delay' }; }, delayed.reduced[0].file);
  await page.route('**/cache-pressure.gif', route => route.fulfill({ contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') }));
  await page.evaluate(() => {
    const s = artTest; s.r.zoom = 2.4; s.r.paintEpoch++; s.r.pickables = [];
    s.drawCachedArchitecture(s.r, s.target, { tiles: [] });
    s.pending = s.preloadCivicSprites({ types: [s.target.type], variant: 0, owner: s.r });
    if (!window.artworkPending) throw new Error('Upgrade did not reach the delayed decoder');
  });
  const pressured = await page.evaluate(async () => {
    const s = artTest;
    // Obtain the renderer's own spec, including during Vite timestamped edits.
    const pressureTile = s.tiles.find(tile => tile.type !== s.target.type);
    s.civicSpriteSpec(pressureTile).frames['day-0'] = { file: 'cache-pressure.gif', width: 4096, height: 2048, anchor: [1, 1] };
    await s.preloadCivicSprites({ types: [pressureTile.type] });
    if (s.r.pickables.some(hit => hit.canvas)) throw new Error('Eviction left retired canvases in picking records');
    return s.civicSpriteStats();
  });
  assert.equal(pressured.entries, 1);
  assert.equal(pressured.decodedBytes, pressured.maxDecodedBytes);
  const late = await page.evaluate(async () => { window.artworkPending(); await artTest.pending; return artTest.civicSpriteStats(); });
  assert.equal(late.entries, 1, 'late upgrade does not resurrect an evicted entry');
  assert.equal(late.decodedBytes, late.maxDecodedBytes, 'late upgrade cannot add untracked bytes');
  await page.close();
  page = await browser.newPage();
  const history = await setup(page, true);
  assert.equal(history.types, 50);
  await page.close();
  page = await browser.newPage();
  await setup(page, false, .3);
  const minimum = await page.evaluate(() => {
    const s = artTest, frame = s.CIVIC_SPRITES[s.target.type].frames['day-0'];
    return { actual: s.hit.canvas.width, expected: Math.ceil(frame.width * .3 * 2 / 3) };
  });
  assert.equal(minimum.actual, minimum.expected, 'minimum zoom uses actual screen resolution');
  console.log('Working set: 50 types, no repaint reloads, reduced alpha picking, full close-ups, failed upgrades and late-result accounting and portrait history pass.', initial);
} finally { await browser.close(); }
