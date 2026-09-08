// Personalization Stage 4 — the shared Benefits & Schemes catalog (see PERSONALIZATION.md).
// A curated library of government schemes and common employer/occupation benefits,
// mapped to eligibility signals, so PayWatch can PROACTIVELY suggest "people like
// you usually have…". Combined at runtime with crowd-learned patterns (context.ts).
// Educational only — asset-class/scheme level, never a specific product. Paise.

import { ProfileData } from './score';
import { BenefitFact, BenefitType, normalizeCtx } from './context';
import { query } from '../db';

const L = 100000_00; // ₹1 lakh in paise

export interface Suggestion {
  key: string;
  name: string;
  type: BenefitType;
  source: BenefitFact['source'];
  reason: string;                 // why it's shown ("You're 60+")
  prompt: string;                 // the ask ("Do you have SCSS? Add it.")
  prefill: Partial<BenefitFact>;  // pre-populates the add form (user confirms)
  origin: 'catalog' | 'learned';
}

interface Elig {
  min_age?: number; max_age?: number;
  employment_nature?: string[];         // matches context.employment_nature OR user.employment_type
  occupation_kw?: string[];             // any keyword in occupation
  sector_kw?: string[];                 // any keyword in sector
  min_income?: number; max_income?: number; // annual gross, paise
  has_dependents?: boolean;
}

interface CatalogEntry {
  key: string; name: string; type: BenefitType; source: BenefitFact['source'];
  reason: string; prompt: string; affects: string[]; elig: Elig;
}

// ── Curated seed (accurate as of 2026; verify at build time) ────────
const CATALOG: CatalogEntry[] = [
  {
    key: 'scss', name: 'Senior Citizen Savings Scheme (SCSS)', type: 'govt_scheme', source: 'government',
    reason: "You're 60 or above", prompt: 'SCSS gives guaranteed quarterly income and an 80C deduction — a strong fit near retirement.',
    affects: ['invest', 'tax', 'retirement'], elig: { min_age: 60 },
  },
  {
    key: 'nps_80ccd1b', name: 'NPS (extra ₹50k deduction, 80CCD-1B)', type: 'nps', source: 'government',
    reason: "You're of working age", prompt: 'NPS Tier-1 gives an extra ₹50,000 tax deduction beyond 80C, plus a retirement corpus.',
    affects: ['tax', 'invest', 'retirement'], elig: { min_age: 18, max_age: 60 },
  },
  {
    key: 'apy', name: 'Atal Pension Yojana (APY)', type: 'pension', source: 'government',
    reason: "You're between 18 and 40", prompt: 'APY gives a guaranteed pension from 60 with small monthly contributions — good for the unorganised sector.',
    affects: ['retirement'], elig: { min_age: 18, max_age: 40, max_income: 6 * L * 12 / 12 * 3 }, // ~₹18L/yr ceiling as a soft filter
  },
  {
    key: 'ssy', name: 'Sukanya Samriddhi Yojana (SSY)', type: 'govt_scheme', source: 'government',
    reason: 'You have dependents', prompt: 'If you have a girl child under 10, SSY offers a high, tax-free return and an 80C deduction.',
    affects: ['invest', 'tax'], elig: { has_dependents: true, min_age: 21 },
  },
  {
    key: 'epf_vpf', name: 'EPF / VPF top-up', type: 'epf', source: 'employer',
    reason: "You're salaried", prompt: 'As a salaried employee you have EPF — topping up via VPF earns the same tax-free rate and counts under 80C.',
    affects: ['invest', 'tax', 'retirement'], elig: { employment_nature: ['salaried'] },
  },
  {
    key: 'employer_nps', name: 'Employer NPS (80CCD-2)', type: 'nps', source: 'employer',
    reason: "You're salaried", prompt: "If your employer offers NPS, their contribution is deductible over and above your own limits — ask HR.",
    affects: ['tax', 'retirement'], elig: { employment_nature: ['salaried'] },
  },
  {
    key: 'group_health_employer', name: 'Employer group health cover', type: 'group_health', source: 'employer',
    reason: 'You are salaried / faculty', prompt: 'Most employers provide group health cover. Add it so we count it against your health-cover need (but keep a personal policy — it ends with the job).',
    affects: ['insurance.health', 'score.insurance'], elig: { employment_nature: ['salaried'] },
  },
  {
    key: 'faculty_health_booster', name: 'Institutional insurance booster', type: 'insurance_booster', source: 'employer',
    reason: 'You work in education', prompt: 'Universities and institutions often provide a health/insurance booster (a small base that tops up to a large cover). Check with HR and add it if you have one.',
    affects: ['insurance.health', 'score.insurance'], elig: { occupation_kw: ['faculty', 'professor', 'teacher', 'lecturer'], sector_kw: ['education', 'university', 'academic'] },
  },
  {
    key: 'gpf', name: 'GPF (General Provident Fund)', type: 'gpf', source: 'government',
    reason: 'You appear to be a government employee', prompt: 'Government employees have GPF — a safe, tax-advantaged retirement fund. Add your balance so we count it.',
    affects: ['invest', 'retirement'], elig: { occupation_kw: ['government', 'govt', 'psu', 'public sector'], sector_kw: ['government', 'public'] },
  },
  {
    key: 'ayushman', name: 'Ayushman Bharat (PM-JAY)', type: 'govt_scheme', source: 'government',
    reason: 'Based on your income', prompt: 'Lower-income households may qualify for ₹5L free health cover under PM-JAY — worth checking your eligibility.',
    affects: ['insurance.health'], elig: { max_income: 5 * L },
  },
];

