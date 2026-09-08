// Tunnels. The manual, page 35-36: "A road or rail tunnel will be recommended
// by the city engineers when traversing mountainous terrain... If the
// underground distance is sufficient for the tunnel to be constructed, six
// tiles minimum, the city engineers will ask if you wish to bore a tunnel and
// let you know the cost of this construction. If you accept... the city
// engineers will place a tunnel entrance and exit and bore the tunnel for you."
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { createCity, tick, getStats, place, evaluate, refresh, serialize, deserialize } from "../src/sim.js";
import { findBore, MIN_BORE, TUNNEL_KIND } from "../src/sim/tunnels.js";
import { BUILDINGS } from "../src/sim/catalog.js";

const at = (c, x, y) => c.tiles[y * c.size + x];
const put = (c, x, y, tool, o) => { c.money = 5_000_000; return place(c, x, y, tool, {confirmStructures:true,maxCost:5_000_000,...o}); };

// A flat map with a ridge of the given width raised across it at x = from..to.
function ridge(width, height = 4) {
  const c = createCity({ seed: 5, starter: false, layout: "plains", hills: 0, startYear: 2000 });
  for (const t of c.tiles) if (t.terrain !== "water" && t.x >= 20 && t.x < 20 + width) t.elev = height;
  return c;
}

describe("the engineers' rule", () => {
  test("six tiles of higher ground is the minimum", () => {
    const short = ridge(MIN_BORE - 1);
    assert.equal(findBore(short, 19, 30, "road"), null, "a narrow ridge needs no tunnel");
    const long = ridge(MIN_BORE);
    const run = findBore(long, 19, 30, "road");
    assert.ok(run, "a ridge of the minimum width should be borable");
    assert.equal(run.length, MIN_BORE);
    assert.equal(run.entrance.x, 19);
    assert.equal(run.exit.x, 20 + MIN_BORE);
  });

  test("there has to be higher ground to bore through", () => {
    const flat = createCity({ seed: 5, starter: false, layout: "plains", hills: 0 });
    assert.equal(findBore(flat, 20, 30, "road"), null);
    assert.match(evaluate(flat, 20, 30, "tunnel").message, /No high ground/);
  });

  test("the far side has to come back to the portal's level", () => {
    const c = ridge(8);
    // Raise everything beyond the ridge so the bore never resurfaces.
    for (const t of c.tiles) if (t.terrain !== "water" && t.x >= 28) t.elev = 4;
    assert.equal(findBore(c, 19, 30, "road"), null);
  });

  test("the engineers quote an increasing cost per tile of bore", () => {
    const c = ridge(10);
    const quote = evaluate(c, 19, 30, "tunnel");
    assert.equal(quote.ok, true);
    assert.equal(quote.cost, BUILDINGS.tunnel.cost * 10 + BUILDINGS.road.cost * 100);
    assert.match(quote.message, /Bore a 10-tile road tunnel/);
  });
});

describe("boring one", () => {
  test("it places an entrance, an exit, and the bore between", () => {
    const c = ridge(8);
    assert.equal(put(c, 19, 30, "tunnel").ok, true);
    assert.equal(at(c, 19, 30).type, "road", "entrance");
    assert.equal(at(c, 28, 30).type, "road", "exit");
    for (let x = 20; x < 28; x++) {
      assert.equal(at(c, x, 30).tunnel, TUNNEL_KIND.road, `bore at ${x}`);
      assert.equal(at(c, x, 30).type, "empty", "the ground above is untouched");
      assert.equal(at(c, x, 30).elev, 4, "and keeps its height");
    }
  });

  test("a rail tunnel bores rail", () => {
    const c = ridge(8);
    assert.equal(put(c, 19, 30, "railtunnel").ok, true);
    assert.equal(at(c, 19, 30).type, "rail");
    assert.equal(at(c, 22, 30).tunnel, TUNNEL_KIND.rail);
  });

  test("two tunnels cannot share ground", () => {
    const c = ridge(8);
    put(c, 19, 30, "tunnel");
    assert.equal(evaluate(c, 19, 30, "tunnel").ok, false);
  });
});

describe("what a tunnel is for", () => {
  // Homes on one side, jobs far enough away that the trip is near the limit.
  // Going over a ridge costs a step per level climbed and again per level
  // descended; a bore runs level and costs nothing extra.
  // route: "flat" (no ridge), "over" (road across it), "tunnel" (bored through).
  function town(route) {
    const c = route === "flat"
      ? createCity({ seed: 5, starter: false, layout: "plains", hills: 0, startYear: 2000 })
      : ridge(8, 8);
    for (let x = 4; x <= 19; x++) put(c, x, 30, "road");
    for (let x = 28; x <= 41; x++) put(c, x, 30, "road");
    if (route === "tunnel") put(c, 19, 30, "tunnel");
    else for (let x = 20; x <= 27; x++) put(c, x, 30, "road");
    put(c, 4, 26, "coal");
    for (let y = 27; y <= 30; y++) put(c, 6, y, "powerline");
    for (let x = 7; x <= 41; x++) put(c, x, 29, "powerline");
    for (let y = 31; y <= 33; y++) for (let x = 5; x <= 12; x++) put(c, x, y, "residential", { density: 1 });
    for (let y = 31; y <= 33; y++) for (let x = 36; x <= 41; x++) put(c, x, y, "industrial", { density: 1 });
    refresh(c);
    for (let i = 0; i < 24; i++) tick(c);
    return getStats(c);
  }

  // The trip is long either way, so nobody expects every job to be filled;
  // what matters is that the climb costs commutes and the bore gives them
  // back. See growth.js: the further the work, the slower a block builds out.
  test("climbing a ridge puts jobs out of reach", () => {
    const flat = town("flat"), over = town("over");
    assert.ok(over.employed < flat.employed, `the ridge should cost some commutes: ${over.employed} vs ${flat.employed} on the flat`);
  });

  test("boring through it puts them back in reach", () => {
    const over = town("over"), through = town("tunnel"), flat = town("flat");
    assert.ok(through.employed > over.employed, `tunnel ${through.employed} vs over the top ${over.employed}`);
    assert.ok(through.employed >= flat.employed * 0.95, `the bore is about as good as flat ground: ${through.employed} vs ${flat.employed}`);
  });

  test("nothing joins the line except at the portals", () => {
    const c = ridge(8);
    put(c, 19, 30, "tunnel");
    put(c, 24, 25, "residential", { density: 1 });
    for (let y = 25; y <= 29; y++) put(c, 23, y, "road");
    refresh(c);
    assert.equal(at(c, 24, 25).roadAccess, true, "a house on its own street has access");
    assert.equal(at(c, 24, 34).roadAccess, false, "but the ground over the bore gives none");
  });
});

describe("tunnels persist", () => {
  test("a bore survives a save and a tampered code is rejected", () => {
    const c = ridge(8);
    put(c, 19, 30, "tunnel");
    const d = deserialize(serialize(c));
    assert.equal(at(d, 24, 30).tunnel, TUNNEL_KIND.road);
    tick(c); tick(d);
    assert.equal(serialize(d), serialize(c));

    const bad = JSON.parse(serialize(c));
    bad.tiles[30 * c.size + 24][22] = 5;
    assert.throws(() => deserialize(JSON.stringify(bad)), /bad tunnel/);
  });
});
