// Road condition.
//
// The manual's budget page names what the road budget buys: "Road Budget -
// Pays for road and highway maintenance, and keeps roads from falling apart."
// It also warns that "an over funded branch will waste money" and that
// "underfunding causes a loss of effectiveness".
//
// A neglected network does not vanish; it gets slower. Potholed streets carry
// fewer cars before they jam, so skimping on roads shows up as congestion a
// year or two later rather than immediately.

// The worst a network gets, and how fast it drifts toward what the budget
// supports. Repairs take time, and so does decay.
export const WORST = 25;
const DRIFT = 0.12;

// Condition the current road budget will sustain, 0..100. Paying more than
// the department asks for buys nothing: the surplus is waste.
export function targetCondition(city) {
  const pct = Math.min(1, Math.max(0, (city.funding?.road ?? 100) / 100));
  return WORST + (100 - WORST) * pct;
}

// One month of wear and repair. Returns news when the network crosses a
// threshold the mayor should hear about.
export function advanceRoads(city) {
  const before = city.roadCondition ?? 100;
  const target = targetCondition(city);
  const after = before + (target - before) * DRIFT;
  city.roadCondition = Math.round(Math.max(WORST, Math.min(100, after)) * 100) / 100;
  const news = [];
  for (const [mark, message] of [[45, "The roads are breaking up. Traffic is crawling over the potholes."],
                                 [70, "Road surfaces are deteriorating. Raise the road budget."]]) {
    if (before > mark && city.roadCondition <= mark) { news.push(message); break; }
  }
  if (before < 92 && city.roadCondition >= 92) news.push("Road repairs are complete; the network is in good order.");
  return news;
}

// How much of a road's rated capacity a network in this condition delivers.
// A fully maintained road carries its rating; a ruined one little over half.
export const roadCapacity = (city) => 0.55 + 0.45 * ((city.roadCondition ?? 100) / 100);
