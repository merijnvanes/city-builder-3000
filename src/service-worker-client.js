// The page's half of the service worker.
//
// Registering one is easy; the part worth writing carefully is the update.
//
// A build that arrives while somebody is playing waits. The player is told, and
// the swap happens when they say so, because reloading ends the session. A build
// that was already waiting when the page opened is a different case: this page
// has just loaded over the network, so it is already running that build's code,
// and telling the player a new version is ready would be a lie. That one is
// activated quietly. It is safe to do because every file the running page could
// still ask for is named by a content hash, so a newer worker cannot answer with
// a different build's version of it.

// What this page loaded to be a game: the bundle, the stylesheet, and the font
// the stylesheet pulls. Their requests happened before any worker was in charge,
// so the worker never saw them and the next visit would still need the network.
// The browser already knows the exact URLs, so there is nothing to guess or
// parse.
//
// The artwork is deliberately not in this list. Sprites are the bulk of what a
// page fetches and they are not the shell: they are cached as they are drawn,
// they are allowed to be evicted, and a city renders without them. Only what the
// document names belongs here.
const SHELL_KINDS = new Set(["script", "link", "css"]);

function shellUrls(performance, origin, page) {
  const found = new Set();
  const keep = (name) => {
    if (typeof name !== "string" || !origin || !name.startsWith(origin)) return;
    found.add(name);
  };
  // What the document names, including the fixed-name loading screen. Missing
  // that one leaves an offline page showing unstyled text while it waits.
  for (const link of page?.querySelectorAll?.("link[rel~=stylesheet][href], script[src]") || []) {
    keep(link.href || link.src);
  }
  // And what those pulled in turn, which is how the font gets here.
  for (const entry of performance?.getEntriesByType?.("resource") || []) {
    if (SHELL_KINDS.has(entry.initiatorType)) keep(entry.name);
  }
  return [...found];
}

// How long to wait for a worker that was asked to step in. If controllerchange
// never comes — a second tab where the new worker already took over through
// clients.claim(), so there is no change left to fire — the reload happens
// anyway rather than leaving a button that does nothing.
const TAKEOVER_GRACE_MS = 3000;
// A tab left open for hours never checks for a new build on its own. Coming back
// to it is the natural moment to look.
const UPDATE_CHECK_MS = 15 * 60 * 1000;

export function registerServiceWorker({
  container = globalThis.navigator?.serviceWorker,
  location: where = globalThis.location,
  performance: timing = globalThis.performance,
  document: page = globalThis.document,
  url = "./sw.js",
  updateEvery = UPDATE_CHECK_MS,
  onUpdateReady,
} = {}) {
  if (!container) return null;

  let reloading = false;

  // Hand the shell over as soon as a worker is in charge, whether it took over
  // during this page's life or was already there when the page opened. The
  // document travels with the files it names, so the worker stores them as a set.
  // Offline play is worth having, and worth nothing next to the update path
  // that shares this registration. A failure here stays here.
  const offerShell = () => {
    try {
      const urls = shellUrls(timing, where?.origin, page);
      if (urls.length && container.controller) {
        container.controller.postMessage({ type: "CACHE_SHELL", document: where.href, urls });
      }
    } catch { /* the next visit will need the network, and that is all */ }
  };

  // The moment a new worker takes over. Reloading here, and only here, means the
  // page that comes back is served entirely by one build.
  container.addEventListener("controllerchange", () => {
    offerShell();
    if (!reloading) return;
    reloading = false;
    where.reload();
  });

  const accept = (worker) => {
    // Already in charge: there is no takeover left to wait for, which is what
    // happens in every tab but the one the player clicked in.
    if (!worker || container.controller === worker || worker.state === "activated") { where.reload(); return; }
    reloading = true;
    worker.postMessage({ type: "SKIP_WAITING" });
    setTimeout(() => { if (reloading) { reloading = false; where.reload(); } }, TAKEOVER_GRACE_MS);
  };

  const registration = container.register(url).then((reg) => {
    // Installed before this page's life began. The page is already running it,
    // so it is activated without a word. See the note at the top.
    if (reg.waiting && container.controller) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    if (container.controller) offerShell();

    // A worker that was already installing when register() resolved has fired
    // its updatefound; watching only for the next one would miss it.
    const watch = (worker) => {
      if (!worker) return;
      const announce = () => {
        if (worker.state === "installed" && container.controller) onUpdateReady?.(() => accept(worker));
      };
      worker.addEventListener("statechange", announce);
      announce();
    };
    watch(reg.installing);
    reg.addEventListener("updatefound", () => watch(reg.installing));

    // Nothing checks for a new build while a tab sits open, and this game is
    // played for hours without a navigation. Coming back to the tab is the
    // moment to look; the page has only just loaded, so the clock starts now.
    let lastCheck = Date.now();
    page?.addEventListener?.("visibilitychange", () => {
      if (page.hidden || Date.now() - lastCheck < updateEvery) return;
      lastCheck = Date.now();
      reg.update?.().catch?.(() => {});
    });
    return reg;
  }).catch(() => null);

  return registration;
}
