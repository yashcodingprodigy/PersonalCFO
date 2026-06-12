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
