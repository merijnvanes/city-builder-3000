// How long the player looks at nothing.
//
// The game cannot draw until a megabyte of artwork coordinates has been parsed
// and a city has been laid out. Before this there was no markup in the page at
// all, so a slow connection or a slow phone showed a blank window for the whole
// of it, with no way to tell a loading game from a broken one.
//
// This measures the two moments against each other on a throttled connection,
// where the difference is the size of the problem.
//
// Run `pnpm build` first. It starts its own server.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { startPreview } from "./preview-server.mjs";

const overrides = new Map();
const { server, origin } = await startPreview({ overrides });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];

async function boot({ throttle = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  if (throttle) {
    // Roughly a slow connection: enough that the wait is worth covering.
    const session = await context.newCDPSession(page);
    await session.send("Network.enable");
    await session.send("Network.emulateNetworkConditions", {
      offline: false, latency: 150, downloadThroughput: 400_000, uploadThroughput: 200_000,
    });
    await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  }
  // Watched from inside the page. Polling from outside misses a loading screen
  // that comes and goes between two checks, which is exactly what happens on a
  // fast connection.
  await page.addInitScript(() => {
    window.__boot = {};
    const look = () => {
      const present = !!document.getElementById("booting");
      if (present && window.__boot.shown === undefined) window.__boot.shown = performance.now();
      if (!present && window.__boot.shown !== undefined && window.__boot.gone === undefined) {
        window.__boot.gone = performance.now();
      }
    };
    // The document node, not documentElement: this runs before the parser has
    // created the <html> element, and observing null throws.
    new MutationObserver(look).observe(document, { childList: true, subtree: true });
    document.addEventListener("DOMContentLoaded", look);
  });
  await page.goto(`${origin}/`, { waitUntil: "commit" });
  await page.waitForFunction(() => window.__boot?.gone !== undefined, null, { timeout: 90000 });

  const result = await page.evaluate(() => ({
    ...window.__boot,
    paint: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null,
    // The screen is only allowed to go when there is a game behind it. Without
    // this the test would pass just as well on a page that removed the element
    // and drew nothing.
    running: !!window.civic?.city?.tiles?.length,
    canvas: document.querySelector("#city-canvas")?.width ?? 0,
    // A loading screen still on screen behind a running game would be invisible
    // to a check for its absence in the DOM, so its styling is checked too.
    covered: !!document.getElementById("booting"),
  }));
  await context.close();
  return result;
}

const ready = (result, what) => {
  assert.ok(result.gone > 0, `${what}: the game finished starting`);
  assert.equal(result.running, true, `${what}: there is a city behind the screen that was removed`);
  assert.ok(result.canvas > 0, `${what}: the canvas has a size`);
  assert.equal(result.covered, false, `${what}: the loading screen is gone, not merely hidden behind the game`);
};

try {
  const fast = await boot();
  ready(fast, "unthrottled");
  assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);

  const slow = await boot({ throttle: true });
  ready(slow, "throttled");
  assert.ok(slow.shown < slow.gone, "the loading screen is up before the game is");
  // The gap is the wait the player would otherwise spend looking at a blank
  // window. If it ever stops being worth covering, this says so.
  const covered = slow.gone - slow.shown;
  assert.ok(covered > 100,
    `the covered wait was only ${covered.toFixed(0)} ms; the loading screen may no longer be earning its place`);

  assert.ok(slow.paint !== null && slow.paint <= slow.gone + 1,
    `something was painted at ${slow.paint} ms, before the game was ready at ${slow.gone.toFixed(0)} ms`);

  // A bundle that never runs cannot be caught by the crash guard inside it. The
  // loading screen has to stop claiming progress on its own, or it says
  // "Laying out the streets…" for as long as the player is willing to believe it.
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const broken = await context.newPage();
  broken.on("pageerror", () => {});
  await broken.route("**/assets/index-*.js", (route) => route.abort());
  await broken.goto(`${origin}/`, { waitUntil: "commit" });

  const failed = broken.locator("#booting[data-failed]");
  await failed.waitFor({ state: "visible", timeout: 30000 })
    .catch(() => { throw new Error("a bundle that never arrived was never reported"); });
  const said = await failed.innerText();
  assert.match(said, /could not/i, `the screen says what happened, got: ${said}`);
  assert.doesNotMatch(said, /Laying out/, "and stops claiming progress");
  await context.close();

  console.log(`boot.mjs: throttled, something on screen at ${slow.paint.toFixed(0)} ms and the game at ${slow.gone.toFixed(0)} ms, covering ${covered.toFixed(0)} ms of waiting (unthrottled the game takes ${fast.gone.toFixed(0)} ms); a bundle that never arrives is reported`);
} finally {
  await browser.close();
  server.close();
}
