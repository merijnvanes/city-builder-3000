// When a new build arrives while somebody is playing.
//
// A service worker that calls skipWaiting on install swaps the code under a
// running page. So a build that arrives mid-session waits, the player is told,
// and the swap happens when they choose. A build that was already waiting when
// the page opened is the other case: the page has just loaded over the network
// and is already running that build, so announcing it would be a lie.
//
// These tests cover the deciding: who is told, when, and what reloads.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { registerServiceWorker } from "../src/service-worker-client.js";

function fakeWorker(state = "installing") {
  const own = new Map();
  const messages = [];
  return {
    state, messages,
    postMessage: (data) => messages.push(data),
    addEventListener: (type, fn) => own.set(type, [...(own.get(type) || []), fn]),
    fire(type) { for (const fn of own.get(type) || []) fn(); },
  };
}

// A stand-in for navigator.serviceWorker and the registration it hands back.
function fakeContainer({ controller = null } = {}) {
  const listeners = new Map();
  const registration = {
    installing: null,
    waiting: null,
    updates: 0,
    listeners: new Map(),
    addEventListener(type, fn) { this.listeners.set(type, fn); },
    fire(type) { this.listeners.get(type)?.(); },
    update() { this.updates++; return Promise.resolve(); },
  };
  return {
    controller,
    registration,
    registered: [],
    addEventListener: (type, fn) => listeners.set(type, [...(listeners.get(type) || []), fn]),
    fire(type) { for (const fn of listeners.get(type) || []) fn(); },
    register(url) { this.registered.push(url); return Promise.resolve(registration); },
  };
}

const fakeLocation = () => ({ href: "https://example.test/", origin: "https://example.test", reloads: 0, reload() { this.reloads++; } });
const fakePage = () => {
  const own = new Map();
  return { hidden: false, addEventListener: (type, fn) => own.set(type, fn), fire: (type) => own.get(type)?.() };
};
// What the browser reports after a page load: the bundle and stylesheet the
// document named, the font the stylesheet pulled, and the artwork the game
// fetched afterwards. Only the first three are the shell.
const fakeTiming = () => ({ getEntriesByType: () => [
  { name: "https://example.test/assets/index-abcd1234.js", initiatorType: "script" },
  { name: "https://example.test/assets/index-abcd1234.css", initiatorType: "link" },
  { name: "https://example.test/assets/nunito-sans-abcd1234.woff2", initiatorType: "css" },
  { name: "https://example.test/assets/civic/hospital-day-0.abcd1234.webp", initiatorType: "img" },
  { name: "https://elsewhere.test/assets/tracker.js", initiatorType: "script" },
] });

const start = (container, extra = {}) => registerServiceWorker({
  container, location: extra.where || fakeLocation(), performance: fakeTiming(), document: extra.page || fakePage(),
  updateEvery: extra.updateEvery, onUpdateReady: extra.onUpdateReady,
});

