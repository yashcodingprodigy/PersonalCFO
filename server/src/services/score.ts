// Money Health Score engine — implements SRS §6 exactly.
// All monetary inputs in paise.

export interface ProfileData {
  user: {
    annual_gross_income: number;
    monthly_take_home: number;
    dependents_count: number;
    age: number | null;
  };
  assets: any;
  liabilities: any;
  insurance: any;
  tax_data: any;
  monthlyExpenses: number | null; // derived from transactions or manual entry
}

export interface ScoreResult {
  score: number;
  dimensions: {
    savings_rate: DimensionScore;
    insurance_adequacy: DimensionScore;
    investment_diversification: DimensionScore;
    emergency_fund: DimensionScore;
    debt_health: DimensionScore;
    tax_efficiency: DimensionScore;
  };
}

export interface DimensionScore {
  score: number;       // 0–100
  weight: number;
  explanation: string;
  available: boolean;  // false when not enough data — excluded & weights renormalised
}

const lerp = (x: number, x0: number, x1: number, y0: number, y1: number) =>
  y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

const sum = (arr: any[], field: string) =>
  (Array.isArray(arr) ? arr : []).reduce((s, x) => s + (Number(x?.[field]) || 0), 0);

export function totalMonthlyEmi(liabilities: any): number {
  return (
    sum(liabilities?.home_loans, 'emi') +
    sum(liabilities?.personal_loans, 'emi') +
    sum(liabilities?.car_loans, 'emi') +
    sum(liabilities?.education_loans, 'emi')
  );
}

// ── 6.3.1 Savings Rate (25%) ────────────────────────────────────────
function savingsRateScore(p: ProfileData): DimensionScore {
  const income = p.user.monthly_take_home;
  if (!income || p.monthlyExpenses == null) {
    return { score: 0, weight: 0.25, explanation: 'Add your monthly expenses or connect a bank account to unlock this dimension.', available: false };
  }
  const rate = (income - p.monthlyExpenses) / income;
  let score: number;
  if (rate >= 0.35) score = 100;
  else if (rate >= 0.25) score = lerp(rate, 0.25, 0.35, 75, 99);
  else if (rate >= 0.15) score = lerp(rate, 0.15, 0.25, 40, 74);
  else if (rate >= 0.05) score = lerp(rate, 0.05, 0.15, 10, 39);
  else score = clamp(lerp(Math.max(rate, 0), 0, 0.05, 0, 9));
  const pct = Math.round(rate * 100);
  return {
    score: Math.round(clamp(score)),
    weight: 0.25,
    explanation: `You save ${pct}% of your take-home each month. Target: 25%+.`,
    available: true,
  };
}

// ── 6.3.2 Insurance Adequacy (20%) ──────────────────────────────────
function insuranceScore(p: ProfileData): DimensionScore {
  const annualIncome = p.user.annual_gross_income;
  if (!annualIncome) {
    return { score: 0, weight: 0.2, explanation: 'Add your income to assess insurance adequacy.', available: false };
  }
  const termCover = sum(p.insurance?.term, 'sum_assured');
  const healthCover = sum(p.insurance?.health, 'sum_insured');
  const recommendedTerm = annualIncome * 25;
  const familySize = 1 + (p.user.dependents_count || 0);
  // ₹10L family floater minimum, adjusted for family size (₹5L per member floor)
  const recommendedHealth = Math.max(1000000 * 100, 500000 * 100 * familySize);

  const termScore = clamp((termCover / recommendedTerm) * 100);
  const healthScore = clamp((healthCover / recommendedHealth) * 100);
  let combined = termScore * 0.6 + healthScore * 0.4;

  // Hard cap: zero term insurance with dependents caps dimension at 30
  if (termCover === 0 && (p.user.dependents_count || 0) > 0) combined = Math.min(combined, 30);

  const gapCr = ((recommendedTerm - termCover) / 1e7 / 100).toFixed(2);
  const explanation =
    termCover >= recommendedTerm
      ? 'Your life and health cover meet recommended levels.'
      : `Term cover gap of ₹${gapCr} Cr vs the 25× income guideline.`;
  return { score: Math.round(clamp(combined)), weight: 0.2, explanation, available: true };
}

