'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api';
import { inr } from '@/lib/format';

const BUCKET_COLOR: Record<string, string> = {
  equity: 'bg-pine-700',
  debt: 'bg-mint-500',
  gold: 'bg-signal-amber',
};
const BUCKET_LABEL: Record<string, string> = { equity: 'Equity (growth)', debt: 'Debt (stability)', gold: 'Gold (cushion)' };
const RISK_LABEL: Record<string, string> = { conservative: 'Play it safe', moderate: 'Balanced', aggressive: 'Go for growth' };

export default function InvestPage() {
  const [g, setG] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => { get('/invest').then(setG).catch((e) => setErr(e.message)); }, []);

  if (err) return <p className="text-signal-red text-sm mt-8">{err}</p>;
  if (!g) return <div className="card h-96 animate-pulse mt-4" />;

  if (!g.hasIncome) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl font-medium">Where to invest</h1>
        <div className="card p-8 text-center">
          <p className="text-sm text-ink-soft">{g.investableExplanation}</p>
          <Link href="/settings" className="btn-primary inline-block mt-4">Add my income</Link>
        </div>
      </div>
    );
  }

  const target = g.targetAllocation;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium">Where to invest</h1>
        <p className="text-sm text-ink-soft mt-1">A personalised, beginner-friendly plan built from your profile — fund <em>categories</em>, never specific products.</p>
      </div>

      {/* Guardrails: do these first */}
      {(g.emergencyFirst || g.highCostDebtFirst) && (
        <section className="card p-6 border-l-4 border-l-signal-amber space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-signal-amber">Do this first</h2>
          {g.highCostDebtFirst && <p className="text-sm text-ink-soft leading-relaxed">{g.debtMessage}</p>}
          {g.emergencyFirst && <p className="text-sm text-ink-soft leading-relaxed">{g.emergencyMessage}</p>}
          <Link href="/actions" className="inline-block text-sm font-semibold text-pine-700 hover:underline">See these in your action plan →</Link>
        </section>
      )}

      {/* Risk + investable */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">Your investor type</h2>
          <p className="font-display text-2xl font-medium mt-2 capitalize">{RISK_LABEL[g.riskProfile] || g.riskProfile}</p>
          <p className="text-xs text-ink-soft mt-2 leading-relaxed">{g.riskReason}</p>
          {!g.riskWasExplicit && <Link href="/settings" className="text-xs text-pine-700 underline mt-2 inline-block">Set this yourself →</Link>}
        </section>
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">Suggested to invest / month</h2>
          <p className="font-display text-3xl font-semibold mt-2 tabular-nums">{inr(g.monthlyInvestable)}</p>
          <p className="text-xs text-ink-soft mt-2 leading-relaxed">{g.investableExplanation}</p>
        </section>
      </div>

      {/* Target allocation bar */}
      <section className="card p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-1">Your target mix</h2>
        <p className="text-xs text-ink-soft mb-4">How to split each rupee you invest, for your age and comfort with risk.</p>
        <div className="flex h-4 rounded-full overflow-hidden">
          {(['equity', 'debt', 'gold'] as const).map((k) => target[k] > 0 && (
            <div key={k} className={BUCKET_COLOR[k]} style={{ width: `${target[k]}%` }} title={`${BUCKET_LABEL[k]} ${target[k]}%`} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-ink-soft">
          {(['equity', 'debt', 'gold'] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${BUCKET_COLOR[k]}`} />{BUCKET_LABEL[k]} — <strong>{target[k]}%</strong>
            </span>
          ))}
        </div>
        {g.allocationGap?.length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-paper-100 pt-4">
            {g.allocationGap.map((s: string, i: number) => (
              <li key={i} className="flex gap-2 text-sm text-ink-soft leading-relaxed"><span className="text-mint-500 font-bold">·</span>{s}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Recommendations */}
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Your monthly plan, step by step</h2>
        <div className="space-y-3">
          {g.recommendations.map((r: any, i: number) => (
            <article key={i} className="card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <span className={`mt-1 inline-block w-2.5 h-2.5 rounded-full shrink-0 ${BUCKET_COLOR[r.bucket]}`} />
                  <div>
                    <h3 className="text-sm font-bold">{r.category}</h3>
                    <p className="text-xs text-ink-soft mt-1 leading-relaxed">{r.whatItIs}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-xl font-semibold tabular-nums">{inr(r.monthlyAmount)}<span className="text-xs text-ink-faint font-normal">/mo</span></p>
                  <p className="text-[11px] text-ink-faint">{r.allocationPct}% of plan</p>
                </div>
              </div>
              <div className="mt-3 ml-6 text-xs text-ink-soft leading-relaxed">
                <p><strong className="text-pine-800">Why for you:</strong> {r.whyForYou}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="chip bg-paper-100 text-ink-soft">{r.liquidity}</span>
                  <span className="chip bg-paper-100 text-ink-soft">Lock-in: {r.lockIn}</span>
                  <span className="chip bg-paper-100 text-ink-soft">{r.taxNote}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Model portfolios */}
      <section className="card p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-1">Ready-made model mixes</h2>
        <p className="text-xs text-ink-soft mb-4">Prefer a template? Pick the one that matches you — your profile suggests the highlighted one.</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {g.modelPortfolios.map((m: any) => (
            <div key={m.key} className={`rounded-xl border p-4 ${m.matchesYou ? 'border-pine-700 bg-pine-900/5' : 'border-paper-200'}`}>
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm">{m.name}</p>
                {m.matchesYou && <span className="chip bg-pine-900 text-white">For you</span>}
              </div>
              <p className="text-[11px] text-ink-faint mb-3">{m.tagline}</p>
              <ul className="space-y-1.5">
                {m.mix.map((x: any, j: number) => (
                  <li key={j} className="flex justify-between text-xs text-ink-soft"><span>{x.label}</span><span className="tabular-nums font-semibold">{x.pct}%</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* How to start + rebalance */}
      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">How to actually start</h2>
          <ol className="space-y-2.5 text-sm text-ink-soft leading-relaxed list-decimal list-inside">
            {g.startSteps.map((s: string, i: number) => <li key={i}>{s}</li>)}
          </ol>
        </section>
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Keeping it healthy</h2>
          <ul className="space-y-2.5 text-sm text-ink-soft leading-relaxed">
            {g.rebalanceNotes.map((s: string, i: number) => <li key={i} className="flex gap-2"><span className="text-mint-500 font-bold shrink-0">·</span>{s}</li>)}
          </ul>
        </section>
      </div>

      <p className="text-[11px] text-ink-faint leading-relaxed">{g.disclaimer}</p>
    </div>
  );
}
