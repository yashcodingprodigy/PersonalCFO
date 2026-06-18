// Deep engine coverage — score dimensions, net worth, tax brackets, ITR form
// branches, investment risk logic, goals, market. Pure functions, no DB.
import assert from 'assert';
import { ProfileData, computeScore, scoreBand, deductionUsage, totalMonthlyEmi } from '../src/services/score';
import { computeNetWorth, projectValue, projectMonthsToTarget } from '../src/services/networth';
import { computeRegime, taxCalendarEntries } from '../src/services/tax';
import { prepareFiling, FilingInputs } from '../src/services/taxFiling';
import { buildInvestmentGuidance } from '../src/services/investment';
import { generateActions } from '../src/services/actions';
import { analyseInsurance } from '../src/services/insurance';
import { computeGoalMath } from '../src/services/goals';
import { trendingThemes, marketBasics } from '../src/services/market';

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

console.log('\nSCORE DIMENSIONS');
check('Savings rate ≥35% → 100', () => {
  const s = computeScore(profile({ user: { monthly_take_home: 100000_00, annual_gross_income: 12 * L }, monthlyExpenses: 50000_00 }));
  assert.strictEqual(s.dimensions.savings_rate.score, 100);
});
check('Debt-free → debt_health ~100', () => {
  const s = computeScore(profile({ user: { monthly_take_home: 100000_00, annual_gross_income: 12 * L } }));
  assert(s.dimensions.debt_health.available && s.dimensions.debt_health.score >= 90);
});
check('Single asset class → weak diversification', () => {
  const s = computeScore(profile({ assets: { mutual_funds: { value: 10 * L } } }));
  assert(s.dimensions.investment_diversification.score < 30);
});
check('Spread across classes → healthy diversification', () => {
  const s = computeScore(profile({ assets: { mutual_funds: { value: 3 * L }, ppf: 3 * L, gold: 1 * L, savings_balance: 3 * L } }));
  assert(s.dimensions.investment_diversification.score >= 50);
});
check('6 months liquid → emergency fund 100', () => {
  const s = computeScore(profile({ assets: { savings_balance: 3 * L }, monthlyExpenses: 50000_00 }));
  assert.strictEqual(s.dimensions.emergency_fund.score, 100);
});
check('High EMI load → debt health drops', () => {
  const s = computeScore(profile({ user: { monthly_take_home: 100000_00, annual_gross_income: 12 * L }, liabilities: { home_loans: [{ emi: 70000_00, outstanding: 50 * L }] } }));
  assert(s.dimensions.debt_health.score < 60);
});
check('scoreBand thresholds (red/amber/teal/green)', () => {
  assert.strictEqual(scoreBand(30), 'red');
  assert.strictEqual(scoreBand(55), 'amber');
  assert.strictEqual(scoreBand(75), 'teal');
  assert.strictEqual(scoreBand(95), 'green');
});
check('totalMonthlyEmi sums all loan EMIs', () => {
  const emi = totalMonthlyEmi({ home_loans: [{ emi: 30000_00 }], personal_loans: [{ emi: 10000_00 }] });
  assert.strictEqual(emi, 40000_00);
});
check('deductionUsage caps 80C at ₹1.5L and reads NPS', () => {
  const { items } = deductionUsage(profile({ tax_data: { ppf_annual: 2 * L, nps_80ccd1b_annual: 50000_00 } }));
  assert.strictEqual(items.find((i) => i.section === '80C')!.used, 150000_00);
  assert.strictEqual(items.find((i) => i.section === '80CCD(1B)')!.used, 50000_00);
});

console.log('\nNET WORTH MATH');
check('projectValue with 0% = principal + contributions', () => {
  assert.strictEqual(projectValue(0, 10000_00, 12, 0), 120000_00);
});
check('projectValue with growth exceeds principal', () => {
  assert(projectValue(100000_00, 0, 12, 0.12) > 100000_00);
});
check('projectMonthsToTarget: already there → 0', () => {
  assert.strictEqual(projectMonthsToTarget(200000_00, 5000_00, 100000_00), 0);
});
check('projectMonthsToTarget: no surplus → null', () => {
  assert.strictEqual(projectMonthsToTarget(0, 0, 100000_00), null);
});
check('Allocation buckets: equity vs debt classified correctly', () => {
  const nw = computeNetWorth(profile({ assets: { mutual_funds: { value: 5 * L }, stocks: 2 * L, ppf: 3 * L, gold: 1 * L } }));
  assert.strictEqual(nw.allocation.equity, 7 * L);
  assert.strictEqual(nw.allocation.debt, 3 * L);
  assert.strictEqual(nw.allocation.gold, 1 * L);
});
check('Liquidity ratio reflects liquid share of assets', () => {
  const nw = computeNetWorth(profile({ assets: { savings_balance: 5 * L, property: 5 * L } }));
  assert(Math.abs(nw.liquidityRatio - 0.5) < 0.01);
});

