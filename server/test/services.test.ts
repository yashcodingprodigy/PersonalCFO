// Service-level / integration logic tests (no DB — pure service functions).
// Run: cd server && npx tsx test/services.test.ts
import assert from 'assert';
import { ProfileData } from '../src/services/score';
import { generateAlerts, AlertSignals } from '../src/services/alerts';
import { analyzeStatement, RawTxn } from '../src/services/statement';
import { generateActions } from '../src/services/actions';
import { analyseInsurance } from '../src/services/insurance';
import { taxReductionPlan, taxCopilot, computeHraExemption, marginalRate } from '../src/services/tax';
import { buildInvestmentGuidance } from '../src/services/investment';

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
const noSignals = (o: Partial<AlertSignals> = {}): AlertSignals => ({
  goals: [], spendSpikePct: null, spendSpikeCategory: null, newSubscriptions: [], docExpiries: [], scoreDelta: null, hasNominationDoc: true, ...o,
});
const kinds = (a: { kind: string }[]) => a.map((x) => x.kind);

console.log('\nALERTS ENGINE');
check('Thin emergency fund → emergency_fund alert', () => {
  const p = profile({ user: { annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, assets: { savings_balance: 50000_00 }, monthlyExpenses: 60000_00 });
  assert(kinds(generateAlerts(p, noSignals())).includes('emergency_fund'));
});
check('Spend spike signal → spend_spike alert', () => {
  const a = generateAlerts(profile({ user: { annual_gross_income: 12 * L } }), noSignals({ spendSpikePct: 42, spendSpikeCategory: 'food & dining' }));
  assert(kinds(a).includes('spend_spike'));
});
check('New subscription signal → new_subscription alert', () => {
  const a = generateAlerts(profile(), noSignals({ newSubscriptions: ['NETFLIX'] }));
  assert(kinds(a).includes('new_subscription'));
});
check('Off-track goal → goal_offtrack alert', () => {
  const a = generateAlerts(profile(), noSignals({ goals: [{ name: 'Car', health: 'off_track', requiredMonthly: 20000_00, monthlyContribution: 5000_00 }] }));
  assert(kinds(a).includes('goal_offtrack'));
});
check('Score improved → a "good" alert', () => {
  const a = generateAlerts(profile(), noSignals({ scoreDelta: 6 }));
  assert(a.some((x) => x.severity === 'good'));
});
check('Proof season (January) → proof_season alert', () => {
  const a = generateAlerts(profile({ user: { annual_gross_income: 12 * L } }), noSignals(), new Date('2026-01-15'));
  assert(kinds(a).includes('proof_season'));
});
check('Salaried → no advance_tax alert', () => {
  const a = generateAlerts(profile({ user: { annual_gross_income: 20 * L, employment_type: 'salaried' } }), noSignals(), new Date('2026-06-10'));
  assert(!kinds(a).includes('advance_tax'));
});
check('Every alert has a dedupeKey', () => {
  const a = generateAlerts(profile({ user: { annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, assets: { savings_balance: 0 }, monthlyExpenses: 50000_00 }), noSignals({ scoreDelta: 3 }));
  a.forEach((x) => assert(x.dedupeKey && x.dedupeKey.length > 0));
});

console.log('\nSTATEMENT ANALYSER');
const txns: RawTxn[] = [
  { date: '2026-01-01', description: 'SALARY CREDIT NEFT', amount: 100000_00, direction: 'credit' },
  { date: '2026-01-05', description: 'SWIGGY ORDER', amount: 5000_00, direction: 'debit' },
  { date: '2026-01-10', description: 'AMAZON PURCHASE', amount: 8000_00, direction: 'debit' },
  { date: '2026-01-15', description: 'SIP CAMS-MF AUTOPAY', amount: 15000_00, direction: 'debit' },
];
check('Totals: inflow/outflow/net/savings rate', () => {
  const r = analyzeStatement(txns);
  assert.strictEqual(r.totals.inflow, 100000_00);
  assert.strictEqual(r.totals.outflow, 28000_00);
  assert.strictEqual(r.totals.net, 72000_00);
  assert(Math.abs((r.totals.savingsRate ?? 0) - 0.72) < 0.01);
});
check('Investments (SIP) detected', () => {
  assert(analyzeStatement(txns).invested.total === 15000_00);
});
check('Categorises food & shopping', () => {
  const cats = analyzeStatement(txns).byCategory.map((c) => c.category);
  assert(cats.includes('food_dining') && cats.includes('shopping'));
});
check('Overspending → high-severity watch-out', () => {
  const over: RawTxn[] = [
    { date: '2026-01-01', description: 'SALARY', amount: 20000_00, direction: 'credit' },
    { date: '2026-01-10', description: 'AMAZON', amount: 50000_00, direction: 'debit' },
  ];
  assert(analyzeStatement(over).watchOuts.some((w) => w.severity === 'high'));
});

console.log('\nACTIONS ENGINE');
check('Term-insurance action only fires with dependents', () => {
  const withDeps = generateActions(profile({ user: { annual_gross_income: 15 * L, dependents_count: 2 }, insurance: {} }));
  const noDeps = generateActions(profile({ user: { annual_gross_income: 15 * L, dependents_count: 0 }, insurance: {} }));
  assert(withDeps.some((a) => a.rule_id === 'ACT-001'));
  assert(!noDeps.some((a) => a.rule_id === 'ACT-001'));
});
check('Health action skipped for students', () => {
  const student = generateActions(profile({ user: { annual_gross_income: 4 * L, employment_type: 'student' } }));
  assert(!student.some((a) => a.rule_id === 'ACT-002'));
});
check('Not investing + surplus → "start investing" action (ACT-013)', () => {
  const a = generateActions(profile({ user: { annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, monthlyExpenses: 60000_00, assets: {} }));
  assert(a.some((x) => x.rule_id === 'ACT-013'));
});
check('Every action gets a priority', () => {
  const a = generateActions(profile({ user: { annual_gross_income: 15 * L, monthly_take_home: 100000_00, dependents_count: 1 }, monthlyExpenses: 90000_00 }));
  a.forEach((x) => assert(['high', 'medium', 'low'].includes(x.priority!)));
});

console.log('\nINSURANCE');
check('Dependents + no term cover → high-severity flag', () => {
  const r = analyseInsurance(profile({ user: { annual_gross_income: 15 * L, dependents_count: 2 } }));
  assert(r.term.gap > 0 && r.flags.some((f) => f.severity === 'high'));
});
check('No dependents → no term cover required', () => {
  const r = analyseInsurance(profile({ user: { annual_gross_income: 15 * L, dependents_count: 0 } }));
  assert.strictEqual(r.term.recommended, 0);
});
check('Student → student-aware intro, no life-cover push', () => {
  const r = analyseInsurance(profile({ user: { annual_gross_income: 4 * L, employment_type: 'student' } }));
  assert(/student/i.test(r.beginnerIntro) && r.term.recommended === 0);
});

console.log('\nTAX COPILOT / REDUCTION / HRA');
check('Reduction plan returns steps + sane marginal rate', () => {
  const rp = taxReductionPlan(profile({ user: { annual_gross_income: 20 * L } }));
  assert(rp.steps.length > 0 && rp.marginalRatePct >= 0 && rp.marginalRatePct <= 40);
});
check('Advance tax: applies to business, not salaried', () => {
  const sal = taxCopilot(profile({ user: { annual_gross_income: 20 * L, employment_type: 'salaried' } }));
  const biz = taxCopilot(profile({ user: { annual_gross_income: 20 * L, employment_type: 'business' } }));
  assert.strictEqual(sal.advanceTax.applicable, false);
  assert.strictEqual(biz.advanceTax.applicable, true);
});
check('Advance tax schedule has 4 instalments', () => {
  assert.strictEqual(taxCopilot(profile({ user: { annual_gross_income: 20 * L, employment_type: 'business' } })).advanceTax.instalments.length, 4);
});
check('HRA exemption = min(HRA, rent−10% basic, 50% basic metro)', () => {
  const ex = computeHraExemption(profile({ tax_data: { basic_salary_annual: 6 * L, hra_received_annual: 3 * L, rent_paid_monthly: 25000_00, metro_city: true } }));
  // min(3L, 3L−60k=2.4L, 3L) = 2.4L
  assert(Math.abs(ex - 240000_00) < 200);
});
check('Marginal rate at ₹15L taxable = 31.2% (30% + cess)', () => {
  assert(Math.abs(marginalRate(15 * L) - 0.312) < 0.001);
});

console.log('\nINVESTMENT GUARDRAILS');
check('Thin emergency fund → emergencyFirst', () => {
  const g = buildInvestmentGuidance(profile({ user: { annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, assets: { savings_balance: 30000_00 }, monthlyExpenses: 60000_00 }));
  assert.strictEqual(g.emergencyFirst, true);
});
check('Credit-card balance → highCostDebtFirst', () => {
  const g = buildInvestmentGuidance(profile({ user: { annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, liabilities: { credit_cards: [{ outstanding: 50000_00 }] }, monthlyExpenses: 40000_00 }));
  assert.strictEqual(g.highCostDebtFirst, true);
});
check('Recommendations exist and carry monthly amounts', () => {
  const g = buildInvestmentGuidance(profile({ user: { annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, monthlyExpenses: 50000_00, assets: { savings_balance: 300000_00 } }));
  assert(g.recommendations.length > 0);
  g.recommendations.forEach((r) => assert(typeof r.monthlyAmount === 'number'));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
