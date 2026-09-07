// Taxes, department budgets, ordinances and loans.
import { BUILDINGS, ZONE_TYPES, PORT_TYPES, DEPARTMENTS, FUNDED_DEPARTMENTS, ROAD_TYPES } from "./catalog.js";
import { isAnchor, capacityOf } from "./lots.js";
import { industryTraits } from "./industry.js";
import { commerceTraits } from "./commerce.js";
import { ORDINANCES } from "./city.js";
import { dealTerms } from "./neighbors.js";
import { portUpkeep } from "./ports.js";

// The manual, page 63, lists the loan rules outright:
//
//   "You may have up to ten loans outstanding at any time."
//   "Loans are available in 5000 Simoleon increments, up to 25K per loan."
//   "Each new loan is extended for ten years, and cannot be paid off early."
//   "The city must make annual payments on each loan for ten full years."
//   "Annual payment amounts are based on principal and interest."
//   "When the final payment is made in the tenth year, the loan is repaid and
//    comes off the books."
//   "Total payments made will equal approximately 150% of the original loan
//    amount."
//
// The last line gives the interest away, so there is no rate to guess: ten
// annual payments of 15% of the principal repay 150% of it. That is 10% of the
// principal and 5% interest a year.
export const LOAN_STEP = 5000;
export const LOAN_AMOUNT = 10000;   // what the button offers
export const LOAN_MAX = 25000;
export const MAX_LOANS = 10;
export const LOAN_YEARS = 10;
export const LOAN_TOTAL = 1.5;

export function loanPayment(amount) {
  return Math.round(amount * LOAN_TOTAL / LOAN_YEARS);
}

// A loan falls due on each anniversary of the month it was taken, ten times.
// amortize() runs while `city.month` is still the month being closed.
export function loanDue(month, loan) {
  const age = month - loan.since;
  return age >= 12 && age % 12 === 0;
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
  // Annual, not monthly: the ledger charges in the month the payment falls
  // due, which is the month amortize() knocks it off the balance.
  for (const loan of city.loans || []) if (loanDue(city.month, loan)) expenses.loans += Math.min(loan.payment, loan.remaining);
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

// Knock this month's due payments off the outstanding balances. "When the
// final payment is made in the tenth year, the loan is repaid and comes off
// the books." Returns the amount paid.
export function amortize(city) {
  let paid = 0;
  city.loans = (city.loans || []).filter((loan) => {
    if (!loanDue(city.month, loan)) return true;
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
  if (amount % LOAN_STEP !== 0) return { ok: false, message: `Loans come in $${LOAN_STEP.toLocaleString()} increments.` };
  if (amount > LOAN_MAX) return { ok: false, message: `No single loan may exceed $${LOAN_MAX.toLocaleString()}.` };
  if ((city.loans || []).length >= MAX_LOANS) return { ok: false, message: `The city may have ${MAX_LOANS} loans outstanding at a time.` };
  const payment = loanPayment(amount);
  city.loans = [...(city.loans || []), { amount, remaining: payment * LOAN_YEARS, payment, since: city.month }];
  city.money += amount;
  city.debt = Math.round(city.loans.reduce((s, l) => s + l.remaining, 0));
  return { ok: true, message: `Borrowed $${amount.toLocaleString()}: $${payment.toLocaleString()} a year for ${LOAN_YEARS} years, $${(payment * LOAN_YEARS).toLocaleString()} in all. It cannot be paid off early.` };
}

// "Each new loan is extended for ten years, and cannot be paid off early."
export function repayLoan(city) {
  if (!city.loans?.length) return { ok: false, message: "No outstanding loans." };
  return { ok: false, message: `A loan runs its ${LOAN_YEARS} years and cannot be paid off early.` };
}