// ── Investment Diversification (20%) ────────────────────────────────
function diversificationScore(p: ProfileData): DimensionScore {
  const a = p.assets || {};
  const equity = (Number(a.mutual_funds?.value) || 0) + (Number(a.stocks) || 0) + (Number(a.us_stocks) || 0);
  const debt = (Number(a.epf) || 0) + (Number(a.ppf) || 0) + (Number(a.fd_total) || 0) + (Number(a.nps) || 0);
  const realEstate = Number(a.property) || 0;
  const gold = Number(a.gold) || 0;
  const cash = Number(a.savings_balance) || 0;
  const total = equity + debt + realEstate + gold + cash;
  if (total === 0) {
    return { score: 0, weight: 0.2, explanation: 'Add your investments to unlock this dimension.', available: false };
  }
  const shares = [equity, debt, realEstate, gold].map((x) => x / total);
  const categoriesHeld = shares.filter((s) => s > 0.02).length;
  const maxShare = Math.max(...shares, cash / total);
  // Base: breadth of categories. Penalty: concentration above 70% in one category.
  let score = categoriesHeld * 25;
  if (maxShare > 0.7) score -= lerp(Math.min(maxShare, 1), 0.7, 1.0, 0, 40);
  // Idle cash above 40% of portfolio is also concentration
  const explanation =
    categoriesHeld >= 3
      ? 'Healthy spread across asset classes.'
      : `Portfolio concentrated in ${categoriesHeld <= 1 ? 'a single asset class' : 'two asset classes'} — diversification reduces risk.`;
  return { score: Math.round(clamp(score)), weight: 0.2, explanation, available: true };
}

// ── Emergency Fund (15%) ────────────────────────────────────────────
function emergencyFundScore(p: ProfileData): DimensionScore {
  const a = p.assets || {};
  const liquid = (Number(a.savings_balance) || 0) + (Number(a.liquid_funds) || 0);
  if (p.monthlyExpenses == null || p.monthlyExpenses === 0) {
    return { score: 0, weight: 0.15, explanation: 'Add monthly expenses to measure your emergency runway.', available: false };
  }
  const months = liquid / p.monthlyExpenses;
  const score = clamp((months / 6) * 100);
  return {
    score: Math.round(score),
    weight: 0.15,
    explanation: `Liquid assets cover ${months.toFixed(1)} months of expenses. Target: 6 months.`,
    available: true,
  };
}

// ── Debt Health (10%) ───────────────────────────────────────────────
function debtHealthScore(p: ProfileData): DimensionScore {
  const income = p.user.monthly_take_home;
  if (!income) return { score: 0, weight: 0.1, explanation: 'Add income to assess debt load.', available: false };
  const emi = totalMonthlyEmi(p.liabilities);
  const ccOutstanding = sum(p.liabilities?.credit_cards, 'outstanding');
  const ccLimit = sum(p.liabilities?.credit_cards, 'limit');

  const emiRatio = emi / income;
  // EMI component: <40% is healthy
  let emiScore: number;
  if (emiRatio <= 0.2) emiScore = 100;
  else if (emiRatio <= 0.4) emiScore = lerp(emiRatio, 0.2, 0.4, 100, 70);
  else if (emiRatio <= 0.6) emiScore = lerp(emiRatio, 0.4, 0.6, 70, 20);
  else emiScore = 10;

  // Credit utilisation component: <30% is healthy
  let ccScore = 100;
  if (ccLimit > 0) {
    const util = ccOutstanding / ccLimit;
    if (util <= 0.3) ccScore = 100;
    else if (util <= 0.6) ccScore = lerp(util, 0.3, 0.6, 100, 40);
    else ccScore = lerp(Math.min(util, 1), 0.6, 1, 40, 0);
  }
  const score = emiScore * 0.6 + ccScore * 0.4;
  const explanation =
    emi === 0 && ccOutstanding === 0
      ? 'No EMIs or card debt — debt-free position.'
      : `EMIs are ${Math.round(emiRatio * 100)}% of take-home (target < 40%).`;
  return { score: Math.round(clamp(score)), weight: 0.1, explanation, available: true };
}

