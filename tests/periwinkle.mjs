import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {mapPoint} from '../src/minimap-geometry.js';

const browser = await chromium.launch({channel: 'chrome', headless: true});
const page = await browser.newPage({viewport: {width: 1440, height: 1000}, reducedMotion: 'reduce'});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir('artifacts', {recursive: true});
const overview = page.locator('.district-map');
const canvas = overview.locator('canvas');
const pan = () => page.evaluate(() => [civic.renderer.panX, civic.renderer.panY]);
async function point(x, y) {
  const bounds = await canvas.boundingBox();
  const size = await page.evaluate(() => civic.city.size);
  const p = mapPoint(x, y, size);
  return {x: bounds.x + p.x / 160 * bounds.width, y: bounds.y + p.y / 160 * bounds.height};
}
async function unobstructed(locator) {
  await locator.scrollIntoViewIfNeeded();
  assert.ok(await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    const margin = el.tagName === 'CANVAS' ? r.width * 15 / 160 : 0;
    return r.width > 0 && r.left + margin >= 0 && r.top >= 0 && r.right - margin <= innerWidth + .5 && r.bottom - margin <= innerHeight + .5 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  }), `Unreachable ${await locator.getAttribute('aria-label')}`);
}
async function separateCameraControls() {
  const controls = await page.locator('#navigator .nav-btn').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().toJSON()));
  for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
    const a = controls[i], b = controls[j];
    assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, 'Camera hit targets never overlap');
  }
}
try {
  await page.goto(`${process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173'}/?play`);
  await page.waitForFunction(() => window.civic?.city);
  assert.equal(await overview.locator('summary').count(), 0, 'The permanent minimap has no collapse control');
  await unobstructed(canvas);
  assert.ok((await canvas.boundingBox()).width >= 220, 'The minimap anchors the desktop console');
  assert.ok(await canvas.evaluate(el => el.width >= el.clientWidth * 1.5), 'The map remains sharp on a high-density display');
  const centerAlpha = await canvas.evaluate(el => el.getContext('2d').getImageData(el.width / 2, el.height / 2, 1, 1).data[3]);
  assert.equal(centerAlpha, 255, 'The live map is rendered');
  const target = await point(20, 25);
  await page.mouse.click(target.x, target.y);
  const centered = await page.evaluate(() => {
    const r = civic.renderer, p = r.project(20, 25);
    return Math.hypot(p.x - r.cx, p.y - r.cy);
  });
  assert.ok(centered < 2, 'Clicking the overview centers that world position');
  const beforeKey = await pan();
  await canvas.focus(); await page.keyboard.press('ArrowRight');
  assert.deepEqual(await pan(), [beforeKey[0] - 40, beforeKey[1]], 'Map keyboard panning is handled once');
  const beforeMargin = await pan(), bounds = await canvas.boundingBox();
  await page.mouse.click(bounds.x + 2, bounds.y + 2);
  assert.deepEqual(await pan(), beforeMargin, 'The transparent map margin does not move the city');
  if (await page.locator('#inspector-panel').isVisible()) await page.getByRole('button', {name: 'Close inspector', exact: true}).click();
  const from = await point(25, 25), to = await point(35, 35);
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(to.x, to.y, {steps: 5}); await page.mouse.up();
  const afterDrag = await pan();
  assert.notDeepEqual(afterDrag, beforeMargin, 'Dragging the overview moves the city');
  await page.mouse.move(from.x, from.y);
  assert.deepEqual(await pan(), afterDrag, 'Releasing the pointer ends map panning');
  assert.equal(await page.getByRole('button', {name: 'Home view [H]', exact: true}).count(), 0);
  await page.keyboard.press('h');
  const navigator = await page.locator('#navigator').boundingBox();
  await page.mouse.click(navigator.x + 12, navigator.y + navigator.height - 4);
  assert.equal(await page.locator('#inspector-panel').isVisible(), false, 'Clicking the painted map housing never selects the city underneath');
  await page.mouse.click(navigator.x + 12, navigator.y + 30);
  assert.equal(await page.locator('#inspector-panel').isVisible(), true, 'The transparent area outside the curved housing still reaches the city');
  await page.getByRole('button', {name: 'Close inspector', exact: true}).click();
  await page.screenshot({path: 'artifacts/periwinkle-desktop.png'});
  await unobstructed(page.locator('.rci-row').first());
  await separateCameraControls();
  const mapBounds = await canvas.boundingBox();
  for (const [name, x, y] of [['Rotate left', .2, .8], ['Rotate right', .8, .8], ['Toggle data maps', .8, .2]]) {
    const control = await page.getByRole('button', {name, exact: true}).boundingBox();
    assert.ok(Math.abs(control.x + control.width / 2 - (mapBounds.x + mapBounds.width * x)) < 1);
    if (name === 'Toggle data maps') assert.ok(Math.abs(control.y + control.height / 2 - (mapBounds.y + mapBounds.height * y)) < 1, 'Layers control uses exact fifth spacing');
  }
  const zoom = await page.locator('.nav-zoom .nav-btn').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().toJSON()));
  const news = await page.locator('#bottom-bar').boundingBox();
  const status = await page.locator('#command-bar').boundingBox();
  assert.ok(Math.abs((zoom[0].top + zoom[1].bottom) / 2 - (news.y + status.y + status.height) / 2) < 1, 'Zoom stack is centred vertically in the bottom console');
  for (const control of await page.locator('.nav-rotation .nav-btn').all()) {
    const bounds = await control.boundingBox();
    assert.ok(Math.abs(bounds.y + bounds.height / 2 - (news.y + status.y + status.height) / 2) < 1, 'Rotation controls share the bottom console centreline');
  }

  for (const [width, height] of [[390, 844], [320, 568], [667, 375]]) {
    await page.setViewportSize({width, height});
    assert.equal(await canvas.isVisible(), true, 'The minimap stays visible on compact screens');
    await unobstructed(canvas);
    await separateCameraControls();
    for (const name of ['Zoom in [+]', 'Zoom out [−]', 'Rotate left', 'Rotate right', 'Toggle data maps']) await unobstructed(page.getByRole('button', {name, exact: true}));
    await unobstructed(page.getByRole('textbox', {name: 'City name', exact: true}));
    await unobstructed(page.locator('.status-money'));
    await page.screenshot({path: `artifacts/periwinkle-map-${width}.png`});
    await page.getByRole('button', {name: 'Zones', exact: true}).click();
    assert.equal(await canvas.isVisible(), true, 'Opening a construction palette keeps the map visible');
    await unobstructed(page.locator('[data-tool="residential"]'));
    await page.keyboard.press('Escape');
    await page.getByRole('button', {name: 'Toggle data maps', exact: true}).click();
    await unobstructed(page.locator('[data-overlay="landvalue"]'));
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => [scrollX, scrollY]), [0, 0], 'Focus never scrolls the whole HUD');
  }
  await page.setViewportSize({width: 1440, height: 1000});
  assert.equal(await canvas.isVisible(), true, 'The overview remains visible on desktop');
  await page.getByRole('button', {name: 'Open budget', exact: true}).click();
  await page.screenshot({path: 'artifacts/periwinkle-budget.png'});
  assert.deepEqual(errors, []);
  console.log('Periwinkle: live map, high-density rendering, click/drag/keyboard navigation, compact map controls and HUD focus passed.');
} finally {
  await browser.close();
}
