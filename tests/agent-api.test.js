// agent-api.test.js — the machine-facing command surface, driven headlessly.
//
// The API is wired to the real simulation through the same adapter shape
// main.js supplies, so these tests cover the real build and tick paths.
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as sim from "../src/sim/index.js";
import { planConstruction, applyConstruction, createUndoManager } from "../src/construction.js";
import { createAgentAPI } from "../src/agent-api.js";

// Stand-in for main.js: the same actions, minus the browser.
function harness({ starter = true, seed = 5 } = {}) {
  let city = sim.createCity({ seed, starter, hills: 0 });
  const notices = [];
  const undo = createUndoManager(20);
  let speed = 0;
  const actions = {
    connectNeighbor: link => sim.connectNeighbor(city,link),
    getSpeed: () => speed,
    setSpeed: (n) => { speed = n; },
    setPolicy: (k, v) => sim.setPolicy(city, k, v),
    setOverlay: () => {},
    setDisaster: (id) => sim.disaster(city, id),
    undo: () => undo.undo(city),
    save: () => {}, load: () => {}, listSaves: () => [],
    newCity: () => { city = sim.createCity({ seed: 9, starter: false, hills: 0 }); },
    build: (tool, start, end, options) => {
      const before = structuredClone(city);
      const result = applyConstruction(city, planConstruction(city, start, end, tool, options));
      if (result.ok) undo.record(before);
      return result;
    },
    stepMonths: (n) => { const out = []; for (let i = 0; i < n; i++) { const r = sim.tick(city); if (r.disaster) out.push(r.disaster); } return out; },
  };
  const agent = createAgentAPI({ getCity: () => city, actions, renderer: null, ui: { notify: (m) => notices.push(m) }, undo });
  return { agent, notices, getCity: () => city };
}

// rows[0] and rows[1] are the x ruler; the rest are y-labelled map rows.
const rows = (r) => r.rows.slice(2);
const grid = (r) => rows(r).map((l) => l.replace(/^\s*\d+ /, ""));

describe("discovery", () => {
  test("help() lists every command and every buildable tool", () => {
    const { agent } = harness();
    const h = agent.help();
    for (const name of ["state", "overview", "region", "objects", "field", "query", "find", "problems", "build", "run", "policy"])
      assert.ok(h.commands.includes(name), `help() should list ${name}`);
    assert.equal(h.tools.length, sim.TOOLS.length);
    assert.deepEqual(h.tools.map((t) => t.id).sort(), sim.TOOLS.map((t) => t.id).sort());
    assert.deepEqual(Object.keys(h.ordinances).sort(), Object.keys(sim.ORDINANCES).sort());
  });

  test("the tool list is generated, so it cannot drift from the catalog", () => {
    const { agent } = harness();
    for (const t of agent.help().tools) assert.ok(sim.TOOL_MAP[t.id], `${t.id} is not a real tool`);
  });
});

describe("state", () => {
  test("returns a summary and never the tile array", () => {
    const { agent, getCity } = harness();
    const s = agent.state();
    assert.equal(s.name, getCity().name);
    assert.equal(typeof s.money, "number");
    assert.ok(s.population > 0);
    assert.ok(s.map.size === getCity().size);
    assert.equal(JSON.stringify(s).includes('"terrain"'), false);
    // Whole-state payload has to stay small enough to read every turn.
    assert.ok(JSON.stringify(s).length < 8000, `state() was ${JSON.stringify(s).length} bytes`);
  });
});

