// Tax Optimisation Engine — SRS §10.
// FY 2025-26 slabs. Tax law constants are isolated here so the annual
// Finance Act update is a single-file change.
// All amounts in paise.

import { ProfileData, deductionUsage } from './score';

interface Slab { upTo: number; rate: number }

// New regime FY 2025-26 (post Feb 2025 budget)
const NEW_REGIME_SLABS: Slab[] = [
  { upTo: 400000_00, rate: 0 },
  { upTo: 800000_00, rate: 0.05 },
  { upTo: 1200000_00, rate: 0.10 },
  { upTo: 1600000_00, rate: 0.15 },
  { upTo: 2000000_00, rate: 0.20 },
  { upTo: 2400000_00, rate: 0.25 },
  { upTo: Infinity, rate: 0.30 },
];
const NEW_STD_DEDUCTION = 75000_00;
const NEW_REBATE_LIMIT = 1200000_00; // 87A: zero tax up to ₹12L taxable

// Old regime
const OLD_REGIME_SLABS: Slab[] = [
  { upTo: 250000_00, rate: 0 },
  { upTo: 500000_00, rate: 0.05 },
  { upTo: 1000000_00, rate: 0.20 },
  { upTo: Infinity, rate: 0.30 },
];
const OLD_STD_DEDUCTION = 50000_00;
const OLD_REBATE_LIMIT = 500000_00;

const CESS = 0.04;

function slabTax(taxable: number, slabs: Slab[]): number {
  let tax = 0;
  let prev = 0;
  for (const s of slabs) {
    if (taxable > prev) {
      tax += (Math.min(taxable, s.upTo) - prev) * s.rate;
      prev = s.upTo;
    } else break;
  }
  return tax;
}

function surcharge(taxable: number, baseTax: number, regime: 'old' | 'new'): number {
  const r = taxable > 50000000_00 ? (regime === 'new' ? 0.25 : 0.37)
    : taxable > 20000000_00 ? 0.25
    : taxable > 10000000_00 ? 0.15
    : taxable > 5000000_00 ? 0.10 : 0;
  return baseTax * r;
}

export interface RegimeResult {
  regime: 'old' | 'new';
  grossIncome: number;
  totalDeductions: number;
  taxableIncome: number;
  tax: number; // including cess
  effectiveRate: number;
}

export function computeHraExemption(p: ProfileData): number {
  const t = p.tax_data || {};
  const basicAnnual = Number(t.basic_salary_annual) || Math.round((p.user.annual_gross_income || 0) * 0.4);
  const hraReceived = Number(t.hra_received_annual) || 0;
  const rentPaid = (Number(t.rent_paid_monthly) || 0) * 12;
  if (rentPaid === 0 || hraReceived === 0) return 0;
  const metro = t.metro_city !== false; // default metro
  return Math.max(0, Math.min(
    hraReceived,
    rentPaid - basicAnnual * 0.1,
    basicAnnual * (metro ? 0.5 : 0.4),
  ));
}

export function computeRegime(p: ProfileData, regime: 'old' | 'new'): RegimeResult {
  const gross = p.user.annual_gross_income || 0;
  let deductions = 0;
  if (regime === 'new') {
    deductions = NEW_STD_DEDUCTION;
    // Employer NPS (80CCD(2)) survives the new regime
    deductions += Number(p.tax_data?.employer_nps_annual) || 0;
  } else {
    const { used } = deductionUsage(p);
    deductions = OLD_STD_DEDUCTION + used + computeHraExemption(p);
    deductions += Number(p.tax_data?.professional_tax_annual) || 240000; // ₹2,400 typical
    deductions += Math.min(Number(p.tax_data?.education_loan_interest_annual) || 0, Infinity);
    deductions += Number(p.tax_data?.donations_80g_annual) || 0;
  }
  const taxable = Math.max(0, gross - deductions);
  let tax = slabTax(taxable, regime === 'new' ? NEW_REGIME_SLABS : OLD_REGIME_SLABS);
  // 87A rebate
  if (taxable <= (regime === 'new' ? NEW_REBATE_LIMIT : OLD_REBATE_LIMIT)) tax = 0;
  tax += surcharge(taxable, tax, regime);
  tax = Math.round(tax * (1 + CESS));
  return {
    regime,
    grossIncome: gross,
    totalDeductions: deductions,
    taxableIncome: taxable,
    tax,
    effectiveRate: gross > 0 ? tax / gross : 0,
  };
}

