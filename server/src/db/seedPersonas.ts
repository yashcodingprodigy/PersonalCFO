// Seeds 15 diverse demo customer personas with full profiles, so the whole
// app (score, actions, tax, insurance, invest, net worth, Ask CFO) can be
// verified across many situations. Safe to re-run: upserts by mobile.
//
// Run:  DATABASE_URL="<your-db-uri>" npm run seed:personas
//
// LOGIN: open the app, enter the persona's +91 number, then read the 6-digit
// OTP from your Railway logs (the "[sms:dev] OTP for +91...: NNNNNN" line).
// If you run the API locally (npm run dev, not production), the OTP is 424242.

import { pool, query, one } from './index';
import { recalculateAndStoreScore } from '../services/profile';
import { PERSONAS, ONBOARDING_DONE, Persona } from './personas.data';

async function upsertPersona(p: Persona) {
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
  return score?.score ?? 0;
}

async function main() {
  console.log(`Seeding ${PERSONAS.length} demo personas...\n`);
  for (const p of PERSONAS) {
    const score = await upsertPersona(p);
    console.log(`  ✓ ${p.mobile}  ${p.name.padEnd(20)} score ${String(score).padStart(3)}/100  · ${p.city}, ${p.employment_type}`);
  }
  console.log(`\n✓ Done. Log in with any number above; OTP is in your Railway logs (or 424242 if running locally).`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
