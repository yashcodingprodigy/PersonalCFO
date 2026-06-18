// SEBI compliance guardrails + AI context builder. Pure functions, no DB.
import assert from 'assert';
import { checkGuardrails, buildUserContext, AI_DISCLAIMER } from '../src/services/cfo-ai';
import { ProfileData } from '../src/services/score';

let passed = 0, failed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
const blocked = (q: string) => assert(checkGuardrails(q) !== null, `should block: "${q}"`);
const allowed = (q: string) => assert(checkGuardrails(q) === null, `should allow: "${q}"`);

console.log('\nSEBI GUARDRAILS — must BLOCK specific-security/guarantee questions');
check('"which stocks should I buy?"', () => blocked('which stocks should I buy?'));
check('"best stocks to buy right now"', () => blocked('best stocks to buy right now'));
check('"best mutual fund to invest in"', () => blocked('best mutual fund to invest in'));
check('"is bitcoin a good investment?"', () => blocked('is bitcoin a good investment?'));
check('"any schemes with guaranteed returns?"', () => blocked('any schemes with guaranteed returns?'));
check('"how do I double my money fast?"', () => blocked('how do I double my money fast?'));

console.log('\nSEBI GUARDRAILS — must ALLOW general education questions');
check('"how much should I invest each month?"', () => allowed('how much should I invest each month?'));
check('"what is Section 80C?"', () => allowed('what is Section 80C?'));
check('"should I prepay my home loan?"', () => allowed('should I prepay my home loan?'));
check('"explain the difference between ELSS and PPF"', () => allowed('explain the difference between ELSS and PPF'));

console.log('\nAI CONTEXT + DISCLAIMER');
check('buildUserContext summarises score & net worth', () => {
  const p = {
    user: { annual_gross_income: 12_00_000_00, monthly_take_home: 100000_00, dependents_count: 1, age: 30, employment_type: 'salaried' },
    assets: { savings_balance: 5_00_000_00 }, liabilities: {}, insurance: {}, tax_data: {}, monthlyExpenses: 50000_00,
  } as ProfileData;
  const ctx = buildUserContext(p);
  assert(/Money Health Score:/.test(ctx) && /Net worth:/.test(ctx));
});
check('AI disclaimer is present and mentions "not SEBI"', () => {
  assert(/not SEBI/i.test(AI_DISCLAIMER));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
