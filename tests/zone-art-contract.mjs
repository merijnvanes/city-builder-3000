import { random } from '../src/architecture-variation.js';
import { LOT_SIZES, LOT_SIZES_BY_TYPE } from '../src/sim/catalog.js';
export const ZONE_FAMILIES = ['residential','commercial'];
export const zoneVariantCount = (type,density,size) => type==='residential' ? [0,4,3,5][density] : type==='commercial' ? density===3 ? size===1?3:6 : [0,5,7][density] : 0;
export function expectedZoneEntries() {
  return ZONE_FAMILIES.flatMap(type=>[1,2,3].flatMap(density=>[1,2,3,4].flatMap(level=>(LOT_SIZES_BY_TYPE[type]?.[density]||LOT_SIZES[density]).map(size=>({
    key:`${type}-d${density}-l${level}-s${size}`,type,density,level,size,variants:zoneVariantCount(type,density,size),
  })))));
}


// Find coordinates in the fixture map that select the requested skyline branch.
// The normalized seed still selects one of three families inside that branch.
export function zoneVariantFixture(spec,variant,x=2,y=2) {
  if(spec.zone?.type==='commercial' && spec.zone.density===3) {
    if(spec.tiles>1 || spec.w>1) {
      for(let candidate=2;candidate<13;candidate++) {
        if((random(x,candidate,37)<.45)===(variant>=3)){y=candidate;break;}
      }
    }
    return {x,y,variant:(variant%3+.5)/3};
  }
  return {x,y,variant:(variant+.5)/(spec.variants?.length||spec.artVariants||1)};
}
