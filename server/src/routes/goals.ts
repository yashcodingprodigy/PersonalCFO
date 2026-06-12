import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { computeGoalMath, GOAL_TYPES } from '../services/goals';
import { PLANS, PlanKey } from '../config';

export const goalsRouter = Router();
goalsRouter.use(requireAuth);

goalsRouter.get('/types', (_req, res) => res.json(GOAL_TYPES));

// GET /goals
goalsRouter.get('/', async (req: AuthedRequest, res) => {
  const rows = await query(`SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at`, [req.userId]);
  res.json(rows.map((g) => ({ ...g, math: computeGoalMath(g) })));
});

const goalSchema = z.object({
  goal_type: z.string().max(30),
  name: z.string().min(1).max(100),
  target_amount: z.number().int().positive(),
  target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  current_amount: z.number().int().min(0).default(0),
  monthly_contribution: z.number().int().min(0).default(0),
  meta: z.record(z.any()).optional(),
});

// POST /goals — enforces plan limits (Starter: 2 goals)
goalsRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = goalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });

  const user = await one(`SELECT plan FROM users WHERE user_id = $1`, [req.userId]);
  const limit = PLANS[(user?.plan || 'starter') as PlanKey].goalLimit;
  const count = await one(`SELECT COUNT(*)::int AS c FROM goals WHERE user_id = $1`, [req.userId]);
  if (count!.c >= limit) {
    return res.status(403).json({ error: 'plan_limit', message: `Your plan includes ${limit} goals. Upgrade to CFO for unlimited goals.` });
  }

  const g = parsed.data;
  const defaultMeta = GOAL_TYPES.find((t) => t.type === g.goal_type)?.defaultMeta || {};
  const row = await one(
    `INSERT INTO goals (user_id, goal_type, name, target_amount, target_date, current_amount, monthly_contribution, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.userId, g.goal_type, g.name, g.target_amount, g.target_date || null, g.current_amount, g.monthly_contribution, JSON.stringify({ ...defaultMeta, ...g.meta })]
  );
  res.status(201).json({ ...row, math: computeGoalMath(row!) });
});

// PUT /goals/:id
goalsRouter.put('/:id', async (req: AuthedRequest, res) => {
  const parsed = goalSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const g = parsed.data;
  const existing = await one(`SELECT * FROM goals WHERE goal_id = $1 AND user_id = $2`, [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const merged = { ...existing, ...g, meta: { ...existing.meta, ...(g.meta || {}) } };
  const row = await one(
    `UPDATE goals SET name=$3, target_amount=$4, target_date=$5, current_amount=$6, monthly_contribution=$7, meta=$8, updated_at=now()
     WHERE goal_id = $1 AND user_id = $2 RETURNING *`,
    [req.params.id, req.userId, merged.name, merged.target_amount, merged.target_date, merged.current_amount, merged.monthly_contribution, JSON.stringify(merged.meta)]
  );
  res.json({ ...row, math: computeGoalMath(row!) });
});

// DELETE /goals/:id
goalsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  await query(`DELETE FROM goals WHERE goal_id = $1 AND user_id = $2`, [req.params.id, req.userId]);
  res.json({ ok: true });
});
