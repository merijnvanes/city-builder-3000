// economy.js — budget, tax, demand, and advisor calculations

export function getTaxRates(city) {
  if (city.taxes) return city.taxes;
  const r = city.tax ?? 9;
  return { residential: r, commercial: r, industrial: r };
}

export function computeTaxIncome(city, pop, comJobs, indJobs) {
  const t = getTaxRates(city);
  const res = Math.round(pop * (t.residential / 100) * 0.8);
  // 0.5 and 0.45 are base-unit rates; at the default 9% tax this yields ≈0.05 per job
  const com = Math.round(comJobs * 0.5 * (t.commercial / 100));
  const ind = Math.round(indJobs * 0.45 * (t.industrial / 100));
  return res + com + ind;
}

export function computeExpenses(city, counts) {
  const f = city.funding ?? {};
  const pct = (k) => (f[k] ?? 100) / 100;
  const police = Math.round((counts.police || 0) * 120 * pct("police"));
  const fire = Math.round((counts.fire || 0) * 100 * pct("fire"));
  const health = Math.round((counts.hospital || 0) * 200 * pct("health"));
  const education = Math.round((counts.school || 0) * 150 * pct("education"));
  const transport = Math.round(
    ((counts.bus || 0) * 80 + (counts.rail || 0) * 0.4 + (counts.road || 0) * 0.2) * pct("transport"),
  );
  const utilities = (counts.power || 0) * 150 + (counts.water || 0) * 75;
  const sanitation = Math.round((counts.landfill || 0) * 60);
  const parks = Math.round((counts.park || 0) * 4);
  const loanPayment = city.debt > 0 ? Math.min(city.debt, Math.max(1, Math.round(city.debt * 0.02))) : 0;
  const ord = city.ordinances ?? {};
  const ordinanceCosts = (ord.cleanAir ? 50 : 0) + (ord.neighborhoodWatch ? 30 : 0) + (ord.recycling ? 20 : 0);
  const total = police + fire + health + education + transport + utilities + sanitation + parks + loanPayment + ordinanceCosts;
  return { police, fire, health, education, transport, utilities, sanitation, parks, loanPayment, ordinanceCosts, total };
}

export function computeDemand(city, pop, comJobs, indJobs, counts, happiness, utilityRatio) {
  const t = getTaxRates(city);
  const resTaxPenalty = Math.max(0, (t.residential - 9) * 2.5);
  const comTaxPenalty = Math.max(0, (t.commercial - 9) * 2);
  const indTaxPenalty = Math.max(0, (t.industrial - 9) * 1.5);
  const totalJobs = comJobs + indJobs;
  const jobsShortfall = Math.max(0, pop * 0.45 - totalJobs) / 200;

  const res = Math.round(
    Math.max(-100, Math.min(100,
      happiness - 45 + utilityRatio * 40 - (counts.residential || 0) * 0.25 + 25 - jobsShortfall - resTaxPenalty,
    )),
  );
  const com = Math.round(
    Math.max(-100, Math.min(100,
      pop / 25 - (counts.commercial || 0) * 4 + 15 - comTaxPenalty,
    )),
  );
  const ind = Math.round(
    Math.max(-100, Math.min(100,
      (counts.commercial || 0) * 2.5 - (counts.industrial || 0) * 3.5 + 10 - indTaxPenalty,
    )),
  );
  return { residential: res, commercial: com, industrial: ind };
}

export function generateAdvisors(city, stats) {
  const advisors = [];
  const { balance, crime, health, education, demand, unemployment, debt } = stats;

  let finMood = "good", finMsg = "Budget is healthy. Finances look strong.";
  if (balance < 0 && (debt || 0) > 20000) { finMood = "bad"; finMsg = "Heavy debt and deficit. Raise taxes or cut services."; }
  else if (balance < 0) { finMood = "warning"; finMsg = "Running a deficit. Monitor spending carefully."; }
  else if ((debt || 0) > 10000) { finMood = "warning"; finMsg = "Debt is growing. Consider loan repayment."; }
  advisors.push({ name: "Gloria Chen", role: "Finance Director", mood: finMood, message: finMsg });

  const topDemand = Object.entries(demand).sort((a, b) => b[1] - a[1])[0];
  let planMood = "good", planMsg = "City growth is balanced.";
  if (unemployment > 20) { planMood = "warning"; planMsg = "High unemployment. Zone more commercial and industrial areas."; }
  else if (topDemand[1] > 60) { planMood = "warning"; planMsg = `High ${topDemand[0]} demand. Zone more ${topDemand[0]} areas.`; }
  advisors.push({ name: "Marcus Torres", role: "City Planner", mood: planMood, message: planMsg });

  let safeMood = "good", safeMsg = "Crime and fire risk are well managed.";
  if (crime > 60) { safeMood = "bad"; safeMsg = "Crime is out of control. Build more police stations."; }
  else if (crime > 40) { safeMood = "warning"; safeMsg = "Crime is rising. Consider more police coverage."; }
  advisors.push({ name: "Donna Park", role: "Safety Commissioner", mood: safeMood, message: safeMsg });

  let healMood = "good", healMsg = "Health and education services are adequate.";
  if (health < 40) { healMood = "bad"; healMsg = "Public health is poor. Build hospitals and fund health services."; }
  else if (education < 40) { healMood = "warning"; healMsg = "Education coverage is low. Build schools."; }
  advisors.push({ name: "Dr. Yusuf Ali", role: "Health & Education Director", mood: healMood, message: healMsg });

  return advisors;
}

export function generateNews(stats, prevStats, city) {
  if (!prevStats) return [];
  const news = [];
  const popDiff = stats.population - (prevStats.population || 0);
  if (popDiff > 500) news.push(`Population surge: ${stats.population.toLocaleString()} residents!`);
  else if (popDiff < -500) news.push(`Population decline: city at ${stats.population.toLocaleString()}.`);
  if (stats.crime > 70 && (prevStats.crime || 0) <= 70) news.push("Crime wave hits city — residents demand action.");
  if (stats.crime < 30 && (prevStats.crime || 100) >= 30) news.push("Crime rates drop to historic lows.");
  if (stats.balance < 0 && prevStats.balance >= 0) news.push("City enters budget deficit.");
  if ((city.debt || 0) > 50000 && (prevStats.debt || 0) <= 50000) news.push("City debt exceeds $50,000 — financial warning issued.");
  if (stats.pollution > 60 && (prevStats.pollution || 0) <= 60) news.push("Air quality reaches unhealthy levels — residents protest.");
  if (stats.pollution < 20 && (prevStats.pollution || 100) >= 20) news.push("Air quality improves. Citizens applaud the effort.");
  return news;
}
