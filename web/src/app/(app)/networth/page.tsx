'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api';
import { inr, pct, CATEGORY_LABELS } from '@/lib/format';
import { Donut, StackedBar, StatTile, Dot, Section, ALLOC_COLORS, C } from '@/components/kit';

const ALLOC_LABELS: Record<string, string> = {
  equity: 'Equity', debt: 'Debt', realEstate: 'Real estate', gold: 'Gold', cash: 'Cash',
};

export default function NetWorthPage() {
  const [nw, setNw] = useState<any>(null);
  const [spend, setSpend] = useState<any>(null);
  const [hi, setHi] = useState(0); // horizon index 0/1/2 → 5/10/20yr

  useEffect(() => {
    get('/networth').then(setNw).catch(() => {});
    get('/spend/summary').then(setSpend).catch(() => {});
  }, []);

  if (!nw) return <div className="card h-96 animate-pulse mt-4" />;

  const allocTotal = Object.values(nw.allocation).reduce((s: number, v: any) => s + Number(v), 0) as number;
  const donutData = Object.entries(nw.allocation)
    .filter(([, v]: any) => Number(v) > 0)
    .map(([k, v]: [string, any]) => ({ label: ALLOC_LABELS[k] || k, value: Number(v), color: ALLOC_COLORS[k] || C.inkFaint }));

  const months = spend?.by_category ? Array.from(new Set<string>(spend.by_category.map((r: any) => r.month))).slice(0, 1) : [];
  const thisMonthSpend = spend?.by_category?.filter((r: any) => r.month === months[0]) || [];

  const g = nw.growth;
  const horizon = g?.horizons?.[hi];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium">Net worth</h1>
        <p className="text-sm text-ink-soft mt-1">Assets minus liabilities — your complete financial picture.</p>
      </div>

      {/* Hero + allocation donut */}
      <div className="grid lg:grid-cols-5 gap-6">
        <section className="card p-7 lg:col-span-3 flex flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">Total net worth</p>
          <p className="font-display text-5xl font-semibold mt-2 tabular-nums">{inr(nw.netWorth)}</p>
          {nw.totalAssets + nw.totalLiabilities > 0 && (
            <div className="mt-5">
              <StackedBar data={[{ label: 'Assets', value: nw.totalAssets, color: C.pine700 }, { label: 'Liabilities', value: nw.totalLiabilities, color: C.amber }]} />
              <div className="mt-2.5 flex justify-between text-xs text-ink-soft">
                <span className="flex items-center gap-1.5"><Dot color={C.pine700} />Assets {inr(nw.totalAssets)}</span>
                <span className="flex items-center gap-1.5"><Dot color={C.amber} />Liabilities {inr(nw.totalLiabilities)}</span>
              </div>
            </div>
          )}
          <p className="text-xs text-ink-faint mt-4">{pct(nw.liquidityRatio)} of your assets are liquid (reachable within a day).</p>
        </section>

        <section className="card p-6 lg:col-span-2 flex flex-col items-center justify-center">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-faint mb-3 self-start">Asset allocation</p>
          {donutData.length > 0 ? (
            <>
              <Donut data={donutData} size={172}>
                <p className="text-[10px] uppercase tracking-wider text-ink-faint">Assets</p>
                <p className="font-display text-lg font-semibold tabular-nums">{inr(nw.totalAssets)}</p>
              </Donut>
              <ul className="mt-4 w-full space-y-1.5">
                {donutData.map((d) => (
                  <li key={d.label} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2"><Dot color={d.color} />{d.label}</span>
                    <span className="tabular-nums font-semibold">{pct(d.value / allocTotal)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="text-sm text-ink-soft self-start">Add assets in Settings to see your allocation.</p>}
        </section>
      </div>

      {/* Grow your net worth — horizon toggle */}
      {g?.available && horizon && (
        <Section id="grow" title="Grow your net worth" hint="Same starting point — the difference is a few habits."
          action={
            <div className="inline-flex rounded-full bg-paper-100 p-1">
              {g.horizons.map((h: any, i: number) => (
                <button key={h.years} onClick={() => setHi(i)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${hi === i ? 'bg-pine-900 text-white' : 'text-ink-soft'}`}>{h.years}y</button>
              ))}
            </div>
          }>
          <div className="card p-6 bg-pine-950 text-white">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-white/50">Do nothing</p>
                <p className="font-display text-3xl font-semibold tabular-nums mt-1">{inr(horizon.baseline)}</p>
                <div className="mt-2 h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-white/30" style={{ width: `${(horizon.baseline / horizon.improved) * 100}%` }} /></div>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-mint-300">Build these habits</p>
                <p className="font-display text-3xl font-semibold tabular-nums mt-1 text-mint-300">{inr(horizon.improved)}</p>
                <div className="mt-2 h-2 rounded-full bg-white/10"><div className="h-full rounded-full bg-mint-500" style={{ width: '100%' }} /></div>
              </div>
            </div>
            <p className="text-sm text-white/80 mt-4">In {horizon.years} years that&apos;s about <strong className="text-mint-300">{inr(horizon.uplift)} more</strong> — and the gap widens every year.</p>
            <ul className="mt-3 space-y-1.5">
              {g.levers.map((l: string, i: number) => (
                <li key={i} className="flex gap-2 text-sm text-white/90"><span className="text-mint-300 font-bold shrink-0">→</span>{l}</li>
              ))}
            </ul>
            <Link href="/actions" className="mt-4 inline-block rounded-full bg-mint-500 text-pine-950 px-5 py-2 text-sm font-bold hover:bg-mint-400 transition-colors">Show me how — go to my actions</Link>
          </div>
        </Section>
      )}

      {/* Holdings */}
      <Section id="holdings" title="Holdings" hint="Everything you own and owe.">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">Assets</p>
            <ul className="divide-y divide-paper-100">
              {nw.assets.map((a: any) => (
                <li key={a.label} className="flex justify-between py-2.5 text-sm">
                  <span>{a.label} {a.liquid && <span className="chip bg-paper-100 text-ink-faint ml-1">liquid</span>}</span>
                  <span className="tabular-nums font-semibold">{inr(a.value)}</span>
                </li>
              ))}
              {nw.assets.length === 0 && <li className="py-2.5 text-sm text-ink-soft">No assets added yet.</li>}
            </ul>
          </div>
          <div className="card p-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">Liabilities</p>
            <ul className="divide-y divide-paper-100">
              {nw.liabilities.map((l: any) => (
                <li key={l.label} className="flex justify-between py-2.5 text-sm text-signal-red">
                  <span>{l.label}</span>
                  <span className="tabular-nums font-semibold">−{inr(l.value)}</span>
                </li>
              ))}
              {nw.liabilities.length === 0 && <li className="py-2.5 text-sm text-signal-green">Debt-free — nothing owed. 🎉</li>}
            </ul>
          </div>
        </div>
      </Section>

      {/* Spend analysis */}
      {thisMonthSpend.length > 0 && (
        <Section id="spending" title="This month's spending" hint="Where your money went.">
          <div className="card p-6">
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
                <h3 className="text-xs font-bold uppercase tracking-widest text-ink-faint mb-2">Recurring charges detected</h3>
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
          </div>
        </Section>
      )}
    </div>
  );
}
