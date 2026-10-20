// /v1/brain — the money brain's API.
//   GET  /brain            → money map, dreams plan, life events, ranked next moves
//   POST /brain/afford     → "Can I afford X (by when)?" — deterministic, explainable
//   GET  /brain/readiness  → which integrations are live vs mock, and what flips them
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { runBrain, brainAfford } from '../services/brain';
import { integrationReadiness } from '../services/brain/readiness';

export const brainRouter = Router();
brainRouter.use(requireAuth);

brainRouter.get('/', async (req: AuthedRequest, res) => {
  const state = await runBrain(req.userId!);
  if (!state) return res.status(404).json({ error: 'not_found' });
  res.json(state);
});

const affordSchema = z.object({
  amount: z.number().int().positive().max(1e13),          // paise
  months: z.number().int().min(1).max(120).nullable().optional(),
  label: z.string().trim().min(1).max(80).optional(),
});
brainRouter.post('/afford', rateLimit({ windowMs: 60_000, max: 30, keyPrefix: 'afford' }), async (req: AuthedRequest, res) => {
  const parsed = affordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const r = await brainAfford(req.userId!, parsed.data.amount, parsed.data.months ?? null, parsed.data.label || 'this');
  if (!r) return res.status(404).json({ error: 'not_found' });
  res.json(r);
});

brainRouter.get('/readiness', (_req, res) => res.json(integrationReadiness()));