describe("map level of detail", () => {
  test("overview() output size does not grow with the map", () => {
    const small = createAt(64), big = createAt(128);
    assert.equal(rows(small.overview()).length, rows(big.overview()).length);
    assert.ok(big.overview().chunk > small.overview().chunk);
  });

  test("region() defaults to the built area and refuses oversized windows", () => {
    const { agent, getCity } = harness();
    const r = agent.region();
    assert.ok(r.box.w <= getCity().size && r.box.h <= getCity().size);
    assert.equal(grid(r)[0].length, r.box.w);
    assert.equal(grid(r).length, r.box.h);
    const big = createAt(128).region(0, 0, 128, 128);
    assert.equal(big.ok, false);
    assert.match(big.error, /limit/);
  });

  test("region() characters match the tiles underneath them", () => {
    const { agent, getCity } = harness();
    const r = agent.region(10, 10, 12, 8);
    const g = grid(r);
    const city = getCity();
    for (let dy = 0; dy < 8; dy++)
      for (let dx = 0; dx < 12; dx++) {
        const t = city.tiles[(10 + dy) * city.size + (10 + dx)];
        const c = g[dy][dx];
        if (t.type === "road") assert.equal(c, "#");
        if (t.type === "empty" && t.terrain === "water") assert.equal(c, "~");
        if (t.type === "residential" && t.level && !t.abandoned) assert.equal(c, "R");
      }
  });

  test("region() reports rare states as coordinates, not as extra characters", () => {
    const { agent } = harness();
    const r = agent.region();
    for (const a of Object.values(r.alerts)) {
      assert.ok(a.count > 0, "empty alert kinds should be dropped");
      assert.ok(a.where.length && a.where.length <= 20, "coordinate samples stay capped");
      for (const [x, y] of a.where) assert.ok(Number.isInteger(x) && Number.isInteger(y));
    }
  });

  test("region() legend only covers what the window contains", () => {
    const { agent } = harness();
    const chars = new Set(grid(agent.region(10, 10, 8, 8)).join(""));
    for (const c of Object.keys(agent.region(10, 10, 8, 8).legend)) assert.ok(chars.has(c));
  });

  test("extra layers align to the same box", () => {
    const { agent } = harness();
    const r = agent.region(8, 8, 10, 6, { layers: ["elev", "power", "pollution", "nonsense"] });
    for (const name of ["elev", "power", "pollution"]) {
      assert.equal(grid(r.layers[name]).length, 6);
      assert.equal(grid(r.layers[name])[0].length, 10);
      assert.ok(r.layers[name].scale);
    }
    assert.match(r.layers.nonsense.error, /Unknown layer/);
    assert.ok(/^[+-]+$/.test(grid(r.layers.power)[0]));
    assert.ok(/^[0-9]+$/.test(grid(r.layers.elev)[0]));
  });

  test("field() folds any map to the same grid and states its scale", () => {
    const small = createAt(64).field("pollution"), big = createAt(128).field("pollution");
    assert.equal(rows(small).length, rows(big).length);
    assert.match(small.scale, /^0 = .+, 9 = .+$/);
    assert.match(createAt(64).field("nope").error, /Unknown field/);
    assert.match(createAt(64).field("service").error, /needs kind/);
    assert.ok(createAt(64).field("service", { kind: "police" }).rows.length);
  });
});

describe("objects", () => {
  test("a lot is one entry, not one per tile", () => {
    const { agent, getCity } = harness();
    const list = agent.objects({ group: "civic" }).objects;
    const city = getCity();
    for (const o of list) {
      const anchor = city.tiles[o.y * city.size + o.x];
      assert.equal(anchor.lot.x, o.x);
      assert.equal(anchor.lot.y, o.y);
      assert.equal(o.w, anchor.lot.w);
    }
    // The starter town has 3x3 civic buildings; nine tiles must yield one row.
    assert.ok(list.some((o) => o.w === 3 && o.h === 3));
  });

  test("roads come back as runs, so a long road is not 40 entries", () => {
    const { agent, getCity } = harness();
    const roads = agent.objects({ type: "road" }).objects;
    const tiles = getCity().tiles.filter((t) => t.type === "road").length;
    assert.ok(roads.length < tiles, `${roads.length} runs should beat ${tiles} tiles`);
    assert.equal(roads.reduce((n, r) => n + r.w, 0), tiles);
  });

  test("underground networks are opt-in", () => {
    const { agent } = harness();
    assert.equal(agent.objects().objects.some((o) => o.type === "pipe"), false);
    const { agent: a2 } = harness();
    a2.build("waterpump", 20, 20);
    a2.build("pipe", 20, 22, 26, 22);
    assert.ok(a2.objects({ networks: true }).objects.some((o) => o.type === "pipe"));
  });

  test("a box restricts the result", () => {
    const { agent } = harness();
    const all = agent.objects().count;
    const some = agent.objects({ box: { x: 0, y: 0, w: 16, h: 16 } });
    assert.ok(some.count < all);
    for (const o of some.objects) assert.ok(o.x < 16 && o.y < 16);
  });
});

