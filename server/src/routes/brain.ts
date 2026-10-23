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
import { captureDream, recentActivity, brainTick } from '../services/brain/autopilot';
import { asLang } from '../services/brain/i18n';

export const brainRouter = Router();
brainRouter.use(requireAuth);

brainRouter.get('/', async (req: AuthedRequest, res) => {
  const state = await runBrain(req.userId!, req.query.lang ? asLang(req.query.lang) : undefined);
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
  const r = await brainAfford(req.userId!, parsed.data.amount, parsed.data.months ?? null, parsed.data.label || 'this', req.body?.lang ? asLang(req.body.lang) : undefined);
  if (!r) return res.status(404).json({ error: 'not_found' });
  res.json(r);
});

brainRouter.get('/readiness', (_req, res) => res.json(integrationReadiness()));

// "While you were away" — what the brain did automatically.
brainRouter.get('/activity', async (req: AuthedRequest, res) => {
  res.json(await recentActivity(req.userId!, Math.min(30, Number(req.query.limit) || 12)));
});

// A dream heard anywhere (onboarding, voice, a text box) → planned automatically.
brainRouter.post('/capture', rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'capture' }), async (req: AuthedRequest, res) => {
  const text = String(req.body?.text || '').slice(0, 400);
  if (!text.trim()) return res.status(400).json({ error: 'invalid_input' });
  const r = await captureDream(req.userId!, text, String(req.body?.source || 'app').slice(0, 20));
  res.json(r ? { captured: true, ...r } : { captured: false });
});

// Re-think now (pull-to-refresh). Normally the brain runs by itself on every change.
brainRouter.post('/tick', rateLimit({ windowMs: 60_000, max: 6, keyPrefix: 'tick' }), async (req: AuthedRequest, res) => {
  const acts = await brainTick(req.userId!, 'manual');
  res.json({ ok: true, activity: acts });
});
