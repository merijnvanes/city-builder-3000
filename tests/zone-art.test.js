import test from 'node:test';
import assert from 'node:assert/strict';
import { zoneArtKey } from '../src/zone-art-key.js';
import { civicSpriteSpec, civicSpriteKey } from '../src/civic-sprites.js';
import { spriteVariant } from '../src/architecture-variation.js';
import { drawLotEffects } from '../src/lot-art-effects.js';
import { shadeHex, NIGHT_EXPOSURE } from '../src/art-colors.js';
import { expectedZoneEntries } from './zone-art-contract.mjs';

test('every supported zone lot, density and stage selects its exact authored entry', () => {
  for(const entry of expectedZoneEntries()) {
    const tile={type:entry.type,density:entry.density,level:entry.level,lot:{x:2,y:3,w:entry.size,h:entry.size}};
    assert.equal(zoneArtKey(tile),entry.key);
    assert.equal(civicSpriteKey(tile),entry.key);
    assert.deepEqual(civicSpriteSpec(tile)?.zone,{type:entry.type,density:entry.density,level:entry.level});
    assert.equal(civicSpriteSpec({...tile,lot:{...tile.lot,h:entry.size+1}}),null);
    assert.equal(civicSpriteSpec({...tile,level:5}),null);
  }
  assert.equal(zoneArtKey({type:'residential'}),null);
  assert.equal(civicSpriteSpec({type:'residential'}),null);
});

test('residential architectural seed boundaries survive save/load and coordinate changes', () => {
  for(const count of [4,3,5])for(let i=0;i<count;i++) {
    const tile={type:'residential',x:3,y:7,variant:i/count};
    assert.equal(spriteVariant(tile,count),i);
    assert.equal(spriteVariant({...JSON.parse(JSON.stringify(tile)),x:80},count),i);
    if(i)assert.equal(spriteVariant({...tile,variant:i/count-Number.EPSILON},count),i-1);
  }
});

test('shared lot effects preserve night/abandonment colors and return crane pick bounds', () => {
  const flat=[],lines=[],boxes=[];
  const r={night:true,project:(x,y,z=0)=>({x:x*20,y:y*10-z}),flat:(...a)=>flat.push(a),line:(...a)=>lines.push(a),box:(...a)=>boxes.push(a)};
  const tile={x:1,y:2,type:'residential',age:0,lot:{x:1,y:2,w:2,h:2}};
  const bounds=drawLotEffects(r,tile,50);
  assert.ok(bounds.top < -30);
  assert.ok(lines.length>3);assert.equal(boxes.length,1);
  assert.equal(lines[0][2],shadeHex('#d9c24a',NIGHT_EXPOSURE));
  lines.length=0;
  assert.equal(drawLotEffects(r,{...tile,abandoned:true},50),null);
  assert.equal(flat.length,4);assert.equal(lines.length,0);
  assert.equal(flat[0][5],shadeHex('#6b6a4c',.55*NIGHT_EXPOSURE));
});


test('real residential save/load keeps the legacy terminal seed balcony family', async () => {
  const {blankCity,serialize,deserialize}=await import('../src/sim/city.js');
  const {assignLot}=await import('../src/sim/lots.js');
  const city=blankCity({size:64,hills:0});
  for(const seed of [1,.9996,.9994]) {
    const tile=city.tiles[10*city.size+10];
    Object.assign(tile,{type:'residential',terrain:'grass',density:3,elev:0,trees:0});
    assignLot(city,{x:10,y:10,w:1,h:1},4,seed);
    const restored=deserialize(serialize(city)).tiles[10*city.size+10];
    const expected=restored.variant===1?2:4;
    assert.equal(spriteVariant(restored,5),expected);
    assert.equal(spriteVariant(restored,5)%3,Math.floor(restored.variant*5)%3);
    assert.equal(civicSpriteKey(restored),'residential-d3-l4-s1');
  }
});


test('terminal medium residential seed retains courtyard on larger lots and balconies on one tile',()=>{
 const tile={type:'residential',density:2,variant:1};
 assert.equal(spriteVariant({...tile,lot:{w:2,h:2}},3),0);
 assert.equal(spriteVariant({...tile,lot:{w:1,h:1}},3),2);
});
