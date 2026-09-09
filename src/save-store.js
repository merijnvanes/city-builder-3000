// Where a saved city lives.
//
// A developed 128×128 city serialises to about 1.1 MB of JSON. localStorage
// keeps strings as UTF-16, so that is roughly 2.2 MB on disk per slot against a
// per-origin quota near 5 MB. Four large cities do not fit, and the only signal
// the browser gives is a QuotaExceededError thrown at the moment of writing —
// which the game used to swallow, losing a fifty-year city without a word.
//
// IndexedDB has no such ceiling, stores the string without doubling it, and
// fails per transaction so a refusal can be reported. Cities live there. A small
// summary is written beside each one, so listing the slots never parses a
// megabyte of JSON.
//
// Every call is asynchronous because IndexedDB is, and every call answers with a
// result object rather than a throw, the way setPolicy and applyConstruction do.

const DB_NAME = "city-builder-3000";
const DB_VERSION = 1;
const STORE = "cities";

// Slot 0 is the automatic save. Slots 1..3 are the player's. The rescue slot is
// written only when the game crashes, and appears in the save dialog only while
// it holds something.
export const SLOT_COUNT = 3;
export const AUTOSAVE_SLOT = 0;
export const RESCUE_SLOT = "rescue";
export const ALL_SLOTS = [AUTOSAVE_SLOT, ...Array.from({ length: SLOT_COUNT }, (_, i) => i + 1)];
const STORED_SLOTS = [...ALL_SLOTS, RESCUE_SLOT];

// The keys the pre-IndexedDB builds wrote. Slot 1 was the bare key, so the
// mapping cannot be derived and is spelled out.
const LEGACY_PREFIX = "city-builder-3000-save-v3";
const legacyKey = (slot) =>
  slot === 0 ? `${LEGACY_PREFIX}-autosave` : slot === 1 ? LEGACY_PREFIX : `${LEGACY_PREFIX}-slot${slot}`;

const localTextKey = (slot) => `${LEGACY_PREFIX}-${slot}`;
const localMetaKey = (slot) => `${LEGACY_PREFIX}-${slot}-meta`;

export const slotLabel = (slot) =>
  slot === RESCUE_SLOT ? "Rescued city" : slot === AUTOSAVE_SLOT ? "Autosave" : `Slot ${slot}`;

// The four fields the save dialog shows. Reading them back out of a stored city
// is only needed for saves written before summaries existed; a live save hands
// them over without a parse.
// A summary is only usable if it names the city. Anything else describes a slot
// the dialog cannot draw, and the stored city has to be parsed instead.
const named = (meta) => (meta && meta.name != null ? meta : null);

export function summarize(text) {
  try {
    const d = JSON.parse(text);
    if (!d || typeof d !== "object") return null;
    return { name: d.name, population: d.population, money: d.money, month: d.month, startYear: d.startYear };
  } catch { return null; }
}

function quotaMessage(err) {
  if (err?.name === "QuotaExceededError" || /quota/i.test(err?.message || "")) {
    return "Storage is full. Export this city to a file, then clear a save slot.";
  }
  return null;
}

// ── backends ──────────────────────────────────────────────────────────────
// Each one answers the same four calls, so nothing above this line branches on
// which storage the browser gave us.

// A failed IDBRequest bubbles to the transaction, the database and finally the
// window, where it would reach the crash handler as an uncaught error. Stopping
// it here keeps a full disk a save failure rather than a reported crash.
function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => { event.preventDefault(); reject(request.error || new Error("Storage request failed.")); };
  });
}

