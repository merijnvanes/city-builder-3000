import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.CIVIC_TEST_URL || 'http://127.0.0.1:4173'}/?play`);
  await page.waitForFunction(()=>window.civic);
  await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>document.fonts.check('900 23px "Nunito Sans"')),true);
  assert.doesNotMatch(await page.locator('.happy').innerText(),/[\d%]/);
  assert.match(await page.locator('.status-money').innerText(),/\$/);
  for(const row of await page.locator('.rci-row').all()) {
    assert.doesNotMatch(await row.innerText(),/\d/);
    assert.ok(await row.getAttribute('aria-valuetext'));
  }
  assert.equal(await page.evaluate(()=>typeof civic.agent.state().metrics.happiness),'number');
  await page.getByRole('button',{name:'City report',exact:true}).click();
  const report=page.getByRole('dialog',{name:'City Report',exact:true});
  assert.equal(await report.locator('.city-history').evaluate(el=>el.open),false);
  for(const card of await report.locator('.city-signal-card[data-tone]').all()) {
    assert.doesNotMatch(await card.innerText(),/\d|%/);
    if(await card.getAttribute('data-tone')==='calm')assert.equal(await card.getByRole('meter').count(),0);
    else assert.ok(await card.getByRole('meter').getAttribute('aria-valuetext'));
  }
  await page.screenshot({path:'artifacts/game-report.png'});
  await page.keyboard.press('Escape');
  await page.mouse.click(720,500);
  assert.ok(await page.locator('#inspector-panel').isVisible());
  assert.equal(await page.locator('.inspection-notes').evaluate(el=>el.open),false);
  await page.screenshot({path:'artifacts/game-inspector-compact.png'});
  await page.locator('.inspection-notes summary').click();
  await page.evaluate(()=>civic.agent.run(1));
  assert.equal(await page.locator('.inspection-notes').evaluate(el=>el.open),true);
  await page.screenshot({path:'artifacts/game-inspector.png'});
  await page.locator('.inspection-notes summary').click();
  await page.getByRole('button',{name:'Close inspector',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'City report',exact:true}).click();
  await page.screenshot({path:'artifacts/game-report-mobile.png'});
  await page.keyboard.press('Escape');
  await page.evaluate(()=>{civic.city.news=['A serious fire needs attention.','A new park opens.'];civic.agent.run(1);});
  await page.getByRole('button',{name:'Read city news',exact:true}).click();
  const news=page.getByRole('dialog',{name:'City news',exact:true});
  assert.ok(await news.getByText('A serious fire needs attention.',{exact:true}).isVisible());
  assert.ok(await news.getByText('A new park opens.',{exact:true}).isVisible());
  await page.getByRole('button',{name:'Close news',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Read city news',exact:true}).evaluate(el=>el===document.activeElement),true);
  assert.deepEqual(errors,[]);
  console.log('Game UI: qualitative signals, exact money and API, report meters and persistent inspector disclosure passed.');
} finally { await browser.close(); }
