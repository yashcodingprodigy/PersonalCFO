// One money formatter for the whole server: Indian digit grouping everywhere
// (₹1,200 · ₹1,20,000 · ₹18,60,000 · ₹1,25,00,000). All inputs are paise.

/** ₹ with Indian commas, no decimals. e.g. 186000000 paise → ₹18,60,000 */
export function inrIN(paise: number): string {
  const r = Math.round(Number(paise) / 100);
  return `${r < 0 ? '−' : ''}₹${Math.abs(r).toLocaleString('en-IN')}`;
}

/** Friendly rounded range for guidance (no false precision), still with Indian commas.
 *  ₹10.85 Cr → "₹10,00,00,000–₹11,00,00,000"; ₹18.5 L → "₹18,00,000–₹19,00,000"; ₹23,400 → "₹20,000–₹25,000" */
export function inrRangeIN(paise: number): string {
  const r = Math.round(Number(paise) / 100);
  if (r <= 0) return '₹0';
  const unit = r >= 1e7 ? 1e7 : r >= 1e5 ? 1e5 : 5000;
  const lo = Math.floor(r / unit) * unit, hi = Math.ceil(r / unit) * unit;
  const f = (n: number) => `₹${n.toLocaleString('en-IN')}`;
  return lo === hi ? f(lo) : `${f(lo)}–${f(hi)}`;
}
