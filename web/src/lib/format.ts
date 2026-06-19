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

// Friendly rounded RANGE for guidance figures (e.g. insurance sizing), so we
// don't imply false precision: ₹10.85 Cr → "₹10–11 Cr", ₹18.5 L → "₹18–19 L".
export function inrRange(paise: number | string | null | undefined): string {
  if (paise == null) return '—';
  const r = Math.round(Number(paise) / 100);
  if (r <= 0) return '₹0';
  if (r >= 1e7) { const lo = Math.floor(r / 1e7), hi = Math.ceil(r / 1e7); return lo === hi ? `₹${lo} Cr` : `₹${lo}–${hi} Cr`; }
  if (r >= 1e5) { const lo = Math.floor(r / 1e5), hi = Math.ceil(r / 1e5); return lo === hi ? `₹${lo} L` : `₹${lo}–${hi} L`; }
  const k = r / 1000; const lo = Math.floor(k / 5) * 5, hi = Math.ceil(k / 5) * 5;
  return lo === hi ? `₹${(lo * 1000).toLocaleString('en-IN')}` : `₹${lo}k–${hi}k`;
}

// Approximate amount for guidance figures (e.g. suggested monthly investment),
// so they read as "about ₹4,000" rather than a falsely precise ₹4,137.
export function inrApprox(paise: number | string | null | undefined): string {
  if (paise == null) return '—';
  const r = Math.round(Number(paise) / 100);
  if (r <= 0) return '₹0';
  if (r >= 1e7) { const cr = r / 1e7; return `~₹${cr.toFixed(cr >= 10 ? 0 : 1)} Cr`; }
  if (r >= 1e5) { const l = r / 1e5; return `~₹${l.toFixed(l >= 10 ? 0 : 1)} L`; }
  // round to a friendly step: nearest ₹500 below ₹50k, nearest ₹1,000 above
  const step = r >= 50000 ? 1000 : 500;
  const rounded = Math.max(step, Math.round(r / step) * step);
  return `~₹${rounded.toLocaleString('en-IN')}`;
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
