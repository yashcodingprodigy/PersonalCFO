'use client';

import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { inr } from '@/lib/format';
import { Disclosure, SectionNav, Section, Pill, C } from '@/components/kit';

const INST_STATUS: Record<string, { tone: any; label: string }> = {
  due_soon: { tone: 'red', label: 'Due now' },
  upcoming: { tone: 'amber', label: 'Upcoming' },
  paid_window: { tone: 'gray', label: 'Later' },
  passed: { tone: 'green', label: 'Passed' },
};

function TaxCopilot({ c }: { c: any }) {
  function downloadPack() {
    const p = c.readyPack;
    const lines = [
      `PayWatch — Tax Ready Pack (FY ${p.fy})`,
      `Generated: ${new Date(p.generatedAt).toLocaleString('en-IN')}`,
      ``,
      `Recommended regime: ${p.recommendedRegime.toUpperCase()}`,
      `Gross income:       ₹${Math.round(p.grossIncome / 100).toLocaleString('en-IN')}`,
      `Total deductions:   ₹${Math.round(p.totalDeductions / 100).toLocaleString('en-IN')}`,
      `Taxable income:     ₹${Math.round(p.taxableIncome / 100).toLocaleString('en-IN')}`,
      `Estimated tax:      ₹${Math.round(p.estimatedTax / 100).toLocaleString('en-IN')} (${p.effectiveRatePct}% effective)`,
      ``,
      `Deductions used:`,
      ...p.deductionItems.map((d: any) => `  • ${d.section}: ₹${Math.round(d.used / 100).toLocaleString('en-IN')} of ₹${Math.round(d.limit / 100).toLocaleString('en-IN')}`),
      ``,
      `Documents to share with your CA:`,
      ...p.documentsNeeded.map((d: string) => `  • ${d}`),
      ``,
      `Note: estimates for planning. Verify with your CA / the Income Tax portal before filing.`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `paywatch-tax-pack-${p.fy}.txt`; a.click();
  }
  const mailto = `mailto:?subject=${encodeURIComponent(`My tax pack (FY ${c.readyPack.fy})`)}&body=${encodeURIComponent('Hi, attaching my PayWatch tax summary for filing. Please find the figures and document list in the attached file.')}`;

  return (
    <Section id="copilot" title="Your year-round tax copilot" hint="What a CA tracks all year — on autopilot.">
      <div className="card p-5 border-l-4 border-l-mint-500 mb-4"><p className="text-sm text-ink-soft leading-relaxed">{c.season}</p></div>

      {/* Advance tax timeline */}
      <div className="card p-6 mb-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-1">Advance tax</h3>
        <p className="text-xs text-ink-soft mb-4 leading-relaxed">{c.advanceTax.reason}</p>
        {c.advanceTax.applicable && (
          <ul className="space-y-3">
            {c.advanceTax.instalments.map((ins: any, i: number) => {
              const st = INST_STATUS[ins.status] || INST_STATUS.upcoming;
              return (
                <li key={i} className="flex items-center gap-4 text-sm">
                  <div className="flex flex-col items-center">
                    <span className={`w-2.5 h-2.5 rounded-full ${ins.status === 'due_soon' ? 'bg-signal-red' : ins.status === 'passed' ? 'bg-signal-green' : 'bg-paper-200'}`} />
                    {i < c.advanceTax.instalments.length - 1 && <span className="w-px h-6 bg-paper-200 my-1" />}
                  </div>
                  <div className="flex-1 flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="font-semibold">{ins.label}</span>
                      <span className="text-ink-faint"> · due {new Date(ins.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-ink-soft">{inr(ins.cumulativeAmount)} ({ins.cumulativePct}%)</span>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* Proof checklist */}
        <div className="card p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Proof collection calendar</h3>
          <ul className="space-y-2 text-sm">
            {c.proofChecklist.map((p: any, i: number) => (
              <li key={i} className="flex justify-between gap-3"><span className="text-ink-soft">{p.item}</span><span className="text-[11px] text-ink-faint whitespace-nowrap">{p.when}</span></li>
            ))}
          </ul>
        </div>
        {/* Harvesting */}
        <div className="card p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-2">Capital-gains harvesting</h3>
          <p className="font-display text-xl font-semibold tabular-nums">{inr(c.harvesting.ltcgFreeLimit)}<span className="text-xs text-ink-faint font-normal"> tax-free/yr</span></p>
          <p className="text-xs text-ink-soft mt-2 leading-relaxed">{c.harvesting.note}</p>
        </div>
      </div>

      {/* CA-ready pack */}
      <div className="card p-6 bg-pine-950 text-white">
        <h3 className="text-sm font-bold uppercase tracking-widest text-mint-300 mb-1">CA-ready pack</h3>
        <p className="text-sm text-white/80 leading-relaxed">Everything a CA needs to file, assembled: your regime, income, deductions, estimated tax and document checklist. Download it and hand it over — or do it yourself on the IT portal.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={downloadPack} className="rounded-full bg-mint-500 text-pine-950 px-5 py-2 text-sm font-bold hover:bg-mint-400 transition-colors">Download my tax pack</button>
          <a href={mailto} className="rounded-full border border-white/30 text-white px-5 py-2 text-sm font-bold hover:bg-white/10 transition-colors">Share with a CA</a>
        </div>
      </div>
    </Section>
  );
}

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

      <SectionNav items={[{ id: 'regime', label: 'Regime' }, { id: 'copilot', label: 'Copilot' }, { id: 'reduce', label: 'Reduce tax' }, { id: 'deductions', label: 'Deductions' }, { id: 'calendar', label: 'Calendar' }, { id: 'docs', label: 'Docs & terms' }]} />

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

      {/* Tax Copilot — the year-round CA */}
      {tax.copilot && <TaxCopilot c={tax.copilot} />}

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
