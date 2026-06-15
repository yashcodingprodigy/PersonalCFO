// Alerts / monitor + monthly briefing routes — the recurring-value layer.
import { Router } from 'express';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { loadProfileData } from '../services/profile';
import { regenerateAlerts as regenerate } from '../services/monitor';
import { buildInvestmentGuidance } from '../services/investment';
import { taxCopilot } from '../services/tax';

export const alertsRouter = Router();
alertsRouter.use(requireAuth);

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
