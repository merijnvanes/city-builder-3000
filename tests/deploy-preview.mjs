import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { startPreview } from "./preview-server.mjs";

const { server, origin } = await startPreview();

// ── the game, under those headers ─────────────────────────────────────────
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(10000);

const violations = [];
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
// The violation event fires in the page, so it is collected there and read back.
await page.addInitScript(() => {
  window.__cspViolations = [];
  document.addEventListener("securitypolicyviolation", (event) => {
    window.__cspViolations.push(`${event.violatedDirective} blocked ${event.blockedURI || "(inline)"}`);
  });
});
const collect = async () => violations.push(...await page.evaluate(() => window.__cspViolations.splice(0)));

// Every response a visitor receives has to carry the policy, whatever path it
// was reached by.
function checkSecurity(response, what) {
  const headers = response.headers();
  assert.match(headers["content-security-policy"] || "", /default-src 'none'/, `${what}: no policy`);
  assert.doesNotMatch(headers["content-security-policy"], /unsafe-/, `${what}: the policy needs an escape hatch`);
  assert.equal(headers["x-content-type-options"], "nosniff", what);
  assert.equal(headers["referrer-policy"], "no-referrer", what);
  assert.match(headers["permissions-policy"] || "", /geolocation=\(\)/, what);
  assert.match(headers["strict-transport-security"] || "", /max-age=/, what);
  return headers;
}

try {
  const response = await page.goto(`${origin}/`);
  const headers = checkSecurity(response, "the game");
  assert.equal(headers["cache-control"], "public, max-age=0, must-revalidate", "the page is revalidated");
  assert.doesNotMatch(headers["cache-control"], /immutable/);

  await page.waitForFunction(() => window.civic?.city?.tiles.length > 0);
  await page.evaluate(() => window.civic.saveStore.ready);
  await collect();
  assert.deepEqual(violations, [], "the page loads its own script, stylesheet and font");

  // The stylesheet actually applied. A blocked one leaves the body unstyled,
  // which no assertion about headers would catch.
  const styled = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  assert.match(styled, /Nunito Sans/, `the font is in use, got ${styled}`);

  await page.getByRole("button", { name: "Explore the sample town", exact: true }).click();
  await page.evaluate(() => window.civic.agent.run(2));
  await page.evaluate(() => window.civic.agent.save(2));
  await page.evaluate(() => window.civic.agent.load(2));

  // Artwork: a sprite has to have decoded, which means the WebP under /assets
  // was fetched and drawn rather than blocked.
  await page.waitForFunction(() => window.civic.renderer.artRevision > 0, null, { timeout: 15000 })
    .catch(() => { throw new Error("no artwork was drawn, so the sprites did not load"); });

  // Open the interface, which is where a style or script violation would show.
  await page.getByRole("button", { name: "City management", exact: true }).click();
  await page.getByRole("button", { name: "Open budget", exact: true }).click();
  await page.keyboard.press("Escape");
  await collect();
  assert.deepEqual(violations, [], "playing the game violates nothing");

  // An immutable asset really is immutable, and it carries the policy too.
  const stylesheet = await page.evaluate(() => document.querySelector("link[rel=stylesheet]")?.href || null);
  assert.ok(stylesheet, "the page has an external stylesheet");
  const asset = await page.request.get(stylesheet);
  const assetHeaders = checkSecurity(asset, "a hashed asset");
  assert.match(assetHeaders["cache-control"], /immutable/, "hashed assets are kept");
  assert.match(assetHeaders["cache-control"], /max-age=31536000/);

  // The gallery, reached the way a visitor reaches it: the host redirects the
  // .html URL to its clean form and matches the rules against that.
  const redirected = await page.goto(`${origin}/civic-gallery.html`);
  assert.equal(new URL(page.url()).pathname, "/civic-gallery", "the .html URL redirects to the clean one");
  const gallery = checkSecurity(redirected, "the gallery");
  assert.equal(gallery["cache-control"], "public, max-age=0, must-revalidate", "and the clean URL has its cache rule");
  await page.waitForFunction(() => document.querySelectorAll("#collection .card").length > 0)
    .catch(() => { throw new Error("the gallery rendered no cards, so its script or catalogue was blocked"); });
  assert.equal(await page.locator("#error").innerText(), "", "the gallery reported no error");
  await collect();
  assert.deepEqual(violations, [], "the gallery's external script and stylesheet are allowed");

  assert.deepEqual(errors, [], `page errors: ${errors.join(" | ")}`);
  console.log("deploy-preview.mjs: the built site plays under its own headers, with no policy violations, on both pages");
} finally {
  await browser.close();
  server.close();
}