// ── Matching ────────────────────────────────────────────────────────
const kwHit = (hay: string | undefined, kws?: string[]) =>
  !kws || (!!hay && kws.some((k) => hay.toLowerCase().includes(k)));

function eligible(p: ProfileData, e: Elig): boolean {
  const age = p.user.age ?? 30;
  const income = p.user.annual_gross_income || 0;
  const nature = (p.context?.employment_nature as string) || p.user.employment_type || '';
  const occ = (p.context?.occupation as string) || '';
  const sector = (p.context?.sector as string) || '';
  if (e.min_age != null && age < e.min_age) return false;
  if (e.max_age != null && age > e.max_age) return false;
  if (e.min_income != null && income < e.min_income) return false;
  if (e.max_income != null && income > e.max_income) return false;
  if (e.has_dependents && !(p.user.dependents_count > 0)) return false;
  if (e.employment_nature && !e.employment_nature.includes(nature)) return false;
  // occupation/sector are OR: a hit in either satisfies the keyword requirement
  if (e.occupation_kw || e.sector_kw) {
    if (!(kwHit(occ, e.occupation_kw) || kwHit(sector, e.sector_kw))) return false;
  }
  return true;
}

// Curated suggestions the user qualifies for and hasn't already added.
export function catalogSuggestions(p: ProfileData): Suggestion[] {
  const have = new Set(((p.context?.benefits as BenefitFact[]) || []).map((b) => (b as any).catalogKey).filter(Boolean));
  const haveTypes = new Set(((p.context?.benefits as BenefitFact[]) || []).map((b) => b.type));
  return CATALOG.filter((e) => !have.has(e.key) && eligible(p, e.elig))
    // don't double-suggest a category the user clearly already covered manually
    .filter((e) => !(['epf', 'nps', 'gpf'].includes(e.type) && haveTypes.has(e.type)))
    .map((e) => ({
      key: e.key, name: e.name, type: e.type, source: e.source, reason: e.reason, prompt: e.prompt,
      origin: 'catalog' as const,
      prefill: { type: e.type, label: e.name, source: e.source, affects: e.affects, confidence: 'user_stated' as const, catalogKey: e.key } as any,
    }));
}

// Crowd-learned suggestions: "people at your employer / in your role usually have…"
// Only surfaced once ≥ threshold users corroborate the pattern (DPDP-safe).
const PATTERN_THRESHOLD = 3;
export async function learnedSuggestions(p: ProfileData): Promise<Suggestion[]> {
  const employer = normalizeCtx(p.context?.employer);
  const occupation = normalizeCtx(p.context?.occupation);
  if (!employer && !occupation) return [];
  const rows = await query<any>(
    `SELECT benefit_type, benefit_label, typical_base, typical_boost, user_count, employer_norm
       FROM benefit_patterns
      WHERE user_count >= $1
        AND ((employer_norm <> '' AND employer_norm = $2) OR (occupation_norm <> '' AND occupation_norm = $3))
      ORDER BY user_count DESC LIMIT 8`,
    [PATTERN_THRESHOLD, employer, occupation]
  );
  const haveLabels = new Set(((p.context?.benefits as BenefitFact[]) || []).map((b) => b.label.toLowerCase()));
  return rows
    .filter((r) => !haveLabels.has(String(r.benefit_label).toLowerCase()))
    .map((r) => ({
      key: `learned_${r.benefit_type}_${String(r.benefit_label).toLowerCase().replace(/\W+/g, '_')}`,
      name: r.benefit_label, type: r.benefit_type as BenefitType, source: 'employer' as const,
      reason: r.employer_norm === employer && employer ? `Common for people at your employer` : `Common in your role`,
      prompt: `Others like you have "${r.benefit_label}" — do you? Add it if so.`,
      origin: 'learned' as const,
      prefill: {
        type: r.benefit_type as BenefitType, label: r.benefit_label, source: 'employer' as const,
        value_base: r.typical_base ? Number(r.typical_base) : undefined,
        value_boosted_to: r.typical_boost ? Number(r.typical_boost) : undefined,
        confidence: 'inferred' as const,
      } as any,
    }));
}

// The combined proactive suggestion list (curated catalog + crowd-learned).
export async function suggestBenefits(p: ProfileData): Promise<Suggestion[]> {
  const catalog = catalogSuggestions(p);
  let learned: Suggestion[] = [];
  try { learned = await learnedSuggestions(p); } catch { /* best-effort */ }
  const seen = new Set(catalog.map((s) => `${s.type}|${s.name.toLowerCase()}`));
  const merged = [...catalog];
  for (const s of learned) if (!seen.has(`${s.type}|${s.name.toLowerCase()}`)) merged.push(s);
  return merged.slice(0, 8);
}
