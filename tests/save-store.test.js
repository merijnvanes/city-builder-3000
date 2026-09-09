// A saved city has to survive the browser it was saved in.
//
// The game used to write cities into localStorage inside an empty catch. A
// developed 128×128 city is about 1.1 MB of JSON, stored as UTF-16, so two of
// them fill a 5 MB origin quota and the third save threw a QuotaExceededError
// that nobody ever saw. The player kept playing and the city was already gone.
//
// These tests cover what the store promises when IndexedDB is not there: a
// working localStorage fallback, cities carried over from the old keys, and a
// refusal that is reported rather than swallowed.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createSaveStore, summarize, slotLabel, AUTOSAVE_SLOT } from "../src/save-store.js";

// The pre-IndexedDB key names, spelled out here so a change to them fails the
// migration test rather than silently orphaning everyone's saves.
const LEGACY = {
  0: "city-builder-3000-save-v3-autosave",
  1: "city-builder-3000-save-v3",
  2: "city-builder-3000-save-v3-slot2",
  3: "city-builder-3000-save-v3-slot3",
};

function fakeStorage({ limit = Infinity } = {}) {
  const map = new Map();
  const store = {
    map,
    limit,
    get length() { return map.size; },
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      const used = [...map].reduce((n, [key, value]) => n + key.length + value.length, 0);
      if (used + k.length + String(v).length > store.limit) {
        const err = new Error("The quota has been exceeded.");
        err.name = "QuotaExceededError";
        throw err;
      }
      map.set(k, String(v));
    },
    removeItem: (k) => map.delete(k),
  };
  return store;
}

// Node has no IndexedDB, and the path every player takes runs through it. This
// is the smallest fake that exercises the real code: asynchronous callbacks, a
// transaction that completes after its requests, and errors that arrive as
// cancellable events the way the browser delivers them.
function memoryIndexedDB({ failWrites = false } = {}) {
  const data = new Map();
  const later = (fn) => queueMicrotask(fn);
  const errorEvent = () => ({ preventDefault() {} });

  const request = (work) => {
    const req = { onsuccess: null, onerror: null, result: undefined, error: null };
    later(() => {
      try { req.result = work(); req.onsuccess?.(); }
      catch (err) { req.error = err; req.onerror?.(errorEvent()); }
    });
    return req;
  };

  const db = {
    objectStoreNames: { contains: () => data.has("cities") },
    createObjectStore: () => { data.set("cities", new Map()); },
    onversionchange: null,
    close() {},
    transaction(name, mode) {
      const rows = data.get("cities");
      const transaction = { oncomplete: null, onerror: null, onabort: null, error: null };
      let failed = false, outstanding = 0;
      const guard = (work) => {
        outstanding++;
        return request(() => {
          try { return work(); }
          catch (err) { failed = true; transaction.error = err; throw err; }
          finally { outstanding--; }
        });
      };
      transaction.objectStore = () => ({
        put: (record) => guard(() => {
          if (failWrites) { const err = new Error("The quota has been exceeded."); err.name = "QuotaExceededError"; throw err; }
          rows.set(record.slot, record);
        }),
        get: (slot) => guard(() => rows.get(slot)),
        delete: (slot) => guard(() => { rows.delete(slot); }),
        getAll: () => guard(() => [...rows.values()]),
      });
      // A real transaction commits in a later task, after every request in it
      // has settled and every promise chained off one has run. Completing any
      // sooner would let the code under test believe a write had landed when it
      // had not, which is the bug this whole module exists to prevent.
      const settle = () => {
        if (outstanding > 0) { setTimeout(settle, 0); return; }
        if (failed) transaction.onerror?.(errorEvent()); else transaction.oncomplete?.();
      };
      setTimeout(settle, 0);
      return transaction;
    },
  };

  return {
    seed(record) { if (!data.has("cities")) data.set("cities", new Map()); data.get("cities").set(record.slot, record); },
    open() {
      const req = { onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null, result: db };
      later(() => { if (!data.has("cities")) req.onupgradeneeded?.(); req.onsuccess?.(); });
      return req;
    },
  };
}

const brokenIndexedDB = (opts) => memoryIndexedDB(opts);

const city = (name, population = 1200) =>
  JSON.stringify({ version: 9, name, population, money: 5000, month: 24, startYear: 1900 });

