import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { TOOL_GROUPS } from '../src/ui-tool-groups.js';
import { TOOLS } from '../src/sim.js';

const catalog = TOOL_GROUPS.flatMap(group => group.tools);
assert.equal(new Set(catalog).size, catalog.length, 'Each tool has one home');
// Tunnel and ramp tools were not in the existing Transport palette, which stays unchanged.
assert.deepEqual([...catalog].sort(), TOOLS.filter(tool => !['inspect', 'tunnel', 'railtunnel'].includes(tool.id)).map(tool => tool.id).sort(), 'Every building and land tool is available');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ reducedMotion: 'reduce' });
const errors = []; page.on('pageerror', error => errors.push(error.message));
async function reachable(locator) {
  await locator.scrollIntoViewIfNeeded();
  assert.ok(await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  }), `Unreachable: ${await locator.textContent()}`);
}
try {
  await page.goto(`${process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173'}/?play`);
  await page.waitForFunction(() => window.civic);
  for (const [width, height] of [[1440,1000], [1024,768], [768,1024], [390,844], [320,568], [667,375]]) {
    await page.setViewportSize({width,height});
    for (const group of TOOL_GROUPS) {
      const trigger = page.getByRole('button', { name: group.label, exact: true });
      await reachable(trigger); await trigger.click();
      for (const section of group.sections || [{id:group.id, tools:group.tools}]) {
        if (group.sections) {
          const tab = page.getByRole('tab', { name: section.label, exact: true });
          await reachable(tab); await tab.click();
          assert.equal(await tab.getAttribute('aria-selected'), 'true');
          assert.equal(await page.locator('#flyout [role="tabpanel"]:visible').count(), 1);
        }
        for (const tool of section.tools) {
          const card = page.locator(`#flyout [data-tool="${tool}"]`);
          if (await card.isVisible()) await reachable(card);
        }
      }
      await page.getByRole('button', { name: 'Close tool palette', exact: true }).click();
    }
    const menu = page.getByLabel('City menu', { exact: true });
    await reachable(menu); await menu.click();
    await reachable(page.getByRole('button', { name: 'Save city', exact: true }));
    await reachable(page.getByRole('button', { name: 'Help', exact: true }));
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'City management', exact: true }).click();
    for (const name of ['Open budget', 'City report', 'Advisors', 'Neighbours & contracts', 'Policies & ordinances', 'Open petition']) await reachable(page.getByRole('button', { name, exact: true }));
    await page.screenshot({path:`artifacts/management-${width}.png`});
    await page.getByRole('button', { name: 'Neighbours & contracts', exact: true }).click();
    assert.equal(await page.getByRole('tab', { name: 'Neighbors', exact: true }).getAttribute('aria-selected'), 'true');
    await page.getByRole('button', { name: 'Back to city management', exact: true }).click();
    await page.getByRole('button', { name: 'Close city management', exact: true }).click();
  }
  await page.getByRole('button', { name:'Utilities', exact:true }).click();
  await page.getByRole('tab', {name:'Electricity',exact:true}).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('tab', {name:'Water',exact:true}).getAttribute('aria-selected'), 'true');
  await page.locator('[data-tool="pipe"]').click();
  assert.equal(await page.evaluate(() => civic.renderer.tool), 'pipe');
  assert.deepEqual(errors, []);
  console.log('Grouped UI: complete catalog, all category tabs, keyboard selection, game menu and management hub passed at six sizes.');
} finally { await browser.close(); }
