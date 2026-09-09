// Saving a city, in a real browser, against real IndexedDB.
//
// The unit tests in save-store.test.js drive the localStorage fallback because
// node has no IndexedDB. That leaves the path every player actually takes
// untested, so this walks it end to end: save a city, reload the tab, load it
// back, and check the two are the same city down to the byte.
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

try {
  await page.goto(URL);
  await ready();

  // Start from a clean store so a previous run cannot answer for this one.
  await page.evaluate(async () => {
    for (const slot of [0, 1, 2, 3]) await window.civic.saveStore.remove(slot);
    localStorage.clear();
  });
  await enterGame();

  assert.equal(await page.evaluate(() => window.civic.saveStore.mode()), "indexeddb",
    "Chrome saves into IndexedDB, not the 5 MB localStorage quota");

  // A city with some history in it, so the comparison has something to fail on.
  await page.evaluate(() => window.civic.agent.run(6));
  const before = await page.evaluate(() => window.civic.sim.serialize(window.civic.city));
  assert.ok(before.length > 1000, "the sample town serialises to something substantial");

  const saved = await page.evaluate(() => window.civic.agent.save(2));
  assert.equal(saved.ok, true, `save reported ${JSON.stringify(saved)}`);

  // The slot list reads its summary from the record, so it knows the city
  // without parsing it back.
  const listed = await page.evaluate(() => window.civic.saveStore.list());
  const slot2 = listed.find((s) => s.slot === 2);
  assert.equal(slot2.empty, false, "slot 2 is filled");
  assert.equal(slot2.name, await page.evaluate(() => window.civic.city.name), "and knows the city's name");
  assert.equal(listed.find((s) => s.slot === 1).empty, true, "other slots stay empty");

  // Nothing was left in localStorage: that is the whole point of the move.
  const stray = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.includes("save")));
  assert.deepEqual(stray, [], `localStorage should hold no cities, found ${stray.join(", ")}`);

  // Reload. A new page, a new store, the same database.
  await page.reload();
  await ready();
  await enterGame();
  await page.evaluate(() => window.civic.agent.newCity({ seed: 7 }));
  assert.notEqual(await page.evaluate(() => window.civic.sim.serialize(window.civic.city)), before,
    "the fresh city differs from the saved one, so loading proves something");

  const loaded = await page.evaluate(() => window.civic.agent.load(2));
  assert.equal(loaded.ok, true, `load reported ${JSON.stringify(loaded)}`);
  const after = await page.evaluate(() => window.civic.sim.serialize(window.civic.city));
  assert.equal(after, before, "the city that came back is the city that went in");

  // A city written by the pre-IndexedDB builds is adopted on the next visit and
  // its old key released.
  await page.evaluate((text) => localStorage.setItem("city-builder-3000-save-v3-slot3", text), before);
  await page.reload();
  await ready();
  const adopted = await page.evaluate(() => window.civic.saveStore.list());
  assert.equal(adopted.find((s) => s.slot === 3).empty, false, "the legacy city moved into slot 3");
  assert.equal(await page.evaluate(() => localStorage.getItem("city-builder-3000-save-v3-slot3")), null,
    "and the old key was released once the copy was committed");
  assert.equal(await page.evaluate(async () => (await window.civic.saveStore.read(3)).text), before,
    "byte for byte");

  // Loading an empty slot is a message, not a crash.
  const missing = await page.evaluate(() => window.civic.agent.load(1));
  assert.equal(missing.ok, false, "an empty slot reports itself");

  assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);
  console.log("saves.mjs: IndexedDB round trip, slot summaries, legacy adoption and empty-slot handling all pass");
} finally {
  await browser.close();
}
