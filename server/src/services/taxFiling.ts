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
// Surcharge RATE on income tax, by total-income slab. Surcharge on capital-gains
// tax (111A / 112A / 112) is separately capped at 15% — handled in computeReturn.
function surchargeRate(taxable: number, regime: 'old' | 'new'): number {
  return taxable > 50000000_00 ? (regime === 'new' ? 0.25 : 0.37)
    : taxable > 20000000_00 ? 0.25 : taxable > 10000000_00 ? 0.15 : taxable > 5000000_00 ? 0.10 : 0;
}

export interface FilingInputs {
  grossSalary: number;            // paise, gross salary (Form 16 part B)
  interestIncome: number;         // savings + FD interest
  housePropertyIncome: number;    // net (signed; current-year loss set off ≤ ₹2L, rest carries forward)
  otherIncome: number;            // dividends, misc
  businessIncome: number;         // proprietor/professional profit BEFORE depreciation
  depreciation?: number;          // business depreciation — subtracted from businessIncome
  stcgEquity: number;             // short-term capital gain on listed equity (sec 111A, 20%)
  ltcgEquity: number;             // long-term capital gain on listed equity (sec 112A, 12.5%, ₹1.25L exempt)
  otherCapitalGains: number;      // short-term non-equity (debt/property/gold) taxed at slab
  stcgOther?: number;             // additional short-term non-equity at slab (merged with otherCapitalGains)
  ltcgOther?: number;             // long-term non-equity (sec 112, 12.5%)
  // current-year capital losses (positive magnitudes)
  stcl?: number;                  // short-term capital loss
  ltcl?: number;                  // long-term capital loss
  // brought-forward losses from prior years (positive magnitudes)
  broughtFwdSTCL?: number; broughtFwdLTCL?: number; broughtFwdHPLoss?: number; broughtFwdBusinessLoss?: number;
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
  headIncome: { salary: number; houseProperty: number; business: number; otherSources: number; capitalGains: number };
  carryForward: { businessLoss: number; housePropertyLoss: number; stcl: number; ltcl: number };
  setOffNotes: string[];
}

export interface ItrFiling {
  fy: string;
  form: { code: 'ITR-1' | 'ITR-2' | 'ITR-3' | 'ITR-4'; name: string; why: string };
  recommendedRegime: 'old' | 'new';
  old: RegimeReturn;
  new: RegimeReturn;
  needsCA: { required: boolean; reason: string | null };
  carryForward: { businessLoss: number; housePropertyLoss: number; stcl: number; ltcl: number };
  setOffNotes: string[];
  checklist: string[];
  portalSteps: string[];
  disclaimer: string;
}

const HP_LOSS_SETOFF_CAP = 200000_00; // ₹2L inter-head set-off cap on house-property loss

