// Taxes, department budgets, ordinances and loans.
import { BUILDINGS, ZONE_TYPES, PORT_TYPES, DEPARTMENTS, FUNDED_DEPARTMENTS, ROAD_TYPES } from "./catalog.js";
import { isAnchor, capacityOf } from "./lots.js";
import { industryTraits } from "./industry.js";
import { commerceTraits } from "./commerce.js";
import { ORDINANCES } from "./city.js";
import { dealTerms } from "./neighbors.js";
import { portUpkeep } from "./ports.js";

export const LOAN_AMOUNT = 10000;
export const LOAN_MONTHS = 60;
export const LOAN_RATE = 0.005; // monthly
export const MAX_DEBT = 100000;

export function loanPayment(amount, months = LOAN_MONTHS, r = LOAN_RATE) {
  return Math.round(amount * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1));
}

const wealth = (t) => 0.7 + ((t.landValue ?? 40) / 100) * 0.6;

export function computeBudget(city) {
  const { tiles, taxes, funding = {}, ordinances = {} } = city;
  const income = { residential: 0, commercial: 0, industrial: 0, ordinances: 0, deals: 0, neighbors: 0, total: 0 };
  const expenses = Object.fromEntries(DEPARTMENTS.map((d) => [d, 0]));
  expenses.ordinances = 0; expenses.loans = 0; expenses.neighbors = 0;
  let population = 0;
  const pct = (d) => (FUNDED_DEPARTMENTS.includes(d) ? (funding[d] ?? 100) / 100 : 1);

  for (const t of tiles) {
    if (ROAD_TYPES.has(t.type) && t.type !== "onramp") { expenses[BUILDINGS[t.type].dept] += BUILDINGS[t.type].upkeep; continue; }
    if (!isAnchor(t)) continue;
    if (ZONE_TYPES.has(t.type)) {
      const cap = capacityOf(t);
      if (!cap) continue;
      if (t.type === "residential") { population += cap; income.residential += cap * (taxes.residential / 100) * 1.4 * wealth(t); }
      else if (t.type === "commercial") income.commercial += cap * (taxes.commercial / 100) * 1.4 * wealth(t) * commerceTraits(t).value;
      else income.industrial += cap * (taxes.industrial / 100) * 1.2 * industryTraits(t).value * (ordinances.wasteTax ? 1.15 : 1);
      continue;
    }
    // A terminal costs the transit department by the acre it covers.
    if (PORT_TYPES.has(t.type)) { expenses.transit += portUpkeep(t); continue; }
    const b = BUILDINGS[t.type];
    if (b) expenses[b.dept] += b.upkeep;
    if (b?.offer) income.deals += b.offer.income;
  }
  for (const d of FUNDED_DEPARTMENTS) expenses[d] = Math.round(expenses[d] * pct(d));
  for (const d of DEPARTMENTS) expenses[d] = Math.round(expenses[d]);

  for (const [key, on] of Object.entries(ordinances)) {
    if (!on || !ORDINANCES[key]) continue;
    const c = ORDINANCES[key].cost * population;
    if (c >= 0) expenses.ordinances += c; else income.ordinances += -c;
  }
  expenses.ordinances = Math.round(expenses.ordinances);
  income.ordinances = Math.round(income.ordinances);
  for (const loan of city.loans || []) expenses.loans += Math.min(loan.payment, loan.remaining);
  expenses.loans = Math.round(expenses.loans);

  // Neighbour deals. Buying is metered on what the city actually needed, with
  // a minimum fee "if you didn't need any during the month". Selling pays the
  // contracted amount, and only when the network could deliver it.
  for (const [resource, deal] of Object.entries(city.deals || {})) {
    const d = dealTerms(city, resource);
    if (!d) continue;
    const traded = resource === "garbage"
      ? (deal.kind === "sell" ? city._svc?.exported || 0 : d.cap)
      : city._util?.[resource]?.deal?.amount ?? 0;
    const bill = Math.max(d.minimum || 0, Math.round(traded * d.rate));
    // Exporting garbage costs money; importing it pays. Power and water are
    // the other way round.
    const earns = (deal.kind === "sell") !== (resource === "garbage");
    if (earns) {
      const met = resource === "garbage" ? true : city._util?.[resource]?.deal?.met !== false;
      if (met) income.neighbors += bill;
    } else expenses.neighbors += bill;
  }

  for (const k of ["residential", "commercial", "industrial"]) income[k] = Math.round(income[k]);
  income.total = income.residential + income.commercial + income.industrial + income.ordinances + income.deals + income.neighbors;
  expenses.total = Object.entries(expenses).filter(([k]) => k !== "total").reduce((s, [, v]) => s + v, 0);
  return { income, expenses, balance: income.total - expenses.total };
}

// Apply a month of loan amortisation. Returns the amount paid.
export function amortize(city) {
  let paid = 0;
  city.loans = (city.loans || []).filter((loan) => {
    const p = Math.min(loan.payment, loan.remaining);
    loan.remaining = Math.max(0, Math.round((loan.remaining - p) * 100) / 100);
    paid += p;
    return loan.remaining > 0.5;
  });
  city.debt = Math.round(city.loans.reduce((s, l) => s + l.remaining, 0));
  return paid;
}

export function takeLoan(city, amount = LOAN_AMOUNT) {
  amount = Number(amount);
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, message: "Loan amount must be positive." };
  amount = Math.round(amount);
  if ((city.debt || 0) + amount > MAX_DEBT) return { ok: false, message: `Outstanding debt cannot exceed $${MAX_DEBT.toLocaleString()}.` };
  if ((city.loans || []).length >= 10) return { ok: false, message: "Too many loans outstanding." };
  const payment = loanPayment(amount);
  city.loans = [...(city.loans || []), { amount, remaining: payment * LOAN_MONTHS, payment }];
  city.money += amount;
  city.debt = Math.round(city.loans.reduce((s, l) => s + l.remaining, 0));
  return { ok: true, message: `Borrowed $${amount.toLocaleString()} at $${payment}/month for ${LOAN_MONTHS} months.` };
}

export function repayLoan(city, amount) {
  if (!city.loans?.length) return { ok: false, message: "No outstanding loans." };
  let budget = amount === true || amount == null ? Infinity : Number(amount);
  if (!Number.isFinite(budget) && budget !== Infinity) return { ok: false, message: "Repayment must be a number." };
  if (budget <= 0) return { ok: false, message: "Repayment must be positive." };
  let paid = 0;
  for (const loan of city.loans) {
    const p = Math.min(loan.remaining, budget, city.money);
    if (p <= 0) break;
    loan.remaining -= p; budget -= p; city.money -= p; paid += p;
  }
  if (paid <= 0) return { ok: false, message: "Not enough funds to repay." };
  city.loans = city.loans.filter((l) => l.remaining > 0.5);
  city.debt = Math.round(city.loans.reduce((s, l) => s + l.remaining, 0));
  return { ok: true, message: `Repaid $${Math.round(paid).toLocaleString()}. Remaining debt: $${city.debt.toLocaleString()}.` };
}
