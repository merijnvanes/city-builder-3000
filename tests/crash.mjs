// A real crash, in a real browser.
//
// The unit tests cover what counts as a crash. This covers what the player
// sees: the game stops, a dialog explains it, the city is written to a slot of
// its own, and it is still there after the reload.
//
// Run `pnpm dev --port 4173` first.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const URL = process.env.CIVIC_TEST_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(8000);

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
  await page.evaluate(async () => {
    for (const slot of [0, 1, 2, 3, "rescue"]) await window.civic.saveStore.remove(slot);
  });
  await enterGame();

  // Play a little, then run the clock, so there is something to lose and the
  // crash arrives with the game in motion.
  await page.evaluate(() => window.civic.agent.run(3));
  await page.evaluate(() => window.civic.agent.speed(2));
  const expected = await page.evaluate(() => window.civic.sim.serialize(window.civic.city));

  // Break the renderer itself, which is where a real crash comes from: frame()
  // throws, and the loop that reschedules itself on its last line ends.
  const framesBefore = await page.evaluate(() => new Promise((resolve) => {
    let n = 0;
    const count = () => { n++; requestAnimationFrame(count); };
    requestAnimationFrame(count);
    setTimeout(() => resolve(n), 200);
  }));
  assert.ok(framesBefore > 2, "the page is animating to begin with");

  await page.evaluate(() => {
    window.civic.renderer.render = () => { throw new Error("Cannot read properties of undefined (reading 'tiles')"); };
  });

  const dialog = page.getByRole("dialog", { name: "The game stopped", exact: true });
  await dialog.waitFor({ state: "visible" });
  // The file and line come from the error event and are covered in
  // tests/crash-guard.test.js. A function injected here has no filename to
  // report, so only the message is checked.
  assert.match(await dialog.innerText(), /Cannot read properties of undefined/, "the dialog says what went wrong");

  assert.equal(await page.evaluate(() => window.civic.agent.state().speed), 0, "the clock is stopped");
  assert.equal(await page.evaluate(() => document.querySelectorAll('dialog[open]').length), 1,
    "and it is the only thing open");

  // Escape does not dismiss the only way out.
  await page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(), true, "escape does not close the crash dialog");

  // The city is written to its own slot, which shows up in the save dialog.
  await page.waitForFunction(async () => (await window.civic.saveStore.read("rescue")).ok);
  assert.equal(await page.evaluate(async () => (await window.civic.saveStore.read("rescue")).text), expected,
    "the rescued city is the city that was being played");

  const listed = await page.evaluate(() => window.civic.saveStore.list());
  const rescue = listed.find((s) => s.slot === "rescue");
  assert.ok(rescue, "the rescue slot is listed once it holds something");
  assert.equal(rescue.empty, false);
  assert.equal(rescue.label, "Rescued city");

  const download = page.getByRole("button", { name: "Download the city as a file", exact: true });
  const reload = page.getByRole("button", { name: "Reload the page", exact: true });
  assert.equal(await download.isEnabled(), true, "the city can be downloaded");
  // Reloading while the copy is still being written would abort it, so the
  // button only opens once the write has settled.
  await reload.waitFor({ state: "visible" });
  assert.equal(await reload.isEnabled(), true, "and reloading is offered once the copy is stored");
  assert.match(await dialog.innerText(), /A copy is stored as Rescued city/);

  const file = await Promise.all([page.waitForEvent("download"), download.click()]).then(([d]) => d);
  assert.match(file.suggestedFilename(), /^city-unreadable-.*\.json$/, "the download is a city file");

  // It survives the reload the dialog tells the player to do.
  await reload.click();
  await ready();
  assert.equal(await page.evaluate(async () => (await window.civic.saveStore.read("rescue")).text), expected,
    "and it is still there afterwards");

  // A second crash does not replace a rescued city nobody has collected.
  await enterGame();
  await page.evaluate(() => window.civic.agent.run(2));
  await page.evaluate(() => { window.civic.renderer.render = () => { throw new Error("a second, later failure"); }; });
  await page.getByRole("dialog", { name: "The game stopped", exact: true }).waitFor({ state: "visible" });
  await page.waitForFunction(() => document.body.innerText.includes("already stored"));
  assert.equal(await page.evaluate(async () => (await window.civic.saveStore.read("rescue")).text), expected,
    "the first rescued city is the one that is kept");

  // A crash while the title screen is still up has to be visible over it. The
  // title styling hides every other child of the app.
  await page.goto(URL);
  await ready();
  assert.equal(await page.getByRole("dialog", { name: "Welcome", exact: true }).isVisible(), true, "the title screen is up");
  await page.evaluate(() => { window.civic.renderer.render = () => { throw new Error("broken before the game started"); }; });
  const overTitle = page.getByRole("dialog", { name: "The game stopped", exact: true });
  await overTitle.waitFor({ state: "visible" });
  assert.match(await overTitle.innerText(), /broken before the game started/, "and the crash dialog is readable over it");

  // A sprite that will not load is not a crash.
  await page.goto(URL);
  await ready();
  await enterGame();
  await page.evaluate(() => {
    const img = document.createElement("img");
    img.src = "assets/civic/there-is-no-such-file.webp";
    document.body.appendChild(img);
  });
  await page.waitForTimeout(400);
  assert.equal(await page.getByRole("dialog", { name: "The game stopped", exact: true }).isVisible(), false,
    "artwork that will not decode does not claim the game has stopped");

  console.log("crash.mjs: a broken render loop is reported over anything on screen, the clock stops, the city is rescued once and downloadable, and it survives the reload");
} finally {
  await browser.close();
}
