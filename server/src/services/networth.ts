// Net Worth service — SRS §8.

import { ProfileData } from './score';

const sum = (arr: any[], f: string) => (Array.isArray(arr) ? arr : []).reduce((s, x) => s + (Number(x?.[f]) || 0), 0);
const n = (x: any) => Number(x) || 0;

export interface NetWorthBreakdown {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  assets: { category: string; label: string; value: number; liquid: boolean }[];
  liabilities: { category: string; label: string; value: number }[];
  allocation: { equity: number; debt: number; realEstate: number; gold: number; cash: number };
  liquidityRatio: number; // share of assets that are liquid
}

export function computeNetWorth(p: ProfileData): NetWorthBreakdown {
  const a = p.assets || {};
  const assets = [
    { category: 'cash', label: 'Savings & bank balance', value: n(a.savings_balance), liquid: true },
    { category: 'cash', label: 'Liquid funds', value: n(a.liquid_funds), liquid: true },
    { category: 'debt', label: 'Fixed deposits', value: n(a.fd_total), liquid: true },
    { category: 'equity', label: 'Mutual funds', value: n(a.mutual_funds?.value), liquid: true },
    { category: 'equity', label: 'Stocks (India)', value: n(a.stocks), liquid: true },
    { category: 'equity', label: 'US / international stocks', value: n(a.us_stocks), liquid: true },
    { category: 'debt', label: 'EPF', value: n(a.epf), liquid: false },
    { category: 'debt', label: 'PPF', value: n(a.ppf), liquid: false },
    { category: 'debt', label: 'NPS', value: n(a.nps), liquid: false },
    { category: 'realEstate', label: 'Property', value: n(a.property), liquid: false },
    { category: 'gold', label: 'Gold & SGBs', value: n(a.gold), liquid: true },
    { category: 'other', label: 'Other assets', value: n(a.other), liquid: false },
  ].filter((x) => x.value > 0);

  const l = p.liabilities || {};
  const liabilities = [
    { category: 'home_loan', label: 'Home loans', value: sum(l.home_loans, 'outstanding') },
    { category: 'personal_loan', label: 'Personal loans', value: sum(l.personal_loans, 'outstanding') },
    { category: 'car_loan', label: 'Car loans', value: sum(l.car_loans, 'outstanding') },
    { category: 'education_loan', label: 'Education loans', value: sum(l.education_loans, 'outstanding') },
    { category: 'credit_card', label: 'Credit card outstanding', value: sum(l.credit_cards, 'outstanding') },
    { category: 'informal', label: 'Informal / family loans', value: n(l.informal_total) },
  ].filter((x) => x.value > 0);

  const totalAssets = assets.reduce((s, x) => s + x.value, 0);
  const totalLiabilities = liabilities.reduce((s, x) => s + x.value, 0);
  const liquidAssets = assets.filter((x) => x.liquid).reduce((s, x) => s + x.value, 0);

  const cat = (c: string) => assets.filter((x) => x.category === c).reduce((s, x) => s + x.value, 0);
  return {
    netWorth: totalAssets - totalLiabilities,
    totalAssets,
    totalLiabilities,
    assets,
    liabilities,
    allocation: { equity: cat('equity'), debt: cat('debt'), realEstate: cat('realEstate'), gold: cat('gold'), cash: cat('cash') },
    liquidityRatio: totalAssets > 0 ? liquidAssets / totalAssets : 0,
  };
}

// Future value of a starting corpus plus a monthly contribution, compounded.
export function projectValue(start: number, monthlySurplus: number, months: number, annualRate = 0.08): number {
  const r = annualRate / 12;
  let nw = start;
  for (let m = 0; m < months; m++) nw = nw * (1 + r) + Math.max(0, monthlySurplus);
  return Math.round(nw);
}

export interface GrowthHorizon {
  years: number;
  baseline: number;  // where you land doing nothing different
  improved: number;  // where you land doing the levers below
  uplift: number;    // improved - baseline
}
// Nominal blended return assumptions by risk level (long-run, conservative).
type RiskKey = 'conservative' | 'moderate' | 'aggressive';
const RISK_RATES: Record<RiskKey, number> = { conservative: 0.07, moderate: 0.09, aggressive: 0.11 };

export interface GrowthProjection {
  available: boolean;
  current: number;
  baselineSurplus: number;
  improvedSurplus: number;
  horizons: GrowthHorizon[];   // 5 / 10 / 20 years
  levers: string[];
  riskAppetite: RiskKey;       // the risk level these projections assume
  assumedReturnPct: number;    // e.g. 9 (= 9% p.a.) for the chosen risk level
}

