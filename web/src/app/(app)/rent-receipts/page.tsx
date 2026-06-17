'use client';

import { useState } from 'react';
import { inr } from '@/lib/format';

// Indian-system number to words (for rent receipts).
function inWords(n: number): string {
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x: number): string => x < 20 ? ones[x] : tens[Math.floor(x / 10)] + (x % 10 ? ' ' + ones[x % 10] : '');
  const three = (x: number): string => (x >= 100 ? ones[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x));
  let res = '';
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) res += three(crore) + ' Crore ';
  if (lakh) res += two(lakh) + ' Lakh ';
  if (thousand) res += two(thousand) + ' Thousand ';
  if (n) res += three(n);
  return res.trim();
}

function monthsBetween(from: string, to: string): { label: string; key: string }[] {
  if (!from || !to) return [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const out: { label: string; key: string }[] = [];
  let y = fy, m = fm;
  for (let i = 0; i < 24; i++) {
    if (y > ty || (y === ty && m > tm)) break;
    const d = new Date(y, m - 1, 1);
    out.push({ label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), key: `${y}-${String(m).padStart(2, '0')}` });
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

export default function RentReceiptsPage() {
  const [f, setF] = useState({ tenant: '', landlord: '', pan: '', address: '', rent: '', from: '', to: '', mode: 'Bank transfer' });
  const [show, setShow] = useState(false);
  const set = (k: string) => (e: any) => setF((p) => ({ ...p, [k]: e.target.value }));
  const rent = Number(f.rent) || 0;
  const months = monthsBetween(f.from, f.to);
  const annual = rent * months.length;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="no-print">
        <h1 className="font-display text-3xl font-medium">Rent receipts</h1>
        <p className="text-sm text-ink-soft mt-1">Generate HRA rent receipts for the whole year in one go — then print or save as PDF.</p>
      </div>

      {!show && (
        <section className="card p-6 space-y-4 no-print">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Your name (tenant)</label><input className="input" value={f.tenant} onChange={set('tenant')} placeholder="Your full name" /></div>
            <div><label className="label">Landlord name</label><input className="input" value={f.landlord} onChange={set('landlord')} placeholder="Landlord's name" /></div>
            <div><label className="label">Monthly rent (₹)</label><input className="input" inputMode="numeric" value={f.rent} onChange={(e) => setF((p) => ({ ...p, rent: e.target.value.replace(/[^\d]/g, '') }))} placeholder="25000" /></div>
            <div><label className="label">Landlord PAN {annual > 100000 ? '(required)' : '(optional)'}</label><input className="input uppercase" value={f.pan} onChange={set('pan')} placeholder="ABCDE1234F" /></div>
            <div><label className="label">From month</label><input type="month" className="input" value={f.from} onChange={set('from')} /></div>
            <div><label className="label">To month</label><input type="month" className="input" value={f.to} onChange={set('to')} /></div>
            <div className="sm:col-span-2"><label className="label">Property address</label><input className="input" value={f.address} onChange={set('address')} placeholder="Flat, building, area, city" /></div>
            <div><label className="label">Payment mode</label>
              <select className="input" value={f.mode} onChange={set('mode')}><option>Bank transfer</option><option>UPI</option><option>Cheque</option><option>Cash</option></select>
            </div>
          </div>
          {annual > 100000 && !f.pan && <p className="text-xs text-signal-amber">Annual rent is over ₹1,00,000, so the landlord&apos;s PAN is mandatory for claiming HRA.</p>}
          <button onClick={() => setShow(true)} disabled={!f.tenant || !f.landlord || !rent || months.length === 0} className="btn-primary">Generate {months.length || ''} receipts</button>
        </section>
      )}

      {show && (
        <>
          <div className="flex gap-2 no-print">
            <button onClick={() => window.print()} className="btn-primary">Print / Save as PDF</button>
            <button onClick={() => setShow(false)} className="btn-secondary">Edit details</button>
          </div>
          <div className="space-y-4">
            {months.map((m, i) => (
              <div key={m.key} className="card p-6 break-inside-avoid" style={{ pageBreakInside: 'avoid' }}>
                <div className="flex items-start justify-between border-b border-paper-200 pb-3 mb-3">
                  <div><p className="font-display text-lg font-semibold">Rent Receipt</p><p className="text-xs text-ink-faint">{m.label}</p></div>
                  <p className="text-xs text-ink-faint">No. {String(i + 1).padStart(3, '0')}</p>
                </div>
                <p className="text-sm leading-relaxed text-ink-soft">
                  Received with thanks from <strong className="text-ink">{f.tenant}</strong> the sum of <strong className="text-ink">{inr(rent * 100)}</strong>
                  {' '}(Rupees {inWords(rent)} only) towards rent for the month of <strong className="text-ink">{m.label}</strong>
                  {' '}for the property situated at <strong className="text-ink">{f.address || '—'}</strong>, paid via {f.mode}.
                </p>
                <div className="mt-6 flex justify-between items-end text-sm">
                  <div className="text-ink-soft">
                    <p>Landlord: <strong className="text-ink">{f.landlord}</strong></p>
                    {f.pan && <p>PAN: <strong className="text-ink">{f.pan.toUpperCase()}</strong></p>}
                  </div>
                  <div className="text-center">
                    <div className="w-40 border-b border-ink-faint mb-1" />
                    <p className="text-xs text-ink-faint">Landlord&apos;s signature{rent > 5000 && f.mode === 'Cash' ? ' (affix revenue stamp)' : ''}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-faint leading-relaxed no-print">Generated for your HRA claim. Get each receipt physically signed by your landlord; submit to your employer with the landlord&apos;s PAN if annual rent exceeds ₹1,00,000.</p>
        </>
      )}
    </div>
  );
}
