// Insurance Analyser — SRS §11. Educational gap analysis only; we never
// recommend a specific policy or insurer product (IRDAI/SEBI positioning).

import { ProfileData } from './score';

const sum = (arr: any[], f: string) => (Array.isArray(arr) ? arr : []).reduce((s, x) => s + (Number(x?.[f]) || 0), 0);
const inr = (paise: number) => {
  const r = Math.round(paise / 100);
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(2)} Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(1)} L`;
  return `₹${r.toLocaleString('en-IN')}`;
};

export interface InsuranceAnalysis {
  term: {
    current: number;
    recommended: number;
    gap: number;
    premiumEstimateAnnual: { low: number; high: number } | null;
    notes: string[];
  };
  health: {
    current: number;
    recommended: number;
    gap: number;
    notes: string[];
  };
  flags: { severity: 'high' | 'medium' | 'low'; message: string }[];
}

export function analyseInsurance(p: ProfileData): InsuranceAnalysis {
  const income = p.user.annual_gross_income || 0;
  const age = p.user.age || 30;
  const dependents = p.user.dependents_count || 0;
  const familySize = 1 + dependents;

  const termCover = sum(p.insurance?.term, 'sum_assured');
  const healthCover = sum(p.insurance?.health, 'sum_insured');
  const totalLiabilities =
    sum(p.liabilities?.home_loans, 'outstanding') +
    sum(p.liabilities?.personal_loans, 'outstanding') +
    sum(p.liabilities?.car_loans, 'outstanding');

  // Recommended term = 25× income, bumped to at least cover liabilities + 15× income
  const recommendedTerm = Math.max(income * 25, totalLiabilities + income * 15);
  const termGap = Math.max(0, recommendedTerm - termCover);

  // Premium heuristic: ₹900–1,300 per ₹1L of cover per year scaled by age band
  const ageFactor = age <= 30 ? 1 : age <= 38 ? 1.4 : age <= 45 ? 2.1 : 3.2;
  const perLakhLow = 90 * ageFactor * 100;   // paise per ₹1L cover
  const perLakhHigh = 140 * ageFactor * 100;
  const lakhs = termGap / 100 / 100000;

  const recommendedHealth = Math.max(1000000_00, 500000_00 * familySize) * (age > 40 ? 1.5 : 1);
  const healthGap = Math.max(0, recommendedHealth - healthCover);

  const termNotes: string[] = [];
  if (termCover === 0 && dependents > 0) termNotes.push('You have dependents and zero term cover — this is the single most important gap in your finances.');
  if (totalLiabilities > 0 && termCover < totalLiabilities) termNotes.push(`Your loans (${inr(totalLiabilities)}) exceed your term cover — your family would inherit the debt without the means to clear it.`);
  termNotes.push('Buy pure term insurance only. Endowment, money-back and ULIP products mix insurance with poor investment returns.');

  const healthNotes: string[] = [];
  const healthPolicies = Array.isArray(p.insurance?.health) ? p.insurance.health : [];
  if (healthPolicies.length > 1) healthNotes.push('You hold multiple health policies — check for overlapping cover and hidden sub-limits (room rent caps, disease-wise limits) in older policies.');
  if (healthPolicies.some((h: any) => h.employer_provided)) healthNotes.push('Employer cover lapses the day you leave the job — a personal base policy or super top-up protects continuity.');
  if (age > 40) healthNotes.push('Past 40, consider a critical illness rider (cancer, cardiac, stroke) — these pay a lump sum on diagnosis, separate from hospitalisation cover.');

  const flags: InsuranceAnalysis['flags'] = [];
  if (termCover === 0 && dependents > 0) flags.push({ severity: 'high', message: 'No term life cover with financial dependents.' });
  if (healthCover === 0) flags.push({ severity: 'high', message: 'No health insurance — one hospitalisation can erase years of savings.' });
  const hasHomeLoan = (p.liabilities?.home_loans || []).length > 0;
  if (hasHomeLoan) {
    flags.push({ severity: 'medium', message: 'Home loan holders should carry personal accident cover — most skip it.' });
    flags.push({ severity: 'low', message: 'Home/property insurance is inexpensive and usually skipped — worth a quote.' });
  }

  return {
    term: {
      current: termCover,
      recommended: recommendedTerm,
      gap: termGap,
      premiumEstimateAnnual: termGap > 0 ? { low: Math.round(lakhs * perLakhLow), high: Math.round(lakhs * perLakhHigh) } : null,
      notes: termNotes,
    },
    health: { current: healthCover, recommended: Math.round(recommendedHealth), gap: Math.round(healthGap), notes: healthNotes },
    flags,
  };
}
