// The Money Map — one consistent view of a user's monthly money flow that every
// brain engine plans against. Pure function (no DB). Amounts in paise.
//
// Conventions (kept identical to investment.ts so numbers never disagree):
//  • monthlyExpenses = all spending INCLUDING loan EMIs, EXCLUDING investments
//    and transfers (that is how profile.ts derives it from transactions).
//  • currentSip = money already flowing to long-term investing each month.
//  • free = takeHome − expenses − currentSip  → the money the brain can plan.

import { ProfileData, totalMonthlyEmi, liquidReserve } from '../score';

export interface MoneyMap {
  takeHome: number;
  expenses: number;          // incl. EMIs
  emi: number;               // portion of expenses that is loan EMIs (informational)
  currentSip: number;
  free: number;              // planable surplus (can be negative = overspending)
  liquid: number;            // savings + liquid funds + FDs
  emergencyTarget: number;   // months × expenses
  emergencyMonths: number;   // 3 for students, 6 otherwise
  emergencyGap: number;      // how much the safety net is short today
  excessCash: number;        // liquid money ABOVE the safety net — usable now
  savingsRate: number | null;// (takeHome − expenses) / takeHome, 0..1
  hasData: boolean;          // false when income/expenses are missing
}

const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function buildMoneyMap(p: ProfileData): MoneyMap {
  const a = p.assets || {};
  const takeHome = n(p.user.monthly_take_home);
  const expenses = n(p.monthlyExpenses);
  const emi = Math.min(totalMonthlyEmi(p.liabilities), expenses || totalMonthlyEmi(p.liabilities));
  const currentSip = n(a.mutual_funds?.monthly_sip);
  const free = takeHome - expenses - currentSip;
  const liquid = liquidReserve(a);
  const emergencyMonths = p.user.employment_type === 'student' ? 3 : 6;
  const emergencyTarget = expenses * emergencyMonths;
  const emergencyGap = Math.max(0, emergencyTarget - liquid);
  const excessCash = Math.max(0, liquid - emergencyTarget);
  const savingsRate = takeHome > 0 ? Math.max(-1, Math.min(1, (takeHome - expenses) / takeHome)) : null;
  return {
    takeHome, expenses, emi, currentSip, free, liquid, emergencyTarget, emergencyMonths,
    emergencyGap, excessCash, savingsRate, hasData: takeHome > 0 && expenses > 0,
  };
}
