import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];
page.on('pageerror', e => failures.push(e.message));
page.on('response', r => { if (r.status() >= 400 && r.url().includes('/assets/')) failures.push(r.url()); });
const url = process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173';
await mkdir('artifacts', { recursive: true });
async function reachable(locator) {
  await locator.scrollIntoViewIfNeeded();
  const state = await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    const hits = [[.5,.5],[.2,.5],[.8,.5],[.5,.2],[.5,.8]].map(([x,y]) => document.elementFromPoint(r.x + r.width*x, r.y + r.height*y));
    return { ok: r.width > 0 && r.height > 0 && r.x >= 0 && r.right <= innerWidth + 1 && r.y >= 0 && r.bottom <= innerHeight + 1 && hits.every(hit => el.contains(hit)), viewport: [innerWidth, innerHeight], rect: r.toJSON(), hits: hits.map(hit => hit?.outerHTML.slice(0, 100)) };
  });
  assert.ok(state.ok, `Control obstructed: ${await locator.getAttribute('aria-label') || await locator.textContent()}: ${JSON.stringify(state)}`);
}
async function cohesiveHud() {
  await page.locator('#console-context').evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(animation => animation.finished)));
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const layout = await page.evaluate(() => {
    const visible = el => el.getBoundingClientRect().width > 0 && getComputedStyle(el).display !== 'none';
    const surfaces = [...document.querySelector('#app').children].filter(el => el.tagName !== 'DIALOG' && visible(el));
    const header = document.querySelector('#command-bar').getBoundingClientRect();
    const console = document.querySelector('#build-console').getBoundingClientRect();
    const deck = document.querySelector('#console-deck').getBoundingClientRect();
    const navigator = document.querySelector('#navigator').getBoundingClientRect();
    const drawer = [...document.querySelector('#console-context').children].find(visible)?.getBoundingClientRect();
    return { surfaces: surfaces.map(el => el.id), header: header.toJSON(), console: console.toJSON(), deck: deck.toJSON(), navigator: navigator.toJSON(), drawer: drawer?.toJSON(), width: innerWidth, height: innerHeight };
  });
  assert.deepEqual(layout.surfaces, ['command-bar', 'build-console'], 'The HUD has exactly two connected surfaces');
  for (const box of [layout.header, layout.console]) assert.ok(box.left >= 0 && box.right <= layout.width && box.top >= 0 && box.bottom <= layout.height, `HUD stays on screen: ${JSON.stringify(layout)}`);
  assert.equal(layout.console.right, layout.width, 'Tool rail touches the right edge');
  assert.equal(layout.console.top, 0, 'No top bar covers the city');
  assert.equal(layout.header.bottom, layout.height, 'Status strip touches the bottom edge');
  assert.ok(Math.abs(layout.header.right - layout.navigator.left) <= 1, 'The status strip joins the minimap console');
  const news = await page.locator('#bottom-bar').boundingBox();
  assert.equal(await page.locator('#command-bar .rci-row').count(), 3);
  for (const row of await page.locator('#command-bar .rci-row').all()) {
    await reachable(row);
    assert.ok(await row.locator('.rci-track').evaluate(el => el.clientHeight >= 9 && el.clientWidth >= 32), 'Compact demand bars remain legible at every screen size');
  }
  const clippedLabels = await page.locator('.rci-lbl, .rci-val, .group-label, .tool-label, .status-stat-label').evaluateAll(elements => elements.filter(el => el.clientWidth && el.scrollWidth > el.clientWidth + 1).map(el => el.textContent));
  assert.deepEqual(clippedLabels, [], 'Larger labels fit their controls');
  const cityArea = layout.console.left * news.y - (layout.navigator.width - layout.console.width) * Math.max(0, news.y - layout.navigator.top);
  if (layout.width >= 1000 && layout.height >= 640) {
    assert.ok(cityArea / (layout.width * layout.height) >= .70, 'Readable demand and the minimap leave at least 70% of desktop for the city');
    if (layout.drawer) assert.ok((cityArea - layout.drawer.width * layout.drawer.height) / (layout.width * layout.height) >= .55, 'A drawer keeps at least 55% of desktop city space');
  }
  if (layout.drawer) {
    assert.ok(Math.abs(layout.drawer.right - layout.console.left) <= 1, 'Drawer joins the right rail');
    assert.ok(layout.drawer.top >= 0 && layout.drawer.bottom <= news.y + 1 && layout.drawer.left >= 0, 'Drawer stays above the city wire');
  }
}
try {
  await page.goto(url);
  await page.waitForFunction(() => window.civic);
  await page.keyboard.press('3');
  assert.equal(await page.locator('[data-speed="0"]').getAttribute('aria-pressed'), 'true', 'Welcome blocks game shortcuts');
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => document.activeElement.closest('#title-screen')), 'Welcome contains keyboard focus');
  }
  await page.screenshot({ path: 'artifacts/ui-title.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Explore the sample town', exact: true }).click();
  await page.locator('#notif.show').waitFor({ state: 'hidden' });
  await page.screenshot({ path: 'artifacts/ui-desktop.png', animations: 'disabled' });
  await page.mouse.click(720, 500);
  await page.getByRole('button', { name: 'Open budget', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#inspector-panel').isVisible(), 'Modal Escape preserves the inspected tile');
  const inspector = await page.locator('#inspector-panel').boundingBox(), mini = await page.locator('.district-map').boundingBox();
  assert.ok(inspector.y + inspector.height <= mini.y || inspector.x + inspector.width <= mini.x, 'Inspector never overlaps the minimap');
  await page.getByRole('button', { name: 'Close inspector', exact: true }).click();
  await page.evaluate(() => civic.agent.run(1));
  assert.ok(!await page.locator('#inspector-panel').isVisible(), 'A dismissed inspector stays closed after simulation updates');
  await page.getByRole('button', { name: 'Toggle data maps', exact: true }).click();
  await page.locator('[data-overlay="pollution"]').click();
  await page.getByRole('button', { name: 'Open budget', exact: true }).click();
  await page.keyboard.press('Escape');
  assert.ok(await page.locator('#overlay-section').isVisible(), 'Modal Escape preserves the data palette');
  await page.getByRole('button', { name: 'Close data maps', exact: true }).click();
  assert.equal(await page.locator('.map-toggle').textContent(), 'Pollution');
  assert.ok(await page.locator('.map-toggle').evaluate(el => el.classList.contains('active')));
  await page.getByRole('button', { name: 'Toggle data maps', exact: true }).click();
  await page.locator('[data-overlay="none"]').click();
  await page.getByRole('button', { name: 'Close data maps', exact: true }).click();

  await page.getByRole('button', { name: 'Civic', exact: true }).click();
  await page.mouse.click(720, 450);
  assert.ok(await page.locator('#inspector-panel').isVisible(), 'Inspecting a tile replaces the open construction palette');
  assert.ok(!await page.locator('#flyout').isVisible());
  await page.getByRole('button', { name: 'Transport', exact: true }).click();
  await page.evaluate(() => civic.agent.run(1));
  assert.ok(await page.locator('#flyout').isVisible(), 'Simulation updates preserve the drawer the player opened');
  assert.ok(!await page.locator('#inspector-panel').isVisible());
  await page.keyboard.press('r');
  assert.ok(!await page.locator('#flyout').isVisible(), 'A construction shortcut closes the palette');
  assert.match(await page.locator('.active-tool-title').innerText(), /Road/);
  await page.keyboard.press('Escape');
  await page.locator('#notif.show').waitFor({ state: 'hidden' });

  for (const [width, height] of [[1440,1000], [1280,720], [1280,640], [1024,768], [768,1024], [390,844], [320,568], [844,390], [667,375]]) {
    await page.setViewportSize({ width, height });
    await page.keyboard.press('Escape');
    await cohesiveHud();
    if (await page.locator('.district-map').isVisible()) {
      const map = await page.locator('.district-map').boundingBox(), nav = await page.locator('#navigator').boundingBox();
      assert.ok(map.y >= nav.y && map.y + map.height * 145 / 160 <= nav.y + nav.height, 'The painted minimap stays inside the console');
    }
    await reachable(page.getByRole('textbox', { name: 'City name', exact: true }));
    await reachable(page.locator('.status-money'));
    for (const name of ['Open budget', 'City report', 'Advisors']) await reachable(page.getByRole('button', { name, exact: true }));
    await reachable(page.locator('.status-date'));
    if (await page.locator('.clock-state').isVisible()) await reachable(page.locator('.clock-state'));
    const groups = await page.locator('#dock-scroll .group-header[aria-controls="flyout"]:visible').evaluateAll(headers => headers.map(header => header.getAttribute('aria-label')));
    assert.ok(groups.length >= 5, 'Every viewport tests a populated category rail');
    for (const group of groups) {
      const trigger = page.getByRole('button', { name: group, exact: true });
      await reachable(trigger); await trigger.click();
      await cohesiveHud();
      assert.ok(await page.evaluate(() => document.activeElement.matches('#flyout .tool-btn')), 'Opening a palette focuses its first available tool');
      await page.keyboard.press('Tab');
      assert.ok(await page.evaluate(() => document.activeElement.closest('#flyout')), 'Forward Tab stays in the newly opened palette');
      if (width === 844 && group === 'Civic') {
        const before = await page.locator('#flyout').boundingBox();
        await page.evaluate(() => civic.agent.run(1));
        await page.locator('#notif.show').waitFor();
        const after = await page.locator('#flyout').boundingBox();
        assert.ok(Math.abs(before.height - after.height) < 1 && Math.abs(before.y - after.y) < 1, 'A notification does not resize or move the open palette');
        await cohesiveHud();
      }
      const cards = page.locator('#flyout .tool-btn:visible');
      assert.ok(await cards.count() > 0, `${group} offers construction tools`);
      for (const card of await cards.all()) {
        await reachable(card);
        await card.hover();
        const unclipped=await card.evaluate(el=>{
          const card=el.getBoundingClientRect(),clip=el.closest('.flyout-body').getBoundingClientRect();
          return {ok:card.top>=clip.top-.5 && card.bottom<=clip.bottom+.5 && card.left>=clip.left-.5 && card.right<=clip.right+.5,card:card.toJSON(),clip:clip.toJSON()};
        });
        assert.ok(unclipped.ok,`Hover must keep the complete card inside the palette scroll area: ${JSON.stringify(unclipped)}`);
        assert.ok(await card.evaluate(el => {
          const icon = el.querySelector('.tool-visual svg')?.getBoundingClientRect(), card = el.getBoundingClientRect();
          return !icon || (icon.top >= card.top && icon.bottom <= card.bottom && icon.left >= card.left && icon.right <= card.right);
        }), 'Utility artwork stays inside its card when thumbnails shrink');
        await page.keyboard.press('Tab');
        await card.focus();
        assert.equal(await card.evaluate(el=>getComputedStyle(el).outlineOffset),'-3px','Keyboard highlight stays inside the card');
      }
      if (group === 'Transport' && (width === 320 || height === 375)) {
        await cards.first().focus(); await cards.first().scrollIntoViewIfNeeded();
        await page.screenshot({ path: `artifacts/ui-palette-${width}x${height}.png`, animations: 'disabled' });
      }
      const close = page.getByRole('button', { name: 'Close tool palette', exact: true });
      await reachable(close);
      await close.click();
      assert.ok(await trigger.evaluate(el => el === document.activeElement), 'Closing a palette restores focus');
    }
    await page.getByRole('button', { name: 'Zones', exact: true }).click();
    await page.locator('[data-tool="residential"]').click();
    const density = page.getByRole('button', { name: 'Density 3', exact: true });
    await reachable(density); await density.click();
    await cohesiveHud();
    assert.match(await page.locator('.active-tool-title').textContent(), /\$50\/tile/);
    assert.equal(await density.getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
    await reachable(page.getByRole('button', { name: 'Toggle data maps', exact: true }));
    for (const name of ['Rotate left', 'Rotate right', 'Zoom in [+]', 'Zoom out [−]']) await reachable(page.getByRole('button', { name, exact: true }));
    await page.locator('.city-menu summary').click();
    await reachable(page.getByRole('button', { name: 'Save city', exact: true }));
    await reachable(page.getByRole('button', { name: 'Help', exact: true }));
    await page.keyboard.press('Escape');
    assert.ok(await page.locator('.city-menu summary').evaluate(el => el === document.activeElement));
    console.log(`Controls reachable at ${width}×${height}`);
  }

  await page.setViewportSize({ width: 320, height: 568 });
  await page.evaluate(() => {
    const tile = civic.city.tiles.find(tile => tile.type === 'empty' && tile.terrain !== 'water' && tile.terrain !== 'rock' && tile.x > 8 && tile.y > 8);
    civic.renderer.focusOn(tile.x, tile.y, .8);
  });
  const fundsBeforeDrag = await page.evaluate(() => civic.city.money);
  await page.keyboard.press('z');
  await page.mouse.move(160, 284); await page.mouse.down();
  await page.mouse.move(180, 300, { steps: 5 });
  const quote = await page.locator('#build-preview').boundingBox(), context = await page.locator('#console-context').boundingBox();
  assert.ok(quote && quote.height > 0 && quote.y >= context.y && quote.y + quote.height <= context.y + context.height, 'The full construction quote remains visible beside density controls');
  await cohesiveHud();
  await page.keyboard.press('Escape'); await page.mouse.up();
  assert.equal(await page.evaluate(() => civic.city.money), fundsBeforeDrag, 'Cancelling the preview preserves city funds');
  await page.keyboard.press('Escape');
  await page.keyboard.press('h');
  const petitionButton = page.locator('[aria-label="Open petition"]');
  await petitionButton.evaluate(el => { el.style.display = ''; });
  await cohesiveHud();
  await reachable(petitionButton);
  for (const name of ['Open budget', 'City report', 'Advisors']) await reachable(page.getByRole('button', { name, exact: true }));
  const petitionBox = await petitionButton.boundingBox(), commandBox = await page.locator('#build-console').boundingBox();
  assert.ok(petitionBox.x >= commandBox.x && petitionBox.x + petitionBox.width <= commandBox.x + commandBox.width, 'Petitions stay inside the tool rail');
  await petitionButton.evaluate(el => { el.style.display = 'none'; });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('.city-menu summary').focus();
  await page.keyboard.press('Space');
  assert.ok(await page.locator('.city-menu').evaluate(el => el.open), 'Space opens the city menu');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Civic', exact: true }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('#flyout img')].every(i => i.complete && i.naturalWidth > 0));
  await page.locator('#flyout img').evaluateAll(images=>Promise.all(images.map(image=>image.decode())));
  await page.screenshot({ path: 'artifacts/ui-palette.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open budget', exact: true }).click();
  await page.getByRole('tab', { name: 'Overview', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab', { name: 'Taxes & services', exact: true }).getAttribute('aria-selected'), 'true');
  await reachable(page.getByRole('slider', { name: 'Residential tax rate', exact: true }));
  await page.keyboard.press('Home');
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await page.screenshot({ path: 'artifacts/ui-budget.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/ui-mobile.png', animations: 'disabled' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('#news-ticker').evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.deepEqual(failures, []);
  console.log('UI design passed: nine viewport sizes, Periwinkle controls, at least 70% idle desktop city space, every category, notifications, petitions, keyboard access, pricing and artwork.');
} catch (error) {
  await page.screenshot({ path: 'artifacts/ui-failure.png', animations: 'disabled' });
  throw error;
} finally { await browser.close(); }