// Full computation for one regime, implementing the Income-Tax Act's set-off and
// carry-forward rules across heads — the part that actually protects people's money:
//  • Capital losses: STCL sets off against STCG & LTCG; LTCL only against LTCG; unused carries fwd 8 yrs (CG only).
//  • House-property loss: set off against any head ≤ ₹2L this year; excess carries fwd (HP income only).
//  • Business loss: set off against any head EXCEPT salary; excess carries fwd (business only). Depreciation reduces business income.
//  • Surcharge on capital-gains tax capped at 15%.
function computeReturn(inp: FilingInputs, regime: 'old' | 'new'): RegimeReturn {
  const n0 = (x?: number) => Math.max(0, Math.round(Number(x) || 0));
  const notes: string[] = [];
  const std = regime === 'new' ? NEW_STD : OLD_STD;
  const salary = Math.max(0, n0(inp.grossSalary) - std);

  // ── Capital-gains intra-head set-off ──────────────────────────────
  let sE = n0(inp.stcgEquity);                               // 20%   (111A)
  let sSlab = n0(inp.otherCapitalGains) + n0(inp.stcgOther); // slab  (short-term non-equity)
  let lE = n0(inp.ltcgEquity);                               // 12.5% (112A, ₹1.25L exempt)
  let lO = n0(inp.ltcgOther);                                // 12.5% (112)
  let stclPool = n0(inp.stcl) + n0(inp.broughtFwdSTCL);
  let ltclPool = n0(inp.ltcl) + n0(inp.broughtFwdLTCL);
  const eat = (pool: number, gain: number): [number, number] => { const t = Math.min(pool, gain); return [pool - t, gain - t]; };
  // LTCL can ONLY offset LTCG — use it first so it isn't wasted.
  [ltclPool, lE] = eat(ltclPool, lE);
  [ltclPool, lO] = eat(ltclPool, lO);
  // STCL offsets short-term (slab, then equity) and then any remaining long-term.
  [stclPool, sSlab] = eat(stclPool, sSlab);
  [stclPool, sE] = eat(stclPool, sE);
  [stclPool, lE] = eat(stclPool, lE);
  [stclPool, lO] = eat(stclPool, lO);
  const carrySTCL = stclPool, carryLTCL = ltclPool;
  if (n0(inp.stcl) + n0(inp.ltcl) > 0 || carrySTCL > 0 || carryLTCL > 0) notes.push('Capital losses set off against capital gains per the Act (STCL vs STCG/LTCG, LTCL vs LTCG only).');

  // ── House property (loss ≤ ₹2L vs other heads; b/f loss vs HP only) ──
  let hp = Math.round(Number(inp.housePropertyIncome) || 0);
  let bfHP = n0(inp.broughtFwdHPLoss);
  let carryHP = 0;
  if (hp > 0) { const u = Math.min(hp, bfHP); hp -= u; carryHP = bfHP - u; }
  else if (hp < 0) {
    const loss = -hp; const setoff = Math.min(loss, HP_LOSS_SETOFF_CAP); hp = -setoff; carryHP = (loss - setoff) + bfHP;
    if (loss > HP_LOSS_SETOFF_CAP) notes.push(`House-property loss set off against other income is capped at ₹2L this year; ${inrW(loss - HP_LOSS_SETOFF_CAP)} carries forward.`);
  } else carryHP = bfHP;

  // ── Business (depreciation reduces it; loss vs non-salary heads) ──
  let bizNet = n0(inp.businessIncome) - n0(inp.depreciation);
  let bfBL = n0(inp.broughtFwdBusinessLoss);
  let bizPositive = 0, bizLoss = 0, carryBL = bfBL;
  if (bizNet > 0) { const u = Math.min(bizNet, bfBL); bizPositive = bizNet - u; carryBL = bfBL - u; }
  else if (bizNet < 0) { bizLoss = -bizNet; }
  if (n0(inp.depreciation) > 0) notes.push(`Depreciation of ${inrW(n0(inp.depreciation))} reduced business income.`);

  // ── Other sources ──
  let otherSrc = n0(inp.interestIncome) + n0(inp.otherIncome);

  // ── Current-year business loss: inter-head set-off (NOT against salary) ──
  if (bizLoss > 0) {
    const absorb = (avail: number): number => { const t = Math.min(bizLoss, avail); bizLoss -= t; return avail - t; };
    otherSrc = absorb(otherSrc);
    if (hp > 0) hp = absorb(hp);
    sSlab = absorb(sSlab); sE = absorb(sE); lE = absorb(lE); lO = absorb(lO);
    carryBL += bizLoss; bizLoss = 0;
    notes.push('Business loss set off against non-salary income (it cannot reduce salary); any balance carries forward.');
  }

  // ── Normal (slab) income & deductions ──
  const normalIncome = salary + otherSrc + hp + sSlab + bizPositive; // hp may be negative (≤ ₹2L)
  let deductions = n0(inp.employerNps);
  if (regime === 'old') deductions += n0(inp.ded80C) + n0(inp.ded80CCD1B) + n0(inp.ded80D) + n0(inp.ded24b) + n0(inp.ded80G) + n0(inp.ded80TTA) + n0(inp.ded80E) + n0(inp.hraExempt);
  deductions = Math.min(deductions, Math.max(0, normalIncome)); // VI-A can't exceed normal income or create a loss
  const totalIncome = Math.max(0, normalIncome - deductions);

  let slab = slabTax(totalIncome, regime === 'new' ? NEW_SLABS : OLD_SLABS);
  let rebate = 0;
  if (totalIncome <= (regime === 'new' ? NEW_REBATE_TAXABLE : OLD_REBATE_TAXABLE)) { rebate = slab; slab = 0; }

  // Capital-gains special-rate tax (no 87A rebate).
  const stcgTax = sE * 0.20;
  const ltcgTax = Math.max(0, lE - LTCG_EQUITY_EXEMPT) * 0.125 + lO * 0.125;
  const capitalGainsTax = Math.round(stcgTax + ltcgTax);

  // Surcharge: full rate on normal tax, capped at 15% on the capital-gains tax.
  const incomeForSurcharge = totalIncome + sE + lE + lO;
  const rate = surchargeRate(incomeForSurcharge, regime);
  let slabSur = slab * rate;
  // Marginal relief: surcharge can't make (tax + surcharge) on income just over a
  // threshold exceed the tax at the threshold plus the income above it. Applied to
  // the slab portion (the standard high-earner case; flagged when special-rate CG present).
  if (rate > 0) {
    // Surcharge thresholds (paise): ₹50L, ₹1Cr, ₹2Cr, ₹5Cr.
    const T = [5000000_00, 10000000_00, 20000000_00, 50000000_00].filter((x) => totalIncome > x).pop();
    if (T && (sE + lE + lO) === 0) {
      const reliefCap = slabTax(T, regime === 'new' ? NEW_SLABS : OLD_SLABS) + (totalIncome - T);
      if (slab + slabSur > reliefCap) { slabSur = Math.max(0, reliefCap - slab); notes.push('Marginal relief on surcharge applied.'); }
    }
  }
  const sur = Math.round(slabSur + capitalGainsTax * Math.min(rate, 0.15));
  const preCess = slab + capitalGainsTax + sur;
  const cess = Math.round(preCess * CESS);
  const totalTax = Math.round(preCess + cess);

  const grossTotalIncome = normalIncome + sE + lE + lO;
  const taxesPaid = n0(inp.tdsSalary) + n0(inp.tdsOther) + n0(inp.advanceTax);

  return {
    regime, salaryAfterStd: salary, grossTotalIncome, deductions, totalIncome,
    slabTax: Math.round(slab), rebate: Math.round(rebate), capitalGainsTax,
    surcharge: sur, cess, totalTax, taxesPaid, refundOrPayable: taxesPaid - totalTax,
    headIncome: { salary, houseProperty: hp, business: bizPositive, otherSources: otherSrc, capitalGains: sE + sSlab + lE + lO },
    carryForward: { businessLoss: carryBL, housePropertyLoss: carryHP, stcl: carrySTCL, ltcl: carryLTCL },
    setOffNotes: notes,
  };
}

