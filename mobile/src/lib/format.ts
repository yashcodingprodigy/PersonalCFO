// Indian money formatting. All API values are in paise.
// Grouping is done by hand (not Intl) so it is identical on every Android/iOS version:
// ₹1,200 · ₹1,20,000 · ₹18,60,000 · ₹1,25,00,000.

export function groupIN(n: number): string {
  const s = String(Math.abs(Math.round(n)));
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

export function inr(paise: number | string | null | undefined, opts: { compact?: boolean } = {}): string {
  if (paise == null || paise === '') return '—';
  const r = Math.round(Number(paise) / 100);
  if (!Number.isFinite(r)) return '—';
  const sign = r < 0 ? '−' : '';
  if (opts.compact) {
    const a = Math.abs(r);
    if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(a >= 1e8 ? 1 : 2)} Cr`;
    if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(a >= 1e6 ? 1 : 2)} L`;
  }
  return `${sign}₹${groupIN(r)}`;
}

export function inrApprox(paise: number | string | null | undefined): string {
  if (paise == null) return '—';
  const r = Math.round(Number(paise) / 100);
  if (r <= 0) return '₹0';
  const step = r >= 1e7 ? 1e6 : r >= 1e5 ? 10000 : r >= 50000 ? 1000 : 500;
  return `~₹${groupIN(Math.max(step, Math.round(r / step) * step))}`;
}

export function inrRange(paise: number | string | null | undefined): string {
  if (paise == null) return '—';
  const r = Math.round(Number(paise) / 100);
  if (r <= 0) return '₹0';
  const unit = r >= 1e7 ? 1e7 : r >= 1e5 ? 1e5 : 5000;
  const lo = Math.floor(r / unit) * unit, hi = Math.ceil(r / unit) * unit;
  return lo === hi ? `₹${groupIN(lo)}` : `₹${groupIN(lo)}–₹${groupIN(hi)}`;
}

/** "120000" → "1,20,000" while typing. State keeps plain digits. */
export function groupDigits(raw: string): string {
  const d = String(raw ?? '').replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
  return d ? groupIN(Number(d)) : '';
}
export const digitsOnly = (s: string) => String(s ?? '').replace(/[^0-9]/g, '');
export const rupeesToPaise = (r: string | number) => Math.round(Number(String(r).replace(/[,₹\s]/g, '') || 0) * 100);
export const paiseToRupeesStr = (p: number | null | undefined) => (p ? String(Math.round(Number(p) / 100)) : '');

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_HI = ['जन', 'फ़र', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुल', 'अग', 'सित', 'अक्टू', 'नव', 'दिस'];
/** "2027-03" or ISO date → "Mar 2027" */
export function prettyMonth(s: string | null | undefined, lang: 'en' | 'hi' = 'en'): string {
  if (!s) return '—';
  const [y, m] = String(s).split('-').map(Number);
  if (!y || !m) return String(s);
  return `${(lang === 'hi' ? MONTHS_HI : MONTHS_EN)[m - 1]} ${y}`;
}
export function prettyDate(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return String(s);
  return `${d.getDate()} ${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;
}
export function ago(iso: string, lang: 'en' | 'hi' = 'en'): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  const hi = lang === 'hi';
  if (s < 3600) { const m = Math.max(1, Math.round(s / 60)); return hi ? `${m} मिनट पहले` : `${m} min ago`; }
  if (s < 86400) { const h = Math.round(s / 3600); return hi ? `${h} घंटे पहले` : `${h} h ago`; }
  const d = Math.round(s / 86400); return hi ? `${d} दिन पहले` : `${d} d ago`;
}
export const pct = (x: number | null | undefined, digits = 0) => (x == null ? '—' : `${Number(x).toFixed(digits)}%`);
