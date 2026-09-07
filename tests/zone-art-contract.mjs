import { LOT_SIZES, LOT_SIZES_BY_TYPE } from '../src/sim/catalog.js';
export const ZONE_FAMILIES = ['residential'];
export const zoneVariantCount = (type,density) => type==='residential' ? [0,4,3,5][density] : 0;
export function expectedZoneEntries() {
  return ZONE_FAMILIES.flatMap(type=>[1,2,3].flatMap(density=>[1,2,3,4].flatMap(level=>(LOT_SIZES_BY_TYPE[type]?.[density]||LOT_SIZES[density]).map(size=>({
    key:`${type}-d${density}-l${level}-s${size}`,type,density,level,size,variants:zoneVariantCount(type,density),
  })))));
}
