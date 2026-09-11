// What the game tells the player about where their city lives.
//
// The note exists because the honest version of "nothing is sent anywhere" is
// also "nothing is backed up anywhere". A browser is allowed to throw away what
// a site stored, and a player who has not been told that finds out by losing a
// city. So the note has to be reachable before anything goes wrong, and it has
// to say the awkward half rather than only the reassuring one.
//
// It also has to stay true. Every claim below is checked against the game, not
// just against the text: if the game ever gains a network call, the note is
// wrong and this fails.
//
// Run `pnpm dev:test` first.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";

const SITE = process.env.CIVIC_TEST_URL || "http://127.0.0.1:4173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

// Everything the page asks for, with the method, so the claim is checked rather
// than taken on trust. A same-origin POST carrying a city would pass a check
// that only looked at hostnames.
const requested = [];
page.on("request", (request) => requested.push({ url: request.url(), method: request.method(), body: request.postData() }));

// Whether the game actually asks the browser to keep the cities, which the note
// says it does.
await page.addInitScript(() => {
  window.__persistCalls = 0;
  if (navigator.storage?.persist) {
    const real = navigator.storage.persist.bind(navigator.storage);
    navigator.storage.persist = () => { window.__persistCalls++; return real(); };
  }
});

try {
  await page.goto(SITE);
  await page.waitForFunction(() => window.civic?.city?.tiles.length > 0);
  const explore = page.getByRole("button", { name: "Explore the sample town", exact: true });
  if (await explore.isVisible().catch(() => false)) await explore.click();

  // Reachable from the game menu, without a crash and without digging.
  await page.locator(".city-menu summary").click();
  await page.getByRole("button", { name: "Where your city is kept", exact: true }).click();
  const note = page.getByRole("dialog", { name: "Where your city is kept", exact: true });
  await note.waitFor({ state: "visible" });
  const text = await note.innerText();

  // The reassuring half.
  assert.match(text, /kept in this browser/i, "says where cities are kept");
  assert.match(text, /no account and no server/i, "says what is not there");
  assert.match(text, /never sends your city/i);

  // The half that costs somebody a city if it goes unsaid.
  assert.match(text, /allowed to clear/i, "says the browser may throw it away");
  assert.match(text, /private window/i, "and that a private window keeps nothing");
  assert.match(text, /request and not a guarantee/i, "does not oversell persistent storage");
  assert.match(text, /another browser, or\s+on another device/i, "says a city does not follow the player");
  assert.match(text, /Nothing here is locked/i, "and does not pretend the city is private on a shared device");

  // And what to do about it.
  assert.match(text, /Export to a file/i, "points at the way to keep a copy");
  assert.match(text, /only when you press it/i, "and is clear that diagnostics are not automatic");

  // The claim it would be easiest to get wrong: what the note says about where
  // storage is going has to be what storage is actually doing.
  const mode = await page.evaluate(() => window.civic.saveStore.mode());
  const expected = { indexeddb: /own database/i, localstorage: /simpler storage/i, none: /not letting the game store/i }[mode];
  assert.ok(expected, `unknown storage mode ${mode}`);
  assert.match(text, expected, `storage is ${mode} but the note says otherwise`);

  // The way out leads somewhere useful rather than just closing.
  await page.getByRole("button", { name: "Save slots and files", exact: true }).click();
  await page.getByRole("dialog", { name: "Files", exact: true }).waitFor({ state: "visible" });
  assert.equal(await note.isVisible(), false, "and the note gets out of the way");
  await page.keyboard.press("Escape");

  // Also reachable from the help dialog, which is where somebody looking for it
  // would look first.
  await page.locator(".city-menu summary").click();
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.getByRole("button", { name: "Where your city is kept", exact: true }).click();
  await note.waitFor({ state: "visible" });
  await page.keyboard.press("Escape");

  // The claim itself. Playing the game, saving, loading and turning the camera
  // must not have asked anything of anywhere else.
  await page.evaluate(() => window.civic.agent.run(3));
  await page.evaluate(() => window.civic.agent.save(1));
  await page.evaluate(() => window.civic.agent.load(1));
  await page.evaluate(() => window.civic.renderer.rotate(1));
  await page.waitForTimeout(600);

  // The note says the game asks the browser to keep the cities. It has to, and
  // this is read before navigating: the init script runs again on the next page
  // and would reset the count.
  assert.ok(await page.evaluate(() => window.__persistCalls) > 0,
    "no persistent-storage request was made, so the note's claim is not true");

  // The gallery page too, since it is served from the same site.
  await page.goto(`${SITE}/civic-gallery.html`);
  await page.waitForFunction(() => document.querySelectorAll("#collection .card").length > 0).catch(() => {});

  const origin = new URL(SITE).origin;
  const elsewhere = requested.filter(({ url }) => {
    if (url.startsWith("data:") || url.startsWith("blob:")) return false;
    // Compared as origins, not as a string prefix: 127.0.0.1:41730 starts with
    // 127.0.0.1:4173 and would slip through.
    try { return new URL(url).origin !== origin; } catch { return true; }
  });
  assert.deepEqual(elsewhere.map(({ url }) => url), [], "the game asked something of another origin");

  // And nothing was sent anywhere, even here. Everything the game asks for is a
  // read: a same-origin POST carrying a city would be invisible to a check on
  // hostnames alone.
  const sent = requested.filter(({ method }) => method !== "GET" && method !== "HEAD");
  assert.deepEqual(sent.map(({ method, url }) => `${method} ${url}`), [], "the game sent a request with a body");


  assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);
  console.log(`privacy.mjs: the note is reachable from the menu and from help, matches what storage is actually doing, and across ${requested.length} requests the game asked nothing of another origin and sent nothing anywhere`);
} finally {
  await browser.close();
}
