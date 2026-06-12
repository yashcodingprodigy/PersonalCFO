// Goal engine — SRS §13. SIP maths with inflation adjustment.
// Amounts in paise. Rates are annual decimals.

export interface GoalMath {
  inflationAdjustedTarget: number;
  requiredMonthly: number;
  projectedAtCurrentRate: number;
  health: 'on_track' | 'at_risk' | 'off_track' | 'achieved';
  monthsRemaining: number;
}

// Future value of a monthly SIP: P × [((1+i)^n − 1)/i] × (1+i)
function sipFutureValue(monthly: number, months: number, annualRate: number): number {
  const i = annualRate / 12;
  if (i === 0) return monthly * months;
  return monthly * ((Math.pow(1 + i, months) - 1) / i) * (1 + i);
}

// Required monthly SIP to reach FV in n months at rate r
function requiredSip(fv: number, months: number, annualRate: number): number {
  const i = annualRate / 12;
  if (months <= 0) return fv;
  if (i === 0) return fv / months;
  return fv / (((Math.pow(1 + i, months) - 1) / i) * (1 + i));
}

export function computeGoalMath(goal: {
  target_amount: number;
  target_date: string | null;
  current_amount: number;
  monthly_contribution: number;
  meta?: any;
}): GoalMath {
  const now = new Date();
  const target = goal.target_date ? new Date(goal.target_date) : new Date(now.getFullYear() + 5, now.getMonth(), 1);
  const months = Math.max(0, Math.round((target.getTime() - now.getTime()) / (30.44 * 24 * 3600 * 1000)));

  const inflation = Number(goal.meta?.inflation ?? 0); // e.g. 0.08 for education
  const expectedReturn = Number(goal.meta?.expected_return ?? (months > 84 ? 0.12 : months > 36 ? 0.10 : 0.065));

  const adjustedTarget = Math.round(goal.target_amount * Math.pow(1 + inflation, months / 12));
  const corpusGrowth = goal.current_amount * Math.pow(1 + expectedReturn / 12, months);
  const stillNeeded = Math.max(0, adjustedTarget - corpusGrowth);
  const reqMonthly = Math.round(requiredSip(stillNeeded, months, expectedReturn));
  const projected = Math.round(corpusGrowth + sipFutureValue(goal.monthly_contribution, months, expectedReturn));

  let health: GoalMath['health'];
  if (goal.current_amount >= adjustedTarget) health = 'achieved';
  else if (reqMonthly === 0 || goal.monthly_contribution >= reqMonthly) health = 'on_track';
  else if (goal.monthly_contribution >= reqMonthly * 0.7) health = 'at_risk';
  else health = 'off_track';

  return {
    inflationAdjustedTarget: adjustedTarget,
    requiredMonthly: reqMonthly,
    projectedAtCurrentRate: projected,
    health,
    monthsRemaining: months,
  };
}

export const GOAL_TYPES = [
  { type: 'emergency_fund', label: 'Emergency fund', defaultMeta: { expected_return: 0.065, inflation: 0 } },
  { type: 'home_purchase', label: 'Home down payment', defaultMeta: { expected_return: 0.08, inflation: 0.06 } },
  { type: 'child_education', label: "Child's education", defaultMeta: { expected_return: 0.12, inflation: 0.08 } },
  { type: 'retirement', label: 'Retirement corpus', defaultMeta: { expected_return: 0.12, inflation: 0.06 } },
  { type: 'car_purchase', label: 'Car purchase', defaultMeta: { expected_return: 0.065, inflation: 0.04 } },
  { type: 'debt_free', label: 'Debt-free date', defaultMeta: { expected_return: 0, inflation: 0 } },
  { type: 'custom', label: 'Custom goal', defaultMeta: { expected_return: 0.08, inflation: 0 } },
];