function indexedBackend(db) {
  const run = (mode, work) => new Promise((resolve, reject) => {
    let transaction;
    try { transaction = db.transaction(STORE, mode); }
    catch (err) { reject(err); return; }
    // The request resolving is not the write landing: only a committed
    // transaction means the city survives the tab closing a millisecond later.
    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = (event) => { event.preventDefault(); reject(transaction.error || new Error("Storage transaction failed.")); };
    transaction.onabort = () => reject(transaction.error || new Error("Storage transaction was aborted."));
    Promise.resolve(work(transaction.objectStore(STORE))).then((value) => { result = value; }, reject);
  });
  return {
    mode: "indexeddb",
    put: (record) => run("readwrite", (store) => promisify(store.put(record))),
    get: (slot) => run("readonly", (store) => promisify(store.get(slot))),
    remove: (slot) => run("readwrite", (store) => promisify(store.delete(slot))),
    all: () => run("readonly", (store) => promisify(store.getAll())),
  };
}

// Firefox in private browsing, and any browser with site data switched off,
// refuses IndexedDB. A city still fits localStorage on the default 64 map, so
// the game keeps saving there rather than losing the feature outright.
function localBackend(ls) {
  const read = (slot) => {
    const text = ls.getItem(localTextKey(slot));
    if (text == null) return undefined;
    let meta = null;
    try { meta = named(JSON.parse(ls.getItem(localMetaKey(slot)) || "null")); } catch { meta = null; }
    return { slot, text, meta: meta || summarize(text), savedAt: meta?.savedAt ?? 0 };
  };
  return {
    mode: "localstorage",
    put: async (record) => {
      // The old summary is dropped before the new city goes in. Writing the
      // city and then failing to write its summary would otherwise leave the
      // slot showing the name and population of the city it replaced.
      ls.removeItem(localMetaKey(record.slot));
      ls.setItem(localTextKey(record.slot), record.text);
      // A summary that will not fit is not worth failing the save for: read()
      // falls back to parsing the city, which is slower and always correct.
      if (named(record.meta)) {
        try { ls.setItem(localMetaKey(record.slot), JSON.stringify({ ...record.meta, savedAt: record.savedAt })); } catch { /* the city itself is what matters */ }
      }
    },
    get: async (slot) => read(slot),
    remove: async (slot) => { ls.removeItem(localTextKey(slot)); ls.removeItem(localMetaKey(slot)); },
    all: async () => STORED_SLOTS.map(read).filter(Boolean),
  };
}

// Nothing is available. Reads come back empty and writes say so, because a
// store that quietly forgets is worse than one that admits it cannot help.
function refusingBackend(reason) {
  const fail = async () => { throw new Error(reason); };
  return { mode: "none", reason, put: fail, get: async () => undefined, remove: async () => {}, all: async () => [] };
}

function openIndexed(idb) {
  return new Promise((resolve, reject) => {
    let request;
    try { request = idb.open(DB_NAME, DB_VERSION); }
    catch (err) { reject(err); return; }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "slot" });
    };
    request.onsuccess = () => {
      const db = request.result;
      // A second tab running a newer build cannot upgrade the database while
      // this connection holds it open. Standing aside costs this tab its
      // storage; refusing would cost the other tab every save it tries.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error("IndexedDB could not be opened."));
    request.onblocked = () => reject(new Error("Another tab is holding an older version of the save database."));
  });
}