// ── Salary → tax-liability breakdown (used by the Monthly Records payslip card)
// Given an annualised gross salary (paise) it returns, for each regime, the
// slab-by-slab "tax rate window", the rebate/surcharge/cess, the total tax,
// the implied monthly TDS, and the marginal + effective rates. This is a
// projection from one payslip annualised — always shown as an estimate.
export interface TaxBand { from: number; to: number | null; rate: number; taxedAmount: number; tax: number }
export interface SalaryTaxResult {
  regime: 'old' | 'new';
  annualGross: number;
  standardDeduction: number;
  otherDeductions: number;
  taxableIncome: number;
  bands: TaxBand[];
  baseTax: number;     // slab tax before rebate
  rebate: number;      // 87A rebate applied (negative effect)
  surcharge: number;
  cess: number;
  totalTax: number;    // payable incl. surcharge + cess, after rebate
  monthlyTds: number;  // totalTax / 12
  marginalRatePct: number;  // top slab the income reaches
  effectiveRatePct: number; // totalTax / gross
}

function bandsFor(taxable: number, slabs: Slab[]): TaxBand[] {
  const out: TaxBand[] = [];
  let prev = 0;
  for (const s of slabs) {
    const top = s.upTo === Infinity ? null : s.upTo;
    const taxedAmount = Math.max(0, Math.min(taxable, s.upTo) - prev);
    out.push({ from: prev, to: top, rate: s.rate, taxedAmount, tax: Math.round(taxedAmount * s.rate) });
    if (taxable <= s.upTo) break;
    prev = s.upTo;
  }
  return out;
}

export function salaryTaxBreakdown(annualGross: number, regime: 'old' | 'new', otherDeductions = 0): SalaryTaxResult {
  const slabs = regime === 'new' ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
  const stdDed = regime === 'new' ? NEW_STD_DEDUCTION : OLD_STD_DEDUCTION;
  const taxable = Math.max(0, annualGross - stdDed - Math.max(0, otherDeductions));
  const bands = bandsFor(taxable, slabs);
  const baseTax = bands.reduce((s, b) => s + b.tax, 0);
  const rebated = taxable <= (regime === 'new' ? NEW_REBATE_LIMIT : OLD_REBATE_LIMIT);
  const afterRebate = rebated ? 0 : baseTax;
  const sur = surcharge(taxable, afterRebate, regime);
  const cess = Math.round((afterRebate + sur) * CESS);
  const totalTax = afterRebate + sur + cess;
  const marginalBand = [...bands].reverse().find((b) => b.taxedAmount > 0);
  return {
    regime, annualGross, standardDeduction: stdDed, otherDeductions: Math.max(0, otherDeductions),
    taxableIncome: taxable, bands, baseTax,
    rebate: rebated ? baseTax : 0, surcharge: sur, cess, totalTax,
    monthlyTds: Math.round(totalTax / 12),
    marginalRatePct: rebated ? 0 : Math.round((marginalBand?.rate || 0) * 100),
    effectiveRatePct: annualGross > 0 ? Math.round((totalTax / annualGross) * 1000) / 10 : 0,
  };
}

export interface SalaryTaxComparison {
  annualGross: number;
  old: SalaryTaxResult;
  new: SalaryTaxResult;
  recommended: 'old' | 'new';
  savings: number;
}
export function salaryTaxComparison(annualGross: number, oldOtherDeductions = 0): SalaryTaxComparison {
  const oldR = salaryTaxBreakdown(annualGross, 'old', oldOtherDeductions);
  const newR = salaryTaxBreakdown(annualGross, 'new', 0);
  const recommended = oldR.totalTax <= newR.totalTax ? 'old' : 'new';
  return { annualGross, old: oldR, new: newR, recommended, savings: Math.abs(oldR.totalTax - newR.totalTax) };
}

export interface RegimeComparison {
  oldRegime: RegimeResult;
  newRegime: RegimeResult;
  recommended: 'old' | 'new';
  savings: number;
  reasoning: string;
}

