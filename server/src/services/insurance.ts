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
  beginnerIntro: string;
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    title: string;
    whatItIs: string;
    whyForYou: string;
    howTo: string;
    estCostAnnual: { low: number; high: number } | null;
  }[];
  avoid: string[];
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

  // ── Beginner-friendly personalised recommendations ─────────────────
  const recommendations: InsuranceAnalysis['recommendations'] = [];

  if (termGap > 0 && (dependents > 0 || income > 0)) {
    recommendations.push({
      priority: dependents > 0 ? 'high' : 'medium',
      title: termCover > 0 ? `Top up your term life cover by ${inr(termGap)}` : `Buy term life insurance (about ${inr(recommendedTerm)})`,
      whatItIs: 'Term insurance pays your family a large lump sum if you pass away during the policy period. It is pure protection — no maturity payout — which is exactly why it is so cheap.',
      whyForYou: dependents > 0
        ? `${dependents} ${dependents === 1 ? 'person depends' : 'people depend'} on your income. The 25× income rule (${inr(recommendedTerm)}) is enough to replace your earnings and clear debts so they aren't left struggling.`
        : 'Even without dependents now, locking in cover while young and healthy keeps premiums very low for life.',
      howTo: 'Buy online directly from a few insurers, choose cover till age 60–65, disclose health honestly, and pick a “pure term” plan — nothing fancier.',
      estCostAnnual: termGap > 0 ? { low: Math.round(lakhs * perLakhLow), high: Math.round(lakhs * perLakhHigh) } : null,
    });
  }

  if (healthGap > 0) {
    const ghLakhs = healthGap / 100 / 100000;
    recommendations.push({
      priority: healthCover === 0 ? 'high' : 'medium',
      title: healthCover > 0 ? `Raise your health cover by ${inr(healthGap)}` : `Get health insurance (about ${inr(recommendedHealth)})`,
      whatItIs: 'Health insurance pays your hospital bills. A “family floater” covers everyone under one shared amount; a “super top-up” cheaply extends cover above a threshold.',
      whyForYou: `For a family of ${familySize}, ${inr(Math.round(recommendedHealth))} is a sensible floor — a single ICU stay in a metro can cross ₹5L.${healthCover > 0 ? ' A super top-up over your existing policy is the cheapest way to close the gap.' : ''}`,
      howTo: 'Pick a floater with no room-rent cap and a high claim-settlement ratio; add parents on a separate policy. Don’t rely only on employer cover — it ends with the job.',
      estCostAnnual: { low: Math.round(ghLakhs * 800 * 100), high: Math.round(ghLakhs * 1500 * 100) },
    });
  }

  if (age >= 40) recommendations.push({
    priority: 'medium',
    title: 'Add a critical-illness cover',
    whatItIs: 'A policy that pays a one-time lump sum if you are diagnosed with a major illness (cancer, heart attack, stroke) — separate from hospital bills.',
    whyForYou: `Past 40 the odds rise, and this money replaces lost income during recovery, not just treatment costs.`,
    howTo: 'Add it as a rider on your term plan or buy a standalone ₹10–25L cover.',
    estCostAnnual: null,
  });

  if ((p.liabilities?.home_loans || []).length > 0) recommendations.push({
    priority: 'medium',
    title: 'Get personal-accident cover',
    whatItIs: 'Pays out on accidental death or disability — inexpensive but commonly skipped, especially important when you carry a big loan.',
    whyForYou: 'A disability that stops your income would still leave the home-loan EMIs running; this protects against that.',
    howTo: 'Often available as a low-cost add-on to health or term policies, or standalone for a few hundred rupees a month.',
    estCostAnnual: null,
  });

  if (Number(p.assets?.property) > 0) recommendations.push({
    priority: 'low',
    title: 'Consider home / property insurance',
    whatItIs: 'Covers your house and belongings against fire, theft and natural disasters.',
    whyForYou: 'It is one of the cheapest policies relative to what it protects, and almost everyone forgets it.',
    howTo: 'Get a quote for building + contents cover from a general insurer.',
    estCostAnnual: null,
  });

  const order = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => order[a.priority] - order[b.priority]);

  const beginnerIntro = recommendations.some((r) => r.priority === 'high')
    ? 'Insurance is the seatbelt of your finances — boring until the day it saves everything. Based on your profile, here is exactly what to get and why, starting with the most urgent.'
    : 'Good news — your core cover looks solid. Below are smaller, optional protections worth considering, plus what to steer clear of.';

  const avoid = [
    'Endowment, money-back and ULIP plans — they bundle insurance with weak investment returns. Keep insurance and investing separate.',
    'Buying cover just to “save tax” in March — choose what actually protects you; the tax benefit is a bonus, not the goal.',
    'Tiny ₹2–3L health policies — one serious hospitalisation can blow past them. Go higher with a top-up instead.',
  ];

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
    beginnerIntro,
    recommendations,
    avoid,
  };
}
