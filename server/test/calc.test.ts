// Money-math verification suite. Pure functions only (no DB).
// Run: cd server && npx tsx test/calc.test.ts
import assert from 'assert';
import { ProfileData } from '../src/services/score';
import { compareRegimes, computeRegime } from '../src/services/tax';
import { prepareFiling, FilingInputs } from '../src/services/taxFiling';
import { computeScore } from '../src/services/score';
import { computeNetWorth, growthProjection } from '../src/services/networth';
import { buildInvestmentGuidance } from '../src/services/investment';

let passed = 0, failed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
// approx equality in paise (allow ₹2 rounding)
const near = (a: number, b: number, tolPaise = 200) => assert(Math.abs(a - b) <= tolPaise, `expected ~${b}, got ${a}`);

const L = 100000_00; // ₹1 lakh in paise

function profile(over: Partial<ProfileData> = {}): ProfileData {
  return {
    user: { annual_gross_income: 0, monthly_take_home: 0, dependents_count: 0, age: 30, employment_type: 'salaried' },
    assets: {}, liabilities: {}, insurance: {}, tax_data: {}, monthlyExpenses: null,
    ...over,
  } as ProfileData;
}

console.log('\nTAX — new regime FY2025-26');
check('₹10L gross → ₹0 tax (87A rebate, taxable ≤ ₹12L)', () => {
  const r = computeRegime(profile({ user: { ...profile().user, annual_gross_income: 10 * L } }), 'new');
  near(r.tax, 0);
});
check('₹20L gross → ₹1,92,400 tax', () => {
  const r = computeRegime(profile({ user: { ...profile().user, annual_gross_income: 20 * L } }), 'new');
  // taxable 19.25L → 20k+40k+60k+65k = 185k, +4% cess = 192,400
  near(r.tax, 192400_00);
});

console.log('\nTAX — old regime');
check('₹20L gross → ₹4,12,651 tax (std 50k + default ₹2,400 professional tax)', () => {
  // Old regime auto-applies ₹50k std deduction + a default ₹2,400 professional tax →
  // taxable ₹19,47,600 → 12.5k+100k+284,280 = 396,780, +4% cess = 412,651.
  const r = computeRegime(profile({ user: { ...profile().user, annual_gross_income: 20 * L } }), 'old');
  near(r.tax, 412651_00, 200);
});
check('compareRegimes picks NEW for a high earner with no deductions', () => {
  const c = compareRegimes(profile({ user: { ...profile().user, annual_gross_income: 20 * L } }));
  assert.strictEqual(c.recommended, 'new');
});

console.log('\nITR FILING');
const baseInputs = (over: Partial<FilingInputs> = {}): FilingInputs => ({
  grossSalary: 0, interestIncome: 0, housePropertyIncome: 0, otherIncome: 0, businessIncome: 0,
  stcgEquity: 0, ltcgEquity: 0, otherCapitalGains: 0,
  ded80C: 0, ded80CCD1B: 0, ded80D: 0, ded24b: 0, ded80G: 0, ded80TTA: 0, ded80E: 0, hraExempt: 0,
  employerNps: 0, tdsSalary: 0, tdsOther: 0, advanceTax: 0, ...over,
});
check('Salary ₹12L, TDS ₹50k → refund ₹50k (new regime, rebate)', () => {
  const f = prepareFiling(baseInputs({ grossSalary: 12 * L, tdsSalary: 50000_00 }), '2025-26');
  const reg = f.recommendedRegime === 'old' ? f.old : f.new;
  near(reg.refundOrPayable, 50000_00);
});
check('Simple salary → ITR-1 (Sahaj)', () => {
  const f = prepareFiling(baseInputs({ grossSalary: 12 * L }), '2025-26');
  assert.strictEqual(f.form.code, 'ITR-1');
});
check('Capital gains → ITR-2', () => {
  const f = prepareFiling(baseInputs({ grossSalary: 12 * L, ltcgEquity: 2 * L }), '2025-26');
  assert.strictEqual(f.form.code, 'ITR-2');
});
check('Business income → ITR-3', () => {
  const f = prepareFiling(baseInputs({ businessIncome: 15 * L }), '2025-26');
  assert.strictEqual(f.form.code, 'ITR-3');
});
check('Presumptive business under ₹50L → ITR-4', () => {
  const f = prepareFiling(baseInputs({ businessIncome: 8 * L, presumptiveBusiness: true }), '2025-26');
  assert.strictEqual(f.form.code, 'ITR-4');
});
check('LTCG ₹2L → only ₹75k taxable at 12.5% (₹1.25L exempt)', () => {
  // salary 0, ltcg 2L; new regime. CG tax = (2L-1.25L)*12.5% = 9375 ; +4% cess
  const f = prepareFiling(baseInputs({ ltcgEquity: 2 * L }), '2025-26');
  near(f.new.capitalGainsTax, 9375_00, 100);
});
check('STCG equity taxed at 20%', () => {
  const f = prepareFiling(baseInputs({ stcgEquity: 1 * L }), '2025-26');
  near(f.new.capitalGainsTax, 20000_00, 100);
});

