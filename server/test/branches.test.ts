// Remaining branch coverage — statement recurring/reduce, investment gaps,
// growth levers, score edge bands, tax plan content. Pure functions, no DB.
import assert from 'assert';
import { ProfileData, computeScore } from '../src/services/score';
import { analyzeStatement, RawTxn } from '../src/services/statement';
import { buildInvestmentGuidance } from '../src/services/investment';
import { computeNetWorth, growthProjection } from '../src/services/networth';
import { taxReductionPlan } from '../src/services/tax';

let passed = 0, failed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
const L = 100000_00;
function profile(over: any = {}): ProfileData {
  return {
    user: { annual_gross_income: 0, monthly_take_home: 0, dependents_count: 0, age: 32, employment_type: 'salaried', ...(over.user || {}) },
    assets: over.assets || {}, liabilities: over.liabilities || {}, insurance: over.insurance || {},
    tax_data: over.tax_data || {}, monthlyExpenses: over.monthlyExpenses ?? null,
  } as ProfileData;
}

console.log('\nSTATEMENT — recurring & reduce');
check('Repeated subscription detected as recurring', () => {
  const txns: RawTxn[] = [
    { date: '2026-01-12', description: 'NETFLIX SUBSCRIPTION', amount: 649_00, direction: 'debit' },
    { date: '2026-02-12', description: 'NETFLIX SUBSCRIPTION', amount: 649_00, direction: 'debit' },
  ];
  assert(analyzeStatement(txns).recurring.length > 0);
});
check('High discretionary spend → a reduce suggestion', () => {
  const txns: RawTxn[] = [
    { date: '2026-01-01', description: 'SALARY', amount: 100000_00, direction: 'credit' },
    { date: '2026-01-08', description: 'SWIGGY ORDER', amount: 12000_00, direction: 'debit' },
  ];
  assert(analyzeStatement(txns).reduceSuggestions.length > 0);
});

console.log('\nINVESTMENT — gaps & student steps');
check('Cash-heavy portfolio → idle-cash gap message', () => {
  const g = buildInvestmentGuidance(profile({ user: { annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, monthlyExpenses: 50000_00, assets: { savings_balance: 20 * L, mutual_funds: { value: 1 * L } } }));
  assert(g.allocationGap.some((s) => /idle|cash/i.test(s)));
});
check('Student → start-small step appears', () => {
  const g = buildInvestmentGuidance(profile({ user: { employment_type: 'student', age: 21, annual_gross_income: 3 * L, monthly_take_home: 20000_00 }, monthlyExpenses: 10000_00 }));
  assert(g.startSteps.some((s) => /₹500|begin small|small/i.test(s)));
});
check('Recommendation allocation percentages are positive', () => {
  const g = buildInvestmentGuidance(profile({ user: { annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, monthlyExpenses: 50000_00, assets: { savings_balance: 5 * L } }));
  g.recommendations.forEach((r) => assert(r.allocationPct >= 0 && r.allocationPct <= 100));
});

console.log('\nGROWTH — levers');
check('Savings rate below 25% → "lift savings rate" lever', () => {
  const p = profile({ user: { monthly_take_home: 100000_00, annual_gross_income: 12 * L }, monthlyExpenses: 90000_00 });
  const g = growthProjection(p, computeNetWorth(p));
  assert(g.levers.some((l) => /savings rate|25%/i.test(l)));
});

console.log('\nSCORE — edge bands');
check('Overspending → savings rate score 0 (available)', () => {
  const s = computeScore(profile({ user: { monthly_take_home: 50000_00, annual_gross_income: 6 * L }, monthlyExpenses: 70000_00 }));
  assert(s.dimensions.savings_rate.available && s.dimensions.savings_rate.score === 0);
});
check('Dependents + partial term cover → mid insurance score', () => {
  const s = computeScore(profile({ user: { annual_gross_income: 10 * L, dependents_count: 2 }, insurance: { term: [{ sum_assured: 125 * L }], health: [{ sum_insured: 0 }] } }));
  const v = s.dimensions.insurance_adequacy.score;
  assert(s.dimensions.insurance_adequacy.available && v > 0 && v < 60, `got ${v}`);
});
check('High income → tax efficiency dimension active', () => {
  const s = computeScore(profile({ user: { annual_gross_income: 20 * L } }));
  assert.strictEqual(s.dimensions.tax_efficiency.available, true);
});

console.log('\nTAX REDUCTION PLAN — content');
check('Capital-gains explainer, glossary, checklist all populated', () => {
  const rp = taxReductionPlan(profile({ user: { annual_gross_income: 20 * L } }));
  assert(rp.capitalGains.points.length > 0);
  assert(rp.glossary.length > 0);
  assert(rp.documentChecklist.length > 0);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