describe("building", () => {
  test("build() goes through the same path as a mouse drag", () => {
    const { agent, getCity } = harness({ starter: false });
    const before = getCity().money;
    const r = agent.build("road", 20, 20, 25, 20);
    assert.equal(r.ok, true);
    assert.equal(r.changed, 6);
    assert.equal(getCity().money, before - r.cost);
    for (let x = 20; x <= 25; x++) assert.equal(getCity().tiles[20 * getCity().size + x].type, "road");
  });

  test("a rectangle tool fills the box and a footprint tool centres itself", () => {
    const { agent, getCity } = harness({ starter: false });
    agent.build("road", 20, 24, 30, 24);
    const zoned = agent.build("residential", 20, 20, 23, 23, { density: 1 });
    assert.equal(zoned.changed, 16);
    const before = getCity().tiles.filter((t) => t.type === "police").length;
    agent.build("police", 30, 30);
    const after = getCity().tiles.filter((t) => t.type === "police");
    assert.equal(after.length - before, 9);
    // 3x3 centred on the cursor means the anchor sits one up and one left.
    assert.ok(after.some((t) => t.x === 29 && t.y === 29));
  });

  test("failures come back as data, never as a throw", () => {
    const { agent } = harness({ starter: false });
    assert.match(agent.build("laser", 1, 1).error, /Unknown tool/);
    assert.match(agent.build("road", "a", 1).error, /integer/);
    assert.equal(agent.build("road", -50, -50, -40, -50).ok, false);
    assert.equal(agent.query(-5, -5).title, "Out of bounds");
    assert.match(agent.find("laser").error, /Unknown tool/);
  });

  test("an unaffordable plan is refused and changes nothing", () => {
    const { agent, getCity } = harness({ starter: false });
    getCity().money = 10;
    const r = agent.build("road", 20, 20, 40, 20);
    assert.equal(r.ok, false);
    assert.match(r.error, /Insufficient funds/);
    assert.equal(getCity().money, 10);
  });

  test("every build is announced to the human and kept in the log", () => {
    const { agent, notices } = harness({ starter: false });
    agent.build("road", 20, 20, 25, 20);
    assert.equal(notices.filter((n) => n.startsWith("Agent:")).length, 1);
    const log = agent.log();
    assert.equal(log.at(-1).tool, "road");
    assert.equal(log.at(-1).changed, 6);
  });

  test("undo() reverses the last build", () => {
    const { agent, getCity } = harness({ starter: false });
    const before = getCity().money;
    agent.build("road", 20, 20, 25, 20);
    assert.equal(agent.undo().ok, true);
    assert.equal(getCity().tiles[20 * getCity().size + 20].type, "empty");
    assert.equal(getCity().money, before);
  });
});

describe("find", () => {
  test("only returns spots the game actually accepts", () => {
    const { agent, getCity } = harness({ starter: false });
    const spots = agent.find("coal", { limit: 5 }).spots;
    assert.ok(spots.length);
    for (const s of spots) assert.equal(sim.evaluate(getCity(), s.x, s.y, "coal", { density: 1 }).ok, true);
  });

  test("near sorts by distance", () => {
    const { agent } = harness({ starter: false });
    const near = { x: 40, y: 40 };
    const spots = agent.find("park", { near, limit: 5 }).spots;
    const d = spots.map((s) => Math.abs(s.x - near.x) + Math.abs(s.y - near.y));
    assert.deepEqual(d, [...d].sort((a, b) => a - b));
  });

  test("water is never offered for a land building", () => {
    const { agent, getCity } = harness({ starter: false });
    for (const s of agent.find("park", { limit: 50 }).spots)
      assert.notEqual(getCity().tiles[s.y * getCity().size + s.x].terrain, "water");
  });
});

