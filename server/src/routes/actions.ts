import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { loadProfileData, recalculateAndStoreScore } from '../services/profile';
import { generateActions } from '../services/actions';
import { remember } from '../services/rag';

export const actionsRouter = Router();
actionsRouter.use(requireAuth);

// Sync rule-generated actions with stored ones: insert new triggers,
// auto-resolve actions whose trigger no longer holds.
async function syncActions(userId: string) {
  const p = await loadProfileData(userId);
  if (!p) return;
  const generated = generateActions(p);
  const existing = await query(`SELECT rule_id, status FROM actions WHERE user_id = $1 AND source = 'rule'`, [userId]);
  const existingRules = new Set(existing.map((e) => e.rule_id));
  const generatedRules = new Set(generated.map((g) => g.rule_id));

  for (const g of generated) {
    if (!existingRules.has(g.rule_id)) {
      await query(
        `INSERT INTO actions (user_id, rule_id, title, body, impact_text, impact_score, dimension, difficulty, deadline, category, is_seasonal, referral_link, priority)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [userId, g.rule_id, g.title, g.body, g.impact_text, g.impact_score, g.dimension, g.difficulty, g.deadline, g.category, g.is_seasonal, g.referral_link, g.priority || 'medium']
      );
    } else {
      // keep priority fresh as the user's profile changes
      await query(
        `UPDATE actions SET priority = $3 WHERE user_id = $1 AND rule_id = $2 AND status IN ('pending','in_progress','deferred')`,
        [userId, g.rule_id, g.priority || 'medium']
      );
    }
  }
  // Trigger no longer applies → mark done automatically (user fixed it)
  for (const e of existing) {
    if (!generatedRules.has(e.rule_id) && ['pending', 'in_progress', 'deferred'].includes(e.status)) {
      await query(
        `UPDATE actions SET status = 'done', completed_at = now() WHERE user_id = $1 AND rule_id = $2 AND status IN ('pending','in_progress','deferred')`,
        [userId, e.rule_id]
      );
    }
  }
}

// GET /actions
actionsRouter.get('/', async (req: AuthedRequest, res) => {
  await syncActions(req.userId!);
  const status = req.query.status as string | undefined;
  const params: any[] = [req.userId];
  let where = `user_id = $1`;
  if (status) { params.push(status); where += ` AND status = $2`; }
  const rows = await query(
    `SELECT * FROM actions WHERE ${where} ORDER BY
       CASE status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'deferred' THEN 2 ELSE 3 END,
       impact_score DESC, created_at ASC`,
    params
  );
  // Compounding cost of inaction for stale pending actions (SRS §7.5)
  const now = Date.now();
  const enriched = rows.map((a) => {
    const ageMonths = Math.floor((now - new Date(a.created_at).getTime()) / (30 * 24 * 3600 * 1000));
    return { ...a, months_pending: ageMonths };
  });
  res.json(enriched);
});

// GET /actions/:id
actionsRouter.get('/:id', async (req: AuthedRequest, res) => {
  const row = await one(`SELECT * FROM actions WHERE action_id = $1 AND user_id = $2`, [req.params.id, req.userId]);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
});

// PATCH /actions/:id/status
actionsRouter.patch('/:id/status', async (req: AuthedRequest, res) => {
  const schema = z.object({
    status: z.enum(['pending', 'in_progress', 'done', 'skipped', 'deferred']),
    deferred_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });

  const action = await one(`SELECT * FROM actions WHERE action_id = $1 AND user_id = $2`, [req.params.id, req.userId]);
  if (!action) return res.status(404).json({ error: 'not_found' });

  const { status, deferred_until } = parsed.data;
  await query(
    `UPDATE actions SET status = $3, deferred_until = $4, completed_at = CASE WHEN $3 = 'done' THEN now() ELSE completed_at END
     WHERE action_id = $1 AND user_id = $2`,
    [req.params.id, req.userId, status, deferred_until || null]
  );

  // Feed the personalisation layer — completions/skips teach the AI what
  // this user acts on (SRS §7.4)
  if (status === 'done') {
    await remember(req.userId!, 'action_completed', `Completed: ${action.title}`, `User completed the action "${action.title}" (${action.category}, ${action.difficulty}) on ${new Date().toISOString().slice(0, 10)}. ${action.impact_text}`);
    await recalculateAndStoreScore(req.userId!, 'action_complete');
  } else if (status === 'skipped') {
    await remember(req.userId!, 'action_skipped', `Skipped: ${action.title}`, `User skipped the action "${action.title}" (${action.category}, ${action.difficulty}). They may prefer different approaches to ${action.category}.`);
  }

  const updated = await one(`SELECT * FROM actions WHERE action_id = $1`, [req.params.id]);
  res.json(updated);
});

// POST /actions/:id/complete — confirm done and (optionally) record what the
// user actually invested so their profile + score update correctly.
actionsRouter.post('/:id/complete', async (req: AuthedRequest, res) => {
  const schema = z.object({
    invested_amount: z.number().int().positive().optional(),   // paise
    invested_type: z.enum([
      'index_fund', 'mutual_fund', 'stocks', 'ppf', 'epf', 'nps', 'fd', 'gold',
      'savings', 'term_insurance', 'health_insurance',
    ]).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });

  const action = await one(`SELECT * FROM actions WHERE action_id = $1 AND user_id = $2`, [req.params.id, req.userId]);
  if (!action) return res.status(404).json({ error: 'not_found' });

  const { invested_amount, invested_type } = parsed.data;

  // Apply the profile delta if the user told us what they did.
  if (invested_amount && invested_type) {
    const prof = await one(`SELECT assets, insurance FROM profiles WHERE user_id = $1`, [req.userId]);
    const assets = prof?.assets || {};
    const insurance = prof?.insurance || {};
    const cur = (k: string) => Number(assets[k]) || 0;

    if (invested_type === 'index_fund' || invested_type === 'mutual_fund') {
      const mf = assets.mutual_funds || {};
      const delta = { mutual_funds: { ...mf, value: (Number(mf.value) || 0) + invested_amount } };
      await query(`UPDATE profiles SET assets = assets || $2::jsonb, updated_at = now() WHERE user_id = $1`, [req.userId, JSON.stringify(delta)]);
    } else if (invested_type === 'term_insurance') {
      const term = Array.isArray(insurance.term) ? insurance.term : [];
      const delta = { term: [...term, { sum_assured: invested_amount }] };
      await query(`UPDATE profiles SET insurance = insurance || $2::jsonb, updated_at = now() WHERE user_id = $1`, [req.userId, JSON.stringify(delta)]);
    } else if (invested_type === 'health_insurance') {
      const health = Array.isArray(insurance.health) ? insurance.health : [];
      const delta = { health: [...health, { sum_insured: invested_amount }] };
      await query(`UPDATE profiles SET insurance = insurance || $2::jsonb, updated_at = now() WHERE user_id = $1`, [req.userId, JSON.stringify(delta)]);
    } else {
      const field: Record<string, string> = { stocks: 'stocks', ppf: 'ppf', epf: 'epf', nps: 'nps', fd: 'fd_total', gold: 'gold', savings: 'savings_balance' };
      const key = field[invested_type];
      const delta = { [key]: cur(key) + invested_amount };
      await query(`UPDATE profiles SET assets = assets || $2::jsonb, updated_at = now() WHERE user_id = $1`, [req.userId, JSON.stringify(delta)]);
    }
  }

  await query(
    `UPDATE actions SET status = 'done', completed_at = now() WHERE action_id = $1 AND user_id = $2`,
    [req.params.id, req.userId]
  );
  await remember(req.userId!, 'action_completed', `Completed: ${action.title}`,
    `User completed "${action.title}" (${action.category}) on ${new Date().toISOString().slice(0, 10)}.` +
    (invested_amount && invested_type ? ` They reported ${invested_type.replace('_', ' ')} of ₹${Math.round(invested_amount / 100).toLocaleString('en-IN')}.` : ''));
  const result = await recalculateAndStoreScore(req.userId!, 'action_complete');

  const updated = await one(`SELECT * FROM actions WHERE action_id = $1`, [req.params.id]);
  res.json({ action: updated, score: result?.score ?? null });
});

// GET /actions/stats/summary — streak + completion stats
actionsRouter.get('/stats/summary', async (req: AuthedRequest, res) => {
  const stats = await one(
    `SELECT COUNT(*) FILTER (WHERE status = 'done')::int AS done,
            COUNT(*) FILTER (WHERE status IN ('pending','in_progress'))::int AS open,
            COUNT(*) FILTER (WHERE status = 'done' AND completed_at > date_trunc('month', now()))::int AS done_this_month
       FROM actions WHERE user_id = $1`,
    [req.userId]
  );
  res.json(stats);
});