export function compareRegimes(p: ProfileData): RegimeComparison {
  const oldR = computeRegime(p, 'old');
  const newR = computeRegime(p, 'new');
  const recommended = oldR.tax < newR.tax ? 'old' : 'new';
  const savings = Math.abs(oldR.tax - newR.tax);
  const fmt = (x: number) => `₹${Math.round(x / 100).toLocaleString('en-IN')}`;
  const reasoning =
    recommended === 'old'
      ? `Old regime saves you ${fmt(savings)} this year because your deductions total ${fmt(oldR.totalDeductions)}.`
      : `New regime saves you ${fmt(savings)} this year — your deductions (${fmt(oldR.totalDeductions)}) aren't large enough to beat the new regime's lower slab rates.`;
  return { oldRegime: oldR, newRegime: newR, recommended, savings, reasoning };
}

// ── Beginner-friendly tax reduction plan ─────────────────────────────
const inrR = (paise: number) => {
  const r = Math.round(paise / 100);
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(2)} Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(1)} L`;
  return `₹${r.toLocaleString('en-IN')}`;
};

// Marginal rate (incl. 4% cess) at the user's old-regime taxable income —
// i.e. the rate at which each extra rupee of deduction saves tax.
export function marginalRate(taxableOldRegime: number): number {
  const base = taxableOldRegime > 1000000_00 ? 0.30
    : taxableOldRegime > 500000_00 ? 0.20
    : taxableOldRegime > 250000_00 ? 0.05 : 0;
  return base * (1 + CESS);
}

export interface TaxStep {
  section: string;
  title: string;
  whatItMeans: string;   // plain-language
  howMuchMore: number;   // paise you can still put in / claim
  taxSaved: number;      // paise saved this year
  howTo: string;
  difficulty: 'easy' | 'medium';
}

export interface TaxReductionPlan {
  recommendedRegime: 'old' | 'new';
  regimeReason: string;
  marginalRatePct: number;
  steps: TaxStep[];
  totalPotentialSaving: number;
  newRegimeNote: string | null;
  capitalGains: { title: string; points: string[] };
  documentChecklist: string[];
  glossary: { term: string; meaning: string }[];
}

export function taxReductionPlan(p: ProfileData): TaxReductionPlan {
  const cmp = compareRegimes(p);
  const t = p.tax_data || {};
  const oldR = cmp.oldRegime;
  const mr = marginalRate(oldR.taxableIncome);
  const { items } = deductionUsage(p);
  const headroom = (section: string) => {
    const it = items.find((i) => i.section.startsWith(section));
    return it ? Math.max(0, it.limit - it.used) : 0;
  };
  const saved = (gap: number) => Math.round(gap * mr);

  const steps: TaxStep[] = [];
  const oldBest = cmp.recommended === 'old';

  // 1) Regime choice — always first, both directions
  steps.push({
    section: 'Tax regime',
    title: `Use the ${cmp.recommended === 'old' ? 'Old' : 'New'} Tax Regime this year`,
    whatItMeans:
      'India has two tax systems. The OLD regime lets you subtract investments and expenses (80C, HRA, etc.) before tax. The NEW regime ignores most of those but charges lower rates. You pick whichever leaves more in your pocket.',
    howMuchMore: 0,
    taxSaved: cmp.savings,
    howTo: cmp.recommended === 'old'
      ? 'Tell your employer’s payroll/HR portal to apply the old regime, or select it when filing your ITR. Salaried employees can switch each year.'
      : 'Choose the new regime in your payroll declaration or at ITR filing — no investment proofs needed.',
    difficulty: 'easy',
  });

  // The deduction steps below only help under the OLD regime.
  if (oldBest) {
    const c80 = headroom('80C');
    if (c80 > 0) steps.push({
      section: '80C', title: `Fill your ₹1.5L 80C basket — ${inrR(c80)} still free`,
      whatItMeans: 'Section 80C lets you subtract up to ₹1.5 lakh of certain investments from your taxable income. EPF from your salary already counts toward it.',
      howMuchMore: c80, taxSaved: saved(c80),
      howTo: 'Top it up with ELSS funds (3-yr lock-in, growth), PPF (safe, tax-free) or a 5-yr tax-saver FD. Spread it as a monthly SIP rather than a March rush.',
      difficulty: 'easy',
    });
    const nps = headroom('80CCD(1B)');
    if (nps > 0) steps.push({
      section: '80CCD(1B)', title: `Add up to ${inrR(nps)} to NPS for an extra deduction`,
      whatItMeans: 'This gives you an EXTRA ₹50,000 deduction on top of the 80C ₹1.5L — only through the National Pension System (NPS).',
      howMuchMore: nps, taxSaved: saved(nps),
      howTo: 'Open an NPS Tier-1 account on the eNPS portal (fully online) and contribute. Note: it stays locked until age 60, so treat it as retirement money.',
      difficulty: 'easy',
    });
    const d80self = headroom('80D (self');
    if (d80self > 0) steps.push({
      section: '80D', title: 'Claim your health-insurance premium (80D)',
      whatItMeans: 'The premium you pay for your own/family health cover is deductible — up to ₹25,000 (₹50,000 if senior).',
      howMuchMore: d80self, taxSaved: saved(d80self),
      howTo: 'Enter your annual health premium in Settings → Tax data. If you have no health cover yet, buying one both protects you and cuts tax.',
      difficulty: 'easy',
    });
    const d80par = headroom('80D (parents');
    if (d80par > 0 && (p.user.dependents_count || 0) > 0) steps.push({
      section: '80D (parents)', title: 'Insure your parents for a separate 80D deduction',
      whatItMeans: 'Health premiums you pay for your parents are deductible separately — up to ₹25,000, or ₹50,000 if they are senior citizens.',
      howMuchMore: d80par, taxSaved: saved(d80par),
      howTo: 'Buy or record a parental health policy and add the premium in Settings → Tax data.',
      difficulty: 'medium',
    });
    const hl = headroom('24(b)');
    const hasHomeLoan = (p.liabilities?.home_loans || []).length > 0;
    if (hasHomeLoan && hl > 0) steps.push({
      section: '24(b)', title: 'Claim your home-loan interest (up to ₹2L)',
      whatItMeans: 'Interest you pay on a home loan for a self-occupied house is deductible up to ₹2 lakh a year under Section 24(b).',
      howMuchMore: hl, taxSaved: saved(hl),
      howTo: 'Get the interest certificate from your lender and enter the annual interest in Settings → Tax data.',
      difficulty: 'easy',
    });
    if ((p.user.employment_type === 'salaried' || p.user.employment_type === 'both') && !Number(t.rent_paid_monthly)) steps.push({
      section: 'HRA', title: 'If you pay rent, claim HRA exemption',
      whatItMeans: 'House Rent Allowance in your salary is partly tax-free if you actually pay rent — often one of the biggest savings for renters.',
      howMuchMore: 0, taxSaved: 0,
      howTo: 'Add your monthly rent and the HRA in your salary under Settings → Tax data; submit rent receipts (and landlord PAN if rent > ₹1L/yr) to HR.',
      difficulty: 'easy',
    });
    if ((p.liabilities?.education_loans || []).length > 0) steps.push({
      section: '80E', title: 'Education-loan interest is fully deductible (80E)',
      whatItMeans: 'All the interest on an education loan is deductible — there is no upper limit — for up to 8 years.',
      howMuchMore: 0, taxSaved: 0,
      howTo: 'Collect the annual interest certificate from your lender and claim it while filing.',
      difficulty: 'easy',
    });
  }

  // Works in BOTH regimes — always worth flagging
  if ((p.user.employment_type === 'salaried' || p.user.employment_type === 'both') && !Number(t.employer_nps_annual)) steps.push({
    section: '80CCD(2)', title: 'Ask HR about employer NPS — works even in the new regime',
    whatItMeans: 'If your employer contributes to NPS on your behalf (up to 14% of basic for govt, 10% private), that amount is tax-free — and unlike most deductions, it survives the NEW regime too.',
    howMuchMore: 0, taxSaved: 0,
    howTo: 'Ask your HR/payroll team to enable the employer NPS (Corporate NPS) benefit and route part of your CTC through it.',
    difficulty: 'medium',
  });

  const totalPotentialSaving = steps.reduce((s, x) => s + x.taxSaved, 0);

  const newRegimeNote = !oldBest
    ? 'You’re better off in the NEW regime this year, where most deductions (80C, HRA, 80D) no longer apply. The one big exception is employer NPS (80CCD(2)) — still worth setting up. Keep the old-regime tips in mind if your deductions grow (e.g. you take a home loan).'
    : null;

  return {
    recommendedRegime: cmp.recommended,
    regimeReason: cmp.reasoning,
    marginalRatePct: Math.round(mr * 100),
    steps,
    totalPotentialSaving,
    newRegimeNote,
    capitalGains: {
      title: 'Tax on investment profits (capital gains) — the basics',
      points: [
        'Stocks & equity funds held over 1 year: profit up to ₹1.25 lakh/year is tax-free; beyond that you pay 12.5% (called LTCG).',
        'Stocks & equity funds sold within 1 year: profit taxed at 20% (STCG).',
        'Debt funds (bought after Apr 2023): profit is added to your income and taxed at your slab rate.',
        'Tax-harvesting tip: you can sell and rebuy equity each year to “use up” the ₹1.25L tax-free limit and reset your cost — a legal way to reduce future tax.',
        'Gold SGBs held to maturity (8 years): the profit is completely tax-free.',
      ],
    },
    documentChecklist: [
      'Form 16 from your employer (your salary + TDS summary)',
      'Form 26AS / AIS from the income-tax portal (all tax already deducted on your PAN)',
      'Interest certificates: home loan, education loan, savings/FD interest',
      'Investment proofs: 80C (ELSS/PPF/LIC), NPS, 80D health premium receipts',
      'Rent receipts + landlord PAN (if claiming HRA and rent > ₹1L/year)',
      'Capital-gains statement from your broker / fund platform',
    ],
    glossary: [
      { term: 'Deduction', meaning: 'An amount you subtract from your income before tax is calculated — so you’re taxed on less.' },
      { term: 'TDS', meaning: 'Tax Deducted at Source — tax your employer/bank cuts before paying you. You adjust it while filing.' },
      { term: 'Gross income', meaning: 'Your total income before any deductions or tax.' },
      { term: 'Taxable income', meaning: 'What’s left after deductions — the number your tax is actually charged on.' },
      { term: 'Marginal rate', meaning: 'The tax rate on your next rupee of income — and what each rupee of deduction saves you.' },
      { term: 'ITR', meaning: 'Income Tax Return — the yearly form you file to report income and settle tax (due 31 July for most).' },
    ],
  };
}

export function currentFY(): string {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

export function fyStartYear(d = new Date()): number {
  return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
}

// ── Year-round Tax Copilot (a CA's recurring work, productised) ───────
export interface TaxCopilot {
  fy: string;
  season: string;
  advanceTax: {
    applicable: boolean;
    reason: string;
    totalLiability: number;
    instalments: { label: string; dueDate: string; cumulativePct: number; cumulativeAmount: number; status: 'paid_window' | 'due_soon' | 'upcoming' | 'passed' }[];
  };
  proofChecklist: { item: string; when: string }[];
  harvesting: { ltcgFreeLimit: number; note: string };
  readyPack: {
    fy: string; generatedAt: string; recommendedRegime: 'old' | 'new';
    grossIncome: number; totalDeductions: number; taxableIncome: number; estimatedTax: number; effectiveRatePct: number;
    deductionItems: { section: string; used: number; limit: number }[];
    documentsNeeded: string[];
  };
}

export function taxCopilot(p: ProfileData): TaxCopilot {
  const now = new Date();
  const m = now.getMonth(); // 0=Jan
  const cmp = compareRegimes(p);
  const best = cmp.recommended === 'old' ? cmp.oldRegime : cmp.newRegime;
  const { items } = deductionUsage(p);
  const y = fyStartYear(now);

  const season =
    m >= 3 && m <= 5 ? 'Start of the financial year — set up tax-saving SIPs early so you’re not scrambling in March.'
    : m >= 6 && m <= 8 ? 'ITR filing season — file your return before July 31.'
    : m >= 9 && m <= 11 ? 'Mid-year — check your remaining 80C/80D headroom and invest steadily.'
    : m === 0 || m === 1 ? 'Proof season — submit investment proofs to HR before the payroll cutoff.'
    : 'Final stretch — complete all FY deductions and consider capital-gains harvesting before March 31.';

  const empNonSalary = p.user.employment_type && p.user.employment_type !== 'salaried' && p.user.employment_type !== 'student';
  const advanceApplicable = !!empNonSalary && best.tax > 10000_00;
  const dates = [
    { label: '1st instalment', month: 5, day: 15, pct: 15 },   // 15 Jun
    { label: '2nd instalment', month: 8, day: 15, pct: 45 },   // 15 Sep
    { label: '3rd instalment', month: 11, day: 15, pct: 75 },  // 15 Dec
    { label: '4th instalment', month: 2, day: 15, pct: 100 },  // 15 Mar (next year)
  ];
  const instalments = dates.map((d) => {
    const yr = d.month === 2 ? y + 1 : y;
    const due = new Date(yr, d.month, d.day);
    const days = (due.getTime() - now.getTime()) / (24 * 3600 * 1000);
    const status: 'paid_window' | 'due_soon' | 'upcoming' | 'passed' =
      days < -3 ? 'passed' : days <= 15 ? 'due_soon' : days <= 45 ? 'upcoming' : 'paid_window';
    return {
      label: d.label, dueDate: due.toISOString().slice(0, 10), cumulativePct: d.pct,
      cumulativeAmount: Math.round((best.tax * d.pct) / 100), status,
    };
  });

  return {
    fy: currentFY(), season,
    advanceTax: {
      applicable: advanceApplicable,
      reason: advanceApplicable
        ? 'You have non-salary income and an estimated tax above ₹10,000, so advance tax is due in four instalments. Paying on time avoids interest under sections 234B/234C.'
        : (p.user.employment_type === 'salaried' ? 'Your employer deducts TDS from salary, so advance tax usually doesn’t apply unless you have large other income (capital gains, freelance, rent).' : 'Advance tax applies once your non-TDS tax liability crosses ₹10,000 in a year.'),
      totalLiability: best.tax,
      instalments,
    },
    proofChecklist: [
      { item: 'Form 16 from your employer', when: 'June (after FY close)' },
      { item: '80C proofs — ELSS / PPF / LIC / tuition receipts', when: 'Jan–Feb (to HR)' },
      { item: '80D health-insurance premium receipts', when: 'Jan–Feb' },
      { item: 'Rent receipts + landlord PAN (if HRA & rent > ₹1L/yr)', when: 'Jan–Feb' },
      { item: 'Home-loan interest certificate (24b)', when: 'Jan–Feb' },
      { item: 'Capital-gains statement from your broker/fund', when: 'April–June' },
    ],
    harvesting: {
      ltcgFreeLimit: 125000_00,
      note: 'Equity long-term gains up to ₹1.25 lakh a year are tax-free. Before March 31 you can sell and rebuy to “use up” this free limit and reset your cost — a legal way to reduce future tax. Booking losses can also offset other gains.',
    },
    readyPack: {
      fy: currentFY(), generatedAt: new Date().toISOString(), recommendedRegime: cmp.recommended,
      grossIncome: best.grossIncome, totalDeductions: best.totalDeductions, taxableIncome: best.taxableIncome,
      estimatedTax: best.tax, effectiveRatePct: Math.round(best.effectiveRate * 1000) / 10,
      deductionItems: items,
      documentsNeeded: ['Form 16', 'Form 26AS / AIS', 'Interest certificates (home/education loan)', 'Investment proofs (80C/NPS/80D)', 'Capital-gains statement', 'Bank statements'],
    },
  };
}

export function taxCalendarEntries(): { month: string; message: string }[] {
  return [
    { month: 'April', message: 'New financial year. Set up tax-saving SIPs now to spread 80C investments across the year instead of panic-investing in March.' },
    { month: 'July', message: 'ITR filing deadline is July 31. File early — refunds process faster and you avoid the last-week portal rush.' },
    { month: 'October', message: 'Q2 advance tax instalment due (if your non-salary tax liability exceeds ₹10,000).' },
    { month: 'November–January', message: 'Check your remaining 80C and 80D headroom monthly. Investing now beats a March scramble.' },
    { month: 'February', message: 'Submit investment proofs to your HR before the payroll cutoff. Missing proofs means excess TDS you must claim back as a refund.' },
    { month: 'March', message: 'Final month for all FY deductions: 80C, NPS, health premiums. Payments must complete by March 31.' },
  ];
}
