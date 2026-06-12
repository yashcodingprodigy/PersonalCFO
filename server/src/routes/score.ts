import { Router } from 'express';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { loadProfileData, recalculateAndStoreScore } from '../services/profile';
import { computeScore, scoreBand } from '../services/score';

export const scoreRouter = Router();
scoreRouter.use(requireAuth);

// GET /score — current MHS with all dimensions
scoreRouter.get('/', async (req: AuthedRequest, res) => {
  const p = await loadProfileData(req.userId!);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const result = computeScore(p);

  const lastMonth = await one(
    `SELECT score FROM score_history WHERE user_id = $1 AND calculated_at < date_trunc('month', now())
     ORDER BY calculated_at DESC LIMIT 1`,
    [req.userId]
  );
  res.json({
    ...result,
    band: scoreBand(result.score),
    change_since_last_month: lastMonth ? result.score - lastMonth.score : null,
  });
});

// GET /score/history
scoreRouter.get('/history', async (req: AuthedRequest, res) => {
  const rows = await query(
    `SELECT score, savings_rate_score, insurance_score, investment_score, emergency_fund_score,
            debt_health_score, tax_efficiency_score, trigger, calculated_at
       FROM score_history WHERE user_id = $1 ORDER BY calculated_at DESC LIMIT 60`,
    [req.userId]
  );
  res.json(rows);
});

// POST /score/recalculate
scoreRouter.post('/recalculate', async (req: AuthedRequest, res) => {
  const result = await recalculateAndStoreScore(req.userId!, 'manual_update');
  if (!result) return res.status(404).json({ error: 'not_found' });
  res.json({ ...result, band: scoreBand(result.score) });
});
