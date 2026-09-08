import { NIGHT_EXPOSURE, shadeHex } from './art-colors.js';
import { random } from './architecture-variation.js';

// Shared abandonment details for authored and fallback artwork.
export function drawLotEffects(r,t) {
  const { x, y, w, h } = t.lot;
  const k=(t.abandoned ? 0.55 : 1)*(r.night?NIGHT_EXPOSURE:1);
  const tone=color=>k===1?color:shadeHex(color,k);
  if (t.abandoned) {
    for (let i=0;i<4;i++) r.flat(x+(.1+random(t.x,t.y,i)*.7)*w,y+(.1+random(t.y,t.x,i+3)*.7)*h,.12*w,.08*h,.5,tone('#6b6a4c'));
    return null;
  }
  return null;
}