// "Grow your net worth from X to Y by doing these things."
// Compares the do-nothing trajectory against a realistic improved one
// (lift savings rate toward 25%, deploy idle cash, step-up SIP) over 5/10/20 yr.
export function growthProjection(p: ProfileData, nw: NetWorthBreakdown): GrowthProjection {
  const takeHome = p.user.monthly_take_home || 0;
  const expenses = p.monthlyExpenses;
  const riskKey: RiskKey = (p.user.risk_appetite as RiskKey) in RISK_RATES ? (p.user.risk_appetite as RiskKey) : 'moderate';
  if (!takeHome) {
    return { available: false, current: nw.netWorth, baselineSurplus: 0, improvedSurplus: 0, horizons: [], levers: [], riskAppetite: riskKey, assumedReturnPct: Math.round(RISK_RATES[riskKey] * 100) };
  }

  const surplus = expenses != null ? Math.max(0, takeHome - expenses) : Math.round(takeHome * 0.15);

  // BASELINE = "if nothing changes" should compound what the user ACTUALLY
  // invests into growth assets today (their current SIP), NOT their entire
  // theoretical surplus. Assuming every spare rupee is already invested at 8%
  // grossly overstates the do-nothing path (idle cash earns ~3%, and most
  // surplus quietly leaks to lifestyle). If we don't know their SIP, assume a
  // modest ~10% of take-home trickles in.
  const currentSip = Number(p.assets?.mutual_funds?.monthly_sip) || 0;
  const baselineContribution = currentSip > 0 ? currentSip : Math.min(surplus, Math.round(takeHome * 0.10));

  // IMPROVED = the standard planning target: invest ~25% of take-home. This is
  // achievable by spending less and deploying idle cash, so it may exceed the
  // current surplus — it's a target that requires habit change, clearly framed.
  const improvedContribution = Math.max(baselineContribution, Math.round(takeHome * 0.25));

  const idleCash = nw.allocation.cash;
  // NOMINAL blended return assumptions by the user's chosen risk level. These
  // sit at/below the long-run averages on purpose (equity ~11–12%, debt ~7%) so
  // we under-promise rather than over-promise. Same rate for both paths — the
  // difference between them is how much you invest, not a magic higher return.
  const rate = RISK_RATES[riskKey];

  // Improved path steps the contribution up ~10% a year as income grows;
  // baseline stays flat (that's what "nothing changes" means).
  const improvedAt = (months: number) => {
    let imp = nw.netWorth, contrib = improvedContribution;
    const rM = rate / 12;
    for (let m = 1; m <= months; m++) {
      imp = imp * (1 + rM) + contrib;
      if (m % 12 === 0) contrib = Math.round(contrib * 1.1);
    }
    return Math.round(imp);
  };

  const horizons: GrowthHorizon[] = [5, 10, 20].map((years) => {
    const months = years * 12;
    const baseline = projectValue(nw.netWorth, baselineContribution, months, rate);
    const improved = improvedAt(months);
    return { years, baseline, improved, uplift: Math.max(0, improved - baseline) };
  });

  const inrShort = (paise: number) => {
    const r = Math.round(paise / 100);
    if (r >= 1e5) return `₹${(r / 1e5).toFixed(r >= 1e6 ? 0 : 1)}L`;
    return `₹${Math.round(r / 1000)}k`;
  };
  const levers: string[] = [];
  if (improvedContribution > baselineContribution) {
    const savePct = expenses != null && takeHome > 0 ? Math.round(((takeHome - expenses) / takeHome) * 100) : null;
    levers.push(
      currentSip > 0
        ? `You invest about ${inrShort(currentSip)}/month today. Lifting that toward 25% of take-home (${inrShort(improvedContribution)}/month) is the single biggest lever.`
        : savePct != null
          ? `Aim to invest about 25% of your take-home (${inrShort(improvedContribution)}/month) — you currently save ${savePct}%, so this means investing more of it rather than letting it sit.`
          : `Aim to invest about 25% of your take-home (${inrShort(improvedContribution)}/month).`
    );
  }
  if (idleCash > nw.totalAssets * 0.3 && nw.totalAssets > 0) levers.push('Move idle cash beyond your emergency fund into investments so it earns ~8% instead of ~3%.');
  levers.push('Automate a SIP on salary day so investing happens before you can spend it.');
  levers.push('Step your SIP up ~10% every year as your income grows — it compounds over time.');

  return { available: (horizons[0]?.uplift || 0) > 0, current: nw.netWorth, baselineSurplus: baselineContribution, improvedSurplus: improvedContribution, horizons, levers, riskAppetite: riskKey, assumedReturnPct: Math.round(rate * 100) };
}

// Forward projection: months to reach target at current monthly surplus +
// assumed blended 8% p.a. growth on invested corpus.
export function projectMonthsToTarget(netWorth: number, monthlySurplus: number, target: number): number | null {
  if (netWorth >= target) return 0;
  if (monthlySurplus <= 0) return null;
  const r = 0.08 / 12;
  let nw = netWorth;
  for (let m = 1; m <= 600; m++) {
    nw = nw * (1 + r) + monthlySurplus;
    if (nw >= target) return m;
  }
  return null;
}