describe("simulation control", () => {
  test("run() advances whole months and reports the delta", () => {
    const { agent } = harness();
    const before = agent.state();
    const r = agent.run(6);
    assert.equal(r.months, 6);
    assert.equal(agent.state().month, before.month + 6);
    assert.equal(r.population.change, agent.state().population - before.population);
    assert.equal(r.money.change, agent.state().money - before.money);
  });

  test("run() is clamped and coerces junk", () => {
    const { agent } = harness();
    const before = agent.state().month;
    agent.run(0);
    assert.equal(agent.state().month, before + 1);
    assert.equal(agent.run(1e9).months, 240);
  });

  test("speed is clamped to the human range", () => {
    const { agent } = harness();
    assert.equal(agent.speed(9).speed, 3);
    assert.equal(agent.speed(-4).speed, 0);
    assert.equal(agent.state().speed, 0);
  });

  test("policy() reports refusals instead of failing silently", () => {
    const { agent } = harness();
    assert.equal(agent.policy("tax.residential", 12).ok, true);
    assert.equal(agent.state().taxes.residential, 12);
    assert.equal(agent.policy("tax.nonsense", 1).ok, false);
    assert.equal(agent.policy("ordinance.recycling", true).ok, true);
    assert.ok(agent.state().ordinances.includes("recycling"));
  });

  test("slot 0 is a real slot, not a falsy default", () => {
    const seen = [];
    let city = sim.createCity({ seed: 1, starter: false, hills: 0 });
    const agent = createAgentAPI({
      getCity: () => city,
      actions: { save: (s) => seen.push(["save", s]), load: (s) => seen.push(["load", s]), stepMonths: () => [], setSpeed: () => {}, setPolicy: () => ({ ok: false }), getSpeed: () => 0, build: () => ({ ok: false }) },
      renderer: null, ui: { notify: () => {} }, undo: createUndoManager(1),
    });
    // The January autosave lives in slot 0; `int(slot) || 1` sent it to slot 1.
    assert.equal(agent.save(0).slot, 0);
    assert.equal(agent.load(0).slot, 0);
    assert.deepEqual(seen, [["save", 0], ["load", 0]]);
    assert.equal(agent.load(9).slot, 3);
    assert.equal(agent.load("x").slot, 1);
  });

  test("disaster() only accepts known ids", () => {
    const { agent } = harness();
    assert.match(agent.disaster("meteor").error, /Unknown disaster/);
    assert.equal(agent.disaster("fire").ok, true);
  });
});

describe("problems", () => {
  test("ranks the worst first and points at coordinates", () => {
    const { agent } = harness({ starter: false });
    agent.build("road", 20, 24, 30, 24);
    agent.build("residential", 20, 20, 23, 23);
    agent.run(3);
    const p = agent.problems().problems;
    assert.ok(p.length);
    assert.deepEqual(p.map((x) => x.severity), [...p.map((x) => x.severity)].sort((a, b) => b - a));
    const power = p.find((x) => x.kind === "unpowered");
    assert.ok(power && power.where.length);
  });

  test("reports a capacity shortfall, not the coverage percent", () => {
    const { agent, getCity } = harness();
    const city = getCity();
    const plant = city.tiles.find((t) => sim.BUILDINGS[t.type]?.powerOut);
    assert.ok(plant, "the starter town should have a power plant");
    assert.equal(agent.problems().problems.some((p) => p.kind === "power"), false, "a supplied city has no shortfall");

    agent.bulldoze(plant.x, plant.y);
    agent.run(1);
    const p = agent.problems().problems.find((x) => x.kind === "power");
    assert.ok(p, "losing the only plant must report a power shortfall");
    assert.match(p.message, /^Power demand \d+ exceeds supply 0\.$/);
    // getStats().power is a coverage percent, so reading it as {supply,
    // demand} makes the check silently unreachable. Guard against that.
    assert.equal(typeof agent.state().utilities.power, "number");
    assert.ok(city._util.power.demand > city._util.power.supply);
  });

  test("a bankrupt treasury outranks an advisor grumble", () => {
    const { agent, getCity } = harness();
    getCity().money = -5000;
    const p = agent.problems().problems;
    assert.equal(p[0].kind, "bankrupt");
  });
});

describe("robustness", () => {
  test("no command throws on nonsense arguments", () => {
    const { agent } = harness();
    const junk = [undefined, null, NaN, "x", -1, 1e12, {}, []];
    for (const [name, fn] of Object.entries(agent)) {
      if (name === "newCity" || name === "load") continue;
      for (const j of junk) assert.doesNotThrow(() => fn(j, j, j, j, j), `${name}(${String(j)})`);
    }
  });

  test("read commands never mutate the city", () => {
    const { agent, getCity } = harness();
    const before = JSON.stringify(getCity().tiles.map((t) => [t.type, t.density, t.level]));
    agent.state(); agent.overview(); agent.region(); agent.objects({ networks: true });
    agent.field("pollution"); agent.query(20, 20); agent.find("park", { limit: 3 }); agent.problems();
    assert.equal(JSON.stringify(getCity().tiles.map((t) => [t.type, t.density, t.level])), before);
  });
});

function createAt(size) {
  let city = sim.createCity({ seed: 3, starter: true, size, hills: 2 });
  return createAgentAPI({
    getCity: () => city,
    actions: { build: () => ({ ok: false }), stepMonths: () => [], setSpeed: () => {}, setPolicy: () => ({ ok: false }), getSpeed: () => 0 },
    renderer: null, ui: { notify: () => {} }, undo: createUndoManager(1),
  });
}
