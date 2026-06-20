'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get, post } from '@/lib/api';
import { inr, inrApprox } from '@/lib/format';
import { Donut, StackedBar, Dot, Disclosure, SectionNav, Section, StatTile, Pill, C } from '@/components/kit';
import { PortfolioXray } from '@/components/PortfolioXray';

const BUCKET_COLOR: Record<string, string> = { equity: C.pine700, debt: C.mint500, gold: C.amber };
const BUCKET_LABEL: Record<string, string> = { equity: 'Equity (growth)', debt: 'Debt (stability)', gold: 'Gold (cushion)' };
const RISK_LABEL: Record<string, string> = { conservative: 'Play it safe', moderate: 'Balanced', aggressive: 'Go for growth' };

export default function InvestPage() {
  const [g, setG] = useState<any>(null);
  const [err, setErr] = useState('');
  const [busyCat, setBusyCat] = useState('');
  function loadInvest() { get('/invest').then(setG).catch((e) => setErr(e.message)); }
  useEffect(() => { loadInvest(); }, []);

  async function markStarted(category: string, monthlyAmount: number) {
    setBusyCat(category);
    try { await post('/invest/started', { category, monthlyAmount }); loadInvest(); }
    catch (e: any) { setErr(e.message); } finally { setBusyCat(''); }
  }

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

  const t = g.targetAllocation;
  const donutData = (['equity', 'debt', 'gold'] as const).filter((k) => t[k] > 0).map((k) => ({ label: BUCKET_LABEL[k], value: t[k], color: BUCKET_COLOR[k] }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium">Where to invest</h1>
        <p className="text-sm text-ink-soft mt-1">A personalised, beginner-friendly plan — fund <em>categories</em>, never specific products.</p>
      </div>

      <SectionNav items={[{ id: 'plan', label: 'Your plan' }, { id: 'mix', label: 'Target mix' }, { id: 'funds', label: 'Monthly plan' }, { id: 'xray', label: 'Portfolio X-ray' }, { id: 'models', label: 'Templates' }, { id: 'start', label: 'How to start' }]} />

      {/* Guardrails */}
      {(g.emergencyFirst || g.highCostDebtFirst) && (
        <section className="card p-5 border-l-4 border-l-signal-amber space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-widest text-signal-amber">Do this first</h2>
          {g.highCostDebtFirst && <p className="text-sm text-ink-soft leading-relaxed">{g.debtMessage}</p>}
          {g.emergencyFirst && <p className="text-sm text-ink-soft leading-relaxed">{g.emergencyMessage}</p>}
          <Link href="/actions" className="inline-block text-sm font-semibold text-pine-700 hover:underline">See these in your action plan →</Link>
        </section>
      )}

      {/* Plan: investor type + investable */}
      <Section id="plan" title="Your plan at a glance">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card p-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Your investor type</p>
            <p className="font-display text-2xl font-medium mt-1 capitalize">{RISK_LABEL[g.riskProfile] || g.riskProfile}</p>
            <p className="text-sm text-ink-soft mt-2">{g.riskWasExplicit ? 'Based on the risk comfort you chose.' : 'Estimated from your age and situation.'}</p>
            <Link href="/settings" className="text-xs text-pine-700 underline mt-2 inline-block">Change in Settings →</Link>
          </div>
          <div className="card p-6">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Suggested to invest / month</p>
            <p className="font-display text-4xl font-semibold mt-1 tabular-nums text-pine-700">{inrApprox(g.monthlyInvestable)}</p>
            {g.surplus > 0 ? (
              <dl className="mt-4 space-y-1.5 text-sm border-t border-paper-100 pt-3">
                <div className="flex justify-between"><dt className="text-ink-soft">Monthly take-home</dt><dd className="tabular-nums font-medium">{inr(g.takeHome)}</dd></div>
                <div className="flex justify-between"><dt className="text-ink-soft">Typical expenses</dt><dd className="tabular-nums font-medium">−{inr(g.monthlyExpenses)}</dd></div>
                <div className="flex justify-between border-t border-paper-100 pt-1.5"><dt className="text-ink-soft">Free each month</dt><dd className="tabular-nums font-semibold">{inr(g.surplus)}</dd></div>
                {g.currentSip > 0 && <div className="flex justify-between"><dt className="text-ink-soft">You already invest</dt><dd className="tabular-nums font-medium text-signal-green">{inr(g.currentSip)}</dd></div>}
              </dl>
            ) : (
              <p className="text-sm text-ink-soft mt-2 leading-relaxed">{g.investableExplanation}</p>
            )}
            <p className="text-xs text-ink-faint mt-3">We suggest ~70% of what&apos;s free, keeping a buffer for surprises.</p>
          </div>
        </div>
      </Section>

      {/* Target mix donut */}
      <Section id="mix" title="Your target mix" hint="How to split each rupee you invest.">
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Donut data={donutData} size={172}>
              <p className="text-[10px] uppercase tracking-wider text-ink-faint">Equity</p>
              <p className="font-display text-2xl font-semibold">{t.equity}%</p>
            </Donut>
            <ul className="flex-1 w-full space-y-2.5">
              {(['equity', 'debt', 'gold'] as const).map((k) => t[k] > 0 && (
                <li key={k}>
                  <div className="flex justify-between text-sm mb-1"><span className="flex items-center gap-2"><Dot color={BUCKET_COLOR[k]} />{BUCKET_LABEL[k]}</span><span className="font-semibold tabular-nums">{t[k]}%</span></div>
                  <div className="h-2 bg-paper-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${t[k]}%`, background: BUCKET_COLOR[k] }} /></div>
                </li>
              ))}
            </ul>
          </div>
          {g.allocationGap?.length > 0 && (
            <ul className="mt-5 space-y-2 border-t border-paper-100 pt-4">
              {g.allocationGap.map((s: string, i: number) => (
                <li key={i} className="flex gap-2 text-sm text-ink-soft leading-relaxed"><span className="text-mint-500 font-bold">·</span>{s}</li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      {/* Recommendations — collapsible */}
      <Section id="funds" title="Your monthly plan, step by step" hint="Tap any item for the full why & how.">
        <div className="space-y-2.5">
          {g.recommendations.length === 0 && (
            <div className="card p-6 text-center text-sm text-ink-soft">You&apos;ve recorded all the suggestions in this plan. 🎉 Update your income or risk level in Settings to get a fresh plan.</div>
          )}
          {g.recommendations.map((r: any, i: number) => (
            <Disclosure key={i}
              left={<Dot color={BUCKET_COLOR[r.bucket]} />}
              title={r.category}
              subtitle={`${r.allocationPct}% of plan`}
              right={<span className="font-display text-lg font-semibold tabular-nums whitespace-nowrap">{inrApprox(r.monthlyAmount)}<span className="text-[11px] text-ink-faint font-normal">/mo</span></span>}
            >
              <p className="text-xs text-ink-soft leading-relaxed border-t border-paper-100 pt-3">{r.whatItIs}</p>
              <p className="text-xs text-pine-800 mt-2 leading-relaxed"><strong>Why for you:</strong> {r.whyForYou}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Pill tone="gray">{r.liquidity}</Pill>
                <Pill tone="gray">Lock-in: {r.lockIn}</Pill>
                <Pill tone="gray">{r.taxNote}</Pill>
              </div>
              <button onClick={() => markStarted(r.category, r.monthlyAmount)} disabled={busyCat === r.category}
                className="mt-3 rounded-full bg-mint-500 text-pine-950 px-4 py-1.5 text-xs font-bold hover:bg-mint-400 transition-colors disabled:opacity-50">
                {busyCat === r.category ? 'Saving…' : "✓ I've started this — add to my data"}
              </button>
              <p className="mt-1.5 text-[10px] text-ink-faint">Records it in your investments and removes it from this plan.</p>
            </Disclosure>
          ))}
        </div>
      </Section>

      {/* Portfolio X-ray */}
      <Section id="xray" title="Portfolio X-ray" hint="Already investing? Upload your holdings to see how diversified you really are.">
        <PortfolioXray />
      </Section>

      {/* Model portfolios */}
      <Section id="models" title="Ready-made templates" hint="Prefer a template? Your profile suggests the highlighted one.">
        <div className="grid sm:grid-cols-3 gap-4">
          {g.modelPortfolios.map((m: any) => {
            const bars = m.mix.map((x: any, j: number) => ({ label: x.label, value: x.pct, color: [C.pine700, C.mint500, C.pine500, C.amber, C.mint300][j % 5] }));
            return (
              <div key={m.key} className={`rounded-xl border p-4 ${m.matchesYou ? 'border-pine-700 bg-pine-900/5' : 'border-paper-200'}`}>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm">{m.name}</p>
                  {m.matchesYou && <Pill tone="pine">For you</Pill>}
                </div>
                <p className="text-[11px] text-ink-faint mb-3">{m.tagline}</p>
                <StackedBar data={bars} height={10} />
                <ul className="mt-3 space-y-1">
                  {m.mix.map((x: any, j: number) => (
                    <li key={j} className="flex justify-between text-xs text-ink-soft"><span className="flex items-center gap-1.5"><Dot color={bars[j].color} />{x.label}</span><span className="tabular-nums font-semibold">{x.pct}%</span></li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Start + rebalance */}
      <Section id="start" title="Make it happen">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">How to actually start</h3>
            <ol className="space-y-2.5 text-sm text-ink-soft leading-relaxed list-decimal list-inside">
              {g.startSteps.map((s: string, i: number) => <li key={i}>{s}</li>)}
            </ol>
          </div>
          <div className="card p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Keeping it healthy</h3>
            <ul className="space-y-2.5 text-sm text-ink-soft leading-relaxed">
              {g.rebalanceNotes.map((s: string, i: number) => <li key={i} className="flex gap-2"><span className="text-mint-500 font-bold shrink-0">·</span>{s}</li>)}
            </ul>
          </div>
        </div>
      </Section>

      <p className="text-[11px] text-ink-faint leading-relaxed">{g.disclaimer}</p>
    </div>
  );
}
