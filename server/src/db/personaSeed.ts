// Upsert one demo persona (user + profile + score). Shared by the
// seed:personas script and the one-tap demo login (/auth/demo), which
// re-seeds the demo account on every login so each visitor gets a fresh copy.

import { query, one } from './index';
import { recalculateAndStoreScore } from '../services/profile';
import { ONBOARDING_DONE, Persona } from './personas.data';

export async function upsertPersona(p: Persona): Promise<{ userId: string; score: number }> {
  const email = `${p.name.toLowerCase().replace(/[^a-z]/g, '.')}@demo.paywatch.in`;
  const user = await one<{ user_id: string }>(
    `INSERT INTO users (mobile, name, email, city, state, age, employment_type, risk_appetite,
        annual_gross_income, monthly_take_home, dependents_count, plan, plan_status, onboarding_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)
     ON CONFLICT (mobile) DO UPDATE SET
        name=EXCLUDED.name, email=EXCLUDED.email, city=EXCLUDED.city, state=EXCLUDED.state, age=EXCLUDED.age,
        employment_type=EXCLUDED.employment_type, risk_appetite=EXCLUDED.risk_appetite,
        annual_gross_income=EXCLUDED.annual_gross_income, monthly_take_home=EXCLUDED.monthly_take_home,
        dependents_count=EXCLUDED.dependents_count, plan=EXCLUDED.plan, plan_status=EXCLUDED.plan_status,
        onboarding_status=EXCLUDED.onboarding_status, deleted_at=NULL
     RETURNING user_id`,
    [p.mobile, p.name, email, p.city, p.state, p.age, p.employment_type, p.risk_appetite,
      p.annual_gross_income, p.monthly_take_home, p.dependents_count, p.plan, p.plan_status, ONBOARDING_DONE]
  );
  const userId = user!.user_id;
  await query(
    `INSERT INTO profiles (user_id, assets, liabilities, insurance, tax_data)
     VALUES ($1,$2::jsonb,$3::jsonb,$4::jsonb,$5::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET
        assets=EXCLUDED.assets, liabilities=EXCLUDED.liabilities,
        insurance=EXCLUDED.insurance, tax_data=EXCLUDED.tax_data, updated_at=now()`,
    [userId, JSON.stringify(p.assets), JSON.stringify(p.liabilities), JSON.stringify(p.insurance), JSON.stringify(p.tax_data)]
  );
  const score = await recalculateAndStoreScore(userId, 'seed_persona');
  return { userId, score: score?.score ?? 0 };
}
