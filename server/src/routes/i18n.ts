// /v1/i18n — translate UI/generated strings to Hindi (shared DB cache + Claude).
// Used by the web app's auto-translate layer so EVERY screen works in Hindi,
// not just the hand-translated core. Without an AI key it returns the originals.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { translateTexts, translationAvailable, translationStatus } from '../services/translate';

export const i18nRouter = Router();
i18nRouter.use(requireAuth);

i18nRouter.post('/translate', rateLimit({ windowMs: 60_000, max: 300, keyPrefix: 'i18n' }), async (req, res) => {
  const lang = req.body?.lang === 'hi' ? 'hi' : 'en';
  const texts: string[] = Array.isArray(req.body?.texts) ? req.body.texts.slice(0, 150).map((t: any) => String(t ?? '').slice(0, 800)) : [];
  if (lang === 'en' || !texts.length) return res.json({ texts, available: translationAvailable() });
  res.json({ texts: await translateTexts(texts, lang), available: translationAvailable() });
});

// Quick health check for the Hindi layer (is the AI key set? last error?)
i18nRouter.get('/status', (_req, res) => res.json(translationStatus()));
