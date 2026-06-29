// ITR preparation & computation engine — the core of replacing a CA for an
// individual taxpayer. Picks the right ITR form, computes the full return
// across every income head under both regimes (incl. capital-gains special
// rates, rebate, surcharge, cess), and reconciles TDS/advance tax into a
// refund or amount payable. All money in paise.
//
// Scope note (honest): software can *prepare and compute* the return and
// produce a filing-ready pack. Actually *submitting* to the Income Tax
// Department in one click requires ERI registration (see chat). Tax audits
// (u/s 44AB) and CA certifications legally still need a CA — that's a small
// subset of cases, flagged below.

import { ProfileData, deductionUsage } from './score';
import { computeHraExemption, currentFY } from './tax';

const CESS = 0.04;

// FY 2025-26 slabs (paise).
const NEW_SLABS = [
  { upTo: 400000_00, rate: 0 }, { upTo: 800000_00, rate: 0.05 }, { upTo: 1200000_00, rate: 0.10 },
  { upTo: 1600000_00, rate: 0.15 }, { upTo: 2000000_00, rate: 0.20 }, { upTo: 2400000_00, rate: 0.25 },
  { upTo: Infinity, rate: 0.30 },
];
const OLD_SLABS = [
  { upTo: 250000_00, rate: 0 }, { upTo: 500000_00, rate: 0.05 }, { upTo: 1000000_00, rate: 0.20 },
  { upTo: Infinity, rate: 0.30 },
];
const NEW_STD = 75000_00, OLD_STD = 50000_00;
const NEW_REBATE_TAXABLE = 1200000_00, OLD_REBATE_TAXABLE = 500000_00;
const LTCG_EQUITY_EXEMPT = 125000_00;

function slabTax(taxable: number, slabs: { upTo: number; rate: number }[]): number {
  let tax = 0, prev = 0;
  for (const s of slabs) {
    if (taxable > prev) { tax += (Math.min(taxable, s.upTo) - prev) * s.rate; prev = s.upTo; } else break;
  }
  return tax;
}
function surcharge(taxable: number, baseTax: number, regime: 'old' | 'new'): number {
  const r = taxable > 50000000_00 ? (regime === 'new' ? 0.25 : 0.37)
    : taxable > 20000000_00 ? 0.25 : taxable > 10000000_00 ? 0.15 : taxable > 5000000_00 ? 0.10 : 0;
  return baseTax * r;
}

export interface FilingInputs {
  grossSalary: number;            // paise, gross salary (Form 16 part B)
  interestIncome: number;         // savings + FD interest
  housePropertyIncome: number;    // net (can be negative; loss capped at -2L)
  otherIncome: number;            // dividends, misc
  businessIncome: number;         // proprietor/professional net profit
  stcgEquity: number;             // short-term capital gain on listed equity (sec 111A)
  ltcgEquity: number;             // long-term capital gain on listed equity (sec 112A)
  otherCapitalGains: number;      // taxed at slab (simplified)
  // deductions (old regime)
  ded80C: number; ded80CCD1B: number; ded80D: number; ded24b: number; ded80G: number; ded80TTA: number; ded80E: number; hraExempt: number;
  employerNps: number;            // 80CCD(2) — valid in both regimes
  // taxes already paid
  tdsSalary: number; tdsOther: number; advanceTax: number;
  // profile flags for form selection
  totalIncomeOver50L?: boolean; residentOrdinary?: boolean; foreignAssets?: boolean; isDirector?: boolean; multipleHouseProperties?: boolean; presumptiveBusiness?: boolean;
}

export interface RegimeReturn {
  regime: 'old' | 'new';
  salaryAfterStd: number;
  grossTotalIncome: number;
  deductions: number;
  totalIncome: number;          // taxable (excl. special-rate CG shown separately)
  slabTax: number;
  rebate: number;
  capitalGainsTax: number;
  surcharge: number;
  cess: number;
  totalTax: number;
  taxesPaid: number;
  refundOrPayable: number;      // positive = refund, negative = payable
}

export interface ItrFiling {
  fy: string;
  form: { code: 'ITR-1' | 'ITR-2' | 'ITR-3' | 'ITR-4'; name: string; why: string };
  recommendedRegime: 'old' | 'new';
  old: RegimeReturn;
  new: RegimeReturn;
  needsCA: { required: boolean; reason: string | null };
  checklist: string[];
  portalSteps: string[];
  disclaimer: string;
}

