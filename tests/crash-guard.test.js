// The last thing the game does before it stops.
//
// frame() reschedules itself on its final line, so a throw anywhere inside it
// ends the render loop. The canvas keeps its last picture and nothing explains
// why. These tests cover the part that decides what counts as a crash, what the
// player is told about it, and how many times.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { installCrashGuard } from "../src/crash-guard.js";

// A stand-in for window: it dispatches, and nothing else.
function fakeTarget() {
  const listeners = new Map();
  return {
    addEventListener: (type, fn) => { listeners.set(type, [...(listeners.get(type) || []), fn]); },
    emit(type, event) { for (const fn of listeners.get(type) || []) fn(event); },
  };
}

const guarded = () => {
  const target = fakeTarget();
  const reports = [];
  const state = installCrashGuard({ target, report: (details) => reports.push(details) });
  return { target, reports, state };
};

describe("crash guard", () => {
  test("reports an uncaught exception with where it came from", () => {
    const { target, reports } = guarded();
    const error = new Error("Cannot read properties of undefined (reading 'tiles')");
    target.emit("error", { message: error.message, error, filename: "http://localhost/src/renderer.js", lineno: 412, colno: 9 });

    assert.equal(reports.length, 1);
    assert.equal(reports[0].message, "Cannot read properties of undefined (reading 'tiles')");
    assert.equal(reports[0].source, "http://localhost/src/renderer.js:412:9");
    assert.ok(reports[0].stack, "the stack comes along for the bug report");
  });

  test("reports a rejected promise nobody caught", () => {
    const { target, reports } = guarded();
    target.emit("unhandledrejection", { reason: new Error("Storage transaction failed.") });

    assert.equal(reports.length, 1);
    assert.equal(reports[0].message, "Storage transaction failed.");
    assert.equal(reports[0].rejection, true);
  });

  test("a rejection with no Error in it still says something", () => {
    const { target, reports } = guarded();
    target.emit("unhandledrejection", { reason: "gave up" });
    target.emit("unhandledrejection", { reason: undefined });

    assert.equal(reports[0].message, "gave up");
    assert.equal(reports.length, 1, "only the first crash is reported");
  });

  test("a sprite that would not load is not a crash", () => {
    // Artwork failing to decode arrives as an error event on the window too.
    // The game falls back to procedural art and plays on; telling the player it
    // has stopped would be a lie.
    const { target, reports, state } = guarded();
    target.emit("error", { target: { tagName: "IMG", src: "assets/civic/airport-day-0.webp" } });

    assert.equal(reports.length, 0);
    assert.equal(state.crashes, 0);
  });

  test("only the first crash is shown, and the rest are counted", () => {
    // A render loop that throws every frame would otherwise bury the page.
    const { target, reports, state } = guarded();
    for (let i = 0; i < 40; i++) target.emit("error", { message: `frame ${i} failed`, error: new Error(`frame ${i} failed`) });

    assert.equal(reports.length, 1);
    assert.equal(reports[0].message, "frame 0 failed", "the first one is the one that explains the rest");
    assert.equal(state.crashes, 40, "the others are still counted");
  });

  test("a report that throws does not take the page down with it", () => {
    const target = fakeTarget();
    installCrashGuard({ target, report: () => { throw new Error("the dialog is broken too"); } });
    assert.doesNotThrow(() => target.emit("error", { message: "first", error: new Error("first") }));
  });

  test("a report that failed is tried once more, and then left alone", () => {
    // A report that threw told the player nothing, so the crash that follows is
    // allowed another go. It does not keep going: the part that is failing is
    // usually the interface, and a third attempt is the same failure again.
    const target = fakeTarget();
    const attempts = [];
    const state = installCrashGuard({ target, report: (details) => { attempts.push(details.message); throw new Error("no dialog"); } });

    for (let i = 0; i < 5; i++) target.emit("error", { message: `crash ${i}`, error: new Error(`crash ${i}`) });
    assert.deepEqual(attempts, ["crash 0", "crash 1"]);
    assert.equal(state.reported, false, "nothing ever reached the player");
    assert.equal(state.crashes, 5);
  });

  test("a report that worked is not repeated", () => {
    const target = fakeTarget();
    const attempts = [];
    const state = installCrashGuard({ target, report: (details) => attempts.push(details.message) });

    target.emit("error", { message: "first", error: new Error("first") });
    target.emit("error", { message: "second", error: new Error("second") });
    assert.deepEqual(attempts, ["first"]);
    assert.equal(state.reported, true);
  });
});