describe("save store", () => {
  test("uses IndexedDB when the browser has it", async () => {
    const store = createSaveStore({ indexedDB: memoryIndexedDB(), localStorage: fakeStorage(), storage: undefined });
    assert.equal(await store.mode(), "indexeddb");

    const meta = { name: "Riverton", population: 1200, money: 5000, month: 24, startYear: 1900 };
    assert.equal((await store.write(1, city("Riverton"), meta)).ok, true);
    assert.equal(JSON.parse((await store.read(1)).text).name, "Riverton");
    assert.equal((await store.list()).find((s) => s.slot === 1).population, 1200);

    assert.equal((await store.remove(1)).ok, true);
    assert.equal((await store.read(1)).empty, true);
  });

  test("reports a failed IndexedDB write rather than assuming it landed", async () => {
    const store = createSaveStore({ indexedDB: memoryIndexedDB({ failWrites: true }), localStorage: undefined, storage: undefined });
    const result = await store.write(1, city("Doomed"), null);
    assert.equal(result.ok, false);
    assert.match(result.message, /Storage is full/);
  });

  test("falls back to localStorage when IndexedDB is missing", async () => {
    const ls = fakeStorage();
    const store = createSaveStore({ indexedDB: undefined, localStorage: ls, storage: undefined });
    assert.equal(await store.mode(), "localstorage");

    const written = await store.write(1, city("Riverton"), { name: "Riverton", population: 1200, money: 5000, month: 24, startYear: 1900 });
    assert.ok(written.ok, written.message);

    const read = await store.read(1);
    assert.ok(read.ok);
    assert.equal(JSON.parse(read.text).name, "Riverton");
  });

  test("reports a full disk instead of losing the city", async () => {
    // Room for one small city and nothing more, which is the shape of the bug:
    // the write throws, and before this store the throw went nowhere.
    const ls = fakeStorage({ limit: 400 });
    const store = createSaveStore({ indexedDB: undefined, localStorage: ls, storage: undefined });
    const first = await store.write(1, city("Riverton"), null);
    assert.ok(first.ok, "the first city fits");

    const second = await store.write(2, city("Overflow").padEnd(2000, " "), null);
    assert.equal(second.ok, false, "a city that does not fit reports failure");
    assert.match(second.message, /Storage is full/, "and says what the player can do about it");

    // The city that was already there is untouched by the failed write.
    assert.equal(JSON.parse((await store.read(1)).text).name, "Riverton");
  });

  test("says so when the browser allows no storage at all", async () => {
    const store = createSaveStore({ indexedDB: undefined, localStorage: undefined, storage: undefined });
    assert.equal(await store.mode(), "none");
    const result = await store.write(1, city("Nowhere"), null);
    assert.equal(result.ok, false);
    assert.match(result.message, /not allowing this site to store data/);
    assert.match(result.message, /Export to a file/, "and points at the way out");
  });

  test("adopts cities written by the localStorage builds", async () => {
    const ls = fakeStorage();
    ls.setItem(LEGACY[0], city("Old Autosave"));
    ls.setItem(LEGACY[1], city("Old Slot One"));
    ls.setItem(LEGACY[3], city("Old Slot Three"));

    const store = createSaveStore({ indexedDB: undefined, localStorage: ls, storage: undefined });
    const slots = await store.list();

    assert.equal(slots.find((s) => s.slot === AUTOSAVE_SLOT).name, "Old Autosave");
    assert.equal(slots.find((s) => s.slot === 1).name, "Old Slot One");
    assert.equal(slots.find((s) => s.slot === 2).empty, true);
    assert.equal(slots.find((s) => s.slot === 3).name, "Old Slot Three");

    // The old keys are released only after the new copy is committed.
    for (const key of Object.values(LEGACY)) assert.equal(ls.getItem(key), null, `${key} released`);
  });

  test("keeps the old copy when it cannot be moved", async () => {
    const ls = fakeStorage();
    ls.setItem(LEGACY[1], city("Stranded"));
    // A database that refuses every write stands in for a disk that is already
    // full at the moment of migration. The city is not deleted for the sake of
    // a move that did not happen.
    const store = createSaveStore({ indexedDB: brokenIndexedDB({ failWrites: true }), localStorage: ls, storage: undefined });
    await store.ready;
    assert.equal(ls.getItem(LEGACY[1]), city("Stranded"), "the only copy stays where it is");
  });

  test("leaves an occupied slot and its older copy both intact", async () => {
    const ls = fakeStorage();
    ls.setItem(LEGACY[1], city("Older"));
    const idb = memoryIndexedDB();
    idb.seed({ slot: 1, text: city("Newer"), meta: { name: "Newer" }, savedAt: 2 });

    const store = createSaveStore({ indexedDB: idb, localStorage: ls, storage: undefined });
    const slots = await store.list();
    assert.equal(slots.find((s) => s.slot === 1).name, "Newer", "the city already in the slot is not overwritten");
    assert.equal(ls.getItem(LEGACY[1]), city("Older"), "and the one that could not move is not deleted either");
  });

  test("rescues cities the localStorage fallback wrote once IndexedDB returns", async () => {
    // A session in a private window saves through the fallback. The next
    // session has IndexedDB again, and those cities have to come with it.
    const ls = fakeStorage();
    const fallback = createSaveStore({ indexedDB: undefined, localStorage: ls, storage: undefined });
    await fallback.write(2, city("Written In Private"), { name: "Written In Private", population: 10, money: 1, month: 0, startYear: 1900 });

    const store = createSaveStore({ indexedDB: memoryIndexedDB(), localStorage: ls, storage: undefined });
    assert.equal(await store.mode(), "indexeddb");
    assert.equal((await store.list()).find((s) => s.slot === 2).name, "Written In Private");
    assert.deepEqual(Object.keys(ls.map).filter((k) => k.includes("save")), [], "nothing is left behind in localStorage");
  });

  test("a full localStorage still shows the cities already in it", async () => {
    // Demoting a full localStorage to no storage at all would hide the saves
    // the player has to reach in order to free the space.
    const ls = fakeStorage();
    const store = createSaveStore({ indexedDB: undefined, localStorage: ls, storage: undefined });
    await store.write(1, city("Trapped"), { name: "Trapped", population: 5, money: 5, month: 0, startYear: 1900 });
    ls.limit = 0;

    const reopened = createSaveStore({ indexedDB: undefined, localStorage: ls, storage: undefined });
    assert.equal(await reopened.mode(), "localstorage", "reading still works when writing does not");
    assert.equal((await reopened.list()).find((s) => s.slot === 1).name, "Trapped");
    assert.equal((await reopened.write(2, city("No Room"), null)).ok, false, "and a new save reports the refusal");
    assert.equal((await reopened.remove(1)).ok, true, "clearing a slot is the way out");
  });

  test("a stored city that will not parse is damaged, not empty", async () => {
    const ls = fakeStorage();
    const store = createSaveStore({ indexedDB: undefined, localStorage: ls, storage: undefined });
    await store.write(2, "{ truncated", null);

    const slot = (await store.list()).find((s) => s.slot === 2);
    assert.equal(slot.empty, false, "an occupied slot is never offered as free space");
    assert.equal(slot.damaged, true);
    assert.equal((await store.read(2)).text, "{ truncated", "and the bytes are still there to hand back");
  });

  test("a stale summary never outlives the city it described", async () => {
    // The city goes in, the summary does not fit. Listing the slot must not
    // claim it still holds the city it replaced.
    const ls = fakeStorage();
    const store = createSaveStore({ indexedDB: undefined, localStorage: ls, storage: undefined });
    await store.write(1, city("First"), { name: "First", population: 1, money: 1, month: 0, startYear: 1900 });
    ls.limit = [...ls.map].reduce((n, [k, v]) => n + k.length + v.length, 0) + city("Second").length + 40;
    await store.write(1, city("Second"), { name: "Second", population: 2, money: 2, month: 0, startYear: 1900 });

    assert.equal((await store.list()).find((s) => s.slot === 1).name, "Second");
  });

  test("lists every slot, filled or not, with a label", async () => {
    const ls = fakeStorage();
    const store = createSaveStore({ indexedDB: undefined, localStorage: ls, storage: undefined });
    await store.write(2, city("Only One"), { name: "Only One", population: 300, money: 90, month: 12, startYear: 1900 });

    const slots = await store.list();
    assert.deepEqual(slots.map((s) => s.slot), [0, 1, 2, 3]);
    assert.deepEqual(slots.map((s) => s.label), ["Autosave", "Slot 1", "Slot 2", "Slot 3"]);
    assert.deepEqual(slots.map((s) => s.empty), [true, true, false, true]);
    assert.equal(slots[2].population, 300, "the summary rides along, so listing parses nothing");
  });

  test("clearing a slot empties it", async () => {
    const ls = fakeStorage();
    const store = createSaveStore({ indexedDB: undefined, localStorage: ls, storage: undefined });
    await store.write(3, city("Temporary"), null);
    assert.equal((await store.read(3)).ok, true);

    assert.equal((await store.remove(3)).ok, true);
    const gone = await store.read(3);
    assert.equal(gone.ok, false);
    assert.equal(gone.empty, true);
  });

  test("summarize survives a save that is not JSON", () => {
    assert.equal(summarize("<html>not a city</html>"), null);
    assert.equal(summarize("null"), null);
    assert.equal(summarize(city("Parsed")).name, "Parsed");
  });

  test("labels name the autosave rather than calling it slot zero", () => {
    assert.equal(slotLabel(0), "Autosave");
    assert.equal(slotLabel(2), "Slot 2");
  });
});