function computeRegime(inp: FilingInputs, regime: 'old' | 'new'): RegimeReturn {
  const std = regime === 'new' ? NEW_STD : OLD_STD;
  const salaryAfterStd = Math.max(0, inp.grossSalary - std);
  const houseProp = Math.max(-200000_00, inp.housePropertyIncome); // loss capped at ₹2L
  const normalIncome = salaryAfterStd + inp.interestIncome + houseProp + inp.otherIncome + inp.businessIncome + inp.otherCapitalGains;
  const grossTotalIncome = normalIncome + inp.stcgEquity + inp.ltcgEquity;

  let deductions = inp.employerNps; // valid both regimes
  if (regime === 'old') {
    deductions += inp.ded80C + inp.ded80CCD1B + inp.ded80D + inp.ded24b + inp.ded80G + inp.ded80TTA + inp.ded80E + inp.hraExempt;
  }
  const totalIncome = Math.max(0, normalIncome - deductions);

  // Normal slab tax
  let slab = slabTax(totalIncome, regime === 'new' ? NEW_SLABS : OLD_SLABS);
  // 87A rebate (normal-rate tax only)
  let rebate = 0;
  if (totalIncome <= (regime === 'new' ? NEW_REBATE_TAXABLE : OLD_REBATE_TAXABLE)) { rebate = slab; slab = 0; }

  // Capital-gains special rates (no rebate)
  const stcgTax = Math.max(0, inp.stcgEquity) * 0.20;                                  // sec 111A (FY24-25 onwards)
  const ltcgTaxable = Math.max(0, inp.ltcgEquity - LTCG_EQUITY_EXEMPT);
  const ltcgTax = ltcgTaxable * 0.125;                                                 // sec 112A
  const capitalGainsTax = Math.round(stcgTax + ltcgTax);

  const preCess = slab + capitalGainsTax;
  const sur = surcharge(totalIncome + inp.stcgEquity + inp.ltcgEquity, preCess, regime);
  const cess = Math.round((preCess + sur) * CESS);
  const totalTax = Math.round(preCess + sur + cess);

  const taxesPaid = inp.tdsSalary + inp.tdsOther + inp.advanceTax;
  return {
    regime, salaryAfterStd, grossTotalIncome, deductions, totalIncome,
    slabTax: Math.round(slab), rebate: Math.round(rebate), capitalGainsTax,
    surcharge: Math.round(sur), cess, totalTax, taxesPaid,
    refundOrPayable: taxesPaid - totalTax,
  };
}

function pickForm(inp: FilingInputs, totalIncome: number): ItrFiling['form'] {
  const hasCG = inp.stcgEquity > 0 || inp.ltcgEquity > 0 || inp.otherCapitalGains > 0;
  const over50 = inp.totalIncomeOver50L || totalIncome > 5000000_00;
  if (inp.businessIncome > 0 && inp.presumptiveBusiness && !hasCG && !over50) {
    return { code: 'ITR-4', name: 'Sugam', why: 'You have presumptive business/professional income (44AD/44ADA) and income under ₹50L.' };
  }
  if (inp.businessIncome > 0) {
    return { code: 'ITR-3', name: 'ITR-3', why: 'You have income from a business or profession (non-presumptive).' };
  }
  if (hasCG || over50 || inp.multipleHouseProperties || inp.foreignAssets || inp.isDirector || inp.residentOrdinary === false) {
    return { code: 'ITR-2', name: 'ITR-2', why: 'You have capital gains / income over ₹50L / more than one house property / foreign assets — beyond the simple ITR-1.' };
  }
  return { code: 'ITR-1', name: 'Sahaj', why: 'Resident with salary, one house property and interest income, total income under ₹50L — the simplest return.' };
}