console.log('\nSCORE');
check('Student → insurance dimension excluded', () => {
  const s = computeScore(profile({ user: { ...profile().user, employment_type: 'student', annual_gross_income: 3 * L } }));
  assert.strictEqual(s.dimensions.insurance_adequacy.available, false);
});
check('No dependents → no life-cover penalty (insurance scores on health only)', () => {
  const p = profile({ user: { ...profile().user, annual_gross_income: 15 * L, dependents_count: 0 }, insurance: { health: [{ sum_insured: 10 * L }] } });
  const s = computeScore(p);
  assert(s.dimensions.insurance_adequacy.available);
  assert(s.dimensions.insurance_adequacy.score >= 90, `health-covered no-deps should score high, got ${s.dimensions.insurance_adequacy.score}`);
});
check('Tax-efficiency excluded below ~₹12.75L income', () => {
  const s = computeScore(profile({ user: { ...profile().user, annual_gross_income: 8 * L } }));
  assert.strictEqual(s.dimensions.tax_efficiency.available, false);
});

console.log('\nNET WORTH & GROWTH');
check('Net worth = assets − liabilities', () => {
  const p = profile({ assets: { savings_balance: 5 * L, mutual_funds: { value: 10 * L } }, liabilities: { personal_loans: [{ outstanding: 3 * L }] } });
  const nw = computeNetWorth(p);
  near(nw.netWorth, 12 * L, 100);
});
check('Growth: improved ≥ baseline at every horizon', () => {
  const p = profile({ user: { ...profile().user, monthly_take_home: 100000_00 }, monthlyExpenses: 60000_00, assets: { mutual_funds: { value: 10 * L } } });
  const g = growthProjection(p, computeNetWorth(p));
  assert(g.horizons.length === 3);
  g.horizons.forEach((h) => assert(h.improved >= h.baseline, `improved < baseline at ${h.years}y`));
});

console.log('\nINVESTMENT');
check('Target allocation sums to 100%', () => {
  const g = buildInvestmentGuidance(profile({ user: { ...profile().user, annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, monthlyExpenses: 60000_00 }));
  const t = g.targetAllocation;
  assert.strictEqual(t.equity + t.debt + t.gold, 100, `sums to ${t.equity + t.debt + t.gold}`);
});
check('Aggressive younger investor gets more equity than conservative', () => {
  const young = buildInvestmentGuidance(profile({ user: { ...profile().user, age: 25, risk_appetite: 'aggressive', annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, monthlyExpenses: 50000_00 }));
  const cons = buildInvestmentGuidance(profile({ user: { ...profile().user, age: 25, risk_appetite: 'conservative', annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, monthlyExpenses: 50000_00 }));
  assert(young.targetAllocation.equity > cons.targetAllocation.equity);
});

console.log('\nEDGE CASES');
check('Zero income → score 0, no crash, dimensions locked', () => {
  const s = computeScore(profile());
  assert.strictEqual(s.score, 0);
  assert.strictEqual(s.dimensions.savings_rate.available, false);
});
check('New-regime rebate boundary: taxable exactly ₹12L → ₹0', () => {
  const r = computeRegime(profile({ user: { ...profile().user, annual_gross_income: 1275000_00 } }), 'new'); // -75k std = 12L
  near(r.tax, 0);
});
check('Just over the rebate cap → tax becomes payable', () => {
  const r = computeRegime(profile({ user: { ...profile().user, annual_gross_income: 1300000_00 } }), 'new'); // taxable 12.25L
  assert(r.tax > 0, 'expected tax > 0 just above the rebate ceiling');
});
check('Surcharge kicks in above ₹50L (new regime)', () => {
  const f = prepareFiling(baseInputs({ grossSalary: 60 * L }), '2025-26');
  assert(f.new.surcharge > 0, 'expected surcharge for >₹50L income');
});
check('Capital loss never produces negative tax', () => {
  const f = prepareFiling(baseInputs({ grossSalary: 12 * L, stcgEquity: -3 * L, ltcgEquity: -1 * L }), '2025-26');
  assert(f.new.capitalGainsTax === 0, `CG tax should floor at 0, got ${f.new.capitalGainsTax}`);
});
check('Net worth can be negative (more debt than assets)', () => {
  const nw = computeNetWorth(profile({ assets: { savings_balance: 0 }, liabilities: { personal_loans: [{ outstanding: 5 * L }] } }));
  near(nw.netWorth, -5 * L, 100);
});
check('No income → investment guidance returns hasIncome=false (no crash)', () => {
  const g = buildInvestmentGuidance(profile());
  assert.strictEqual(g.hasIncome, false);
});
check('No take-home → growth projection unavailable (no divide-by-zero)', () => {
  const p = profile();
  const g = growthProjection(p, computeNetWorth(p));
  assert.strictEqual(g.available, false);
});
check('Huge income surcharge capped sanely (₹6 Cr salary computes)', () => {
  const f = prepareFiling(baseInputs({ grossSalary: 60000000_00 }), '2025-26'); // ₹6 Cr
  assert(f.new.totalTax > 0 && isFinite(f.new.totalTax));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
