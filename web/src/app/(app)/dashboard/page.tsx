'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { swr, patch } from '@/lib/api';
import { inr, pct, DIMENSION_LABELS } from '@/lib/format';
import { ScoreGauge, DimensionBar } from '@/components/ScoreGauge';

export default function Dashboard() {
  const router = useRouter();
  const [score, setScore] = useState<any>(null);
  const [networth, setNetworth] = useState<any>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [aa, setAa] = useState<any>(null);
  const [hi, setHi] = useState(0); // growth horizon index 0/1/2
  const [monthly, setMonthly] = useState(25000); // "what if I invest" slider (₹/mo)
  const [briefing, setBriefing] = useState<any>(null);
  const [err, setErr] = useState('');

  async function load() {
    // Serve cached values instantly, then revalidate in the background.
    await Promise.all([
      swr('/score', setScore),
      swr('/networth', setNetworth),
      swr('/actions?status=pending', (a: any) => setActions(a.slice(0, 3))),
      swr('/aa/status', setAa),
    ]);
    swr('/alerts/briefing', setBriefing).catch(() => {});
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
  const growthOk = !!(networth?.growth?.available && networth.growth.horizons?.[hi]);
  const dimBlock = (
    <section className="card p-6">
      <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-2">Score dimensions</h2>
      <div className="grid sm:grid-cols-2 gap-x-8">
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
  );

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

      {/* Money Health Score + your opportunity — hero */}
      <div className="grid lg:grid-cols-5 gap-6 items-start">
        <section className="card p-6 lg:col-span-2 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute -top-14 -left-10 w-48 h-48 rounded-full bg-mint-500/10 blur-3xl pw-blob pointer-events-none" aria-hidden />
          <ScoreGauge score={score.score} size={240} />
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

        <div className="lg:col-span-3">
          {growthOk ? (() => {
            const g = networth.growth; const h = g.horizons[hi];
            const years = h.years;
            const rWith = (g.assumedReturnPct || 11) / 100;
            const rIdle = 0.035;
            const cur = g.current || 0;
            const lump = (p: number, r: number, n: number) => p * Math.pow(1 + r, n);
            const sipFV = (mp: number, r: number, n: number, step: number) => { let tot = 0, p = mp; const i = r / 12; for (let y = 0; y < n; y++) { for (let m = 0; m < 12; m++) tot = (tot + p) * (1 + i); p *= 1 + step; } return tot; };
            const withPW = lump(cur, rWith, years) + sipFV(monthly * 100, rWith, years, 0.08);
            const alone = lump(cur, rIdle, years);
            const uplift = Math.max(0, withPW - alone);
            const total = withPW || 1;
            const basePct = Math.max(4, Math.min(100, (alone / total) * 100));
            const upPct = Math.max(0, Math.min(100 - basePct, (uplift / total) * 100));
            return (
              <section className="card p-6 text-white overflow-hidden relative" style={{ background: 'linear-gradient(150deg,#07211D 0%,#0B2F2A 100%)' }}>
                <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-mint-500/10 blur-3xl pw-blob pointer-events-none" aria-hidden />
                <div className="relative">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-mint-300">Your {years}-year opportunity</p>
                    <div className="inline-flex rounded-full bg-white/10 p-1">
                      {g.horizons.map((x: any, i: number) => (
                        <button key={x.years} onClick={() => setHi(i)}
                          className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${hi === i ? 'bg-mint-500 text-pine-950' : 'text-white/70 hover:text-white'}`}>{x.years}y</button>
                      ))}
                    </div>
                  </div>

                  {/* What-if slider */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-white/55">If you invest</span>
                      <span className="font-display text-lg text-white tabular-nums">{inr(monthly * 100)}<span className="text-white/40 text-xs font-normal">/mo</span></span>
                    </div>
                    <input type="range" min={5000} max={100000} step={1000} value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} className="w-full mt-2 accent-mint-500 h-2 cursor-pointer" />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 items-stretch">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Going it alone</p>
                      <p className="font-display text-2xl sm:text-3xl font-semibold tabular-nums mt-1.5 text-white/70">{inr(alone)}</p>
                    </div>
                    <div className="rounded-2xl border-2 border-mint-500 bg-mint-500/10 p-5 relative shadow-[0_0_30px_-8px_rgba(47,188,155,0.6)]">
                      <span className="absolute -top-2.5 right-3 rounded-full bg-mint-500 text-pine-950 text-[11px] font-extrabold px-2.5 py-0.5">+{inr(uplift)}</span>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-mint-300">With PayWatch</p>
                      <p className="font-display text-2xl sm:text-3xl font-semibold tabular-nums mt-1.5 text-mint-300">{inr(withPW)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex h-3 rounded-full overflow-hidden bg-white/[0.06]">
                    <div className="bg-white/25" style={{ width: `${basePct}%`, transition: 'width .4s cubic-bezier(.16,1,.3,1)' }} />
                    <div className="bg-mint-500" style={{ width: `${upPct}%`, transition: 'width .4s cubic-bezier(.16,1,.3,1)', boxShadow: '0 0 16px rgba(47,188,155,.55)' }} />
                  </div>
                  <p className="mt-2.5 text-sm text-white/85"><strong className="text-mint-300">{inr(uplift)} more</strong> — same start, and the gap widens every year.</p>

                  <div className="mt-4 flex items-center gap-4 flex-wrap">
                    <Link href="/actions" className="inline-block rounded-full bg-mint-500 text-pine-950 px-5 py-2.5 text-sm font-bold hover:bg-mint-400 transition-colors">See how →</Link>
                    <details className="text-sm">
                      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden text-white/65 hover:text-white transition-colors">What moves the needle ▾</summary>
                      <ul className="mt-3 space-y-1.5">
                        {g.levers.map((l: string, i: number) => (
                          <li key={i} className="flex gap-2 text-sm text-white/85"><span className="text-mint-300 shrink-0">→</span>{l}</li>
                        ))}
                      </ul>
                    </details>
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs text-white/55">Your <strong className="text-white/85 capitalize">{g.riskAppetite}</strong> plan · ~{g.assumedReturnPct}%/yr</p>
                    <div className="inline-flex rounded-full bg-white/10 p-0.5">
                      {['conservative', 'moderate', 'aggressive'].map((r) => (
                        <button key={r} onClick={() => changeRisk(r)} disabled={savingRisk}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize transition-colors disabled:opacity-50 ${g.riskAppetite === r ? 'bg-mint-500 text-pine-950' : 'text-white/70 hover:text-white'}`}>
                          {r === 'conservative' ? 'Cautious' : r === 'aggressive' ? 'Aggressive' : 'Balanced'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <details className="mt-2 text-[10px] text-white/40">
                    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-white/60 transition-colors">Assumptions ▾</summary>
                    <p className="mt-1.5 leading-relaxed">Idle savings assumed ~3.5% vs your {g.riskAppetite} plan ~{g.assumedReturnPct}% a year, with a 10% annual step-up on what you invest. Illustration, not a guarantee — markets fluctuate. Nominal, before ~6% inflation.</p>
                  </details>
                </div>
              </section>
            );
          })() : dimBlock}
        </div>
      </div>

      {/* Score dimensions — below the score */}
      {growthOk && dimBlock}

      {/* Ask your CFO — spotlight */}
      <Link href="/ask" className="block group">
        <div className="card text-white p-5 sm:p-6 overflow-hidden relative hover:ring-2 hover:ring-mint-500/50 transition-all" style={{ background: 'linear-gradient(135deg,#0F3D34 0%,#134e43 55%,#177a67 125%)' }}>
          <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-mint-500/15 blur-3xl pw-blob pointer-events-none" aria-hidden />
          <div className="flex items-start gap-4 relative">
            <span className="hidden sm:flex shrink-0 items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-mint-400 to-mint-500 text-pine-950 shadow-lg shadow-mint-500/20">
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
