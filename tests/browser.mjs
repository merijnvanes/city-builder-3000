// Browser gameplay checks with Playwright. Run `pnpm dev --port 4173` first.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(8000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("artifacts", { recursive: true });
const money = () => page.evaluate(() => civic.city.money);
const point = (x, y) => page.evaluate(({ x, y }) => civic.renderer.project(x + 0.5, y + 0.5), { x, y });
const tile = (x, y) => page.evaluate(({ x, y }) => civic.city.tiles[y * civic.city.size + x], { x, y });
try {
  await page.goto(process.env.CIVIC_TEST_URL || "http://127.0.0.1:4173");
  await page.waitForFunction(() => window.civic?.city?.tiles.length > 0);
  assert.ok(await page.getByRole("dialog", { name: "Welcome", exact: true }).isVisible(), "title screen shows");
  await page.getByRole("button", { name: "Explore the sample town", exact: true }).click();
  const initial = await money();
  await page.waitForTimeout(2700);
  assert.equal(await page.evaluate(() => civic.city.month), 0, "Starts paused");
  // Zoom out so open land around the town is in view for placement tests.
  await page.evaluate(() => civic.renderer.zoomAt(Math.log(0.5 / civic.renderer.zoom)));

  // Keyboard panning is continuous and stops on release or dialog focus.
  const cameraX = () => page.evaluate(() => civic.renderer.panX);
  const beforePan = await cameraX();
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(180); await page.keyboard.up('ArrowRight');
  assert.ok((await cameraX()) < beforePan - 25, 'held arrow pans continuously');
  const stopped = await cameraX(); await page.waitForTimeout(80);
  assert.equal(await cameraX(), stopped, 'camera stops on release');
  await page.getByTitle('Home view [H]', { exact: true }).click();
  await page.evaluate(() => civic.renderer.zoomAt(Math.log(0.5 / civic.renderer.zoom)));

  // Pick an empty grass tile in view.
  await page.getByRole("button", { name: "Transport", exact: true }).click();
  await page.locator('[data-tool="road"]').click();
  const target = await page.evaluate(() => civic.city.tiles.find((t) => {
    const p = civic.renderer.project(t.x + 0.5, t.y + 0.5);
    return t.type === "empty" && t.terrain === "grass" && !t.trees && p.x > 300 && p.x < 950 && p.y > 220 && p.y < 700 && document.elementFromPoint(p.x, p.y)?.id === "city-canvas";
  }));
  assert.ok(target, "found an empty tile");
  const p = await point(target.x, target.y);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  assert.equal(await money(), initial, "Pointer down only previews");
  await page.keyboard.press("Escape"); await page.mouse.up();
  assert.equal((await tile(target.x, target.y)).type, "empty", "Escape cancels stroke");
  await page.mouse.click(p.x, p.y);
  assert.equal((await tile(target.x, target.y)).type, "road", "Release builds");
  assert.equal(await money(), initial - 10);
  await page.keyboard.press("ControlOrMeta+z");
  assert.equal((await tile(target.x, target.y)).type, "empty", "Undo restores tile");
  assert.equal(await money(), initial, "Undo restores money");
  await page.mouse.click(p.x, p.y);

  // Save, bulldoze, load.
  await page.getByRole("button", { name: "Save city", exact: true }).click();
  await page.locator('[data-tool="bulldoze"]').click(); await page.mouse.click(p.x, p.y);
  assert.equal((await tile(target.x, target.y)).type, "empty");
  await page.getByRole("button", { name: "Load city", exact: true }).click();
  assert.equal((await tile(target.x, target.y)).type, "road", "Load restores the road");

  // Budget: independent taxes, loans.
  await page.getByRole("button", { name: "Open budget", exact: true }).click();
  const tax = page.getByRole("slider", { name: "Residential tax rate", exact: true });
  await tax.fill("12"); await tax.dispatchEvent("input");
  assert.deepEqual(await page.evaluate(() => civic.getStats().taxes), { residential: 12, commercial: 7, industrial: 7 }, "Taxes remain independent");
  // "Loans are available in 5000 Simoleon increments, up to 25K per loan...
  // Total payments made will equal approximately 150% of the original loan
  // amount." And there is no repaying one early.
  const beforeLoan = await money();
  await page.getByRole("button", { name: "Borrow $10,000: $1,500 a year for 10 years", exact: true }).click();
  assert.equal(await page.evaluate(() => civic.city.debt), 15000, "ten annual payments of 15%");
  assert.equal(await money(), beforeLoan + 10000);
  assert.equal(await page.getByRole("button", { name: /Repay/ }).count(), 0, "no early repayment");
  await page.getByRole("button", { name: "Open budget", exact: true }).click();
  await page.getByRole("button", { name: "Toggle Clean Air Act", exact: true }).click();
  assert.equal(await page.evaluate(() => civic.city.ordinances.cleanAir), true, "ordinance toggles");
  await page.keyboard.press("Escape");

  // Dialogs.
  await page.getByRole("button", { name: "City report", exact: true }).click();
  assert.ok(await page.getByRole("dialog", { name: "City Report", exact: true }).isVisible()); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Advisors", exact: true }).click();
  assert.ok(await page.getByRole("dialog", { name: "Advisors", exact: true }).isVisible()); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Disasters", exact: true }).click();
  await page.locator('[data-disaster="fire"]').click();
  assert.ok((await page.evaluate(() => civic.city.tiles.filter((t) => t.fire > 0).length)) > 0, "fire started");

  // Overlays and rotation.
  await page.locator('[data-overlay="crime"]').click();
  assert.equal(await page.evaluate(() => civic.renderer.overlay), "crime");
  await page.locator('[data-overlay="none"]').click();
  for (let i = 1; i <= 4; i++) { await page.getByRole("button", { name: "Rotate right", exact: true }).click(); assert.equal(await page.evaluate(() => civic.renderer.rotation), i % 4); }

  // Footprint placement: a police station on a 3x3 grass site.
  await page.evaluate(() => civic.renderer.zoomAt(Math.log(0.5 / civic.renderer.zoom)));
  await page.getByRole("button", { name: "Civic", exact: true }).click();
  await page.locator('[data-tool="police"]').click();
  const site = await page.evaluate(() => civic.city.tiles.find((t) => {
    const c = civic.city, ok = (x, y) => { const n = c.tiles[y * c.size + x]; return n && n.terrain === "grass" && n.type === "empty" && n.elev === t.elev; };
    const p = civic.renderer.project(t.x + 0.5, t.y + 0.5);
    return p.x > 300 && p.x < 950 && p.y > 220 && p.y < 700 && [-1, 0, 1].every((dx) => [-1, 0, 1].every((dy) => ok(t.x + dx, t.y + dy))) && document.elementFromPoint(p.x, p.y)?.id === "city-canvas";
  }));
  assert.ok(site, "found a 3x3 site");
  const sp = await point(site.x, site.y);
  const beforePolice = await money();
  await page.mouse.click(sp.x, sp.y);
  assert.equal((await tile(site.x, site.y)).type, "police", "police placed at cursor centre");
  assert.equal((await tile(site.x - 1, site.y - 1)).type, "police", "footprint covers 3x3");
  assert.equal(beforePolice - (await money()), 500);

  // Run the simulation.
  await page.keyboard.press("3"); await page.waitForFunction(() => civic.city.month > 0); await page.keyboard.press("0");
  await page.keyboard.press("Escape"); await page.waitForTimeout(100);
  await page.screenshot({ path: "artifacts/desktop.png" });
  await page.getByRole("button", { name: "Toggle day/night", exact: true }).click(); await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => civic.renderer.night), true);
  await page.screenshot({ path: "artifacts/night.png" });
  await page.getByRole("button", { name: "Toggle day/night", exact: true }).click();

  // Mobile layout.
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(150);
  await page.getByTitle("Home view [H]", { exact: true }).click(); await page.waitForTimeout(200);
  for (const name of ["Open budget", "Save city", "Load city", "New city", "Toggle tools"]) {
    const box = await page.getByRole("button", { name, exact: true }).boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= 390, `${name} reachable on mobile`);
  }
  await page.getByRole("button", { name: "Toggle tools", exact: true }).click();
  assert.ok(await page.locator("#toolbar").isVisible());
  await page.getByRole("button", { name: "Toggle tools", exact: true }).click();
  await page.screenshot({ path: "artifacts/mobile.png" });

  // New city flow.
  await page.getByRole("button", { name: "New city", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  assert.ok(await page.evaluate(() => civic.city.population > 0));
  await page.getByRole("button", { name: "New city", exact: true }).click();
  await page.getByRole("combobox", { name: "Starting funds", exact: true }).selectOption("25000");
  await page.getByRole("combobox", { name: "Terrain", exact: true }).selectOption("coast");
  await page.getByRole("button", { name: "Start city", exact: true }).click();
  assert.equal(await page.evaluate(() => civic.city.population), 0);
  assert.equal(await money(), 25000);
  assert.equal(await page.evaluate(() => civic.city.layout), "coast");
  await page.getByRole("button", { name: "Load city", exact: true }).click();
  assert.ok(await page.evaluate(() => civic.city.population > 0));
  assert.deepEqual(errors, [], "No runtime errors");
  console.log("Browser passed: preview/cancel/commit/undo, save/load, taxes, loans, ordinances, dialogs, disasters, overlays, rotation, footprints, simulation, night, mobile, new city.");
} finally { await browser.close(); }
