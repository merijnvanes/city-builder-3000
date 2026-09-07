// The early warning siren.
//
// The manual, page 89: "If you can get your Sims off the streets and inside
// before a disaster strikes, the damage from the disaster will be much less.
// Activate the Early Warning Siren and they will heed your warning and take
// cover. You are the only one who can control this siren, and you should not
// abuse the privilege. If you activate the siren when no emergency is imminent,
// Sims will start to doubt you and may not respond when the need is real."
//
// So the siren is not a free damage reduction. It is a promise, and the value
// of the next one depends on whether the last one was kept.

// Months a sounded siren keeps people indoors.
export const ALERT_MONTHS = 3;
// How much of a disaster a fully trusted warning heads off.
export const MAX_SHELTER = 0.55;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function blankSiren() {
  return { until: 0, trust: 1, cried: 0 };
}

export function parseSiren(raw) {
  const blank = blankSiren();
  if (!raw || typeof raw !== "object") return blank;
  const whole = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : 0);
  const trust = Number.isFinite(raw.trust) && raw.trust >= 0 && raw.trust <= 1 ? raw.trust : 1;
  return { until: whole(raw.until, Number.MAX_SAFE_INTEGER), trust: Math.round(trust * 1000) / 1000, cried: whole(raw.cried, 1000) };
}

export const sirenSounding = (city) => (city.siren?.until ?? 0) > city.month;

// How much of a disaster's damage the warning heads off, 0..1.
export function shelter(city) {
  if (!sirenSounding(city)) return 0;
  return MAX_SHELTER * (city.siren.trust ?? 1);
}

export function sound(city) {
  const siren = city.siren;
  if (sirenSounding(city)) return { ok: false, message: "The siren is already sounding." };
  siren.until = city.month + ALERT_MONTHS;
  siren.cried = (siren.cried || 0) + 1;
  const heeded = Math.round((siren.trust ?? 1) * 100);
  return { ok: true, message: `Sirens sound across the city. ${heeded}% of Sims take cover.` };
}

// Called each month. A warning that came to nothing costs credibility; one
// that was followed by a real disaster earns it back.
export function advanceSiren(city, disasterStruck) {
  const siren = city.siren;
  const news = [];
  if (!siren) return news;
  if (sirenSounding(city)) {
    if (disasterStruck) {
      siren.cried = 0;
      siren.trust = clamp((siren.trust ?? 1) + 0.2, 0, 1);
    }
    return news;
  }
  // The alert has just lapsed with nothing to show for it.
  if (siren.until === city.month && siren.cried > 0) {
    siren.trust = clamp((siren.trust ?? 1) - 0.25, 0.15, 1);
    news.push(`The all clear sounds with no emergency. ${Math.round(siren.trust * 100)}% of Sims say they would heed the next warning.`);
  }
  return news;
}

export const serializeSiren = (siren) => ({ until: siren.until, trust: Math.round(siren.trust * 1000) / 1000, cried: siren.cried });
