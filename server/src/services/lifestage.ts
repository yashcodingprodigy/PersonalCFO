// Life-Stage model — the first layer of hyper-personalization (see PERSONALIZATION.md).
// Derives which financial "phase" a user is in, so every engine can reframe its
// guidance: a 25-year-old should be told to grow; a 55-year-old to protect and
// plan income. Pure function of age + employment + dependents (intent override
// comes later). No DB, no side effects.

import { ProfileData } from './score';

export type LifePhase = 'accumulation' | 'consolidation' | 'pre_retirement' | 'retirement';

export interface PhaseInfo {
  phase: LifePhase;
  label: string;     // short UI label
  focus: string;     // one-line "what matters now"
}

// Derive the phase. Age is the primary signal; employment overrides at the ends
// (students accumulate; the retired/60+ are in the retirement phase).
export function deriveLifePhase(p: ProfileData): LifePhase {
  const emp = p.user.employment_type;
  const age = p.user.age ?? 30;
  if (emp === 'student') return 'accumulation';
  if (emp === 'retired' || age >= 60) return 'retirement';
  if (age >= 50) return 'pre_retirement';
  if (age >= 35) return 'consolidation';
  return 'accumulation';
}

const INFO: Record<LifePhase, Omit<PhaseInfo, 'phase'>> = {
  accumulation:   { label: 'Building',        focus: 'grow your money and build strong habits early' },
  consolidation:  { label: 'Consolidating',   focus: 'keep growing while protecting your family and goals' },
  pre_retirement: { label: 'Pre-retirement',  focus: 'shift from growth toward protecting and planning income' },
  retirement:     { label: 'Retirement',      focus: 'steady income and preserving what you have built' },
};

export function phaseInfo(phase: LifePhase): PhaseInfo {
  return { phase, ...INFO[phase] };
}

// Adjustment (percentage points) to the equity target, layered on top of the
// age/risk baseline — sharper and more phase-aware than age alone. Kept modest
// so it never flips the risk ordering the tests assert.
export function phaseEquityAdj(phase: LifePhase): number {
  switch (phase) {
    case 'accumulation':   return 5;   // lean into growth while time is on your side
    case 'consolidation':  return 0;
    case 'pre_retirement': return -10; // start de-risking
    case 'retirement':     return -20; // protect the corpus
  }
}
