// Life-event detector — notices what changed in a user's money life from their
// transactions (statement uploads today; Account Aggregator feeds later — same
// input shape), so the brain can react without being asked.
// Pure function over a transaction list. Amounts in paise.

export interface Txn {
  date: string;                  // YYYY-MM-DD
  amount: number;                // positive paise
  direction: 'debit' | 'credit';
  category: string;
  description: string;
}

export interface LifeEvent {
  kind: 'salary_hike' | 'salary_drop' | 'bonus' | 'new_emi' | 'big_purchase';
  title: string;
  detail: string;
  suggestion: string;
  amount: number;
  month: string;                 // YYYY-MM it was seen
}

import { Lang, M } from './i18n';
const inr = (p: number) => `₹${Math.round(p / 100).toLocaleString('en-IN')}`;
const monthOf = (d: string) => d.slice(0, 7);
const isSalary = (t: Txn) => t.direction === 'credit' && (t.category === 'salary' || /\bsal(ary)?\b|payroll/i.test(t.description));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '').slice(0, 14);

export function detectLifeEvents(txns: Txn[], monthlyTakeHome: number, lang: Lang = 'en'): LifeEvent[] {
  if (!txns.length) return [];
  const T = M(lang);
  const months = [...new Set(txns.map((t) => monthOf(t.date)))].sort();
  const latest = months[months.length - 1];
  const prior = months.slice(-4, -1);
  const out: LifeEvent[] = [];

  // Salary per month
  const salaryBy = new Map<string, number>();
  for (const t of txns.filter(isSalary)) salaryBy.set(monthOf(t.date), (salaryBy.get(monthOf(t.date)) || 0) + t.amount);
  const priorSal = prior.map((m) => salaryBy.get(m) || 0).filter((v) => v > 0);
  const latestSal = salaryBy.get(latest) || 0;
  const avgPrior = priorSal.length ? priorSal.reduce((a, b) => a + b, 0) / priorSal.length : 0;
  if (avgPrior > 0 && latestSal > 0) {
    const change = (latestSal - avgPrior) / avgPrior;
    if (change >= 0.10) out.push({
      kind: 'salary_hike', month: latest, amount: Math.round(latestSal - avgPrior),
      title: T.evHikeTitle(inr(latestSal - avgPrior)),
      detail: T.evHikeDetail(Math.round(change * 100)),
      suggestion: T.evHikeTip(inr((latestSal - avgPrior) / 2)),
    });
    else if (change <= -0.10) out.push({
      kind: 'salary_drop', month: latest, amount: Math.round(avgPrior - latestSal),
      title: T.evDropTitle(inr(avgPrior - latestSal)),
      detail: T.evDropDetail(Math.round(-change * 100)),
      suggestion: T.evDropTip,
    });
  }

  // Bonus / large one-off credit (non-salary, or salary well above normal)
  const typical = avgPrior || monthlyTakeHome;
  for (const t of txns.filter((x) => x.direction === 'credit' && monthOf(x.date) === latest)) {
    const big = isSalary(t) ? avgPrior > 0 && t.amount >= avgPrior * 1.5 : typical > 0 && t.amount >= typical * 0.5 && !/refund|reversal|transfer|self/i.test(t.description);
    if (big) {
      out.push({
        kind: 'bonus', month: latest, amount: t.amount,
        title: T.evBonusTitle(inr(t.amount)),
        detail: t.description.slice(0, 60),
        suggestion: T.evBonusTip,
      });
      break;
    }
  }

  // New EMI (an EMI-like debit not seen in the prior months)
  const priorEmi = new Set(txns.filter((t) => t.direction === 'debit' && t.category === 'emi' && monthOf(t.date) !== latest).map((t) => norm(t.description)));
  const newEmi = txns.find((t) => t.direction === 'debit' && t.category === 'emi' && monthOf(t.date) === latest && !priorEmi.has(norm(t.description)));
  if (newEmi && prior.length) out.push({
    kind: 'new_emi', month: latest, amount: newEmi.amount,
    title: T.evEmiTitle(inr(newEmi.amount)),
    detail: newEmi.description.slice(0, 60),
    suggestion: T.evEmiTip,
  });

  // Big one-off purchase
  if (monthlyTakeHome > 0) {
    const bigBuy = txns
      .filter((t) => t.direction === 'debit' && monthOf(t.date) === latest && !['emi', 'investments', 'transfers', 'atm_cash'].includes(t.category))
      .sort((a, b) => b.amount - a.amount)[0];
    if (bigBuy && bigBuy.amount >= monthlyTakeHome * 0.5) out.push({
      kind: 'big_purchase', month: latest, amount: bigBuy.amount,
      title: T.evBuyTitle(inr(bigBuy.amount)),
      detail: bigBuy.description.slice(0, 60),
      suggestion: T.evBuyTip,
    });
  }
  return out;
}
