import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { recalculateAndStoreScore, loadProfileData } from '../services/profile';
import { remember } from '../services/rag';

export const userRouter = Router();
userRouter.use(requireAuth);

// GET /user/me
userRouter.get('/me', async (req: AuthedRequest, res) => {
  const user = await one(
    `SELECT user_id, mobile, name, city, age, employment_type, annual_gross_income, monthly_take_home,
            dependents_count, plan, plan_status, onboarding_status, created_at
       FROM users WHERE user_id = $1 AND deleted_at IS NULL`,
    [req.userId]
  );
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json(user);
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  city: z.string().max(100).optional(),
  age: z.number().int().min(18).max(100).optional(),
  employment_type: z.enum(['salaried', 'self_employed', 'freelancer', 'business']).optional(),
  annual_gross_income: z.number().int().min(0).optional(),
  monthly_take_home: z.number().int().min(0).optional(),
  dependents_count: z.number().int().min(0).max(20).optional(),
  onboarding_status: z.record(z.string()).optional(),
});

// PATCH /user/me
userRouter.patch('/me', async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const fields = parsed.data;
  const keys = Object.keys(fields) as (keyof typeof fields)[];
  if (keys.length === 0) return res.status(400).json({ error: 'empty_update' });

  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map((k) => (k === 'onboarding_status' ? JSON.stringify(fields[k]) : fields[k]));
  await query(`UPDATE users SET ${sets}, last_active_at = now() WHERE user_id = $1`, [req.userId, ...values]);

  if (keys.some((k) => ['annual_gross_income', 'monthly_take_home', 'dependents_count', 'age'].includes(k))) {
    await recalculateAndStoreScore(req.userId!, 'manual_update');
  }
  const user = await one(`SELECT user_id, name, city, age, employment_type, annual_gross_income, monthly_take_home, dependents_count, plan, onboarding_status FROM users WHERE user_id = $1`, [req.userId]);
  res.json(user);
});

// GET /profile
userRouter.get('/profile', async (req: AuthedRequest, res) => {
  const profile = await one(`SELECT * FROM profiles WHERE user_id = $1`, [req.userId]);
  res.json(profile || {});
});

// PATCH /profile/:section — assets / liabilities / insurance / tax_data
userRouter.patch('/profile/:section', async (req: AuthedRequest, res) => {
  const section = req.params.section;
  if (!['assets', 'liabilities', 'insurance', 'tax_data'].includes(section)) {
    return res.status(400).json({ error: 'invalid_section' });
  }
  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'invalid_body', message: 'Expected a JSON object' });
  }
  await query(
    `UPDATE profiles SET ${section} = ${section} || $2::jsonb, version = version + 1, updated_at = now() WHERE user_id = $1`,
    [req.userId, JSON.stringify(req.body)]
  );
  const result = await recalculateAndStoreScore(req.userId!, 'manual_update');
  await remember(req.userId!, 'profile_update', `Updated ${section}`, `User updated their ${section.replace('_', ' ')} data on ${new Date().toISOString().slice(0, 10)}.`);
  const profile = await one(`SELECT * FROM profiles WHERE user_id = $1`, [req.userId]);
  res.json({ profile, score: result?.score ?? null });
});

// GET /profile/full — combined view used by dashboard
userRouter.get('/profile/full', async (req: AuthedRequest, res) => {
  const p = await loadProfileData(req.userId!);
  if (!p) return res.status(404).json({ error: 'not_found' });
  res.json(p);
});
