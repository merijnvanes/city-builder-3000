export const EXPECTED_VARIANTS = { park: 3 };
export const FAMILY_LAYOUT_COUNTS = { civic: 12, power: 8, water: 4, parks: 5 };
export const FAMILY_COUNTS = { civic: 12, power: 8, water: 4, parks: 3 };

export function belongsToFamily(spec, family) {
  if (family === 'civic') return spec.group === 'civic';
  if (family === 'power') return spec.group === 'utilities' && spec.powerOut > 0;
  if (family === 'water') return spec.group === 'utilities' && (spec.waterOut > 0 || spec.cleansWater);
  if (family === 'parks') return spec.group === 'landscape' && spec.service?.kind === 'park';
  return false;
}
