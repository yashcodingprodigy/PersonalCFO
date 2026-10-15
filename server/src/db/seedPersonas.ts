// Seeds 15 diverse demo customer personas with full profiles, so the whole
// app (score, actions, tax, insurance, invest, net worth, Ask CFO) can be
// verified across many situations. Safe to re-run: upserts by mobile.
//
// Run:  DATABASE_URL="<your-db-uri>" npm run seed:personas
//
// LOGIN: easiest is the "Explore the live demo" button on /login (logs in as
// Aarav, no OTP). For other personas, enter the +91 number and read the OTP
// from Railway logs ("[sms:dev] OTP for +91...") — or 424242 when running locally.

import { pool } from './index';
import { PERSONAS } from './personas.data';
import { upsertPersona } from './personaSeed';

async function main() {
  console.log(`Seeding ${PERSONAS.length} demo personas...\n`);
  for (const p of PERSONAS) {
    const { score } = await upsertPersona(p);
    console.log(`  ✓ ${p.mobile}  ${p.name.padEnd(20)} score ${String(score).padStart(3)}/100  · ${p.city}, ${p.employment_type}`);
  }
  console.log(`\n✓ Done. Log in with any number above; OTP is in your Railway logs (or 424242 if running locally).`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
