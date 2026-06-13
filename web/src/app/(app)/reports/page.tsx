'use client';

import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { inr, pct, DIMENSION_LABELS, CATEGORY_LABELS } from '@/lib/format';

export default function ReportsPage() {
  const [r, setR] = useState<any>(null);
  useEffect(() => { get('/reports/current').then(setR).catch(() => {}); }, []);
  if (!r) return <div className="card h-96 animate-pulse mt-4" />;

  const dims = Object.entries(r.score.dimensions) as [string, any][];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-end justify-between flex-wrap gap-3 no-print">
        <div>
          <h1 className="font-display text-3xl font-medium">Monthly report</h1>
          <p className="text-sm text-ink-soft mt-1">{r.month} · generated {new Date(r.generated_at).toLocaleDateString('en-IN')}</p>
        </div>
        <button onClick={() => window.print()} className="btn-secondary !py-2.5 text-xs">Download PDF</button>
      </div>

      {/* Cover */}
      <section className="card p-8 bg-pine-950 !border-0 text-white">
        <p className="text-mint-300 text-xs font-bold uppercase tracking-[0.2em]">PayWatch · Monthly Financial Report</p>
        <h2 className="font-display text-4xl mt-3">{r.month}</h2>
        <p className="text-white/60 text-sm mt-1">{r.user.name}{r.user.city ? ` · ${r.user.city}` : ''}</p>
        <div className="mt-8 flex items-end gap-6">
          <div>
            <p className="font-display text-6xl font-semibold text-mint-400">{r.score.current}</p>
            <p className="text-[11px] uppercase tracking-widest text-white/50 mt-1">Money Health Score</p>
          </div>
          {r.score.vs_last_month != null && (
            <p className="text-sm text-white/70 pb-2">{r.score.vs_last_month >= 0 ? '+' : ''}{r.score.vs_last_month} vs last month</p>
          )}
        </div>
      </section>

      {/* Snapshot */}
      <section className="card p-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-4">Financial snapshot</h3>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><dt className="text-xs text-ink-faint">Net worth</dt><dd className="font-bold font-display text-xl tabular-nums">{inr(r.snapshot.net_worth)}</dd></div>
          <div><dt className="text-xs text-ink-faint">Assets</dt><dd className="font-bold font-display text-xl tabular-nums">{inr(r.snapshot.total_assets)}</dd></div>
          <div><dt className="text-xs text-ink-faint">Liabilities</dt><dd className="font-bold font-display text-xl tabular-nums">{inr(r.snapshot.total_liabilities)}</dd></div>
          <div><dt className="text-xs text-ink-faint">Savings rate</dt><dd className="font-bold font-display text-xl tabular-nums">{pct(r.snapshot.savings_rate)}</dd></div>
        </dl>
      </section>

      {/* Dimensions */}
      <section className="card p-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-4">Score dimensions</h3>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
          {dims.map(([k, d]) => (
            <div key={k} className="flex justify-between text-sm border-b border-paper-100 py-2">
              <span>{DIMENSION_LABELS[k]}</span>
              <span className="font-bold tabular-nums">{d.available ? d.score : '—'}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Insight */}
      {r.insight_of_the_month && (
        <section className="card p-6 border-l-4 border-l-mint-500">
          <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-2">Insight of the month</h3>
          <p className="text-sm leading-relaxed">{r.insight_of_the_month}</p>
        </section>
      )}

      {/* Actions */}
      <section className="card p-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-4">Action report</h3>
        <p className="text-sm text-ink-soft mb-4">{r.actions.completed_this_month} completed this month · {r.actions.open} open</p>
        {r.actions.top_priorities.length > 0 && (
          <>
            <h4 className="text-xs font-bold text-pine-800 mb-2">Top priorities for next month</h4>
            <ol className="space-y-2">
              {r.actions.top_priorities.map((a: any, i: number) => (
                <li key={i} className="text-sm flex gap-3">
                  <span className="font-display font-semibold text-pine-700">{i + 1}.</span>
                  <span><strong>{a.title}</strong> <span className="text-ink-soft">— {a.impact_text}</span></span>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {/* Tax */}
      <section className="card p-6">
        <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Tax status — FY {r.tax.fy}</h3>
        <p className="text-sm leading-relaxed">{r.tax.reasoning}</p>
        <p className="text-sm text-ink-soft mt-2">Deductions in use: {inr(r.tax.deductions.used)}.</p>
      </section>

      {/* Goals */}
      {r.goals.length > 0 && (
        <section className="card p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-4">Goals progress</h3>
          <ul className="space-y-2">
            {r.goals.map((g: any) => (
              <li key={g.name} className="flex justify-between text-sm">
                <span>{g.name}</span>
                <span className={`font-semibold capitalize ${g.math.health === 'on_track' || g.math.health === 'achieved' ? 'text-signal-green' : g.math.health === 'at_risk' ? 'text-signal-amber' : 'text-signal-red'}`}>
                  {g.math.health.replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Spend */}
      {r.spend_by_category.length > 0 && (
        <section className="card p-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-4">Spending this month</h3>
          <ul className="space-y-1.5">
            {r.spend_by_category.map((s: any) => (
              <li key={s.category} className="flex justify-between text-sm">
                <span>{CATEGORY_LABELS[s.category] || s.category}</span>
                <span className="tabular-nums font-semibold">{inr(s.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-ink-faint leading-relaxed">{r.disclaimer}</p>
    </div>
  );
}
