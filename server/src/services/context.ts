// Personalization Stage 2 — the Context & Benefits store (see PERSONALIZATION.md).
// Holds each user's occupation/employer plus the "long tail" of structured
// benefit facts (employer group cover, an insurance booster, EPF/NPS, government
// schemes…) that the engines respect. This is the moat layer: no dataset has it.
// All monetary values in paise, consistent with the rest of the app.

import { one, query } from '../db';
import { ProfileData } from './score';

export type BenefitType =
  | 'insurance_booster' | 'group_health' | 'group_term'
  | 'epf' | 'nps' | 'gratuity' | 'gpf' | 'esops' | 'pension'
  | 'govt_scheme' | 'perk' | 'other';

export interface BenefitFact {
  id: string;
  type: BenefitType;
  label: string;
  source?: 'employer' | 'government' | 'professional_body' | 'bank' | 'other';
  value_base?: number;        // paise
  value_boosted_to?: number;  // paise (e.g. a ₹5L booster that boosts to ₹40L)
  rule?: string;              // free text, e.g. "user split 2.5L/2.5L, preserving for emergency"
  status?: 'active' | 'inactive';
  affects?: string[];         // e.g. ["insurance.health","score.insurance"]
  confidence?: 'user_stated' | 'doc_verified' | 'inferred';
  captured_at?: string;
  source_note?: string;
}

export interface UserContext {
  occupation?: string;
  employer?: string;
  sector?: string;
  employment_nature?: 'salaried' | 'self_employed' | 'business' | 'retired' | 'student';
  benefits?: BenefitFact[];
}

// ── Persistence ─────────────────────────────────────────────────────
export async function getContext(userId: string): Promise<UserContext> {
  const row = await one<any>(`SELECT context FROM profiles WHERE user_id = $1`, [userId]);
  return (row?.context as UserContext) || {};
}

async function writeContext(userId: string, ctx: UserContext): Promise<UserContext> {
  // Upsert: the profile row may not exist yet for a brand-new user.
  await query(
    `INSERT INTO profiles (user_id, context) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET context = $2, updated_at = now()`,
    [userId, JSON.stringify(ctx)]
  );
  return ctx;
}

// Merge occupation/employer/sector fields (leaves benefits untouched).
export async function updateContextFields(userId: string, patch: Partial<UserContext>): Promise<UserContext> {
  const ctx = await getContext(userId);
  const { benefits: _ignore, ...fields } = patch;
  return writeContext(userId, { ...ctx, ...fields });
}

export async function addBenefit(userId: string, fact: Omit<BenefitFact, 'id' | 'captured_at'> & { id?: string }): Promise<UserContext> {
  const ctx = await getContext(userId);
  const benefits = Array.isArray(ctx.benefits) ? ctx.benefits : [];
  const full: BenefitFact = {
    id: fact.id || `bf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    status: 'active',
    confidence: 'user_stated',
    ...fact,
    captured_at: new Date().toISOString(),
  };
  return writeContext(userId, { ...ctx, benefits: [...benefits, full] });
}

export async function removeBenefit(userId: string, id: string): Promise<UserContext> {
  const ctx = await getContext(userId);
  const benefits = (ctx.benefits || []).filter((b) => b.id !== id);
  return writeContext(userId, { ...ctx, benefits });
}

// ── Consumption helpers (used by the engines) ───────────────────────
const activeBenefits = (p: ProfileData): BenefitFact[] =>
  ((p.context?.benefits as BenefitFact[]) || []).filter((b) => (b.status || 'active') === 'active');

// The cover a single benefit effectively provides (a booster provides its boosted ceiling).
const coverOf = (b: BenefitFact): number => Number(b.value_boosted_to || b.value_base || 0);

// Cover the user ALREADY has from employer/scheme benefits, so the insurance
// engine can shrink the gap instead of nagging them to buy what they have.
export function effectiveCoverFromBenefits(p: ProfileData, kind: 'health' | 'term'): { cover: number; labels: string[] } {
  const types: BenefitType[] = kind === 'health'
    ? ['group_health', 'insurance_booster']
    : ['group_term'];
  const matches = activeBenefits(p).filter((b) => types.includes(b.type));
  return {
    cover: matches.reduce((s, b) => s + coverOf(b), 0),
    labels: matches.map((b) => b.label),
  };
}

// A compact, human-readable summary of the user's context for the AI (Ask PayWatch).
export function contextSummaryForAI(p: ProfileData): string {
  const c = (p.context as UserContext) || {};
  const parts: string[] = [];
  if (c.occupation || c.employer) parts.push(`Occupation: ${[c.occupation, c.employer && `at ${c.employer}`].filter(Boolean).join(' ')}.`);
  const bens = activeBenefits(p);
  if (bens.length) {
    parts.push('Benefits/schemes on file (use these — they change the advice):');
    for (const b of bens) {
      const val = b.value_boosted_to ? `up to ${b.value_boosted_to / 100} rupees` : b.value_base ? `${b.value_base / 100} rupees` : '';
      parts.push(`- ${b.label} (${b.type}${b.source ? `, from ${b.source}` : ''})${val ? `: ${val}` : ''}${b.rule ? `. Note: ${b.rule}` : ''}`);
    }
  }
  return parts.join('\n');
}
