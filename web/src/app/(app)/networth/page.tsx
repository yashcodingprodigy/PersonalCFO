'use client';

import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { inr, pct, CATEGORY_LABELS } from '@/lib/format';

const ALLOC_COLORS: Record<string, string> = {
  equity: '#16544B', debt: '#2FBC9B', realEstate: '#C77E1F', gold: '#D4A93B', cash: '#7C8782',
};
const ALLOC_LABELS: Record<string, string> = {
  equity: 'Equity', debt: 'Debt', realEstate: 'Real estate', gold: 'Gold', cash: 'Cash',
};

export default function NetWorthPage() {
  const [nw, setNw] = useState<any>(null);
  const [spend, setSpend] = useState<any>(null);

  useEffect(() => {
    get('/networth').then(setNw).catch(() => {});
    get('/spend/summary').then(setSpend).catch(() => {});
  }, []);

  if (!nw) return <div className="card h-96 animate-pulse mt-4" />;

  const allocTotal = Object.values(nw.allocation).reduce((s: number, v: any) => s + Number(v), 0) as number;
  const months = spend?.by_category ? Array.from(new Set<string>(spend.by_category.map((r: any) => r.month))).slice(0, 1) : [];
  const thisMonthSpend = spend?.by_category?.filter((r: any) => r.month === months[0]) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium">Net worth</h1>
        <p className="text-sm text-ink-soft mt-1">Assets minus liabilities — your complete financial picture.</p>
      </div>

      <section className="card p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Total net worth</p>
        <p className="font-display text-5xl font-semibold mt-2 tabular-nums">{inr(nw.netWorth)}</p>
        <p className="text-sm text-ink-soft mt-2">
          {inr(nw.totalAssets)} in assets · {inr(nw.totalLiabilities)} in liabilities · {pct(nw.liquidityRatio)} of assets are liquid
        </p>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Allocation */}
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-4">Asset allocation</h2>
          {allocTotal > 0 ? (
            <>
              <div className="flex h-4 rounded-full overflow-hidden">
                {Object.entries(nw.allocation).map(([k, v]: [string, any]) =>
                  Number(v) > 0 ? <div key={k} style={{ width: `${(Number(v) / allocTotal) * 100}%`, background: ALLOC_COLORS[k] }} title={ALLOC_LABELS[k]} /> : null
                )}
              </div>
              <ul className="mt-4 space-y-2">
                {Object.entries(nw.allocation).filter(([, v]: any) => Number(v) > 0).map(([k, v]: [string, any]) => (
                  <li key={k} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: ALLOC_COLORS[k] }} />{ALLOC_LABELS[k]}</span>
                    <span className="tabular-nums font-semibold">{inr(v)} <span className="text-ink-faint font-normal">({pct(Number(v) / allocTotal)})</span></span>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="text-sm text-ink-soft">Add assets in Settings to see your allocation.</p>}
        </section>

        {/* Holdings */}
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-4">Holdings</h2>
          <ul className="divide-y divide-paper-100">
            {nw.assets.map((a: any) => (
              <li key={a.label} className="flex justify-between py-2.5 text-sm">
                <span>{a.label} {a.liquid && <span className="chip bg-paper-100 text-ink-faint ml-1">liquid</span>}</span>
                <span className="tabular-nums font-semibold">{inr(a.value)}</span>
              </li>
            ))}
            {nw.liabilities.map((l: any) => (
              <li key={l.label} className="flex justify-between py-2.5 text-sm text-signal-red">
                <span>{l.label}</span>
                <span className="tabular-nums font-semibold">−{inr(l.value)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Spend analysis */}
      {thisMonthSpend.length > 0 && (
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-4">This month&apos;s spending</h2>
          <div className="space-y-2.5">
            {thisMonthSpend.map((r: any) => {
              const max = Number(thisMonthSpend[0].total);
              return (
                <div key={r.category} className="flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0 text-ink-soft">{CATEGORY_LABELS[r.category] || r.category}</span>
                  <div className="flex-1 h-5 bg-paper-100 rounded">
                    <div className="h-full rounded bg-pine-700/80" style={{ width: `${(Number(r.total) / max) * 100}%` }} />
                  </div>
                  <span className="w-20 text-right tabular-nums font-semibold">{inr(r.total)}</span>
                </div>
              );
            })}
          </div>
          {spend?.recurring?.length > 0 && (
            <div className="mt-6 border-t border-paper-100 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-ink-faint mb-2">Subscription audit — recurring charges detected</h3>
              <ul className="text-sm text-ink-soft space-y-1">
                {spend.recurring.map((s: any) => (
                  <li key={s.description} className="flex justify-between">
                    <span>{s.description}</span>
                    <span className="tabular-nums">{inr(s.avg_amount)}/mo · {inr(Number(s.avg_amount) * 12)}/yr</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
