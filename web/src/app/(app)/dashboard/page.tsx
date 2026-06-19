'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { get, patch } from '@/lib/api';
import { inr, pct, DIMENSION_LABELS } from '@/lib/format';
import { ScoreGauge, DimensionBar } from '@/components/ScoreGauge';

export default function Dashboard() {
  const router = useRouter();
  const [score, setScore] = useState<any>(null);
  const [networth, setNetworth] = useState<any>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [aa, setAa] = useState<any>(null);
  const [hi, setHi] = useState(0); // growth horizon index 0/1/2
  const [briefing, setBriefing] = useState<any>(null);
  const [err, setErr] = useState('');

  async function load() {
    const [s, n, a, st] = await Promise.all([
      get('/score'), get('/networth'), get('/actions?status=pending'), get('/aa/status'),
    ]);
    setScore(s); setNetworth(n); setActions(a.slice(0, 3)); setAa(st);
    get('/alerts/briefing').then(setBriefing).catch(() => {});
  }
  useEffect(() => { load().catch((e) => setErr(e.message)); }, []);

  const [savingRisk, setSavingRisk] = useState(false);
  async function changeRisk(r: string) {
    setSavingRisk(true);
    try { await patch('/user/me', { risk_appetite: r }); await load(); }
    catch (e: any) { setErr(e.message); } finally { setSavingRisk(false); }
  }

  if (err) return <p className="text-signal-red text-sm mt-8">{err}</p>;
  if (!score) return <DashSkeleton />;

  const dims = Object.entries(score.dimensions) as [string, any][];
  const unavailable = dims.filter(([, d]) => !d.available);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">Overview</h1>
          <p className="text-sm text-ink-soft mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        {!aa?.linked && (
          <div className="text-right">
            <Link href="/statement" className="btn-secondary text-xs !px-4 !py-2 inline-block">Upload bank statement →</Link>
            <p className="text-[10px] text-ink-faint mt-1">Auto bank sync coming soon — for now, upload a statement</p>
          </div>
        )}
      </div>

      {/* Ask your CFO — spotlight */}
      <Link href="/ask" className="block group">
        <div className="card bg-pine-950 text-white p-5 sm:p-6 overflow-hidden relative hover:ring-2 hover:ring-mint-500/50 transition-all">
          <div className="flex items-start gap-4">
            <span className="hidden sm:flex shrink-0 items-center justify-center w-12 h-12 rounded-full bg-mint-500 text-pine-950">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M4 4h16v12H7l-3 3V4Zm4 5h8v2H8V9Z" /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-mint-300">Ask PayWatch · AI</span>
              </div>
              <h2 className="font-display text-xl font-semibold mt-1">Have a money question? Ask PayWatch.</h2>
              <p className="text-sm text-white/70 mt-1 leading-relaxed">PayWatch knows your income, net worth, score and gaps — and answers in plain English, with your own numbers.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Which tax regime saves me more?', 'Is my term cover enough?', 'Should I prepay my loan or invest?'].map((q) => (
                  <span key={q} onClick={(e) => { e.preventDefault(); router.push(`/ask?q=${encodeURIComponent(q)}`); }}
                    className="rounded-full bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 text-xs text-white/90 transition-colors">
                    {q}
                  </span>
                ))}
              </div>
            </div>
            <span className="hidden sm:inline self-center text-mint-300 group-hover:translate-x-0.5 transition-transform">→</span>
          </div>
        </div>
      </Link>

      {/* Monthly briefing */}
      {briefing && (
        <section className="card p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">{briefing.month} · your money this month</h2>
            <Link href="/alerts" className="text-sm font-semibold text-pine-700 hover:underline">
              {briefing.openAlerts > 0 ? `${briefing.openAlerts} alert${briefing.openAlerts > 1 ? 's' : ''} →` : 'All clear →'}
            </Link>
          </div>
          <div className="mt-4 grid sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-paper-50 border border-paper-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">This month, invest</p>
              <p className="font-display text-2xl font-semibold tabular-nums mt-1 text-pine-700">{inr(briefing.investThisMonth)}</p>
              <Link href="/invest" className="text-[11px] text-pine-700 underline">where to put it →</Link>
            </div>
            <div className="rounded-xl bg-paper-50 border border-paper-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Your #1 move</p>
              <p className="text-sm font-semibold mt-1 line-clamp-2">{briefing.topAction?.title || 'You\'re on track — nothing pressing.'}</p>
              {briefing.topAction && <Link href="/actions" className="text-[11px] text-pine-700 underline">do it →</Link>}
            </div>
            <div className="rounded-xl bg-paper-50 border border-paper-200 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Next deadline</p>
              {briefing.nextDeadline ? (
                <>
                  <p className="text-sm font-semibold mt-1 line-clamp-2">{briefing.nextDeadline.title}</p>
                  <p className="text-[11px] text-signal-amber">by {new Date(briefing.nextDeadline.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                </>
              ) : <p className="text-sm text-ink-soft mt-1">Nothing urgent ahead.</p>}
            </div>
          </div>
        </section>
      )}

      {/* Net-worth growth incentive */}
      {networth?.growth?.available && networth.growth.horizons?.[hi] && (() => {
        const g = networth.growth; const h = g.horizons[hi];
        return (
          <section className="card p-6 bg-pine-950 text-white overflow-hidden relative">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-mint-300">Your {h.years}-year opportunity</p>
              <div className="inline-flex rounded-full bg-white/10 p-1">
                {g.horizons.map((x: any, i: number) => (
                  <button key={x.years} onClick={() => setHi(i)}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${hi === i ? 'bg-mint-500 text-pine-950' : 'text-white/70 hover:text-white'}`}>{x.years}y</button>
                ))}
              </div>
            </div>
            <p className="mt-2 text-xs text-white/55">Starting from your net worth today, <strong className="text-white/80">{inr(g.current)}</strong>, here&apos;s where {h.years} years takes you:</p>

            <div className="mt-4 grid grid-cols-2 gap-3 items-stretch">
              {/* If nothing changes */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">If nothing changes</p>
                <p className="font-display text-2xl sm:text-3xl font-semibold tabular-nums mt-1.5 text-white/70">{inr(h.baseline)}</p>
                <p className="text-[11px] text-white/35 mt-1">going it alone</p>
              </div>
              {/* With PayWatch */}
              <div className="rounded-2xl border-2 border-mint-500 bg-mint-500/10 p-5 relative shadow-[0_0_30px_-8px_rgba(47,188,155,0.6)]">
                <span className="absolute -top-2.5 right-3 rounded-full bg-mint-500 text-pine-950 text-[11px] font-extrabold px-2.5 py-0.5">+{inr(h.uplift)}</span>
                <p className="text-[10px] font-bold uppercase tracking-wider text-mint-300">With PayWatch</p>
                <p className="font-display text-2xl sm:text-3xl font-semibold tabular-nums mt-1.5 text-mint-300">{inr(h.improved)}</p>
                <p className="text-[11px] text-white/55 mt-1">following your plan</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-white/85 leading-snug">
              Same starting point — about <strong className="text-mint-300">{inr(h.uplift)} more</strong> in {h.years} years by investing more of what you earn, instead of letting it sit. And the gap widens every year after.
            </p>

            <ul className="mt-3 space-y-1.5">
              {g.levers.map((l: string, i: number) => (
                <li key={i} className="flex gap-2 text-sm text-white/90"><span className="text-mint-300 font-bold shrink-0">→</span>{l}</li>
              ))}
            </ul>
            <Link href="/actions" className="mt-4 inline-block rounded-full bg-mint-500 text-pine-950 px-5 py-2.5 text-sm font-bold hover:bg-mint-400 transition-colors">
              Show me how — go to my actions
            </Link>

            {/* Risk-based return assumption + change control */}
            <div className="mt-5 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-white/60">Based on your <strong className="text-white/85 capitalize">{g.riskAppetite}</strong> risk level — assumes <strong className="text-white/85">~{g.assumedReturnPct}% a year</strong>.</p>
                <div className="inline-flex rounded-full bg-white/10 p-0.5">
                  {['conservative', 'moderate', 'aggressive'].map((r) => (
                    <button key={r} onClick={() => changeRisk(r)} disabled={savingRisk}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize transition-colors disabled:opacity-50 ${g.riskAppetite === r ? 'bg-mint-500 text-pine-950' : 'text-white/70 hover:text-white'}`}>
                      {r === 'conservative' ? 'Cautious' : r === 'aggressive' ? 'Aggressive' : 'Balanced'}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-[10px] text-white/40 leading-relaxed">
                Change your risk level to see how the projection shifts (cautious ~7% · balanced ~9% · aggressive ~11% a year). Illustration, not a guarantee — markets fluctuate and returns aren&apos;t guaranteed. &ldquo;If nothing changes&rdquo; continues your current investing; the plan assumes you invest ~25% of take-home. Figures are nominal, before ~6% inflation.
              </p>
            </div>
          </section>
        );
      })()}

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Score card */}
        <section className="card p-6 lg:col-span-2 flex flex-col items-center text-center">
          <ScoreGauge score={score.score} />
          {score.change_since_last_month != null && score.change_since_last_month !== 0 && (
            <p className={`text-sm font-semibold ${score.change_since_last_month > 0 ? 'text-signal-green' : 'text-signal-red'}`}>
              {score.change_since_last_month > 0 ? '▲' : '▼'} {Math.abs(score.change_since_last_month)} points since last month
            </p>
          )}
          <p className="text-xs text-ink-faint mt-3 leading-relaxed max-w-xs">
            Your score across six dimensions of financial health, measured against standard planning benchmarks.
          </p>
          {unavailable.length > 0 && (
            <Link href="/settings" className="mt-3 text-xs text-pine-700 underline">
              {unavailable.length} dimension{unavailable.length > 1 ? 's' : ''} locked — add missing data
            </Link>
          )}
        </section>

        {/* Dimensions */}
        <section className="card p-6 lg:col-span-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-2">Score dimensions</h2>
          <div className="divide-y divide-paper-100">
            {dims.map(([key, d]) =>
              d.available ? (
                <DimensionBar key={key} label={DIMENSION_LABELS[key] || key} score={d.score} explanation={d.explanation} />
              ) : (
                <div key={key} className="py-3 opacity-50">
                  <div className="flex justify-between"><span className="text-sm font-semibold">{DIMENSION_LABELS[key]}</span><span className="text-xs">locked</span></div>
                  <p className="text-xs text-ink-soft mt-1">{d.explanation}</p>
                </div>
              )
            )}
          </div>
        </section>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Net worth summary */}
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">Net worth</h2>
          <p className="font-display text-4xl font-semibold mt-3 tabular-nums">{inr(networth?.netWorth)}</p>
          <div className="mt-4 flex h-2.5 rounded-full overflow-hidden bg-paper-100">
            {networth && networth.totalAssets > 0 && (
              <div className="bg-pine-700" style={{ width: `${(networth.totalAssets / (networth.totalAssets + networth.totalLiabilities)) * 100}%` }} />
            )}
            {networth && networth.totalLiabilities > 0 && (
              <div className="bg-signal-amber" style={{ width: `${(networth.totalLiabilities / (networth.totalAssets + networth.totalLiabilities)) * 100}%` }} />
            )}
          </div>
          <div className="mt-3 flex justify-between text-xs text-ink-soft">
            <span><span className="inline-block w-2 h-2 rounded-full bg-pine-700 mr-1.5" />Assets {inr(networth?.totalAssets)}</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-signal-amber mr-1.5" />Liabilities {inr(networth?.totalLiabilities)}</span>
          </div>
          {networth?.months_to_1cr != null && networth.netWorth < 1000000000 && (
            <p className="mt-4 text-xs text-ink-soft leading-relaxed border-t border-paper-100 pt-3">
              At your current savings rate, you reach <strong>₹1 Cr</strong> in about{' '}
              <strong>{Math.floor(networth.months_to_1cr / 12)}y {networth.months_to_1cr % 12}m</strong>.
            </p>
          )}
          <Link href="/networth" className="mt-4 inline-block text-sm font-semibold text-pine-700 hover:underline">Full breakdown →</Link>
        </section>

        {/* Top actions */}
        <section className="card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">Your next moves</h2>
            <Link href="/actions" className="text-sm font-semibold text-pine-700 hover:underline">All actions →</Link>
          </div>
          <div className="mt-3 space-y-3">
            {actions.length === 0 && (
              <p className="text-sm text-ink-soft py-6 text-center">No pending actions — your plan is clear. Check back after your next data refresh.</p>
            )}
            {actions.map((a) => (
              <Link key={a.action_id} href="/actions" className="block rounded-xl border border-paper-200 p-4 hover:shadow-card transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-ink-soft mt-1 line-clamp-2">{a.impact_text}</p>
                  </div>
                  <span className="chip bg-mint-100 text-pine-800 shrink-0">+{a.impact_score} pts</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <span className="chip bg-paper-100 text-ink-soft capitalize">{a.category}</span>
                  <span className="chip bg-paper-100 text-ink-soft capitalize">{a.difficulty}</span>
                  {a.deadline && <span className="chip bg-signal-amber/10 text-signal-amber">by {new Date(a.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <p className="text-[11px] text-ink-faint leading-relaxed max-w-3xl">
        PayWatch provides financial education and organisation based on your data and published planning
        standards. It is not SEBI-registered investment advice. Scores and projections are estimates, not guarantees.
      </p>
    </div>
  );
}

function DashSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-9 w-44 bg-paper-200 rounded" />
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="card h-80 lg:col-span-2" /><div className="card h-80 lg:col-span-3" />
      </div>
      <div className="grid lg:grid-cols-3 gap-6"><div className="card h-56" /><div className="card h-56 lg:col-span-2" /></div>
    </div>
  );
}
