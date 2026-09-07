// One definition of the night exposure so drawing code and tests agree.
export const NIGHT_EXPOSURE = 0.62;
export function shadeHex(hex, k) {
  if (typeof hex !== "string" || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1, 7), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, v * k)) | 0);
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("") + hex.slice(7);
}

