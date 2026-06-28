// Proactive alerts / monitor engine — the recurring-value spine.
// Pulls together tax deadlines, the spending watchdog, portfolio drift, goal
// autopilot, emergency-fund and insurance/renewal reminders into one stream of
// dedup'd, actionable alerts. Education/organisation only — no security tips.

import { ProfileData, deductionUsage } from './score';
import { compareRegimes, taxCopilot, currentFY } from './tax';
import { analyseInsurance } from './insurance';
import { buildInvestmentGuidance } from './investment';

const inr = (paise: number) => {
  const r = Math.round(paise / 100);
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(2)} Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(1)} L`;
  return `₹${r.toLocaleString('en-IN')}`;
};

export interface Alert {
  kind: string;
  category: 'tax' | 'spending' | 'investment' | 'goal' | 'insurance' | 'document' | 'general';
  severity: 'urgent' | 'warning' | 'info' | 'good';
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
  dueDate?: string | null;
  dedupeKey: string;
}

export interface AlertSignals {
  goals: { name: string; health: string; requiredMonthly: number; monthlyContribution: number }[];
  spendSpikePct: number | null;            // % this month vs 3-mo average
  spendSpikeCategory: string | null;
  newSubscriptions: string[];              // descriptions seen this month, not before
  docExpiries: { label: string; expiry_date: string }[];
  insuranceExpiries: { label: string; category: string; kind: 'renewal' | 'maturity'; date: string }[];
  scoreDelta: number | null;
  hasNominationDoc: boolean;
}

export function generateAlerts(p: ProfileData, s: AlertSignals, now = new Date()): Alert[] {
  const out: Alert[] = [];
  const m = now.getMonth(); // 0=Jan
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fy = currentFY();
  const income = p.user.annual_gross_income || 0;

  // ── TAX ────────────────────────────────────────────────────────────
  const copilot = taxCopilot(p);
  if (copilot.advanceTax.applicable) {
    for (const ins of copilot.advanceTax.instalments) {
      if (ins.status === 'due_soon') {
        out.push({
          kind: 'advance_tax', category: 'tax', severity: 'urgent',
          title: `Advance tax ${ins.label} due ${new Date(ins.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
          body: `Pay up to ${inr(ins.cumulativeAmount)} (cumulative ${ins.cumulativePct}% of your estimated ${inr(copilot.advanceTax.totalLiability)} tax) to avoid 234B/234C interest.`,
          actionLabel: 'See tax copilot', actionHref: '/tax', dueDate: ins.dueDate,
          dedupeKey: `advtax_${fy}_${ins.label}`,
        });
      }
    }
  }
  // Unused 80C in the second half of the FY
  if (income > 0 && (m >= 9 || m <= 2)) {
    const items = deductionUsage(p).items;
    const c80 = items.find((i) => i.section === '80C');
    const headroom = c80 ? c80.limit - c80.used : 0;
    if (headroom > 10000_00 && compareRegimes(p).recommended === 'old') {
      out.push({
        kind: 'deduction_unused', category: 'tax', severity: m === 1 || m === 2 ? 'urgent' : 'warning',
        title: `${inr(headroom)} of 80C still unused this year`,
        body: `Invest before March 31 to claim it. In the 30% bracket that's up to ${inr(Math.round(headroom * 0.312))} saved. Spread it as a SIP rather than a March rush.`,
        actionLabel: 'How to reduce tax', actionHref: '/tax', dueDate: `${m <= 2 ? now.getFullYear() : now.getFullYear() + 1}-03-31`,
        dedupeKey: `80c_${fy}`,
      });
    }
  }
  if (m === 0 || m === 1) {
    out.push({
      kind: 'proof_season', category: 'tax', severity: 'info',
      title: 'Submit your investment proofs to HR',
      body: 'It’s proof season. Hand your 80C/80D/HRA proofs to payroll before the cutoff, or excess TDS gets deducted and you’ll have to claim it back as a refund.',
      actionLabel: 'Filing checklist', actionHref: '/tax', dueDate: `${now.getFullYear()}-02-28`,
      dedupeKey: `proofs_${fy}`,
    });
  }
  const a = p.assets || {};
  const hasEquity = (Number(a.mutual_funds?.value) || 0) + (Number(a.stocks) || 0) + (Number(a.us_stocks) || 0) > 0;
  if ((m === 1 || m === 2) && hasEquity) {
    out.push({
      kind: 'harvesting', category: 'tax', severity: 'info',
      title: 'Consider tax-loss / gain harvesting before March 31',
      body: 'Equity gains up to ₹1.25L/year are tax-free. Selling and rebuying to use that limit (or booking losses to offset gains) is a legal way to cut future tax.',
      actionLabel: 'Learn how', actionHref: '/tax', dueDate: `${m <= 2 ? now.getFullYear() : now.getFullYear() + 1}-03-31`,
      dedupeKey: `harvest_${fy}`,
    });
  }
  if (income > 0 && m >= 3 && m <= 6) {
    out.push({
      kind: 'itr_season', category: 'tax', severity: m === 6 ? 'warning' : 'info',
      title: 'ITR filing is open — file by July 31',
      body: 'Your CA-ready tax pack is assembled in the Tax tab. File early — refunds process faster and you skip the last-week portal rush.',
      actionLabel: 'Open my ready pack', actionHref: '/tax', dueDate: `${now.getFullYear()}-07-31`,
      dedupeKey: `itr_${fy}`,
    });
  }

  // ── SPENDING WATCHDOG ──────────────────────────────────────────────
  if (s.spendSpikePct != null && s.spendSpikePct >= 25) {
    out.push({
      kind: 'spend_spike', category: 'spending', severity: 'warning',
      title: `Your ${s.spendSpikeCategory || 'spending'} is ${s.spendSpikePct}% above normal this month`,
      body: 'A category jumped well above your 3-month average. Worth a quick look before it becomes a habit.',
      actionLabel: 'See spending', actionHref: '/networth',
      dedupeKey: `spike_${ym}_${s.spendSpikeCategory || 'all'}`,
    });
  }
  if (s.newSubscriptions.length > 0) {
    out.push({
      kind: 'new_subscription', category: 'spending', severity: 'info',
      title: `New recurring charge${s.newSubscriptions.length > 1 ? 's' : ''} detected`,
      body: `We spotted ${s.newSubscriptions.slice(0, 3).join(', ')}${s.newSubscriptions.length > 3 ? ` and ${s.newSubscriptions.length - 3} more` : ''}. Cancel anything you don't use — it's the easiest saving there is.`,
      actionLabel: 'Scan a statement', actionHref: '/statement',
      dedupeKey: `subs_${ym}`,
    });
  }

  // ── PORTFOLIO DRIFT ────────────────────────────────────────────────
  const g = buildInvestmentGuidance(p);
  if (g.hasIncome && g.currentAllocation && (g.currentAllocation.equity > 0 || g.currentAllocation.debt > 0)) {
    const diff = g.currentAllocation.equity - g.targetAllocation.equity;
    if (Math.abs(diff) >= 15) {
      out.push({
        kind: 'portfolio_drift', category: 'investment', severity: 'info',
        title: `Your equity is ${diff > 0 ? 'above' : 'below'} target (${g.currentAllocation.equity}% vs ${g.targetAllocation.equity}%)`,
        body: diff > 0
          ? 'Steer new investments toward debt/gold to rebalance — better than selling, which can trigger capital-gains tax.'
          : 'You’re light on equity for your profile. Direct new money there — over long horizons it’s what beats inflation.',
        actionLabel: 'See my plan', actionHref: '/invest',
        dedupeKey: `drift_${ym}`,
      });
    }
  }

  // ── GOAL AUTOPILOT ─────────────────────────────────────────────────
  for (const goal of s.goals) {
    if (goal.health === 'off_track' || goal.health === 'at_risk') {
      const stepUp = Math.max(0, goal.requiredMonthly - goal.monthlyContribution);
      out.push({
        kind: 'goal_offtrack', category: 'goal', severity: goal.health === 'off_track' ? 'warning' : 'info',
        title: `Goal "${goal.name}" is ${goal.health.replace('_', ' ')}`,
        body: stepUp > 0
          ? `Raise your monthly contribution by about ${inr(stepUp)} to get back on track for this goal.`
          : 'Review the target date or amount to bring this goal back on track.',
        actionLabel: 'Open goals', actionHref: '/goals',
        dedupeKey: `goal_${goal.name}_${ym}`,
      });
    }
  }

  // ── EMERGENCY FUND ─────────────────────────────────────────────────
  const liquid = (Number(a.savings_balance) || 0) + (Number(a.liquid_funds) || 0);
  if (p.monthlyExpenses && p.monthlyExpenses > 0) {
    const months = liquid / p.monthlyExpenses;
    if (months < 3) {
      out.push({
        kind: 'emergency_fund', category: 'general', severity: 'warning',
        title: `Your emergency fund covers only ${months.toFixed(1)} months`,
        body: `Build it to at least 3 months (${inr(p.monthlyExpenses * 3)}) before increasing investments — it stops a setback from forcing you into debt.`,
        actionLabel: 'See actions', actionHref: '/actions',
        dedupeKey: `emergency_${ym}`,
      });
    }
  }

  // ── INSURANCE / RENEWALS ───────────────────────────────────────────
  const insAnalysis = analyseInsurance(p);
  for (const f of insAnalysis.flags) {
    if (f.severity === 'high') {
      out.push({
        kind: 'insurance_gap', category: 'insurance', severity: 'warning',
        title: f.message, body: 'A protection gap can undo years of progress in one event. See exactly what to get and why.',
        actionLabel: 'Insurance', actionHref: '/insurance',
        dedupeKey: `insgap_${f.message.slice(0, 30)}_${ym}`,
      });
    }
  }
  if (!s.hasNominationDoc && (hasEquity || Number(a.epf) > 0 || liquid > 0)) {
    out.push({
      kind: 'nomination', category: 'document', severity: 'info',
      title: 'Add nominees to your accounts',
      body: 'Make sure your bank, mutual-fund, demat, EPF and insurance accounts all have a nominee — it spares your family a slow claims process. Mark it done in your Vault.',
      actionLabel: 'Open vault', actionHref: '/vault',
      dedupeKey: `nomination_${now.getFullYear()}`,
    });
  }
  for (const d of s.docExpiries) {
    const days = (new Date(d.expiry_date).getTime() - now.getTime()) / (24 * 3600 * 1000);
    if (days <= 30 && days >= -3) {
      out.push({
        kind: 'doc_expiry', category: 'document', severity: 'warning',
        title: `${d.label} expires soon`,
        body: `It renews on ${new Date(d.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}. Renew before it lapses to avoid a coverage gap.`,
        actionLabel: 'Open vault', actionHref: '/vault', dueDate: d.expiry_date,
        dedupeKey: `docexp_${d.label.slice(0, 24)}_${d.expiry_date}`,
      });
    }
  }

  // ── Insurance renewals / expiry / maturity ────────────────────────
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  for (const e of s.insuranceExpiries) {
    const days = Math.round((new Date(e.date).getTime() - now.getTime()) / (24 * 3600 * 1000));
    if (e.kind === 'renewal' && days <= 30 && days >= -7) {
      const urgent = days <= 7;
      out.push({
        kind: 'insurance_expiry', category: 'insurance', severity: urgent ? 'urgent' : 'warning',
        title: days < 0 ? `Your ${e.label} has lapsed — act now` : urgent ? `Your ${e.label} expires in ${days} day${days === 1 ? '' : 's'}` : `Your ${e.label} is due for renewal`,
        body: days < 0
          ? `It was due on ${fmt(e.date)}. Renew immediately to restore cover — a lapse can mean fresh medical tests, a lost no-claim bonus, or (for motor) driving uninsured. Once renewed, upload the new policy so we update your cover.`
          : `It's due on ${fmt(e.date)}${days >= 0 ? ` (${days} day${days === 1 ? '' : 's'} away)` : ''}. Renew before then to avoid a coverage gap. After you renew, upload the new policy and we'll refresh your cover automatically.`,
        actionLabel: 'Review insurance', actionHref: '/insurance', dueDate: e.date,
        dedupeKey: `insexp_${e.label.slice(0, 28)}_${e.date}`,
      });
    }
    if (e.kind === 'maturity' && days <= 60 && days >= -7) {
      out.push({
        kind: 'insurance_maturity', category: 'insurance', severity: 'info',
        title: `Your ${e.label} matures on ${fmt(e.date)}`,
        body: `Plan ahead for the payout — where it will go, the tax on it, and whether you still need replacement cover once it ends.`,
        actionLabel: 'Review insurance', actionHref: '/insurance', dueDate: e.date,
        dedupeKey: `insmat_${e.label.slice(0, 28)}_${e.date}`,
      });
    }
  }

  // ── POSITIVE REINFORCEMENT ─────────────────────────────────────────
  if (s.scoreDelta != null && s.scoreDelta > 0) {
    out.push({
      kind: 'score_up', category: 'general', severity: 'good',
      title: `Your Money Health Score rose ${s.scoreDelta} points 🎉`,
      body: 'Nice work — your recent moves are paying off. Keep the momentum with this month’s actions.',
      actionLabel: 'See actions', actionHref: '/actions',
      dedupeKey: `scoreup_${ym}`,
    });
  }

  const sevRank = { urgent: 0, warning: 1, info: 2, good: 3 };
  out.sort((x, y) => sevRank[x.severity] - sevRank[y.severity]);
  return out;
}
