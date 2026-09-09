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
  assert.ok(inspector.y + inspector.height < mini.y, 'Inspector stays above the minimap');
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

  for (const [width, height] of [[1440,1000], [1280,720], [1024,768], [768,1024], [390,844], [320,568], [844,390], [667,375]]) {
    await page.setViewportSize({ width, height });
    await page.keyboard.press('Escape');
    const mobile = width <= 800;
    await reachable(page.locator('.status-date'));
    await reachable(page.locator('.clock-state'));
    if (mobile) await reachable(page.getByRole('button', { name: 'Toggle tools', exact: true }));
    if (mobile) await page.getByRole('button', { name: 'Toggle tools', exact: true }).click();
    for (const group of ['Zones', 'Transport', 'Civic', 'Parks & Land', 'Power']) {
      const trigger = page.getByRole('button', { name: group, exact: true });
      await reachable(trigger); await trigger.click();
      const cards = page.locator('#flyout .tool-btn:visible');
      assert.ok(await cards.count() > 0);
      for (const card of await cards.all()) {
        await reachable(card);
        await card.hover();
        const unclipped=await card.evaluate(el=>{
          const card=el.getBoundingClientRect(),clip=el.closest('.flyout-body').getBoundingClientRect();
          return {ok:card.top>=clip.top-.5 && card.bottom<=clip.bottom+.5 && card.left>=clip.left-.5 && card.right<=clip.right+.5,card:card.toJSON(),clip:clip.toJSON()};
        });
        assert.ok(unclipped.ok,`Hover must keep the complete card inside the palette scroll area: ${JSON.stringify(unclipped)}`);
        await page.keyboard.press('Tab');
        await card.focus();
        assert.equal(await card.evaluate(el=>getComputedStyle(el).outlineOffset),'-3px','Keyboard highlight stays inside the card');
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
    assert.match(await page.locator('.active-tool-title').textContent(), /\$50\/tile/);
    assert.equal(await density.getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Escape');
    await reachable(page.getByRole('button', { name: 'Toggle data maps', exact: true }));
    for (const name of ['Rotate left', 'Rotate right', 'Zoom in [+]', 'Zoom out [−]', 'Home view [H]']) await reachable(page.getByRole('button', { name, exact: true }));
    await page.locator('.city-menu summary').click();
    await reachable(page.getByRole('button', { name: 'Save city', exact: true }));
    await reachable(page.getByRole('button', { name: 'Help', exact: true }));
    await page.keyboard.press('Escape');
    assert.ok(await page.locator('.city-menu summary').evaluate(el => el === document.activeElement));
    console.log(`Controls reachable at ${width}×${height}`);
  }

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
  console.log('UI design passed: eight viewport sizes, tool access, focus, live density pricing, menu access, budget tabs, artwork and reduced motion.');
} catch (error) {
  await page.screenshot({ path: 'artifacts/ui-failure.png', animations: 'disabled' });
  throw error;
} finally { await browser.close(); }
