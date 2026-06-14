// Alerts / monitor + monthly briefing routes — the recurring-value layer.
import { Router } from 'express';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { loadProfileData } from '../services/profile';
import { generateAlerts, AlertSignals } from '../services/alerts';
import { computeGoalMath } from '../services/goals';
import { buildInvestmentGuidance } from '../services/investment';
import { taxCopilot } from '../services/tax';

export const alertsRouter = Router();
alertsRouter.use(requireAuth);

async function gatherSignals(userId: string): Promise<AlertSignals> {
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
    scoreDelta, hasNominationDoc: !!nomination,
  };
}

async function regenerate(userId: string) {
  const p = await loadProfileData(userId);
  if (!p) return;
  const signals = await gatherSignals(userId);
  const alerts = generateAlerts(p, signals);
  for (const al of alerts) {
    await query(
      `INSERT INTO notifications (user_id, kind, category, severity, title, body, action_label, action_href, due_date, dedupe_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
      [userId, al.kind, al.category, al.severity, al.title, al.body, al.actionLabel || null, al.actionHref || null, al.dueDate || null, al.dedupeKey]
    );
  }
}

// GET /alerts — regenerate then return the inbox
alertsRouter.get('/', async (req: AuthedRequest, res) => {
  await regenerate(req.userId!);
  const rows = await query(
    `SELECT * FROM notifications WHERE user_id=$1 AND status <> 'dismissed'
      ORDER BY (status='unread') DESC,
        CASE severity WHEN 'urgent' THEN 0 WHEN 'warning' THEN 1 WHEN 'info' THEN 2 ELSE 3 END,
        created_at DESC LIMIT 80`,
    [req.userId]
  );
  const unread = rows.filter((r) => r.status === 'unread').length;
  res.json({ alerts: rows, unread });
});

// GET /alerts/count — just the unread badge number (cheap, no regenerate)
alertsRouter.get('/count', async (req: AuthedRequest, res) => {
  const r = await one(`SELECT COUNT(*)::int c FROM notifications WHERE user_id=$1 AND status='unread'`, [req.userId]);
  res.json({ unread: r?.c ?? 0 });
});

// POST /alerts/run — for a scheduled cron to refresh alerts
alertsRouter.post('/run', async (req: AuthedRequest, res) => {
  await regenerate(req.userId!);
  res.json({ ok: true });
});

// PATCH /alerts/:id/read  and  POST /alerts/read-all
alertsRouter.patch('/:id/read', async (req: AuthedRequest, res) => {
  await query(`UPDATE notifications SET status='read' WHERE id=$1 AND user_id=$2`, [req.params.id, req.userId]);
  res.json({ ok: true });
});
alertsRouter.post('/read-all', async (req: AuthedRequest, res) => {
  await query(`UPDATE notifications SET status='read' WHERE user_id=$1 AND status='unread'`, [req.userId]);
  res.json({ ok: true });
});
alertsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  await query(`UPDATE notifications SET status='dismissed' WHERE id=$1 AND user_id=$2`, [req.params.id, req.userId]);
  res.json({ ok: true });
});

// GET /alerts/briefing — the monthly "your money this month" digest
alertsRouter.get('/briefing', async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  await regenerate(userId);
  const p = await loadProfileData(userId);
  if (!p) return res.status(404).json({ error: 'not_found' });

  const guidance = buildInvestmentGuidance(p);
  const cop = taxCopilot(p);
  const topAction = await one(
    `SELECT title, impact_text, impact_score FROM actions WHERE user_id=$1 AND status IN ('pending','in_progress')
      ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, impact_score DESC LIMIT 1`,
    [userId]
  );
  const scoreRow = await one(`SELECT score FROM score_history WHERE user_id=$1 ORDER BY calculated_at DESC LIMIT 1`, [userId]);
  const monthAgo = await one(`SELECT score FROM score_history WHERE user_id=$1 AND calculated_at < now() - INTERVAL '25 days' ORDER BY calculated_at DESC LIMIT 1`, [userId]);
  const unread = await one(`SELECT COUNT(*)::int c FROM notifications WHERE user_id=$1 AND status='unread'`, [userId]);

  const nextDeadlineRow = await one(
    `SELECT title, to_char(due_date,'YYYY-MM-DD') due_date FROM notifications
      WHERE user_id=$1 AND due_date IS NOT NULL AND due_date >= now() AND status <> 'dismissed'
      ORDER BY due_date ASC LIMIT 1`,
    [userId]
  );

  res.json({
    month: new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
    score: scoreRow?.score ?? null,
    scoreDelta: scoreRow && monthAgo ? scoreRow.score - monthAgo.score : null,
    investThisMonth: guidance.hasIncome ? guidance.monthlyInvestable : 0,
    topAction: topAction || null,
    nextDeadline: nextDeadlineRow || null,
    taxSeason: cop.season,
    openAlerts: unread?.c ?? 0,
  });
});
