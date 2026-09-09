// The service worker: offline play, and artwork that survives a cleared HTTP
// cache.
//
// Two rules, split on whether a URL can ever mean something different.
//
// Everything under /assets carries a content hash in its name, so its bytes
// never change. Those are answered from the cache without asking the network,
// which is what makes a city drawn from 5600 sprites open instantly on a second
// visit and at all on a plane.
//
// Everything else keeps a fixed URL and can change with any deploy: the pages,
// the artwork catalogue, this file. Those go to the network first and fall back
// to the cache only when the network is not there. A cached page is a page that
// names a bundle three deploys old, so it is never preferred while online.
//
// Two caches, for two different lifetimes.
//
// SHELL holds the document and the hashed files it names, written together in
// one message from a page that has actually run that build. Writing them as a
// set is the point: a document cached without its bundle is a blank screen
// offline, and a document cached by a worker that is still waiting names a
// bundle nobody has fetched yet. Nothing here is ever evicted to make room.
//
// SPRITES holds the artwork, capped and evicted oldest-first. Its name carries
// no version, because a hashed sprite is correct forever and throwing 90 MB
// away on a worker update would be a cruel way to save nothing.

const VERSION = "v1";
const SHELL = `city-shell-${VERSION}`;
const SPRITES = "city-sprites";
const KEEP = new Set([SHELL, SPRITES]);

// Roughly how many sprites to keep. A big city touches a few hundred; the whole
// collection is 90 MB and filling somebody's disk with it would be rude. Cache
// API keys come back in insertion order, so the oldest go first.
const SPRITE_LIMIT = 900;

const isAsset = (url) => url.pathname.startsWith("/assets/");

self.addEventListener("install", (event) => {
  // No skipWaiting, and nothing cached here. A worker that is still waiting must
  // not touch what the running one is serving: caching the new document now
  // would leave the old worker handing out a page naming a bundle that has never
  // been fetched, which is a blank screen the first time the player is offline.
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter((name) => !KEEP.has(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

// Trims run one at a time. Several sprite fetches finishing together would
// otherwise race over the same keys, each deleting what the others counted on.
let trimming = Promise.resolve();
function trim() {
  trimming = trimming.then(async () => {
    const cache = await caches.open(SPRITES);
    const keys = await cache.keys();
    if (keys.length <= SPRITE_LIMIT) return;
    for (const request of keys.slice(0, keys.length - SPRITE_LIMIT)) await cache.delete(request);
  }).catch(() => {});
  return trimming;
}

self.addEventListener("message", (event) => {
  // The page asks, having told the player what is about to happen.
  if (event.data?.type === "SKIP_WAITING") { self.skipWaiting(); return; }

  // The document and the hashed files it named, from a page that has just run
  // them. Those requests happened before this worker was in charge, so it never
  // saw them and the next visit would still need the network. Taking them now,
  // together, is what makes the second visit work offline.
  if (event.data?.type === "CACHE_SHELL") {
    event.waitUntil(cacheShell(event.data.document, event.data.urls));
  }
});

async function cacheShell(document, urls) {
  if (typeof document !== "string" || !Array.isArray(urls)) return;
  const wanted = [];
  // Only this origin, and only a handful. The list comes from the page, so it is
  // treated as a request rather than an instruction. It is deliberately not
  // restricted to /assets: the loading screen's stylesheet and script keep fixed
  // names, and an offline page without them is unstyled text.
  for (const raw of [document, ...urls].slice(0, 20)) {
    if (typeof raw !== "string") continue;
    let url;
    try { url = new URL(raw, self.location.origin); } catch { continue; }
    if (url.origin !== self.location.origin) continue;
    if (!wanted.includes(url.href)) wanted.push(url.href);
  }
  if (!wanted.includes(new URL(document, self.location.origin).href)) return;

  // Fetched as a set before anything is stored, so a half-written shell never
  // replaces a whole one: a document cached without the bundle it names is a
  // blank screen the first time the player is offline. One failure and the old
  // shell stays exactly as it was.
  const fetched = await Promise.all(wanted.map(async (url) => {
    const response = await fetch(url, { cache: "no-cache" }).catch(() => null);
    return response?.ok ? [url, response] : null;
  }));
  if (fetched.some((entry) => entry === null)) return;

  const cache = await caches.open(SHELL);
  for (const [url, response] of fetched) {
    try { await cache.put(url, response); }
    catch { return; } // Storage refused it; leave the rest of the shell alone.
  }
}

// A hashed name means the bytes behind this URL cannot change. The shell is
// checked first: its files are pinned there and must never be answered from the
// sprite cache, which is allowed to evict.
async function fromCacheFirst(request, event) {
  const pinned = await caches.open(SHELL);
  const kept = await pinned.match(request);
  if (kept) return kept;

  const cache = await caches.open(SPRITES);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    event.waitUntil(trim());
  }
  return response;
}

// A fixed name means the bytes behind this URL can change with any deploy.
async function fromNetworkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    // Only the page itself is stored here, and only by cacheShell, which stores
    // it together with the files it names. A document cached on its own is the
    // blank screen this whole split exists to avoid.
    return response;
  } catch (error) {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Another origin is not this site's business, and the policy forbids one
  // anyway. Range requests are left to the network so media seeking is never
  // answered from a whole-file cache entry.
  if (url.origin !== self.location.origin || request.headers.has("range")) return;
  // This file must never be served from a cache it wrote, or it could never be
  // replaced.
  if (url.pathname === "/sw.js") return;

  event.respondWith(isAsset(url) ? fromCacheFirst(request, event) : fromNetworkFirst(request));
});
