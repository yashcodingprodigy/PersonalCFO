// Insurance marketplace engine — ranks the catalogue plans for a user's profile
// and computes an INDICATIVE premium for each (NOT a live insurer quote; see
// insuranceCatalog.ts compliance note). Transparent, rule-based scoring so the
// "best fit" is explainable and auditable (compliance: education, not advice).
import { CATALOG, InsurancePlan, PlanCategory } from './insuranceCatalog';

export interface MarketCtx {
  age: number;
  cover: number;        // sum assured/insured wanted (paise); for motor = IDV
  familySize: number;   // 1 + dependents
  smoker?: boolean;
}

const L = 100000_00; // ₹1 lakh in paise

// Age multiplier for life/health/CI (premium rises steeply with age).
function ageFactorLife(age: number) {
  return age < 30 ? 0.9 : age <= 35 ? 1 : age <= 40 ? 1.5 : age <= 45 ? 2.2 : age <= 50 ? 3.1 : age <= 55 ? 4.2 : 5.5;
}
function ageFactorHealth(age: number) {
  return age < 30 ? 0.85 : age <= 40 ? 1 : age <= 50 ? 1.4 : age <= 60 ? 2.1 : 3;
}

export interface PremiumEstimate { annual: number; basis: string }

// Indicative annual premium (paise) for a plan given the user's context.
export function estimatePremium(plan: InsurancePlan, ctx: MarketCtx): PremiumEstimate {
  const coverL = Math.max(0, ctx.cover) / L;
  const inrC = `₹${Math.round(ctx.cover / 100).toLocaleString('en-IN')}`;
  switch (plan.category) {
    case 'term_life': {
      const annual = Math.round(coverL * plan.basePerLakh * ageFactorLife(ctx.age) * (ctx.smoker ? 1.45 : 1) * 100);
      return { annual, basis: `${inrC} cover · age ${ctx.age}${ctx.smoker ? ' · smoker' : ''}` };
    }
    case 'health': {
      const familyF = 1 + 0.45 * Math.max(0, ctx.familySize - 1);
      const annual = Math.round(coverL * plan.basePerLakh * ageFactorHealth(ctx.age) * Math.min(familyF, 2.8) * 100);
      return { annual, basis: `${inrC} floater · family of ${ctx.familySize} · age ${ctx.age}` };
    }
    case 'critical_illness': {
      const annual = Math.round(coverL * plan.basePerLakh * ageFactorHealth(ctx.age) * 100);
      return { annual, basis: `${inrC} cover · age ${ctx.age}` };
    }
    case 'personal_accident': {
      const annual = Math.round(coverL * plan.basePerLakh * (ctx.age > 55 ? 1.3 : 1) * 100);
      return { annual, basis: `${inrC} cover` };
    }
    case 'home': {
      const annual = Math.round(coverL * plan.basePerLakh * 100);
      return { annual, basis: `${inrC} structure + contents` };
    }
    case 'motor': {
      // ~3% of IDV for comprehensive own-damage + third-party (indicative).
      const idv = ctx.cover > 0 ? ctx.cover : 600000_00;
      const annual = Math.round(idv * 0.03);
      return { annual, basis: `≈ IDV ₹${Math.round(idv / 100).toLocaleString('en-IN')}, comprehensive` };
    }
    case 'travel': {
      // Per-trip indicative (a typical 7-day overseas trip).
      return { annual: 60000, basis: 'per ~7-day overseas trip' };
    }
    default:
      return { annual: 0, basis: 'indicative' };
  }
}

// Tags we weight up for each category (and contextually).
function preferredTags(category: PlanCategory, ctx: MarketCtx): string[] {
  switch (category) {
    case 'term_life': return ['high claim ratio', 'low premium', 'riders', 'critical illness'];
    case 'health': {
      const base = ['no room rent cap', 'restore benefit', 'high claim ratio', 'carry forward'];
      if (ctx.age < 35 && ctx.familySize > 1) base.push('maternity');
      return base;
    }
    case 'critical_illness': return ['lump sum', 'many illnesses', 'multi-claim'];
    case 'personal_accident': return ['high cover', 'low premium', 'disability', 'income benefit'];
    case 'motor': return ['high claim ratio', 'cashless garages', 'add-ons'];
    case 'home': return ['structure + contents', 'auto escalation'];
    case 'travel': return ['worldwide', 'medical', 'schengen'];
    default: return [];
  }
}

export interface RankedPlan extends InsurancePlan {
  indicativePremium: number;   // paise/year
  premiumBasis: string;
  fitScore: number;
  reasons: string[];
  bestFit: boolean;
}

// Rank a category's plans for the user. Transparent scoring:
//  • claim-settlement ratio (reliability)
//  • indicative premium vs the category's cheapest (value)
//  • how many of the user's preferred features the plan has
export function rankPlans(category: PlanCategory, ctx: MarketCtx): RankedPlan[] {
  const plans = CATALOG.filter((p) => p.category === category);
  const prefs = preferredTags(category, ctx);
  const premiums = plans.map((p) => estimatePremium(p, ctx).annual).filter((x) => x > 0);
  const cheapest = premiums.length ? Math.min(...premiums) : 0;

  const ranked = plans.map((p) => {
    const est = estimatePremium(p, ctx);
    const reasons: string[] = [];
    let score = 0;

    if (p.claimRatioPct) {
      score += (p.claimRatioPct - 88) * 1.2;
      if (p.claimRatioPct >= 99) reasons.push(`High claim-settlement ratio (${p.claimRatioPct}%)`);
    }
    if (cheapest > 0 && est.annual > 0) {
      const ratio = est.annual / cheapest;            // 1 = cheapest
      score += Math.max(0, 6 - (ratio - 1) * 10);     // cheaper → more points
      if (ratio <= 1.05) reasons.push('Among the lowest indicative premiums for this cover');
    }
    const matched = p.tags.filter((t) => prefs.includes(t));
    score += matched.length * 2.5;
    for (const m of matched.slice(0, 2)) {
      const phrase = ({
        'no room rent cap': 'No room-rent cap (matters in metro hospitals)',
        'restore benefit': 'Restores your cover after a claim',
        'carry forward': 'Unclaimed cover carries forward',
        'maternity': 'Includes maternity cover',
        'riders': 'Rich rider options (critical illness, accident, waiver)',
        'critical illness': 'Critical-illness cover available',
        'cashless garages': 'Large cashless garage network',
        'disability': 'Strong disability cover',
        'lump sum': 'Pays a lump sum on diagnosis',
      } as Record<string, string>)[m];
      if (phrase && !reasons.includes(phrase)) reasons.push(phrase);
    }
    // age eligibility note
    if (p.entryAgeMax && ctx.age > p.entryAgeMax) { score -= 100; reasons.unshift(`Entry age limit ${p.entryAgeMax} — you may not be eligible`); }

    return { ...p, indicativePremium: est.annual, premiumBasis: est.basis, fitScore: Math.round(score * 10) / 10, reasons: reasons.slice(0, 3), bestFit: false };
  }).sort((a, b) => b.fitScore - a.fitScore);

  if (ranked.length) ranked[0].bestFit = true;
  return ranked;
}
