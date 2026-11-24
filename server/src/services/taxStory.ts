// Tax story (D-70, Nov 2026) — the tax page explained like a person would explain it.
// One pure function turns the full ITR computation (taxFiling.ts, the single source of tax truth) into:
//   headline     "You'll pay ₹X this year — ₹Y a month. ₹Z is already deducted, so ₹W comes back."
//   saving       how much PayWatch's choices already save (regime + deductions), in rupees
//   steps        a plain-language waterfall from "you earned" to "refund / to pay"
//   slabs        where the tax actually comes from (slab by slab)
//   regime       old vs new in one sentence + the break-even deduction amount
//   moves        the next ways to save, each with ₹ saved and how
//   confidence   how sure the numbers are, and which documents would make them exact
//   ca           the full computation for the CA (unchanged numbers, same engine)
// Numbers in paise. No AI, no DB — tested in test/taxstory.test.ts.
import { ProfileData } from './score';
import { fullFiling, prepareFiling, FilingInputs, RegimeReturn } from './taxFiling';
import { taxReductionPlan, salaryTaxBreakdown } from './tax';
import { inrIN } from '../lib/money';

export type StoryStatus = 'no_tax' | 'refund' | 'payable' | 'settled';
export interface StoryStep { key: string; label: string; amount: number; sign: '+' | '-' | '=' ; explain: string }
export interface TaxStory {
  fy: string;
  ay: string;
  regime: 'old' | 'new';
  headline: { totalTax: number; monthly: number; effectiveRatePct: number; refundOrPayable: number; status: StoryStatus; sentence: string };
  saving: { regime: number; deductions: number; total: number; sentence: string };
  steps: StoryStep[];
  slabs: { from: number; to: number | null; ratePct: number; taxedAmount: number; tax: number }[];
  regimeCompare: { recommended: 'old' | 'new'; oldTax: number; newTax: number; difference: number; breakEvenExtraDeductions: number | null; sentence: string };
  moves: { title: string; section: string; taxSaved: number; why: string; how: string }[];
  confidence: { level: 'estimate' | 'partly_verified' | 'verified'; sentence: string; haveDocs: string[]; missingDocs: { type: string; label: string }[] };
  ca: ReturnType<typeof fullFiling>;
}

const DOC_LABEL: Record<string, string> = {
  form16: 'Form 16', form26as_ais: 'Form 26AS / AIS', payslip: 'A recent payslip',
  interest_certificate: 'Bank interest certificate', capital_gains: 'Capital-gains statement',
};
const KEY_DOCS = ['form16', 'form26as_ais', 'payslip', 'interest_certificate'];

function earned(i: FilingInputs): number {
  return [i.grossSalary, i.interestIncome, Math.max(0, i.housePropertyIncome), i.otherIncome, i.businessIncome,
    i.stcgEquity, i.ltcgEquity, i.otherCapitalGains, i.stcgOther || 0, i.ltcgOther || 0]
    .reduce((s, v) => s + Math.max(0, Math.round(Number(v) || 0)), 0);
}

/** Extra deductions (₹, paise) the old regime would need before it beats the new one; null if never within ₹10L. */
export function breakEvenExtraDeductions(inp: FilingInputs, fy: string): number | null {
  const base = prepareFiling(inp, fy);
  if (base.old.totalTax <= base.new.totalTax) return 0;
  const oldWith = (x: number) => prepareFiling({ ...inp, hraExempt: (inp.hraExempt || 0) + x }, fy).old.totalTax;
  let lo = 0, hi = 10_00_000_00;
  if (oldWith(hi) > base.new.totalTax) return null;
  for (let k = 0; k < 40 && hi - lo > 1000_00; k++) {
    const mid = Math.round((lo + hi) / 2);
    if (oldWith(mid) <= base.new.totalTax) hi = mid; else lo = mid;
  }
  return Math.ceil(hi / 1000_00) * 1000_00; // round up to the next ₹1,000
}

