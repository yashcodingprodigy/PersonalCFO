// Indian currency formatting. All API values are in paise.

// Indian digit grouping everywhere: ₹1,200 · ₹1,20,000 · ₹18,60,000 · ₹1,25,00,000.
const grp = (n: number) => Math.abs(Math.round(n)).toLocaleString('en-IN');

export function inr(paise: number | string | null | undefined, opts: { compact?: boolean } = {}): string {
  if (paise == null || paise === '') return '—';
  const r = Math.round(Number(paise) / 100);
  if (!Number.isFinite(r)) return '—';
  const sign = r < 0 ? '−' : '';
  // compact only where space is tight AND the caller asks for it explicitly
  if (opts.compact === true) {
    const abs = Math.abs(r);
    if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(abs >= 1e8 ? 1 : 2)} Cr`;
    if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(abs >= 1e6 ? 1 : 2)} L`;
  }
  return `${sign}₹${grp(r)}`;
}

// Friendly rounded RANGE for guidance figures (e.g. insurance sizing), so we
// don't imply false precision — still with Indian commas.
// ₹10.85 Cr → "₹10,00,00,000–₹11,00,00,000", ₹18.5 L → "₹18,00,000–₹19,00,000".
export function inrRange(paise: number | string | null | undefined): string {
  if (paise == null) return '—';
  const r = Math.round(Number(paise) / 100);
  if (r <= 0) return '₹0';
  const unit = r >= 1e7 ? 1e7 : r >= 1e5 ? 1e5 : 5000;
  const lo = Math.floor(r / unit) * unit, hi = Math.ceil(r / unit) * unit;
  return lo === hi ? `₹${grp(lo)}` : `₹${grp(lo)}–₹${grp(hi)}`;
}

// Approximate amount for guidance figures (e.g. suggested monthly investment),
// so they read as "about ₹4,000" rather than a falsely precise ₹4,137.
export function inrApprox(paise: number | string | null | undefined): string {
  if (paise == null) return '—';
  const r = Math.round(Number(paise) / 100);
  if (r <= 0) return '₹0';
  const step = r >= 1e7 ? 1e6 : r >= 1e5 ? 10000 : r >= 50000 ? 1000 : 500;
  const rounded = Math.max(step, Math.round(r / step) * step);
  return `~₹${grp(rounded)}`;
}

export function inrFull(paise: number | string | null | undefined): string {
  if (paise == null) return '—';
  const r = Math.round(Number(paise) / 100);
  return `${r < 0 ? '−' : ''}₹${grp(r)}`;
}

/** Format a rupee amount typed by the user with Indian commas ("120000" → "1,20,000"). */
export function groupDigits(raw: string): string {
  const digits = String(raw).replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  return digits ? Number(digits).toLocaleString('en-IN') : '';
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
