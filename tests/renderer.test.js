import test from "node:test";
import assert from "node:assert/strict";
import { CityRenderer } from "../src/renderer.js";

function camera() {
  return Object.assign(Object.create(CityRenderer.prototype), {
    w: 1440,
    h: 900,
    zoom: 1,
    panX: 0,
    panY: 0,
    size: 64,
    minZoom: 0.3,
    maxZoom: 2.8,
  });
}
test("isometric picking selects every tile after pan and zoom", () => {
  const r = camera();
  r.zoom = 1.73;
  r.panX = -117;
  r.panY = 209;
  for (let x = 0; x < 40; x++)
    for (let y = 0; y < 40; y++) {
      const p = r.project(x + 0.5, y + 0.5);
      assert.deepEqual(r.pick(p.x, p.y), { x, y });
    }
});
test("zoom stays anchored at the pointer and clamps extreme input", () => {
  const r = camera(),
    point = r.project(12.5, 19.5);
  r.zoomAt(0.5, point.x, point.y);
  const next = r.project(12.5, 19.5);
  assert.ok(Math.abs(point.x - next.x) < 1e-8);
  assert.ok(Math.abs(point.y - next.y) < 1e-8);
  r.zoomAt(100);
  assert.equal(r.zoom, 2.8);
  r.zoomAt(-100);
  assert.equal(r.zoom, 0.3);
});
test("home clears camera displacement", () => {
  const r = camera();
  r.pan(100, 250);
  r.home();
  assert.equal(r.panX, 0);
  assert.equal(r.panY, 0);
  assert.equal(r.dirty, true);
});

test('isometric picking remains exact in all four orientations',()=>{
 for(let rotation=0;rotation<4;rotation++){
  const r=camera();r.rotation=rotation;r.size=40;r.zoom=.73;r.panX=78;r.panY=-120;
  for(let x=0;x<40;x+=3)for(let y=0;y<40;y+=3){const p=r.project(x+.5,y+.5);assert.deepEqual(r.pick(p.x,p.y),{x,y});}
 }
});

test('facade windows stay between floor bands and below the roof', () => {
  for (const [height, base, floorHeight] of [[48, 0, 8], [90, 8, 8], [136, 10, 6]]) {
    const r = camera();
    const panes = [];
    r.project = (x, y, z = 0) => ({ x, y, z });
    r.poly = points => panes.push(points);
    r.windows(0, 0, 1.5, 1, height, 1, true, base, true, floorHeight);
    assert.ok(panes.length > 10);
    for (const pane of panes) {
      const low = Math.min(...pane.map(p => p.z));
      const high = Math.max(...pane.map(p => p.z));
      assert.ok(low > base && high < base + height, 'panes fit inside the facade');
      for (let band = base; band <= base + height; band += floorHeight) {
        assert.ok(band < low || band > high, 'floor band does not cut through glass');
      }
    }
  }
});

test('earthquake shake expires while paused and does not mutate saved effects', () => {
  const r = camera(), effect = { type: 'earthquake', ttl: 1 };
  const city = { effects: [effect] };
  assert.notDeepEqual(r.shakeOffset(city, 100), { x: 0, y: 0 });
  const end = r.shakeOffset(city, 1001);
  assert.equal(Math.abs(end.x) + Math.abs(end.y), 0);
  assert.equal(r.shakeUntil, 1000, 'the same effect never restarts the shake');
  assert.deepEqual(effect, { type: 'earthquake', ttl: 1 });
  city.effects.push({ type: 'earthquake', ttl: 1 });
  r.shakeOffset(city, 1100);
  assert.equal(r.shakeUntil, 2000, 'a second earthquake shakes again');
  r.shakeOffset({ effects: [] }, 1101);
  assert.equal(r.shakeUntil, 0, 'loading another city clears camera shake');
});
