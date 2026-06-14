'use client';

import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { inr } from '@/lib/format';
import { Disclosure, SectionNav, Section, Pill, C } from '@/components/kit';

export default function TaxPage() {
  const [tax, setTax] = useState<any>(null);
  useEffect(() => { get('/tax').then(setTax).catch(() => {}); }, []);
  if (!tax) return <div className="card h-96 animate-pulse mt-4" />;

  const { comparison: c, deductions: d } = tax;
  const rp = tax.reductionPlan;
  const noTax = c.oldRegime.tax === 0 && c.newRegime.tax === 0;
  const maxTax = Math.max(c.oldRegime.tax, c.newRegime.tax, 1);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium">Tax</h1>
        <p className="text-sm text-ink-soft mt-1">Financial year {tax.fy} · updated for the latest Finance Act.</p>
      </div>

      <SectionNav items={[{ id: 'regime', label: 'Regime' }, { id: 'reduce', label: 'Reduce tax' }, { id: 'deductions', label: 'Deductions' }, { id: 'calendar', label: 'Calendar' }, { id: 'docs', label: 'Docs & terms' }]} />

      {noTax && (
        <div className="card p-5 border-l-4 border-l-signal-green">
          <p className="text-sm text-ink-soft leading-relaxed">
            <strong className="text-signal-green">Good news — you owe no income tax yet.</strong> At your income, the new regime&apos;s rebate covers you fully. Skim the rest so you know how it works for when you earn more.
          </p>
        </div>
      )}

      {/* Regime comparison */}
      <Section id="regime" title="Which tax regime wins" hint="The system that leaves more in your pocket.">
        <div className="grid sm:grid-cols-2 gap-4">
          {[c.oldRegime, c.newRegime].map((r: any) => (
            <div key={r.regime} className={`card p-6 relative ${c.recommended === r.regime ? 'ring-2 ring-pine-700' : ''}`}>
              {c.recommended === r.regime && <span className="absolute -top-3 left-6 chip bg-pine-900 text-white">Recommended</span>}
              <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint">{r.regime} regime</h3>
              <p className="font-display text-4xl font-semibold mt-3 tabular-nums">{inr(r.tax)}</p>
              <p className="text-xs text-ink-faint">estimated tax this FY</p>
              <div className="mt-3 h-2 bg-paper-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(r.tax / maxTax) * 100}%`, background: c.recommended === r.regime ? C.pine700 : C.inkFaint }} /></div>
              <ul className="mt-4 text-sm text-ink-soft space-y-1.5">
                <li className="flex justify-between"><span>Gross income</span><span className="tabular-nums">{inr(r.grossIncome)}</span></li>
                <li className="flex justify-between"><span>Deductions</span><span className="tabular-nums">−{inr(r.totalDeductions)}</span></li>
                <li className="flex justify-between font-semibold text-ink"><span>Taxable income</span><span className="tabular-nums">{inr(r.taxableIncome)}</span></li>
                <li className="flex justify-between"><span>Effective rate</span><span className="tabular-nums">{(r.effectiveRate * 100).toFixed(1)}%</span></li>
              </ul>
            </div>
          ))}
        </div>
        <div className="card p-5 border-l-4 border-l-mint-500 mt-4"><p className="text-sm leading-relaxed">{c.reasoning}</p></div>
      </Section>

      {/* How to reduce */}
      {rp && (
        <Section id="reduce" title="How to reduce your tax"
          hint={`Each extra ₹100 of deduction saves about ₹${rp.marginalRatePct}. Tap a step for the how.`}
          action={rp.totalPotentialSaving > 0 ? <span className="text-sm font-semibold text-signal-green whitespace-nowrap">Up to {inr(rp.totalPotentialSaving)}</span> : undefined}>
          {rp.newRegimeNote && <div className="rounded-lg bg-paper-100 px-4 py-3 text-[12px] text-ink-soft leading-relaxed mb-3">{rp.newRegimeNote}</div>}
          <div className="space-y-2.5">
            {rp.steps.map((s: any, i: number) => (
              <Disclosure key={i}
                left={<Pill tone="pine">{s.section}</Pill>}
                title={s.title}
                right={s.taxSaved > 0 ? <span className="font-display text-base font-semibold text-signal-green tabular-nums whitespace-nowrap">−{inr(s.taxSaved)}</span> : undefined}>
                <p className="text-xs text-ink-soft leading-relaxed border-t border-paper-100 pt-3">{s.whatItMeans}</p>
                <p className="text-xs text-pine-800 mt-2 leading-relaxed"><strong>How:</strong> {s.howTo}</p>
              </Disclosure>
            ))}
          </div>
          <p className="text-xs text-ink-faint mt-3">Update amounts in Settings → Tax data to make these exact.</p>
        </Section>
      )}

      {/* Capital gains */}
      {rp?.capitalGains && (
        <Disclosure title={rp.capitalGains.title} subtitle="Tax on your investment profits — the basics">
          <ul className="space-y-2.5 text-sm text-ink-soft leading-relaxed border-t border-paper-100 pt-3">
            {rp.capitalGains.points.map((pt: string, i: number) => (
              <li key={i} className="flex gap-2"><span className="text-mint-500 font-bold shrink-0">·</span>{pt}</li>
            ))}
          </ul>
        </Disclosure>
      )}

      {/* Deduction tracker */}
      <Section id="deductions" title="Deduction tracker" hint="How much of each limit you've used (old regime).">
        <div className="card p-6 space-y-4">
          {d.items.map((i: any) => {
            const usedPct = Math.min(100, (i.used / i.limit) * 100);
            return (
              <div key={i.section}>
                <div className="flex justify-between text-sm mb-1"><span className="font-semibold">{i.section}</span><span className="tabular-nums text-ink-soft">{inr(i.used)} of {inr(i.limit)}</span></div>
                <div className="h-2.5 bg-paper-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${usedPct}%`, background: usedPct >= 100 ? C.green : C.pine700 }} /></div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Calendar */}
      <Section id="calendar" title="Tax calendar" hint="Don't miss a deadline.">
        <div className="card p-6">
          <ul className="space-y-4">
            {tax.calendar.map((e: any, i: number) => (
              <li key={e.month} className="flex gap-4 text-sm">
                <div className="flex flex-col items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-pine-700 mt-1.5" />
                  {i < tax.calendar.length - 1 && <span className="w-px flex-1 bg-paper-200 my-1" />}
                </div>
                <div className="pb-1">
                  <span className="font-bold text-pine-800">{e.month}</span>
                  <p className="text-ink-soft leading-relaxed mt-0.5">{e.message}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* Docs + glossary */}
      {rp && (
        <Section id="docs" title="Filing toolkit">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Documents to keep ready</h3>
              <ul className="space-y-2 text-sm text-ink-soft leading-relaxed">
                {rp.documentChecklist.map((doc: string, i: number) => (
                  <li key={i} className="flex gap-2"><span className="text-pine-700 font-bold shrink-0">✓</span>{doc}</li>
                ))}
              </ul>
            </div>
            <div className="card p-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Tax words, in plain English</h3>
              <dl className="space-y-2.5 text-sm">
                {rp.glossary.map((gl: any, i: number) => (
                  <div key={i}><dt className="font-semibold text-ink">{gl.term}</dt><dd className="text-ink-soft leading-relaxed">{gl.meaning}</dd></div>
                ))}
              </dl>
            </div>
          </div>
        </Section>
      )}

      <p className="text-[11px] text-ink-faint leading-relaxed">{tax.disclaimer}</p>
    </div>
  );
}
