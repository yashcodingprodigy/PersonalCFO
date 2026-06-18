// Diagnostic: lists the demo personas present in whichever database
// DATABASE_URL points at, plus their onboarding status and whether a profile
// exists. Run it against the SAME DATABASE_URL your app/Railway uses.
//
//   DATABASE_URL="<the app's db uri>" npm run check:personas

import { pool, query } from './index';

async function main() {
  const rows = await query<any>(
    `SELECT u.mobile, u.name, u.onboarding_status,
            (p.user_id IS NOT NULL) AS has_profile
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.user_id
      WHERE u.mobile LIKE '+91900000000%'
      ORDER BY u.mobile`
  );
  if (rows.length === 0) {
    console.log('\n⚠ No demo personas found in THIS database.');
    console.log('  → The app is reading a different database than the one you seeded.');
    console.log('  → Re-run `npm run seed:personas` with the exact DATABASE_URL this app uses.\n');
  } else {
    console.log(`\nFound ${rows.length} demo personas in this database:\n`);
    for (const r of rows) {
      const s1 = (r.onboarding_status || {}).session_1;
      const ok = s1 === 'complete' && r.has_profile;
      console.log(`  ${ok ? '✓' : '✗'} ${r.mobile}  ${String(r.name || '(no name)').padEnd(20)}  onboarding.session_1=${s1}  profile=${r.has_profile}`);
    }
    console.log('\n✓ = will go straight to dashboard.  ✗ = will be sent to first-time setup.\n');
  }
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