describe("service worker client", () => {
  test("does nothing where the browser has no service workers", () => {
    assert.equal(registerServiceWorker({ container: undefined }), null);
  });

  test("the first install is not announced", async () => {
    // Nothing to offer: the page is already running the version being cached,
    // and a "new version" notice on a first visit is a lie.
    const container = fakeContainer({ controller: null });
    const offers = [];
    await start(container, { onUpdateReady: (accept) => offers.push(accept) });

    const worker = fakeWorker();
    container.registration.installing = worker;
    container.registration.fire("updatefound");
    worker.state = "installed";
    worker.fire("statechange");

    assert.deepEqual(offers, [], "a first install has nothing to say");
  });

  test("a build arriving mid-session is offered, and waits until the player takes it", async () => {
    const container = fakeContainer({ controller: fakeWorker("activated") });
    const where = fakeLocation();
    const offers = [];
    await start(container, { where, onUpdateReady: (accept) => offers.push(accept) });

    const worker = fakeWorker();
    container.registration.installing = worker;
    container.registration.fire("updatefound");
    worker.state = "installed";
    worker.fire("statechange");

    assert.equal(offers.length, 1, "the player is told once");
    assert.deepEqual(worker.messages, [], "and nothing has been swapped yet");

    // A worker taking over on its own must not pull the page out from under
    // them; only an accepted update reloads.
    container.fire("controllerchange");
    assert.equal(where.reloads, 0, "an unasked-for takeover does not reload the page");

    offers[0]();
    assert.deepEqual(worker.messages, [{ type: "SKIP_WAITING" }], "the worker is asked to step in");
    assert.equal(where.reloads, 0, "and the page waits for it to actually take over");

    container.fire("controllerchange");
    assert.equal(where.reloads, 1, "then reloads, once, into one build");
  });

  test("a build that was already waiting is activated without a word", async () => {
    // The page just loaded over the network, so it is running this build
    // already. Announcing it would be a lie, and reloading would be pointless.
    const container = fakeContainer({ controller: fakeWorker("activated") });
    const where = fakeLocation();
    const waiting = fakeWorker("installed");
    container.registration.waiting = waiting;
    const offers = [];
    await start(container, { where, onUpdateReady: (accept) => offers.push(accept) });

    assert.deepEqual(offers, [], "nothing is announced");
    assert.deepEqual(waiting.messages, [{ type: "SKIP_WAITING" }], "and it takes over quietly");
    assert.equal(where.reloads, 0, "without disturbing the game");
  });

  test("a worker installing before register resolved is still noticed", async () => {
    // updatefound already fired, so watching only for the next one would miss
    // this build entirely.
    const container = fakeContainer({ controller: fakeWorker("activated") });
    const installing = fakeWorker("installed");
    container.registration.installing = installing;
    const offers = [];
    await start(container, { onUpdateReady: (accept) => offers.push(accept) });

    assert.equal(offers.length, 1, "it is caught on the way past");
  });

  test("accepting in a tab the new worker already controls still reloads", async () => {
    // clients.claim() gives the new worker every tab, so in all but the one the
    // player clicked in there is no controllerchange left to fire. Waiting for
    // one would leave a button that does nothing.
    const container = fakeContainer({ controller: fakeWorker("activated") });
    const where = fakeLocation();
    const worker = fakeWorker("activated");
    const offers = [];
    await start(container, { where, onUpdateReady: (accept) => offers.push(accept) });

    container.registration.installing = worker;
    container.registration.fire("updatefound");
    worker.state = "installed";
    worker.fire("statechange");
    assert.equal(offers.length, 1);

    worker.state = "activated";
    offers[0]();
    assert.equal(where.reloads, 1, "it reloads straight away");
  });

  test("a takeover that never comes reloads anyway", async () => {
    const container = fakeContainer({ controller: fakeWorker("activated") });
    const where = fakeLocation();
    const offers = [];
    await start(container, { where, onUpdateReady: (accept) => offers.push(accept) });

    const worker = fakeWorker();
    container.registration.installing = worker;
    container.registration.fire("updatefound");
    worker.state = "installed";
    worker.fire("statechange");
    offers[0]();

    assert.equal(where.reloads, 0, "it waits first");
    await new Promise((resolve) => setTimeout(resolve, 3200));
    assert.equal(where.reloads, 1, "then gives up and reloads");
  });

  test("the shell is handed over with the document that names it", async () => {
    // Stored as a set. A document cached without its bundle is a blank screen
    // the first time the player is offline.
    const controller = fakeWorker("activated");
    const container = fakeContainer({ controller });
    await start(container);

    assert.equal(controller.messages.length, 1);
    const [message] = controller.messages;
    assert.equal(message.type, "CACHE_SHELL");
    assert.equal(message.document, "https://example.test/");
    assert.deepEqual(message.urls, [
      "https://example.test/assets/index-abcd1234.js",
      "https://example.test/assets/index-abcd1234.css",
      "https://example.test/assets/nunito-sans-abcd1234.woff2",
    ], "the document's own files, and not the artwork or anything from elsewhere");
  });

  test("a tab left open looks for a new build when it comes back", async () => {
    // Nothing checks on its own, and this game is played for hours without a
    // navigation.
    const container = fakeContainer({ controller: fakeWorker("activated") });
    const page = fakePage();
    // A page that has only just loaded has nothing to check, so the interval
    // starts at load. Here it is zero, to skip the waiting.
    await start(container, { page, updateEvery: 0 });

    assert.equal(container.registration.updates, 0, "loading is not a check");
    page.hidden = false;
    page.fire("visibilitychange");
    assert.equal(container.registration.updates, 1, "coming back checks");

    page.hidden = true;
    page.fire("visibilitychange");
    assert.equal(container.registration.updates, 1, "leaving is not a reason to check");
  });

  test("a registration that fails does not reach the page", async () => {
    const container = fakeContainer();
    container.register = () => Promise.reject(new Error("not allowed here"));
    const offers = [];
    const result = await start(container, { onUpdateReady: (accept) => offers.push(accept) });

    assert.equal(result, null, "the failure is swallowed, not thrown at the game");
    assert.deepEqual(offers, []);
  });
});
