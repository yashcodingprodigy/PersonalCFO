// Shared monitor logic — used by both the /alerts route (on visit) and the
// /cron route (scheduled, for all users). Gathers signals, generates alerts,
// and upserts them with per-user dedupe.
import { query, one } from '../db';
import { loadProfileData } from './profile';
import { generateAlerts, AlertSignals } from './alerts';
import { computeGoalMath } from './goals';

export async function gatherSignals(userId: string): Promise<AlertSignals> {
  const goalsRows = await query(`SELECT * FROM goals WHERE user_id = $1`, [userId]);
  const goals = goalsRows.map((g) => {
    const math = computeGoalMath(g);
    return { name: g.name, health: math.health, requiredMonthly: math.requiredMonthly, monthlyContribution: Number(g.monthly_contribution) || 0 };
  });

  const spike = await one(
    `WITH this AS (
       SELECT category, SUM(amount)::bigint t FROM transactions
        WHERE user_id=$1 AND direction='debit' AND category NOT IN ('investments','transfers','emi')
          AND txn_date >= date_trunc('month', now()) GROUP BY category),
     hist AS (
       SELECT category, SUM(amount)::bigint/3 a FROM transactions
        WHERE user_id=$1 AND direction='debit' AND category NOT IN ('investments','transfers','emi')
          AND txn_date >= date_trunc('month', now()) - INTERVAL '3 months' AND txn_date < date_trunc('month', now())
        GROUP BY category)
     SELECT t.category, t.t, h.a FROM this t JOIN hist h USING (category)
      WHERE h.a > 0 ORDER BY (t.t - h.a)::numeric / h.a DESC LIMIT 1`,
    [userId]
  );
  let spendSpikePct: number | null = null; let spendSpikeCategory: string | null = null;
  if (spike && Number(spike.a) > 0) {
    const pct = Math.round(((Number(spike.t) - Number(spike.a)) / Number(spike.a)) * 100);
    if (pct >= 25) { spendSpikePct = pct; spendSpikeCategory = String(spike.category).replace(/_/g, ' '); }
  }

  const subs = await query(
    `SELECT DISTINCT description FROM transactions
      WHERE user_id=$1 AND direction='debit' AND category IN ('entertainment','utilities')
        AND txn_date >= date_trunc('month', now())
        AND description NOT IN (
          SELECT description FROM transactions WHERE user_id=$1 AND direction='debit' AND txn_date < date_trunc('month', now()))
      LIMIT 5`,
    [userId]
  );

  const expiries = await query(
    `SELECT label, to_char(expiry_date,'YYYY-MM-DD') AS expiry_date FROM documents
      WHERE user_id=$1 AND expiry_date IS NOT NULL AND expiry_date <= now() + INTERVAL '30 days'`,
    [userId]
  );
  const nomination = await one(`SELECT 1 FROM documents WHERE user_id=$1 AND slot='nomination' AND status='have' LIMIT 1`, [userId]);

  // Insurance policies approaching renewal/expiry or maturity.
  const policies = await query(
    `SELECT category, insurer,
            to_char(expiry_date,'YYYY-MM-DD')   AS expiry_date,
            to_char(renewal_date,'YYYY-MM-DD')  AS renewal_date,
            to_char(maturity_date,'YYYY-MM-DD') AS maturity_date
       FROM insurance_policies
      WHERE user_id=$1 AND status='active'
        AND (expiry_date IS NOT NULL OR renewal_date IS NOT NULL OR maturity_date IS NOT NULL)`,
    [userId]
  );
  const insuranceExpiries: AlertSignals['insuranceExpiries'] = [];
  for (const p of policies) {
    const label = `${p.insurer ? p.insurer + ' ' : ''}${String(p.category).replace(/_/g, ' ')} policy`;
    const renewBy = p.renewal_date || p.expiry_date;
    if (renewBy) insuranceExpiries.push({ label, category: p.category, kind: 'renewal', date: renewBy });
    if (p.maturity_date) insuranceExpiries.push({ label, category: p.category, kind: 'maturity', date: p.maturity_date });
  }

  const scores = await query(`SELECT score, calculated_at FROM score_history WHERE user_id=$1 ORDER BY calculated_at DESC LIMIT 30`, [userId]);
  let scoreDelta: number | null = null;
  if (scores.length > 1) {
    const monthAgo = scores.find((r) => new Date(r.calculated_at).getTime() < Date.now() - 25 * 24 * 3600 * 1000);
    if (monthAgo) scoreDelta = scores[0].score - monthAgo.score;
  }

  return {
    goals, spendSpikePct, spendSpikeCategory,
    newSubscriptions: subs.map((r) => r.description),
    docExpiries: expiries.map((r) => ({ label: r.label, expiry_date: r.expiry_date })),
    insuranceExpiries,
    scoreDelta, hasNominationDoc: !!nomination,
  };
}

export async function regenerateAlerts(userId: string): Promise<number> {
  const p = await loadProfileData(userId);
  if (!p) return 0;
  const signals = await gatherSignals(userId);
  const alerts = generateAlerts(p, signals);
  let created = 0;
  for (const al of alerts) {
    const r = await query(
      `INSERT INTO notifications (user_id, kind, category, severity, title, body, action_label, action_href, due_date, dedupe_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (user_id, dedupe_key) DO NOTHING RETURNING id`,
      [userId, al.kind, al.category, al.severity, al.title, al.body, al.actionLabel || null, al.actionHref || null, al.dueDate || null, al.dedupeKey]
    );
    if (r.length) created++;
  }
  return created;
}
