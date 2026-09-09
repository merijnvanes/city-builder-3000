// Playing with the network switched off, and taking a new build without losing
// the city.
//
// Run `pnpm build` first. This starts its own server; service workers need a
// secure context, and 127.0.0.1 counts as one.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { startPreview, dist } from "./preview-server.mjs";

const overrides = new Map();
const { server, origin } = await startPreview({ overrides });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

const booted = async () => {
  await page.waitForFunction(() => window.civic?.city?.tiles.length > 0);
  await page.evaluate(() => window.civic.saveStore.ready);
};
const controlled = () => page.waitForFunction(() => !!navigator.serviceWorker.controller);
const enterGame = async () => {
  const explore = page.getByRole("button", { name: "Explore the sample town", exact: true });
  if (await explore.isVisible().catch(() => false)) await explore.click();
};

try {
  await page.goto(`${origin}/`);
  await booted();
  await controlled();
  assert.ok(true, "the worker registered and took control");

  await enterGame();
  await page.evaluate(() => window.civic.agent.run(3));
  // Give the sprite loader time to fill the cache with what a city draws.
  await page.waitForFunction(() => window.civic.renderer.artRevision > 0).catch(() => {});
  await page.evaluate(() => window.civic.agent.save(1));
  const expected = await page.evaluate(() => window.civic.sim.serialize(window.civic.city));

  // Fill the sprite cache past its limit. Artwork is evicted oldest-first, and
  // the bundle, stylesheet and font are hashed files under /assets too: if they
  // shared that cache they would be the first things thrown away, and the game
  // would not start offline.
  await page.evaluate(async () => {
    const cache = await caches.open("city-sprites");
    for (let i = 0; i < 950; i++) {
      await cache.put(new Request(`/assets/civic/filler-${i}.webp`), new Response("x"));
    }
    // One real fetch to trigger the trim.
    await fetch("/assets/civic/filler-trigger.webp").catch(() => {});
  });
  await page.waitForFunction(async () => (await (await caches.open("city-sprites")).keys()).length <= 900,
    null, { timeout: 20000 }).catch(() => { throw new Error("the sprite cache was never trimmed"); });

  // ── the network goes away ───────────────────────────────────────────────
  await context.setOffline(true);
  await page.reload();
  await booted();
  assert.equal(await page.evaluate(() => document.querySelector("#city-canvas").width > 0), true,
    "the game came up with no network at all, with the sprite cache full");

  // And the city is still there, because saves never needed the network.
  await enterGame();
  const loaded = await page.evaluate(() => window.civic.agent.load(1));
  assert.equal(loaded.ok, true, `load reported ${JSON.stringify(loaded)}`);
  assert.equal(await page.evaluate(() => window.civic.sim.serialize(window.civic.city)), expected,
    "the saved city loads offline");

  // Artwork comes from the cache too: the sprites fetched while online are
  // still drawn with the network gone.
  await page.evaluate(() => window.civic.agent.run(1));
  assert.deepEqual(errors, [], `page errors offline: ${errors.join(" | ")}`);

  await context.setOffline(false);

  // ── a new build is deployed while the tab is open ───────────────────────
  // A real deploy changes the page and the bundle it names, not just the
  // worker. `deploy` stands one up: a new worker, a new index naming a new
  // bundle URL, and that bundle served from the same code.
  const sw = readFileSync(join(dist, "sw.js"), "utf8");
  const index = readFileSync(join(dist, "index.html"), "utf8");
  const bundle = readFileSync(join(dist, "assets", index.match(/index-[A-Za-z0-9_-]+\.js/)[0]), "utf8");
  const deploy = (name) => {
    overrides.set("/sw.js", `${sw}\n// ${name}\n`);
    overrides.set("/", index.replace(/index-[A-Za-z0-9_-]+\.js/, `index-${name}.js`));
    overrides.set(`/assets/index-${name}.js`, bundle);
  };
  const checkForUpdate = () => page.evaluate(() => navigator.serviceWorker.ready.then((r) => r.update()));
  const bar = page.locator("#update-bar");

  // Take the first one by reloading into it, the way a returning player would.
  deploy("deploytwo");
  await page.reload();
  await booted();
  await enterGame();
  assert.equal(await bar.isVisible(), false, "a build the page is already running is not announced");

  // Now one arrives mid-session.
  deploy("deploythree");
  await page.evaluate(() => window.civic.agent.run(2));
  const month = await page.evaluate(() => window.civic.city.month);
  await checkForUpdate();
  await bar.waitFor({ state: "visible" });
  assert.match(await bar.innerText(), /new version/i, "the player is told, rather than swapped");
  assert.equal(await page.evaluate(() => window.civic.city.month), month, "and the city is untouched");

  // Later means later.
  await page.getByRole("button", { name: "Keep playing this version", exact: true }).click();
  assert.equal(await bar.isVisible(), false, "the notice can be dismissed");
  assert.equal(await page.evaluate(() => window.civic.city.month), month);

  // With a new worker waiting and unaccepted, the cache must still hold a page
  // and a bundle from the same build. This is the case that catches a worker
  // caching the new document before it is in charge: offline, that document
  // asks for a script nobody has.
  await context.setOffline(true);
  await page.reload();
  await booted();
  assert.equal(await page.evaluate(() => document.querySelector("#city-canvas").width > 0), true,
    "offline part way through a deploy still starts the game the cache holds");
  await context.setOffline(false);

  // Taking it saves the city first, then reloads once into the new build.
  await page.reload();
  await booted();
  await enterGame();
  await page.evaluate(async () => {
    for (const slot of [0]) await window.civic.saveStore.remove(slot);
  });
  await page.evaluate(() => window.civic.agent.run(4));
  const unsaved = await page.evaluate(() => window.civic.sim.serialize(window.civic.city));

  deploy("deployfour");
  await checkForUpdate();
  await bar.waitFor({ state: "visible" });
  await Promise.all([
    page.waitForNavigation(),
    page.getByRole("button", { name: "Reload to the new version", exact: true }).click(),
  ]);
  await booted();
  await controlled();
  assert.equal(await page.locator("#update-bar").isVisible(), false, "and the notice is gone afterwards");
  assert.equal(await page.evaluate(async () => (await window.civic.saveStore.read(0)).text), unsaved,
    "the city was written before the page went, rather than gambled on pagehide");

  assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);
  console.log("offline.mjs: the game plays and loads saves with the network off, and a new build waits to be accepted");
} finally {
  await browser.close();
  server.close();
}
