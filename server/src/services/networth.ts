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
export interface GrowthProjection {
  available: boolean;
  current: number;
  baselineSurplus: number;
  improvedSurplus: number;
  horizons: GrowthHorizon[];   // 5 / 10 / 20 years
  levers: string[];
}

// "Grow your net worth from X to Y by doing these things."
// Compares the do-nothing trajectory against a realistic improved one
// (lift savings rate toward 25%, deploy idle cash, step-up SIP) over 5/10/20 yr.
export function growthProjection(p: ProfileData, nw: NetWorthBreakdown): GrowthProjection {
  const takeHome = p.user.monthly_take_home || 0;
  const expenses = p.monthlyExpenses;
  if (!takeHome) {
    return { available: false, current: nw.netWorth, baselineSurplus: 0, improvedSurplus: 0, horizons: [], levers: [] };
  }

  const currentSurplus = expenses != null ? Math.max(0, takeHome - expenses) : Math.round(takeHome * 0.1);
  const baselineSurplus = currentSurplus;
  const improvedSurplus = Math.max(baselineSurplus, Math.round(takeHome * 0.25));
  const idleCash = nw.allocation.cash;
  const improvedRate = idleCash > nw.totalAssets * 0.3 ? 0.09 : 0.085;

  // Improved path steps the contribution up ~10% a year as income grows.
  const improvedAt = (months: number) => {
    let imp = nw.netWorth, contrib = improvedSurplus;
    const rM = improvedRate / 12;
    for (let m = 1; m <= months; m++) {
      imp = imp * (1 + rM) + contrib;
      if (m % 12 === 0) contrib = Math.round(contrib * 1.1);
    }
    return Math.round(imp);
  };

  const horizons: GrowthHorizon[] = [5, 10, 20].map((years) => {
    const months = years * 12;
    const baseline = projectValue(nw.netWorth, baselineSurplus, months, 0.08);
    const improved = improvedAt(months);
    return { years, baseline, improved, uplift: Math.max(0, improved - baseline) };
  });

  const levers: string[] = [];
  if (improvedSurplus > baselineSurplus) {
    const savePct = expenses != null && takeHome > 0 ? Math.round(((takeHome - expenses) / takeHome) * 100) : null;
    levers.push(savePct != null
      ? `Lift your savings rate from ${savePct}% toward 25% — the single biggest lever.`
      : 'Aim to invest about 25% of your take-home each month.');
  }
  if (idleCash > nw.totalAssets * 0.3 && nw.totalAssets > 0) levers.push('Move idle cash beyond your emergency fund into investments so it earns ~8% instead of ~3%.');
  levers.push('Automate a SIP on salary day so investing happens before you can spend it.');
  levers.push('Step your SIP up ~10% every year as your income grows — it compounds dramatically.');

  return { available: (horizons[0]?.uplift || 0) > 0, current: nw.netWorth, baselineSurplus, improvedSurplus, horizons, levers };
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
