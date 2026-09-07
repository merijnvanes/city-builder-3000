import { BUILDINGS } from '../src/sim/catalog.js';
import { expectedZoneEntries, ZONE_FAMILIES } from './zone-art-contract.mjs';
export const EXPECTED_VARIANTS = { park: 3, seaport: 5, stadium: 2, casino: 4, toxicdump: 3, gigamall: 5 };
export const FAMILY_LAYOUT_COUNTS = { civic: 12, power: 8, water: 4, parks: 5, transport: 9, rewards: 9, deals: 14, landmarks: 5, residential: 100, commercial: 136, industrial: 152 };
export const FAMILY_COUNTS = { civic: 12, power: 8, water: 4, parks: 3, transport: 5, rewards: 8, deals: 5, landmarks: 5 };

export function belongsToFamily(spec, family) {
  if (family === 'civic') return spec.group === 'civic';
  if (family === 'power') return spec.group === 'utilities' && spec.powerOut > 0;
  if (family === 'water') return spec.group === 'utilities' && (spec.waterOut > 0 || spec.cleansWater);
  if (family === 'parks') return spec.group === 'landscape' && spec.service?.kind === 'park';
  if (family === 'transport') return spec.group === 'transport' && !spec.path && !spec.bores && !spec.overlay && !spec.rect && !spec.terrain;
  if (family === 'landmarks') return spec.group === 'landmark';
  if (family === 'deals') return !!spec.offer;
  if (family === 'rewards') return !!spec.reward;
  return false;
}

export function familyBuildings(family) {
  if (ZONE_FAMILIES.includes(family)) return expectedZoneEntries().filter(z=>z.type===family).map(z=>[z.key,{
    w:z.size,h:z.size,label:`${z.type} · density ${z.density} · stage ${z.level} · ${z.size}×${z.size}`,
    artVariants:z.variants,zone:{type:z.type,density:z.density,level:z.level},
  }]);
  return Object.entries(BUILDINGS).filter(([,spec])=>belongsToFamily(spec,family));
}