export function taxStory(p: ProfileData, docTypes: string[] = []): TaxStory {
  const f = fullFiling(p);
  const i = f.inputs;
  const rec: RegimeReturn = f.recommendedRegime === 'old' ? f.old : f.new;
  const other: RegimeReturn = f.recommendedRegime === 'old' ? f.new : f.old;
  const y = Number(f.fy.slice(0, 4));
  const ay = `${y + 1}-${String(y + 2).slice(2)}`;
  const total = rec.totalTax;
  const inc = earned(i);
  const effectiveRatePct = inc > 0 ? Math.round((total / inc) * 1000) / 10 : 0;
  const rp = rec.refundOrPayable;
  const status: StoryStatus = total === 0 && rec.taxesPaid === 0 ? 'no_tax' : Math.abs(rp) < 100_00 ? 'settled' : rp > 0 ? 'refund' : 'payable';
  const R = inrIN;

  const sentence =
    status === 'no_tax' ? `You owe no income tax for FY ${f.fy}. At your income, the ${f.recommendedRegime} regime's rebate covers you fully.`
    : status === 'refund' ? `You'll pay about ${R(total)} in tax for FY ${f.fy} (≈ ${R(Math.round(total / 12))} a month). ${R(rec.taxesPaid)} has already been deducted, so about ${R(rp)} should come back to you as a refund.`
    : status === 'payable' ? `You'll pay about ${R(total)} in tax for FY ${f.fy} (≈ ${R(Math.round(total / 12))} a month). ${rec.taxesPaid > 0 ? `${R(rec.taxesPaid)} is already paid, so` : 'Nothing has been deducted yet, so'} about ${R(-rp)} is still to pay.`
    : `You'll pay about ${R(total)} in tax for FY ${f.fy}, and what's already been deducted covers it. Nothing more to pay, no refund due.`;

  // What PayWatch's choices save: picking the cheaper regime + the deductions claimed in it.
  const regimeSaving = Math.max(0, other.totalTax - rec.totalTax);
  const zeroDed: FilingInputs = { ...i, ded80C: 0, ded80CCD1B: 0, ded80D: 0, ded24b: 0, ded80G: 0, ded80TTA: 0, ded80E: 0, hraExempt: 0, employerNps: 0 };
  const noDed = prepareFiling(zeroDed, f.fy);
  const dedSaving = Math.max(0, (f.recommendedRegime === 'old' ? noDed.old.totalTax : noDed.new.totalTax) - rec.totalTax);
  const totalSaving = regimeSaving + dedSaving;
  const savingSentence = totalSaving > 0
    ? `Your tax is ${R(totalSaving)} lower than it could have been: ${regimeSaving > 0 ? `${R(regimeSaving)} from choosing the ${f.recommendedRegime} regime` : ''}${regimeSaving > 0 && dedSaving > 0 ? ' and ' : ''}${dedSaving > 0 ? `${R(dedSaving)} from the deductions you claim` : ''}.`
    : 'There is nothing extra to save this year with your current numbers.';

  // Waterfall, in words people use.
  const std = i.grossSalary > 0 ? Math.min(i.grossSalary, f.recommendedRegime === 'new' ? 75000_00 : 50000_00) : 0;
  const ded = rec.deductions;
  const steps: StoryStep[] = [];
  const push = (s: StoryStep) => { if (s.amount !== 0 || s.sign === '=') steps.push(s); };
  push({ key: 'earned', label: 'You earned', amount: inc, sign: '+', explain: 'Salary, interest, rent, business profit and investment gains for the year, before any tax.' });
  push({ key: 'standard', label: 'Standard deduction (automatic)', amount: std, sign: '-', explain: `Every salaried person gets this without any proof: ${R(f.recommendedRegime === 'new' ? 75000_00 : 50000_00)} in the ${f.recommendedRegime} regime.` });
  push({ key: 'deductions', label: f.recommendedRegime === 'old' ? 'Deductions & exemptions you claim' : 'Employer NPS (allowed in the new regime)', amount: ded, sign: '-', explain: f.recommendedRegime === 'old' ? '80C (EPF, PPF, ELSS…), 80D health insurance, NPS, home-loan interest, HRA and more.' : 'The new regime ignores most deductions; only a few, like your employer’s NPS contribution, still count.' });
  const special = Math.max(0, i.stcgEquity) + Math.max(0, i.ltcgEquity) + Math.max(0, i.ltcgOther || 0);
  const adjustments = inc - std - ded - rec.totalIncome - special;
  if (Math.abs(adjustments) >= 1000_00) push({ key: 'adjust', label: adjustments > 0 ? 'Losses set off & exempt gains' : 'Other adjustments', amount: Math.abs(adjustments), sign: adjustments > 0 ? '-' : '+', explain: 'Losses from earlier years or other heads, and the tax-free part of long-term gains, reduce what is taxed.' });
  push({ key: 'taxable', label: 'Taxed at slab rates', amount: rec.totalIncome, sign: '=', explain: 'This is the income your slab rates apply to.' });
  push({ key: 'slabtax', label: 'Tax on that, slab by slab', amount: rec.slabTax, sign: '+', explain: 'Each slice of income is taxed at its own rate (see "Where your tax comes from").' });
  push({ key: 'rebate', label: 'Rebate (section 87A)', amount: rec.rebate, sign: '-', explain: 'If your taxable income is under the limit, the government waives this tax entirely.' });
  push({ key: 'cgtax', label: 'Tax on investment profits', amount: rec.capitalGainsTax, sign: '+', explain: 'Share and fund profits are taxed at fixed rates: 20% short-term, 12.5% long-term above ₹1.25 lakh.' });
  push({ key: 'surcharge', label: 'Surcharge', amount: rec.surcharge, sign: '+', explain: 'Extra tax only for incomes above ₹50 lakh.' });
  push({ key: 'cess', label: 'Health & education cess (4%)', amount: rec.cess, sign: '+', explain: 'A 4% add-on on your tax.' });
  push({ key: 'total', label: 'Your total tax', amount: total, sign: '=', explain: 'What you owe for the year.' });
  push({ key: 'paid', label: 'Already paid (TDS + advance tax)', amount: rec.taxesPaid, sign: '-', explain: 'Tax your employer, bank or you have already paid during the year (check Form 26AS).' });
  push({ key: 'result', label: rp >= 0 ? 'Refund to you' : 'Still to pay', amount: Math.abs(rp), sign: '=', explain: rp >= 0 ? 'Comes back to your bank account after you file and e-verify.' : 'Pay before filing (Challan 280) to avoid interest.' });

  // Slab picture (salary-led approximation of the chosen regime's slab tax).
  const slabTaxable = rec.totalIncome + (f.recommendedRegime === 'new' ? 75000_00 : 50000_00);
  const br = salaryTaxBreakdown(slabTaxable, f.recommendedRegime, 0);
  const slabs = br.bands.map((b) => ({ from: b.from, to: b.to, ratePct: Math.round(b.rate * 100), taxedAmount: b.taxedAmount, tax: b.tax }));

  const be = f.recommendedRegime === 'new' ? breakEvenExtraDeductions(i, f.fy) : 0;
  const diff = Math.abs(f.old.totalTax - f.new.totalTax);
  const regimeSentence = diff < 100_00
    ? 'Both regimes cost about the same for you; the new regime is simpler (no proofs needed).'
    : f.recommendedRegime === 'new'
      ? `The new regime is ${R(diff)} cheaper for you.${be ? ` The old regime would only win if you claimed about ${R(be)} more in deductions (80C, 80D, NPS, HRA, home loan).` : be === null ? ' Even with much bigger deductions, the old regime would not win.' : ''}`
      : `The old regime is ${R(diff)} cheaper for you because your deductions (${R(f.old.deductions)}) are large. Keep your proofs safe.`;

  const plan = taxReductionPlan(p);
  const moves = plan.steps
    .filter((s) => s.section !== 'Tax regime' && s.taxSaved > 0)
    .sort((a, b) => b.taxSaved - a.taxSaved)
    .slice(0, 5)
    .map((s) => ({ title: s.title, section: s.section, taxSaved: s.taxSaved, why: s.whatItMeans, how: s.howTo }));

  const have = KEY_DOCS.filter((d) => docTypes.includes(d));
  const missing = KEY_DOCS.filter((d) => !docTypes.includes(d)).map((d) => ({ type: d, label: DOC_LABEL[d] }));
  const level: TaxStory['confidence']['level'] =
    have.includes('form16') && have.includes('form26as_ais') ? 'verified' : have.length > 0 ? 'partly_verified' : 'estimate';
  const confSentence =
    level === 'verified' ? 'Matched with your Form 16 and Form 26AS/AIS. These numbers should be very close to your final return.'
    : level === 'partly_verified' ? `Partly based on your documents. Add ${missing.slice(0, 2).map((m) => m.label).join(' and ')} to make it exact.`
    : 'An estimate from what you told us during onboarding. Upload your Form 16 or a payslip and we’ll make it exact.';

  return {
    fy: f.fy, ay, regime: f.recommendedRegime,
    headline: { totalTax: total, monthly: Math.round(total / 12), effectiveRatePct, refundOrPayable: rp, status, sentence },
    saving: { regime: regimeSaving, deductions: dedSaving, total: totalSaving, sentence: savingSentence },
    steps, slabs,
    regimeCompare: { recommended: f.recommendedRegime, oldTax: f.old.totalTax, newTax: f.new.totalTax, difference: diff, breakEvenExtraDeductions: be, sentence: regimeSentence },
    moves,
    confidence: { level, sentence: confSentence, haveDocs: have.map((d) => DOC_LABEL[d]), missingDocs: missing },
    ca: f,
  };
}