console.log('\nTAX BRACKETS & CALENDAR');
check('Old-regime surcharge applies above ₹50L', () => {
  const f = prepareFiling({ ...baseInputs(), grossSalary: 60 * L }, '2025-26');
  assert(f.old.surcharge > 0);
});
check('Tax calendar has 6 milestones', () => {
  const c = taxCalendarEntries();
  assert.strictEqual(c.length, 6);
  assert(c.some((e) => /July/.test(e.month)));
});
check('Below ₹2.5L → zero tax both regimes', () => {
  assert.strictEqual(computeRegime(profile({ user: { annual_gross_income: 2 * L } }), 'old').tax, 0);
  assert.strictEqual(computeRegime(profile({ user: { annual_gross_income: 2 * L } }), 'new').tax, 0);
});

function baseInputs(over: Partial<FilingInputs> = {}): FilingInputs {
  return {
    grossSalary: 0, interestIncome: 0, housePropertyIncome: 0, otherIncome: 0, businessIncome: 0,
    stcgEquity: 0, ltcgEquity: 0, otherCapitalGains: 0,
    ded80C: 0, ded80CCD1B: 0, ded80D: 0, ded24b: 0, ded80G: 0, ded80TTA: 0, ded80E: 0, hraExempt: 0,
    employerNps: 0, tdsSalary: 0, tdsOther: 0, advanceTax: 0, ...over,
  };
}

console.log('\nITR FORM SELECTION BRANCHES');
check('Foreign assets → ITR-2', () => { assert.strictEqual(prepareFiling(baseInputs({ grossSalary: 12 * L, foreignAssets: true }), '2025-26').form.code, 'ITR-2'); });
check('Company director → ITR-2', () => { assert.strictEqual(prepareFiling(baseInputs({ grossSalary: 12 * L, isDirector: true }), '2025-26').form.code, 'ITR-2'); });
check('Multiple house properties → ITR-2', () => { assert.strictEqual(prepareFiling(baseInputs({ grossSalary: 12 * L, multipleHouseProperties: true }), '2025-26').form.code, 'ITR-2'); });
check('Income over ₹50L → ITR-2', () => { assert.strictEqual(prepareFiling(baseInputs({ grossSalary: 60 * L }), '2025-26').form.code, 'ITR-2'); });
check('House-property loss capped at ₹2L', () => {
  const a = prepareFiling(baseInputs({ grossSalary: 20 * L, housePropertyIncome: -3 * L }), '2025-26');
  const b = prepareFiling(baseInputs({ grossSalary: 20 * L, housePropertyIncome: -5 * L }), '2025-26');
  assert.strictEqual(a.old.totalIncome, b.old.totalIncome); // both capped at −₹2L
});
check('Employer NPS (80CCD-2) deducts in the NEW regime too', () => {
  const f = prepareFiling(baseInputs({ grossSalary: 20 * L, employerNps: 1 * L }), '2025-26');
  assert(f.new.deductions >= 1 * L);
});

