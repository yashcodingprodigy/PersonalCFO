// Monthly Financial Report — SRS §14. Generates the full report data
// model; the web client renders it as a print-ready document (browser
// print → PDF gives identical output to the Puppeteer pipeline described
// in the SRS, without a headless browser dependency on the API host).
import { Router } from 'express';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { loadProfileData } from '../services/profile';
import { computeScore } from '../services/score';
import { computeNetWorth } from '../services/networth';
import { compareRegimes, currentFY } from '../services/tax';
import { analyseInsurance } from '../services/insurance';
import { computeGoalMath } from '../services/goals';
import { deductionUsage } from '../services/score';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

// GET /reports/current — this month's report, generated on demand
reportsRouter.get('/current', async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const p = await loadProfileData(userId);
  if (!p) return res.status(404).json({ error: 'not_found' });

  const user = await one(`SELECT name, city, plan FROM users WHERE user_id = $1`, [userId]);
  const score = computeScore(p);
  const nw = computeNetWorth(p);

  const monthAgo = await one(
    `SELECT score FROM score_history WHERE user_id = $1 AND calculated_at < now() - INTERVAL '25 days' ORDER BY calculated_at DESC LIMIT 1`,
    [userId]
  );
  const sixMonthsAgo = await one(
    `SELECT score FROM score_history WHERE user_id = $1 AND calculated_at < now() - INTERVAL '5 months' ORDER BY calculated_at DESC LIMIT 1`,
    [userId]
  );

  const actionStats = await one(
    `SELECT COUNT(*) FILTER (WHERE status = 'done' AND completed_at > date_trunc('month', now()))::int AS done_this_month,
            COUNT(*) FILTER (WHERE status IN ('pending','in_progress'))::int AS open
       FROM actions WHERE user_id = $1`,
    [userId]
  );
  const topActions = await query(
    `SELECT title, impact_text, impact_score, difficulty, category FROM actions
      WHERE user_id = $1 AND status IN ('pending','in_progress') ORDER BY impact_score DESC LIMIT 3`,
    [userId]
  );

  const goals = await query(`SELECT * FROM goals WHERE user_id = $1`, [userId]);
  const spend = await query(
    `SELECT category, SUM(amount)::bigint AS total FROM transactions
      WHERE user_id = $1 AND direction = 'debit' AND txn_date >= date_trunc('month', now())
      GROUP BY category ORDER BY total DESC LIMIT 8`,
    [userId]
  );

  // Insight of the month: largest category deviation vs 3-month average
  let insight: string | null = null;
  const deviation = await one(
    `WITH recent AS (
       SELECT category, SUM(amount)::bigint AS this_month FROM transactions
        WHERE user_id = $1 AND direction = 'debit' AND txn_date >= date_trunc('month', now())
          AND category NOT IN ('emi','investments','transfers') GROUP BY category),
     hist AS (
       SELECT category, SUM(amount)::bigint / 3 AS avg_month FROM transactions
        WHERE user_id = $1 AND direction = 'debit'
          AND txn_date >= date_trunc('month', now()) - INTERVAL '3 months' AND txn_date < date_trunc('month', now())
        GROUP BY category)
     SELECT r.category, r.this_month, h.avg_month FROM recent r JOIN hist h USING (category)
      WHERE h.avg_month > 0 ORDER BY ABS(r.this_month - h.avg_month)::numeric / h.avg_month DESC LIMIT 1`,
    [userId]
  );
  if (deviation) {
    const delta = Math.round(((Number(deviation.this_month) - Number(deviation.avg_month)) / Number(deviation.avg_month)) * 100);
    const label = deviation.category.replace(/_/g, ' ');
    insight = delta > 10
      ? `Your ${label} spend is ${delta}% above your 3-month average this month — worth a look.`
      : delta < -10
      ? `Your ${label} spend is ${Math.abs(delta)}% below your 3-month average — whatever you changed, it's working.`
      : `Your spending is stable across categories this month — consistency is underrated.`;
  }

  const tax = compareRegimes(p);
  const ded = deductionUsage(p);

  res.json({
    generated_at: new Date().toISOString(),
    month: new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
    user: { name: user?.name, city: user?.city, plan: user?.plan },
    score: {
      current: score.score,
      dimensions: score.dimensions,
      vs_last_month: monthAgo ? score.score - monthAgo.score : null,
      vs_six_months: sixMonthsAgo ? score.score - sixMonthsAgo.score : null,
    },
    snapshot: {
      net_worth: nw.netWorth,
      total_assets: nw.totalAssets,
      total_liabilities: nw.totalLiabilities,
      monthly_income: p.user.monthly_take_home,
      monthly_expenses: p.monthlyExpenses,
      savings_rate: p.monthlyExpenses != null && p.user.monthly_take_home > 0
        ? (p.user.monthly_take_home - p.monthlyExpenses) / p.user.monthly_take_home : null,
    },
    actions: { completed_this_month: actionStats?.done_this_month ?? 0, open: actionStats?.open ?? 0, top_priorities: topActions },
    tax: { fy: currentFY(), recommended_regime: tax.recommended, savings_vs_other: tax.savings, reasoning: tax.reasoning, deductions: ded },
    insurance: analyseInsurance(p),
    goals: goals.map((g) => ({ name: g.name, type: g.goal_type, math: computeGoalMath(g) })),
    spend_by_category: spend,
    insight_of_the_month: insight,
    disclaimer: 'This report is educational financial organisation, not SEBI-registered investment advice.',
  });
});
