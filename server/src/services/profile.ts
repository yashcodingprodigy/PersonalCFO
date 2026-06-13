import { one, query } from '../db';
import { ProfileData, computeScore } from './score';

export async function loadProfileData(userId: string): Promise<ProfileData | null> {
  const user = await one(
    `SELECT annual_gross_income, monthly_take_home, dependents_count, age,
            employment_type, risk_appetite, city, state
       FROM users WHERE user_id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  if (!user) return null;
  const profile = await one(`SELECT assets, liabilities, insurance, tax_data FROM profiles WHERE user_id = $1`, [userId]);

  // Derive monthly expenses: prefer transaction data (last 3 full months of
  // debits excluding investments & transfers), fall back to manual entry.
  let monthlyExpenses: number | null = null;
  const txnRows = await query(
    `SELECT date_trunc('month', txn_date) AS m, SUM(amount)::bigint AS spend
       FROM transactions
      WHERE user_id = $1 AND direction = 'debit'
        AND category NOT IN ('investments','transfers')
        AND txn_date >= (CURRENT_DATE - INTERVAL '3 months')
      GROUP BY 1`,
    [userId]
  );
  if (txnRows.length > 0) {
    monthlyExpenses = Math.round(txnRows.reduce((s, r) => s + Number(r.spend), 0) / txnRows.length);
  } else if (profile?.assets?.monthly_expenses) {
    monthlyExpenses = Number(profile.assets.monthly_expenses);
  }

  return {
    user: {
      annual_gross_income: Number(user.annual_gross_income) || 0,
      monthly_take_home: Number(user.monthly_take_home) || 0,
      dependents_count: user.dependents_count || 0,
      age: user.age,
      employment_type: user.employment_type,
      risk_appetite: user.risk_appetite,
      city: user.city,
      state: user.state,
    },
    assets: profile?.assets || {},
    liabilities: profile?.liabilities || {},
    insurance: profile?.insurance || {},
    tax_data: profile?.tax_data || {},
    monthlyExpenses,
  };
}

export async function recalculateAndStoreScore(userId: string, trigger: string) {
  const p = await loadProfileData(userId);
  if (!p) return null;
  const result = computeScore(p);
  await query(
    `INSERT INTO score_history (user_id, score, savings_rate_score, insurance_score, investment_score,
       emergency_fund_score, debt_health_score, tax_efficiency_score, trigger, profile_snapshot)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      userId,
      result.score,
      result.dimensions.savings_rate.score,
      result.dimensions.insurance_adequacy.score,
      result.dimensions.investment_diversification.score,
      result.dimensions.emergency_fund.score,
      result.dimensions.debt_health.score,
      result.dimensions.tax_efficiency.score,
      trigger,
      JSON.stringify({ assets: p.assets, liabilities: p.liabilities, insurance: p.insurance, monthlyExpenses: p.monthlyExpenses }),
    ]
  );
  return result;
}
