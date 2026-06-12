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

export function currentFY(): string {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${String(start + 1).slice(2)}`;
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