console.log('\nINVESTMENT RISK LOGIC');
check('Young, no dependents, salaried → aggressive (derived)', () => {
  const g = buildInvestmentGuidance(profile({ user: { age: 25, dependents_count: 0, employment_type: 'salaried', annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, monthlyExpenses: 50000_00 }));
  assert.strictEqual(g.riskProfile, 'aggressive');
  assert.strictEqual(g.riskWasExplicit, false);
});
check('Older, many dependents, freelancer → conservative', () => {
  const g = buildInvestmentGuidance(profile({ user: { age: 55, dependents_count: 3, employment_type: 'freelancer', annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, monthlyExpenses: 50000_00 }));
  assert.strictEqual(g.riskProfile, 'conservative');
});
check('Explicit risk_appetite is respected', () => {
  const g = buildInvestmentGuidance(profile({ user: { risk_appetite: 'conservative', age: 25, annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, monthlyExpenses: 50000_00 }));
  assert.strictEqual(g.riskProfile, 'conservative');
  assert.strictEqual(g.riskWasExplicit, true);
});
check('Exactly one model portfolio matches the user', () => {
  const g = buildInvestmentGuidance(profile({ user: { risk_appetite: 'moderate', annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, monthlyExpenses: 50000_00 }));
  assert.strictEqual(g.modelPortfolios.filter((m) => m.matchesYou).length, 1);
});
check('Monthly investable ≈ 70% of surplus', () => {
  const g = buildInvestmentGuidance(profile({ user: { annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, monthlyExpenses: 50000_00, assets: { savings_balance: 5 * L } }));
  assert(Math.abs(g.monthlyInvestable - Math.round(50000_00 * 0.7)) < 200);
});

console.log('\nACTIONS — MORE RULES');
check('Idle-cash beyond 6 months → ACT-009', () => {
  const a = generateActions(profile({ user: { annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, monthlyExpenses: 50000_00, assets: { savings_balance: 10 * L } }));
  assert(a.some((x) => x.rule_id === 'ACT-009'));
});
check('High credit-card utilisation → ACT-007', () => {
  const a = generateActions(profile({ user: { annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, liabilities: { credit_cards: [{ outstanding: 80000_00, limit: 100000_00 }] } }));
  assert(a.some((x) => x.rule_id === 'ACT-007'));
});
check('No expense data → ACT-018 (upload statement)', () => {
  const a = generateActions(profile({ user: { annual_gross_income: 12 * L, monthly_take_home: 100000_00 } }));
  assert(a.some((x) => x.rule_id === 'ACT-018'));
});
check('Has SIP → ACT-014 step-up', () => {
  const a = generateActions(profile({ user: { annual_gross_income: 12 * L, monthly_take_home: 100000_00 }, assets: { mutual_funds: { value: 5 * L, monthly_sip: 10000_00 } }, monthlyExpenses: 50000_00 }));
  assert(a.some((x) => x.rule_id === 'ACT-014'));
});

console.log('\nINSURANCE — RECOMMENDATIONS');
check('Term gap + dependents → premium estimate present', () => {
  const r = analyseInsurance(profile({ user: { annual_gross_income: 15 * L, dependents_count: 2, age: 30 } }));
  assert(r.term.premiumEstimateAnnual && r.term.premiumEstimateAnnual.low > 0);
});
check('Age 45 → critical-illness recommendation', () => {
  const r = analyseInsurance(profile({ user: { annual_gross_income: 15 * L, age: 45, dependents_count: 1 } }));
  assert(r.recommendations.some((x) => /critical/i.test(x.title)));
});
check('Home loan → personal-accident recommendation', () => {
  const r = analyseInsurance(profile({ user: { annual_gross_income: 15 * L, dependents_count: 1 }, liabilities: { home_loans: [{ outstanding: 40 * L }] } }));
  assert(r.recommendations.some((x) => /accident/i.test(x.title)));
});
check('Owns property → home-insurance recommendation; avoid list non-empty', () => {
  const r = analyseInsurance(profile({ user: { annual_gross_income: 15 * L }, assets: { property: 80 * L } }));
  assert(r.recommendations.some((x) => /home \/ property/i.test(x.title)));
  assert(r.avoid.length > 0);
});

console.log('\nGOALS MATH');
check('Already funded → achieved', () => {
  const m = computeGoalMath({ target_amount: 5 * L, target_date: null, current_amount: 6 * L, monthly_contribution: 0 });
  assert.strictEqual(m.health, 'achieved');
});
check('Contribution ≥ required → on_track; required > 0 when underfunded', () => {
  const m = computeGoalMath({ target_amount: 100 * L, target_date: '2035-01-01', current_amount: 0, monthly_contribution: 0, meta: { expected_return: 0.12 } });
  assert(m.requiredMonthly > 0);
  const m2 = computeGoalMath({ target_amount: 100 * L, target_date: '2035-01-01', current_amount: 0, monthly_contribution: m.requiredMonthly + 1000_00, meta: { expected_return: 0.12 } });
  assert.strictEqual(m2.health, 'on_track');
});
check('Tiny contribution vs big target → off_track', () => {
  const m = computeGoalMath({ target_amount: 100 * L, target_date: '2028-01-01', current_amount: 0, monthly_contribution: 100_00 });
  assert.strictEqual(m.health, 'off_track');
});

console.log('\nMARKET (education content)');
check('Trending themes present with risk labels', () => {
  const t = trendingThemes();
  assert(t.length > 0);
  t.forEach((x) => assert(['Low', 'Medium', 'High'].includes(x.risk)));
});
check('Market basics present', () => { assert(marketBasics().length > 0); });

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
