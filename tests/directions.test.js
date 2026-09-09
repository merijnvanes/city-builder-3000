import test from 'node:test';
import assert from 'node:assert/strict';
import { CityRenderer } from '../src/renderer.js';
import { mapPoint } from '../src/minimap-geometry.js';
import { edgeSides, EDGE_DIRECTIONS } from '../src/sim/neighbor-links.js';
import { SIDES } from '../src/sim/neighbors.js';
import { createCity, place, connectNeighbor, serialize, deserialize } from '../src/sim/index.js';

test('cardinal corners rotate with the world; default north is above the other corners', () => {
  const corners = [[0,0],[32,0],[32,32],[0,32]];
  const r = Object.assign(Object.create(CityRenderer.prototype), { size:32 });
  for (let rotation=0; rotation<4; rotation++) {
    r.rotation=rotation;
    const points=corners.map(([x,y])=>{const p=r.orient(x,y);return mapPoint(p.x,p.y,32);});
    const top=points.findIndex(p=>p.y===Math.min(...points.map(q=>q.y)));
    assert.equal(top,(4-rotation)%4);
  }
  assert.deepEqual(EDGE_DIRECTIONS,{northeast:[0,-1],southeast:[1,0],southwest:[0,1],northwest:[-1,0]});
  assert.deepEqual(SIDES,Object.keys(EDGE_DIRECTIONS));
  assert.deepEqual(edgeSides(32,0,0),['northeast','northwest']);
  assert.deepEqual(edgeSides(32,31,31),['southeast','southwest']);
  assert.deepEqual(edgeSides(32,31,0),['northeast','southeast']);
  assert.deepEqual(edgeSides(32,0,31),['southwest','northwest']);
});

test('version 6 connections and deals migrate once without moving counties', () => {
  const c=createCity({starter:false,layout:'plains',hills:0,seed:12,startYear:2000});
  place(c,0,20,'road');
  connectNeighbor(c,{x:0,y:20,side:'northwest',route:'road'});
  const raw=JSON.parse(serialize(c));
  raw.version=6; raw.transportConnections[0].side='west';
  raw.deals={power:{side:'north',kind:'buy',since:0}};
  raw.petitions=[{id:'neighborDeal',status:'pending',since:0,deal:{side:'east',resource:'power',kind:'buy'}}];
  const restored=deserialize(JSON.stringify(raw));
  assert.equal(restored.transportConnections[0].side,'northwest');
  assert.equal(restored.deals.power.side,'northeast');
  assert.equal(restored.petitions[0].deal.side,'southeast');
  assert.equal(restored._connections.northwest.road,1);
  assert.equal(deserialize(serialize(restored)).transportConnections[0].side,'northwest');
  const modern=JSON.parse(serialize(restored));modern.transportConnections[0].side='west';
  assert.throws(()=>deserialize(JSON.stringify(modern)),/county connection/);
});