// ── Tax Efficiency (10%) ────────────────────────────────────────────
export function deductionUsage(p: ProfileData): { used: number; available: number; items: { section: string; used: number; limit: number }[] } {
  const t = p.tax_data || {};
  const a = p.assets || {};
  const epfAnnual = Number(t.epf_annual) || Math.round((Number(a.epf) || 0) * 0.12 * 0); // EPF contribution must be explicit
  const c80 = Math.min(
    (Number(t.epf_contribution_annual) || 0) +
      (Number(t.elss_annual) || (Number(a.mutual_funds?.monthly_sip) || 0) * 12 * (t.sip_is_elss ? 1 : 0)) +
      (Number(t.ppf_annual) || 0) +
      (Number(t.home_loan_principal_annual) || 0) +
      (Number(t.school_fees_annual) || 0) +
      (Number(t.lic_premium_annual) || 0),
    15000000
  );
  const nps = Math.min(Number(t.nps_80ccd1b_annual) || 0, 5000000);
  const healthPremiumSelf = Math.min(Number(t.health_premium_self_annual) || 0, 2500000);
  const healthPremiumParents = Math.min(Number(t.health_premium_parents_annual) || 0, t.parents_senior ? 5000000 : 2500000);
  const homeLoanInterest = Math.min(Number(t.home_loan_interest_annual) || 0, 20000000);

  const items = [
    { section: '80C', used: c80, limit: 15000000 },
    { section: '80CCD(1B)', used: nps, limit: 5000000 },
    { section: '80D (self & family)', used: healthPremiumSelf, limit: 2500000 },
    { section: '80D (parents)', used: healthPremiumParents, limit: t.parents_senior ? 5000000 : 2500000 },
    { section: '24(b) home loan interest', used: homeLoanInterest, limit: 20000000 },
  ];
  const used = items.reduce((s, i) => s + i.used, 0);
  const available = items.reduce((s, i) => s + i.limit, 0);
  return { used, available, items };
}

function taxEfficiencyScore(p: ProfileData): DimensionScore {
  if (!p.user.annual_gross_income) {
    return { score: 0, weight: 0.1, explanation: 'Add income details to assess tax efficiency.', available: false };
  }
  // Under the new regime most deductions don't apply — score reflects
  // whether the user has picked the regime that saves them more.
  const { used, items } = deductionUsage(p);
  // Relevant ceiling: only count limits the user could plausibly use
  const relevant = items.filter((i) => i.section !== '24(b) home loan interest' || i.used > 0);
  const available = relevant.reduce((s, i) => s + i.limit, 0);
  const score = available > 0 ? clamp((used / available) * 100) : 0;
  const usedL = (used / 100 / 100000).toFixed(1);
  return {
    score: Math.round(score),
    weight: 0.1,
    explanation: `Using ₹${usedL}L of available deductions. Unused headroom is money left on the table.`,
    available: true,
  };
}

export function computeScore(p: ProfileData): ScoreResult {
  const dims = {
    savings_rate: savingsRateScore(p),
    insurance_adequacy: insuranceScore(p),
    investment_diversification: diversificationScore(p),
    emergency_fund: emergencyFundScore(p),
    debt_health: debtHealthScore(p),
    tax_efficiency: taxEfficiencyScore(p),
  };
  const active = Object.values(dims).filter((d) => d.available);
  const totalWeight = active.reduce((s, d) => s + d.weight, 0);
  const score =
    totalWeight === 0
      ? 0
      : Math.round(active.reduce((s, d) => s + d.score * d.weight, 0) / totalWeight);
  return { score: clamp(score), dimensions: dims };
}

export function scoreBand(score: number): 'red' | 'amber' | 'teal' | 'green' {
  if (score <= 40) return 'red';
  if (score <= 65) return 'amber';
  if (score <= 85) return 'teal';
  return 'green';
}