// Compact ₹ for set-off notes.
function inrW(paise: number): string {
  const r = Math.round(paise / 100);
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(2)} Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(1)} L`;
  return `₹${r.toLocaleString('en-IN')}`;
}

function pickForm(inp: FilingInputs, totalIncome: number): ItrFiling['form'] {
  const hasCG = (inp.stcgEquity || 0) > 0 || (inp.ltcgEquity || 0) > 0 || (inp.otherCapitalGains || 0) > 0
    || (inp.stcgOther || 0) > 0 || (inp.ltcgOther || 0) > 0
    || (inp.stcl || 0) > 0 || (inp.ltcl || 0) > 0 || (inp.broughtFwdSTCL || 0) > 0 || (inp.broughtFwdLTCL || 0) > 0;
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
    depreciation: Number(t.business_depreciation) || 0,
    stcgEquity: Number(t.stcg_equity) || 0,
    ltcgEquity: Number(t.ltcg_equity) || 0,
    otherCapitalGains: Number(t.other_capital_gains) || 0,
    stcgOther: Number(t.stcg_other) || 0,
    ltcgOther: Number(t.ltcg_other) || 0,
    stcl: Number(t.stcl) || 0,
    ltcl: Number(t.ltcl) || 0,
    broughtFwdSTCL: Number(t.carry_fwd_stcl) || 0,
    broughtFwdLTCL: Number(t.carry_fwd_ltcl) || 0,
    broughtFwdHPLoss: Number(t.carry_fwd_hp_loss) || 0,
    broughtFwdBusinessLoss: Number(t.carry_fwd_business_loss) || 0,
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
  const oldR = computeReturn(inp, 'old');
  const newR = computeReturn(inp, 'new');
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
    carryForward: chosen.carryForward,
    setOffNotes: chosen.setOffNotes,
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
