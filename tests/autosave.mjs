// The autosave has to survive the tab being put away.
//
// It used to run once every twelve simulated months and nowhere else, so a
// closed tab threw away most of a session. It now also runs when the page is
// hidden, which on a phone is the last moment the page is still alive and
// IndexedDB can still commit.
//
// Two things have to hold at once: a city that was played is written when the
// tab goes away, and a tab that was only opened is not. The second matters more
// than it looks. A returning player who opens the game and switches away must
// not have their autosave replaced by the untouched sample town.
//
// Run `pnpm dev --port 4173` first.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const URL = process.env.CIVIC_TEST_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(8000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const ready = async () => {
  await page.waitForFunction(() => window.civic?.city?.tiles.length > 0);
  await page.evaluate(() => window.civic.saveStore.ready);
};
const enterGame = async () => {
  const explore = page.getByRole("button", { name: "Explore the sample town", exact: true });
  if (await explore.isVisible().catch(() => false)) await explore.click();
};
// Chrome will not background a driven tab, so the event the game listens for is
// raised directly, with document.hidden reading true the way it would.
const hide = () => page.evaluate(async () => {
  Object.defineProperty(document, "hidden", { value: true, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  await new Promise((resolve) => setTimeout(resolve, 300));
});
const show = () => page.evaluate(() => {
  Object.defineProperty(document, "hidden", { value: false, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
});
const autosaveSlot = () => page.evaluate(async () => (await window.civic.saveStore.list()).find((s) => s.slot === 0));

try {
  await page.goto(URL);
  await ready();
  await page.evaluate(async () => {
    for (const slot of [0, 1, 2, 3]) await window.civic.saveStore.remove(slot);
  });
  await enterGame();

  // An untouched tab, put away again.
  await hide();
  assert.equal((await autosaveSlot()).empty, true, "opening the game and leaving does not overwrite the autosave");
  await show();

  // Now play. One month of simulation is a change to the city. Months 1 and 2
  // are used throughout, so the January autosave never fires and every write
  // here is one the hidden tab asked for.
  const played = await page.evaluate(() => window.civic.agent.run(1));
  assert.equal(await page.evaluate(() => window.civic.city.month), 1, `run reported ${JSON.stringify(played)}`);

  await hide();
  const saved = await autosaveSlot();
  assert.equal(saved.empty, false, "a played city is written when the tab is put away");
  assert.equal(saved.name, await page.evaluate(() => window.civic.city.name));
  await show();

  // Hiding again with nothing changed does not write again.
  const first = (await autosaveSlot()).savedAt;
  await hide();
  assert.equal((await autosaveSlot()).savedAt, first, "an unchanged city is not written twice");
  await show();

  // A further change is written on the next hide, throttle or no throttle.
  await page.evaluate(() => window.civic.agent.run(1));
  await hide();
  assert.notEqual((await autosaveSlot()).savedAt, first, "a changed city is written even so soon after the last one");
  await show();

  // A new city nobody has played does not replace the autosave either. This is
  // the path that costs the most: the player opens the game, presses New City
  // to look at the options, and walks away.
  const kept = await autosaveSlot();
  await page.evaluate(() => window.civic.agent.newCity({ seed: 4242 }));
  await hide();
  assert.deepEqual(await autosaveSlot(), kept, "looking at a new city and leaving keeps the autosave");
  await show();

  // Loading a slot to look at it does not replace the autosave with it either.
  await page.evaluate(() => window.civic.agent.save(1));
  await page.evaluate(() => window.civic.agent.load(1));
  await hide();
  assert.deepEqual(await autosaveSlot(), kept, "loading a slot and leaving keeps the autosave");
  await show();

  // Playing the loaded city does write it.
  await page.evaluate(() => window.civic.agent.run(1));
  await hide();
  assert.notDeepEqual(await autosaveSlot(), kept, "a city that is played is written");
  await show();

  // pagehide has to write on its own, not just behind visibilitychange.
  await page.evaluate(() => window.civic.agent.run(1));
  const beforeUnload = (await autosaveSlot()).savedAt;
  await page.evaluate(async () => {
    window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false }));
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  assert.notEqual((await autosaveSlot()).savedAt, beforeUnload, "pagehide writes by itself");

  // The city that comes back is the one that was put away.
  const expected = await page.evaluate(() => window.civic.sim.serialize(window.civic.city));
  await page.reload();
  await ready();
  await enterGame();
  const loaded = await page.evaluate(() => window.civic.agent.load(0));
  assert.equal(loaded.ok, true, `load reported ${JSON.stringify(loaded)}`);
  assert.equal(await page.evaluate(() => window.civic.sim.serialize(window.civic.city)), expected,
    "the autosaved city round trips");

  assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);
  console.log("autosave.mjs: hidden-tab and pagehide autosave, restraint on boot, new city and load, throttling and round trip all pass");
} finally {
  await browser.close();
}
