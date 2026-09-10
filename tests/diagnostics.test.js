// The bug report the game writes about itself.
//
// There is no server and no error reporting service, so the only way a problem
// reaches anybody is if the player sends it. That makes two things matter: the
// report has to hold what a fix would actually need, and it has to survive being
// gathered from a game that has just broken.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { collectDiagnostics, formatDiagnostics, copyText } from "../src/diagnostics.js";

// The dev server puts its own client module in the page ahead of the app's.
const page = ({ scripts = ["/assets/index-abcd1234.js"] } = {}) => ({
  documentElement: { clientWidth: 1280, clientHeight: 900 },
  querySelectorAll: () => scripts.map((src) => ({ getAttribute: () => src, src })),
});

const world = (extra = {}) => ({
  city: { name: "New Riverton", size: 64, month: 37, population: 4200, money: 18234.6, revision: 812, scenario: "sandbox" },
  stats: { date: "Feb 1903", population: 4200, money: 18234.6 },
  renderer: { dpr: 2, zoom: 0.85, rotation: 1, night: false },
  canvas: { width: 2560, height: 1800 },
  quota: { usage: 41, limit: 60000, persisted: true },
  spriteStats: { entries: 308, decodedBytes: 15_500_000, maxDecodedBytes: 33_554_432, loads: 77, speculativeLoads: 231 },
  storage: { where: "indexeddb" },
  tool: "road",
  speed: 2,
  navigator: { userAgent: "Mozilla/5.0 (Macintosh) Chrome/140", language: "en-GB", hardwareConcurrency: 10, deviceMemory: 8, onLine: true },
  location: { pathname: "/" },
  document: page(),
  screen: { width: 2560, height: 1440 },
  performance: { now: () => 84213.7 },
  ...extra,
});

describe("diagnostics", () => {
  test("names the exact build, from what is already in the page", () => {
    // A version string would have to be invented and kept up to date, and would
    // still say less than the hashed filename already on the page.
    assert.equal(collectDiagnostics(world()).build, "index-abcd1234.js");
    // The dev server's own module comes first in the page. Naming it would
    // report "client" as the build on every developer's machine.
    assert.equal(collectDiagnostics(world({
      document: page({ scripts: ["/@vite/client", "/src/main.js"] }),
    })).build, "development");
    assert.equal(collectDiagnostics(world({
      document: page({ scripts: ["/@vite/client", "/assets/index-beef5678.js"] }),
    })).build, "index-beef5678.js");
    assert.equal(collectDiagnostics(world({ document: page({ scripts: [] }) })).build, "development");
  });

  test("holds what a fix would need", () => {
    const report = collectDiagnostics(world());
    assert.equal(report.browser.userAgent, "Mozilla/5.0 (Macintosh) Chrome/140");
    assert.equal(report.display.window, "1280x900");
    assert.equal(report.display.rendererDpr, 2);
    assert.equal(report.city.date, "Feb 1903");
    assert.equal(report.city.money, 18235, "funds are rounded, not printed to the cent");
    assert.equal(report.city.tool, "road");
    assert.equal(report.storage.where, "indexeddb");
    assert.equal(report.artwork.heldMB, 14.8);
    assert.equal(report.upFor, 84.2);
  });

  test("carries the error when there is one, and no error field when there is not", () => {
    const crash = { name: "TypeError", message: "Cannot read properties of undefined", source: "renderer.js:412:9", stack: "at paint\nat frame", rejection: true };
    const withCrash = collectDiagnostics(world({ crash }));
    assert.equal(withCrash.error.message, crash.message);
    assert.equal(withCrash.error.source, crash.source);
    // The name separates a RangeError from a QuotaExceededError, and the flag
    // says whether there was ever a stack to read.
    assert.equal(withCrash.error.name, "TypeError");
    assert.equal(withCrash.error.rejection, true);

    assert.equal(collectDiagnostics(world()).error, null);
  });

  test("gathers from a game that has already fallen over", () => {
    // The report is most needed exactly when the least is available.
    for (const missing of [{ city: null, stats: null }, { renderer: null }, { spriteStats: null }, { storage: null }, { document: null }, { navigator: null }, { screen: null }, { performance: null }]) {
      assert.doesNotThrow(() => formatDiagnostics(collectDiagnostics(world(missing))), JSON.stringify(Object.keys(missing)));
    }
    assert.doesNotThrow(() => formatDiagnostics(collectDiagnostics()));
    // And a report that was never gathered at all.
    assert.doesNotThrow(() => formatDiagnostics());
    assert.doesNotThrow(() => formatDiagnostics({}));
    assert.match(formatDiagnostics({}), /City Builder 3000/);
  });

  test("reads as something a person would paste into a message", () => {
    const text = formatDiagnostics(collectDiagnostics(world({
      crash: { message: "boom", source: null, stack: "at frame (index.js:1:1)" },
    })));
    assert.match(text, /^City Builder 3000 — diagnostics/);
    assert.match(text, /Build: index-abcd1234\.js/);
    assert.match(text, /Name: New Riverton/);
    assert.match(text, /Held: 14\.8 MB of 32 MB/);
    assert.match(text, /Canvas: 2560x1800/);
    assert.match(text, /Message: boom/);
    assert.match(text, /at frame \(index\.js:1:1\)/);
    // Nothing empty left behind by a field that was not there.
    assert.doesNotMatch(text, /: (null|undefined)$/m);
  });

  test("a refused clipboard hands the text back rather than losing it", async () => {
    // A clipboard write needs a secure context and a gesture, and can still be
    // denied. There is no second automatic attempt: the click is spent by the
    // time an awaited write has rejected. The caller shows the text instead, so
    // the text has to come back with the refusal.
    const result = await copyText("the whole report", { clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
    assert.equal(result.ok, false);
    assert.equal(result.text, "the whole report", "the report survives the refusal");
    assert.match(result.message, /refused/);
  });

  test("says so when the browser has no clipboard at all", async () => {
    const result = await copyText("the whole report", { clipboard: undefined });
    assert.equal(result.ok, false);
    assert.equal(result.text, "the whole report");
    assert.match(result.message, /does not let a page write to the clipboard/);
  });

  test("uses the clipboard when it works", async () => {
    const written = [];
    const result = await copyText("hello", { clipboard: { writeText: async (text) => written.push(text) } });
    assert.equal(result.ok, true);
    assert.equal(result.text, "hello");
    assert.deepEqual(written, ["hello"]);
  });
});
