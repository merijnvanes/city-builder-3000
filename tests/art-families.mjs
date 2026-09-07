export const EXPECTED_VARIANTS = { park: 3, seaport: 5, stadium: 2 };
export const FAMILY_LAYOUT_COUNTS = { civic: 12, power: 8, water: 4, parks: 5, transport: 9, rewards: 9 };
export const FAMILY_COUNTS = { civic: 12, power: 8, water: 4, parks: 3, transport: 5, rewards: 8 };

export function belongsToFamily(spec, family) {
  if (family === 'civic') return spec.group === 'civic';
  if (family === 'power') return spec.group === 'utilities' && spec.powerOut > 0;
  if (family === 'water') return spec.group === 'utilities' && (spec.waterOut > 0 || spec.cleansWater);
  if (family === 'parks') return spec.group === 'landscape' && spec.service?.kind === 'park';
  if (family === 'transport') return spec.group === 'transport' && !spec.path && !spec.bores && !spec.overlay && !spec.rect && !spec.terrain;
  if (family === 'rewards') return !!spec.reward;
  return false;
}