export function createSaveStore({
  indexedDB: idb = globalThis.indexedDB,
  localStorage: ls = globalThis.localStorage,
  storage = globalThis.navigator?.storage,
} = {}) {
  let persistRequested = false;

  // Cities left in localStorage are moved into IndexedDB on first run. Two
  // kinds are found there: the keys the original build wrote, and anything the
  // localStorage fallback below saved during a session when IndexedDB was
  // unavailable, which would otherwise stay stranded once it came back.
  //
  // A city is only ever removed from localStorage after the new copy is
  // committed. An occupied target slot is left alone entirely: the newer city
  // in IndexedDB is not overwritten, and the older one keeps its only copy
  // rather than being deleted to tidy up.
  async function adoptLegacy(backend) {
    if (!ls || backend.mode === "none") return;
    // The fallback writes under its own key names, so its cities are a source
    // worth collecting only when moving to a different store. To the fallback
    // itself they are already home.
    const sources = backend.mode === "indexeddb" ? [legacyKey, localTextKey] : [legacyKey];
    for (const slot of STORED_SLOTS) {
      // The rescue slot never existed under the original key names, and
      // legacyKey has no sensible answer for a slot that is not a number.
      const names = slot === RESCUE_SLOT ? sources.filter((name) => name === localTextKey) : sources;
      for (const key of names.map((name) => name(slot))) {
        let text = null;
        try { text = ls.getItem(key); } catch { return; }
        if (text == null) continue;
        try {
          if (await backend.get(slot)) continue;
          await backend.put({ slot, text, meta: summarize(text), savedAt: Date.now() });
          ls.removeItem(key);
          ls.removeItem(localMetaKey(slot));
        } catch { /* leave the old copy where it is and try again next run */ }
      }
    }
  }

  const ready = (async () => {
    let backend;
    if (idb) {
      try { backend = indexedBackend(await openIndexed(idb)); }
      catch { backend = null; }
    }
    // Readable is enough to qualify. Probing with a write would demote a full
    // localStorage to no storage at all, hiding the very cities the player
    // needs to reach in order to free the space.
    if (!backend && ls) {
      try { ls.getItem(`${LEGACY_PREFIX}-probe`); backend = localBackend(ls); }
      catch { backend = null; }
    }
    if (!backend) backend = refusingBackend("This browser is not allowing this site to store data, so cities cannot be saved here. Export to a file instead.");
    await adoptLegacy(backend);
    return backend;
  })();

  // Storage a browser calls "best effort" is the first thing evicted when the
  // disk fills. Asking costs nothing where it is granted on engagement, and the
  // ask waits for a real save so a first visit never meets a permission prompt.
  async function requestPersistence() {
    if (persistRequested || !storage?.persist) return;
    persistRequested = true;
    try { if (!(await storage.persisted?.())) await storage.persist(); } catch { /* not supported here */ }
  }

  return {
    ready,
    mode: async () => (await ready).mode,

    async write(slot, text, meta) {
      const backend = await ready;
      if (backend.reason) return { ok: false, message: backend.reason };
      try {
        await backend.put({ slot, text, meta: meta ?? null, savedAt: Date.now() });
        void requestPersistence();
        return { ok: true };
      } catch (err) {
        return { ok: false, message: quotaMessage(err) || `Saving failed: ${err.message}` };
      }
    },

    async read(slot) {
      const backend = await ready;
      try {
        const record = await backend.get(slot);
        if (!record) return { ok: false, empty: true, message: "No saved city in that slot yet." };
        return { ok: true, text: record.text, meta: record.meta, savedAt: record.savedAt };
      } catch (err) {
        return { ok: false, message: `That save could not be read: ${err.message}` };
      }
    },

    async remove(slot) {
      const backend = await ready;
      try { await backend.remove(slot); return { ok: true }; }
      catch (err) { return { ok: false, message: `That slot could not be cleared: ${err.message}` }; }
    },

    // Every slot, in order, whether or not it holds a city. The dialog draws the
    // empty ones too, so it asks for the full set rather than what exists.
    //
    // A slot holding something unreadable is reported as damaged, never as
    // empty. Empty invites the player to save over it, and whatever is in there
    // may still be recoverable by hand from an export.
    async list() {
      const backend = await ready;
      let records = [];
      try { records = await backend.all(); } catch { records = []; }
      const bySlot = new Map(records.map((r) => [r.slot, r]));
      // The rescue slot is not one of the player's. It is listed only when a
      // crash has put a city there for them to collect.
      const slots = bySlot.has(RESCUE_SLOT) ? [RESCUE_SLOT, ...ALL_SLOTS] : ALL_SLOTS;
      return slots.map((slot) => {
        const record = bySlot.get(slot);
        if (!record) return { slot, label: slotLabel(slot), empty: true };
        const meta = named(record.meta) || summarize(record.text);
        if (!meta) return { slot, label: slotLabel(slot), empty: false, damaged: true, name: "Unreadable save" };
        return { slot, label: slotLabel(slot), empty: false, savedAt: record.savedAt ?? 0, ...meta };
      });
    },
  };
}

export const saveStore = createSaveStore();
