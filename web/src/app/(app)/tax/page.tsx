'use client';

import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { inr } from '@/lib/format';

export default function TaxPage() {
  const [tax, setTax] = useState<any>(null);
  useEffect(() => { get('/tax').then(setTax).catch(() => {}); }, []);
  if (!tax) return <div className="card h-96 animate-pulse mt-4" />;

  const { comparison: c, deductions: d } = tax;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium">Tax optimisation</h1>
        <p className="text-sm text-ink-soft mt-1">Financial year {tax.fy} · updated for the latest Finance Act.</p>
      </div>

      {/* Regime comparison */}
      <section className="grid sm:grid-cols-2 gap-4">
        {[c.oldRegime, c.newRegime].map((r: any) => (
          <div key={r.regime} className={`card p-6 ${c.recommended === r.regime ? 'ring-2 ring-pine-700 relative' : ''}`}>
            {c.recommended === r.regime && <span className="absolute -top-3 left-6 chip bg-pine-900 text-white">Recommended</span>}
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">{r.regime} regime</h2>
            <p className="font-display text-4xl font-semibold mt-3 tabular-nums">{inr(r.tax)}</p>
            <p className="text-xs text-ink-faint">estimated tax this FY</p>
            <ul className="mt-4 text-sm text-ink-soft space-y-1.5">
              <li className="flex justify-between"><span>Gross income</span><span className="tabular-nums">{inr(r.grossIncome)}</span></li>
              <li className="flex justify-between"><span>Deductions</span><span className="tabular-nums">−{inr(r.totalDeductions)}</span></li>
              <li className="flex justify-between font-semibold text-ink"><span>Taxable income</span><span className="tabular-nums">{inr(r.taxableIncome)}</span></li>
              <li className="flex justify-between"><span>Effective rate</span><span className="tabular-nums">{(r.effectiveRate * 100).toFixed(1)}%</span></li>
            </ul>
          </div>
        ))}
      </section>

      <div className="card p-5 border-l-4 border-l-mint-500">
        <p className="text-sm leading-relaxed">{c.reasoning}</p>
      </div>

      {/* Deduction tracker */}
      <section className="card p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-4">Deduction tracker (old regime)</h2>
        <div className="space-y-4">
          {d.items.map((i: any) => (
            <div key={i.section}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-semibold">{i.section}</span>
                <span className="tabular-nums text-ink-soft">{inr(i.used)} of {inr(i.limit)}</span>
              </div>
              <div className="h-2 bg-paper-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${i.used >= i.limit ? 'bg-signal-green' : 'bg-pine-600'}`} style={{ width: `${Math.min(100, (i.used / i.limit) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-ink-faint mt-4">
          Update your investment and premium amounts in Settings → Tax data to keep this accurate.
        </p>
      </section>

      {/* Tax calendar */}
      <section className="card p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-4">Tax calendar</h2>
        <ul className="space-y-3">
          {tax.calendar.map((e: any) => (
            <li key={e.month} className="flex gap-4 text-sm">
              <span className="w-36 shrink-0 font-bold text-pine-800">{e.month}</span>
              <span className="text-ink-soft leading-relaxed">{e.message}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-[11px] text-ink-faint leading-relaxed">{tax.disclaimer}</p>
    </div>
  );
}