// Assemble a complete set of filing inputs from EVERYTHING we know about the
// user — profile income + all the figures uploads have folded into tax_data
// (salary & TDS from Form 16, interest, dividends, house property, capital
// gains, deductions). This is what makes the tax breakdown comprehensive and
// CA-usable rather than salary-only.
export function assembleFilingInputs(p: ProfileData): FilingInputs {
  const t: any = p.tax_data || {};
  const items = deductionUsage(p).items;
  const used = (prefix: string) => items.filter((i) => i.section.startsWith(prefix)).reduce((s, i) => s + i.used, 0);
  const emp = p.user.employment_type;
  const isSalaried = emp === 'salaried' || emp === 'both';
  const isBiz = !!emp && emp !== 'salaried' && emp !== 'student' && emp !== 'both';

  const grossSalary = Number(t.salary_gross) || (isSalaried ? (p.user.annual_gross_income || 0) : 0);
  const businessIncome = Number(t.business_income) || (isBiz ? (p.user.annual_gross_income || 0) : 0);

  return {
    grossSalary,
    interestIncome: Number(t.interest_income) || 0,
    housePropertyIncome: Number(t.house_property_income) || 0,
    otherIncome: (Number(t.dividend_income) || 0) + (Number(t.other_income) || 0),
    businessIncome,
    stcgEquity: Number(t.stcg_equity) || 0,
    ltcgEquity: Number(t.ltcg_equity) || 0,
    otherCapitalGains: Number(t.other_capital_gains) || 0,
    ded80C: used('80C'), ded80CCD1B: used('80CCD(1B)'), ded80D: used('80D'), ded24b: used('24(b)'),
    ded80G: Number(t.donations_80g_annual) || 0, ded80TTA: 0, ded80E: Number(t.education_loan_interest_annual) || 0,
    hraExempt: computeHraExemption(p), employerNps: Number(t.employer_nps_annual) || 0,
    tdsSalary: Number(t.tds_salary) || 0, tdsOther: Number(t.tds_other) || 0, advanceTax: Number(t.advance_tax) || 0,
    residentOrdinary: true, foreignAssets: false, isDirector: false, multipleHouseProperties: false,
    presumptiveBusiness: emp === 'freelancer' || emp === 'self_employed',
  };
}

// One call: the full computed return from the user's complete data.
export function fullFiling(p: ProfileData): ItrFiling & { inputs: FilingInputs } {
  const inputs = assembleFilingInputs(p);
  return { ...prepareFiling(inputs, currentFY()), inputs };
}

export function prepareFiling(inp: FilingInputs, fy: string): ItrFiling {
  const oldR = computeRegime(inp, 'old');
  const newR = computeRegime(inp, 'new');
  const recommendedRegime = oldR.totalTax <= newR.totalTax ? 'old' : 'new';
  const chosen = recommendedRegime === 'old' ? oldR : newR;
  const form = pickForm(inp, chosen.totalIncome);

  // Cases that legally still need a CA (small subset).
  const turnoverAuditLikely = inp.businessIncome > 0 && !inp.presumptiveBusiness && inp.grossSalary === 0 && inp.businessIncome > 10000000_00;
  const needsCA = turnoverAuditLikely
    ? { required: true, reason: 'Your business income suggests a possible tax audit (u/s 44AB), which by law must be signed by a Chartered Accountant. PayWatch prepares everything; a CA only counter-signs the audit.' }
    : { required: false, reason: null };

  return {
    fy, form, recommendedRegime, old: oldR, new: newR, needsCA,
    checklist: [
      'PAN & Aadhaar (linked)',
      'Form 16 from your employer',
      'Form 26AS / AIS from the income-tax portal (pre-filled TDS)',
      'Bank interest certificate / passbook',
      'Capital-gains statement from your broker (if any)',
      'Investment & insurance proofs (80C / 80D / NPS)',
      'Home-loan interest certificate (if any)',
      'Rent receipts + landlord PAN (if claiming HRA)',
    ],
    portalSteps: [
      'Log in at incometax.gov.in with your PAN and Aadhaar OTP.',
      'Go to e-File → Income Tax Returns → File Income Tax Return.',
      `Select assessment year ${Number(fy.slice(0, 4)) + 1}-${String(Number(fy.slice(0, 4)) + 2).slice(2)} and the ${form.code} form.`,
      'Choose the ' + recommendedRegime + ' regime when asked.',
      'The portal pre-fills most data from AIS — cross-check it against the figures PayWatch computed above.',
      'Enter any remaining income/deductions to match this summary, then verify the tax payable/refund matches.',
      'Submit and e-verify with Aadhaar OTP — done. Your ITR-V acknowledgement arrives by email.',
    ],
    disclaimer:
      'PayWatch prepares and computes your return from the figures you provide. Numbers are estimates for self-filing — always cross-check against Form 26AS/AIS on the income-tax portal. This is not a substitute for a Chartered Accountant where an audit or certification is legally required.',
  };
}
