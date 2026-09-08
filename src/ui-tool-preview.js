import { CIVIC_SPRITES } from './civic-sprite-manifest.js';

// Use the game's authored artwork. Only the open palette requests its images.
export function toolPreview(id) {
  const key = ['residential', 'commercial', 'industrial'].includes(id) ? `${id}-d2-l3-s2` : id;
  const frame = CIVIC_SPRITES[key]?.frames['day-0'];
  if (!frame) return null;
  const image = document.createElement('img');
  image.className = 'tool-art';
  image.alt = '';
  image.decoding = 'async';
  image.dataset.src = `${import.meta.env?.BASE_URL || './'}assets/civic/${frame.file}`;
  return image;
}
