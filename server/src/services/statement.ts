// Bank-statement analyser. Takes a list of parsed transactions (extracted
// client-side from CSV / Excel / PDF) and produces a detailed, beginner-
// friendly report: where the money went, what was invested, how to cut
// spending, and what to watch out for. All amounts in paise.

import { categorise } from '../adapters/aa';
import { ProfileData } from './score';

export interface RawTxn {
  date: string;          // YYYY-MM-DD (best-effort)
  description: string;
  amount: number;        // paise, positive
  direction: 'debit' | 'credit';
}

const inr = (paise: number) => {
  const r = Math.round(paise / 100);
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(2)} Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(1)} L`;
  return `₹${r.toLocaleString('en-IN')}`;
};

const CATEGORY_LABELS: Record<string, string> = {
  food_dining: 'Food & dining', transport: 'Transport', entertainment: 'Entertainment',
  shopping: 'Shopping', utilities: 'Utilities & bills', health: 'Health', education: 'Education',
  emi: 'Loan EMIs', investments: 'Investments & insurance', transfers: 'Transfers',
  atm_cash: 'ATM / cash', salary: 'Salary', unknown: 'Other / uncategorised',
};
const DISCRETIONARY = new Set(['food_dining', 'entertainment', 'shopping']);

export interface StatementReport {
  transactionCount: number;
  period: { from: string; to: string; months: number };
  totals: { inflow: number; outflow: number; net: number; savingsRate: number | null };
  monthly: { avgInflow: number; avgOutflow: number; avgInvested: number };
  byCategory: { category: string; label: string; total: number; pct: number; count: number; discretionary: boolean }[];
  invested: { total: number; monthlyAvg: number; items: { description: string; amount: number }[] };
  recurring: { description: string; occurrences: number; avgAmount: number }[];
  largestExpenses: { date: string; description: string; amount: number; category: string }[];
  reduceSuggestions: { area: string; finding: string; potentialAnnualSaving: number; tip: string }[];
  watchOuts: { severity: 'high' | 'medium' | 'low'; message: string }[];
  positives: string[];
  summary: string;
  disclaimer: string;
}

function monthsBetween(from: string, to: string): number {
  const a = new Date(from), b = new Date(to);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 1;
  const m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + 1;
  return Math.max(1, m);
}

// Normalise a free-text merchant so repeated subscriptions group together.
function merchantKey(desc: string): string {
  return desc.toUpperCase().replace(/\d+/g, '').replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 24);
}

export function analyzeStatement(txns: RawTxn[], p?: ProfileData | null): StatementReport {
  const disclaimer =
    'This report organises the transactions you uploaded for your own understanding. It is educational, not investment, tax or accounting advice. Figures depend on how cleanly your statement was read — review anything that looks off.';

  const clean = txns.filter((t) => t && t.amount > 0 && (t.direction === 'debit' || t.direction === 'credit'));
  const cats = clean.map((t) => ({ ...t, category: t.direction === 'credit' && /salary|sal /i.test(t.description) ? 'salary' : categorise(t.description) }));

  const dates = clean.map((t) => t.date).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const from = dates[0] || '';
  const to = dates[dates.length - 1] || '';
  const months = from && to ? monthsBetween(from, to) : 1;

  const inflow = cats.filter((t) => t.direction === 'credit').reduce((s, t) => s + t.amount, 0);
  const outflow = cats.filter((t) => t.direction === 'debit').reduce((s, t) => s + t.amount, 0);
  const net = inflow - outflow;
  const savingsRate = inflow > 0 ? net / inflow : null;

  // Category breakdown of debits
  const catMap = new Map<string, { total: number; count: number }>();
  for (const t of cats) {
    if (t.direction !== 'debit') continue;
    const cur = catMap.get(t.category) || { total: 0, count: 0 };
    cur.total += t.amount; cur.count += 1; catMap.set(t.category, cur);
  }
  const byCategory = [...catMap.entries()]
    .map(([category, v]) => ({
      category, label: CATEGORY_LABELS[category] || category, total: v.total, count: v.count,
      pct: outflow > 0 ? Math.round((v.total / outflow) * 100) : 0, discretionary: DISCRETIONARY.has(category),
    }))
    .sort((a, b) => b.total - a.total);

  // Investments detected
  const investTxns = cats.filter((t) => t.direction === 'debit' && t.category === 'investments');
  const investedTotal = investTxns.reduce((s, t) => s + t.amount, 0);
  const investItems = investTxns
    .reduce((acc: { description: string; amount: number }[], t) => {
      const key = merchantKey(t.description);
      const ex = acc.find((x) => merchantKey(x.description) === key);
      if (ex) ex.amount += t.amount; else acc.push({ description: t.description, amount: t.amount });
      return acc;
    }, [])
    .sort((a, b) => b.amount - a.amount);

  // Recurring (likely subscriptions / fixed bills)
  const recurMap = new Map<string, { sample: string; amounts: number[] }>();
  for (const t of cats) {
    if (t.direction !== 'debit') continue;
    if (!['entertainment', 'utilities', 'investments'].includes(t.category)) continue;
    const key = merchantKey(t.description);
    const cur = recurMap.get(key) || { sample: t.description, amounts: [] };
    cur.amounts.push(t.amount); recurMap.set(key, cur);
  }
  const recurring = [...recurMap.values()]
    .filter((v) => v.amounts.length >= 2)
    .map((v) => ({ description: v.sample, occurrences: v.amounts.length, avgAmount: Math.round(v.amounts.reduce((s, x) => s + x, 0) / v.amounts.length) }))
    .sort((a, b) => b.avgAmount * b.occurrences - a.avgAmount * a.occurrences)
    .slice(0, 12);

  // Largest single expenses
  const largestExpenses = cats.filter((t) => t.direction === 'debit')
    .sort((a, b) => b.amount - a.amount).slice(0, 8)
    .map((t) => ({ date: t.date, description: t.description, amount: t.amount, category: CATEGORY_LABELS[t.category] || t.category }));

  // ── Reduce suggestions ─────────────────────────────────────────────
  const reduceSuggestions: StatementReport['reduceSuggestions'] = [];
  for (const c of byCategory.filter((c) => c.discretionary)) {
    const monthly = c.total / months;
    if (monthly < 100000) continue; // ignore <₹1,000/mo
    const cut = Math.round(monthly * 0.25); // a realistic 25% trim
    reduceSuggestions.push({
      area: c.label,
      finding: `You spent ${inr(c.total)} on ${c.label.toLowerCase()} (${c.pct}% of outgoings, ~${inr(Math.round(monthly))}/month).`,
      potentialAnnualSaving: cut * 12,
      tip: c.category === 'food_dining'
        ? 'Food delivery is the usual culprit. Cooking 2 extra meals a week or a weekly order cap is the easiest dent.'
        : c.category === 'shopping'
        ? 'Try a 48-hour wait rule before non-essential buys and unsubscribe from sale emails.'
        : 'Audit subscriptions and impulse buys — cutting the ones you barely use needs zero ongoing willpower.',
    });
  }
  const subsTotal = recurring.filter((r) => /netflix|prime|hotstar|spotify|youtube|subscription|jio|airtel/i.test(r.description)).reduce((s, r) => s + r.avgAmount, 0);
  if (subsTotal > 0) reduceSuggestions.push({
    area: 'Subscriptions', finding: `Around ${inr(subsTotal)}/month goes to recurring subscriptions.`, potentialAnnualSaving: Math.round(subsTotal * 0.4) * 12,
    tip: 'Keep the 1–2 you use weekly; pause the rest. You can always resubscribe.',
  });
  const atm = catMap.get('atm_cash');
  if (atm && atm.total / months > 1500000) reduceSuggestions.push({
    area: 'Cash withdrawals', finding: `You withdraw ~${inr(Math.round(atm.total / months))}/month as cash, which is hard to track.`, potentialAnnualSaving: 0,
    tip: 'Pay digitally where possible so spending is visible and categorised — untracked cash is where budgets quietly leak.',
  });
  reduceSuggestions.sort((a, b) => b.potentialAnnualSaving - a.potentialAnnualSaving);

  // ── Watch-outs ─────────────────────────────────────────────────────
  const watchOuts: StatementReport['watchOuts'] = [];
  if (savingsRate != null && savingsRate < 0) watchOuts.push({ severity: 'high', message: `You spent more than you earned this period (by ${inr(Math.abs(net))}). This is the first thing to fix — it usually means dipping into savings or credit.` });
  else if (savingsRate != null && savingsRate < 0.1 && inflow > 0) watchOuts.push({ severity: 'medium', message: `Your savings rate is only ${Math.round(savingsRate * 100)}%. Aim for at least 20% — even small cuts compound fast.` });
  if (investedTotal === 0 && outflow > 0) watchOuts.push({ severity: 'medium', message: 'No investments or SIPs were detected. Money sitting idle loses value to inflation — see the Invest tab for a starter plan.' });
  const emiCat = catMap.get('emi');
  if (emiCat && inflow > 0 && emiCat.total / inflow > 0.4) watchOuts.push({ severity: 'high', message: `Loan EMIs eat ${Math.round((emiCat.total / inflow) * 100)}% of your inflow — above the safe 40% line. Avoid taking on new debt.` });
  const unknownCat = catMap.get('unknown');
  if (unknownCat && outflow > 0 && unknownCat.total / outflow > 0.35) watchOuts.push({ severity: 'low', message: `${Math.round((unknownCat.total / outflow) * 100)}% of spending couldn't be auto-categorised — your statement format may be unusual. Review the "Other" bucket.` });
  if (recurring.length >= 6) watchOuts.push({ severity: 'low', message: `You have ${recurring.length} recurring payments. Subscriptions silently add up — worth a yearly audit.` });

  // ── Positives ──────────────────────────────────────────────────────
  const positives: string[] = [];
  if (savingsRate != null && savingsRate >= 0.2) positives.push(`Strong ${Math.round(savingsRate * 100)}% savings rate — you're keeping a healthy chunk of what you earn.`);
  if (investedTotal > 0) positives.push(`You invested ${inr(investedTotal)} (~${inr(Math.round(investedTotal / months))}/month) — paying your future self first.`);
  if (emiCat && inflow > 0 && emiCat.total / inflow <= 0.3 && emiCat.total > 0) positives.push('Your EMI load is comfortably within safe limits.');

  const summary =
    `Across ${months} month${months === 1 ? '' : 's'}, ${inr(inflow)} came in and ${inr(outflow)} went out — ` +
    `${net >= 0 ? `you kept ${inr(net)}` : `you overspent by ${inr(Math.abs(net))}`}. ` +
    `${investedTotal > 0 ? `${inr(investedTotal)} went into investments. ` : ''}` +
    `Your biggest spending area was ${byCategory[0]?.label?.toLowerCase() || 'n/a'}.`;

  return {
    transactionCount: clean.length,
    period: { from, to, months },
    totals: { inflow, outflow, net, savingsRate },
    monthly: { avgInflow: Math.round(inflow / months), avgOutflow: Math.round(outflow / months), avgInvested: Math.round(investedTotal / months) },
    byCategory,
    invested: { total: investedTotal, monthlyAvg: Math.round(investedTotal / months), items: investItems.slice(0, 10) },
    recurring,
    largestExpenses,
    reduceSuggestions,
    watchOuts,
    positives,
    summary,
    disclaimer,
  };
}
