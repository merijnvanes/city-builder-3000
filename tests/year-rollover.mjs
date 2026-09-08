import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173'}/?play`);
  await page.waitForFunction(() => window.civic);
  // Old saves can have automatic reviews enabled. They must also keep playing.
  await page.evaluate(() => { civic.city.month = 11; civic.city.settings.yearEndBudget = true; });
  await page.getByRole('button', { name: 'Very fast [3]', exact: true }).click();
  await page.waitForFunction(() => civic.city.month >= 13);
  const state = await page.evaluate(() => {
    const snapshot = {
      dialogs: document.querySelectorAll('dialog[open]').length,
      speed: document.querySelector('[data-speed="3"]').getAttribute('aria-pressed'),
      autosave: JSON.parse(localStorage.getItem('city-builder-3000-save-v3-autosave')).month,
    };
    document.querySelector('[data-speed="0"]').click();
    return snapshot;
  });
  assert.deepEqual(state, { dialogs: 0, speed: 'true', autosave: 12 });
  await page.getByRole('button', { name: 'Open budget', exact: true }).click();
  assert.ok(await page.getByRole('dialog', { name: 'Budget', exact: true }).isVisible());
  assert.ok(await page.getByText('Last Year', { exact: true }).isVisible());
  console.log('Year rollover: play continues, old settings ignored, autosave retained, manual Budget available.');
} finally { await browser.close(); }
