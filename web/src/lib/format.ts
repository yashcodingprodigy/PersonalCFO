// Indian currency formatting. All API values are in paise.

export function inr(paise: number | string | null | undefined, opts: { compact?: boolean } = {}): string {
  if (paise == null) return '—';
  const r = Math.round(Number(paise) / 100);
  const abs = Math.abs(r);
  const sign = r < 0 ? '−' : '';
  if (opts.compact !== false) {
    if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(abs >= 1e8 ? 1 : 2)} Cr`;
    if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 1 : 2)} L`;
  }
  return `${sign}₹${abs.toLocaleString('en-IN')}`;
}

export function inrFull(paise: number | string | null | undefined): string {
  if (paise == null) return '—';
  const r = Math.round(Number(paise) / 100);
  return `${r < 0 ? '−' : ''}₹${Math.abs(r).toLocaleString('en-IN')}`;
}

export function rupeesToPaise(rupees: string | number): number {
  return Math.round(Number(String(rupees).replace(/[,₹\s]/g, '')) * 100);
}

export function pct(x: number | null | undefined, digits = 0): string {
  if (x == null) return '—';
  return `${(x * 100).toFixed(digits)}%`;
}

export const bandColor: Record<string, string> = {
  red: '#C2402A',
  amber: '#C77E1F',
  teal: '#1D8A78',
  green: '#2E9E44',
};

export function scoreBand(score: number): string {
  if (score <= 40) return 'red';
  if (score <= 65) return 'amber';
  if (score <= 85) return 'teal';
  return 'green';
}

export const DIMENSION_LABELS: Record<string, string> = {
  savings_rate: 'Savings rate',
  insurance_adequacy: 'Insurance adequacy',
  investment_diversification: 'Diversification',
  emergency_fund: 'Emergency fund',
  debt_health: 'Debt health',
  tax_efficiency: 'Tax efficiency',
};

export const CATEGORY_LABELS: Record<string, string> = {
  food_dining: 'Food & dining',
  transport: 'Transport',
  entertainment: 'Entertainment',
  shopping: 'Shopping',
  utilities: 'Utilities',
  health: 'Health',
  education: 'Education',
  emi: 'EMI payments',
  investments: 'Investments',
  transfers: 'Transfers',
  atm_cash: 'ATM / cash',
  salary: 'Salary',
  unknown: 'Uncategorised',
};
