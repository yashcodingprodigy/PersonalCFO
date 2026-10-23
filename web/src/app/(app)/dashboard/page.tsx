'use client';

// Overview — "sell the dream". The page reads as a story, top to bottom:
//   1. Hero: your money brain (live 3D) + how many dreams are on track
//   2. Your dreams — each one illustrated, with its own plan and date
//   3. Where your money goes every month (the river the brain planned)
//   4. While you were away (what the brain did on its own) + next moves
//   5. Future you (growth projection) and the numbers behind it
// Nothing here needs manual upkeep: it refreshes whenever data or the assistant changes something.

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { swr, patch, post } from '@/lib/api';
import { inr } from '@/lib/format';
import { useLang } from '@/lib/i18n';
import { useAssistant, DATA_CHANGED } from '@/components/assistant/Assistant';
import { NextMoves } from '@/components/NextMoves';
import { ScoreGauge } from '@/components/ScoreGauge';
import { DreamCard, MoneyFlow, AwayFeed, Reveal, Tilt, CountUp } from '@/components/overview/parts';

const BrainScene = dynamic(() => import('@/components/overview/BrainScene').then((m) => m.BrainScene), {
  ssr: false,
  loading: () => <div className="w-full h-full grid place-items-center"><span className="relative w-40 h-40 rounded-full pw-orb" /></div>,
});

export default function Dashboard() {
  const { t, lang } = useLang();
  const assistant = useAssistant();
  const [me, setMe] = useState<any>(null);
  const [brain, setBrain] = useState<any>(null);
  const [score, setScore] = useState<any>(null);
  const [networth, setNetworth] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [aa, setAa] = useState<any>(null);
  const [pulse, setPulse] = useState(0);
  const [afford, setAfford] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    await Promise.all([
      swr(`/brain?lang=${lang}`, setBrain),
      swr('/score', setScore),
      swr('/user/me', setMe).catch(() => {}),
    ]);
    swr('/networth', setNetworth).catch(() => {});
    swr('/brain/activity?limit=8', (a: any) => setActivity(Array.isArray(a) ? a : [])).catch(() => {});
    swr('/aa/status', setAa).catch(() => {});
  }, [lang]);

  useEffect(() => { load().catch((e) => setErr(e.message)); }, [load]);
  // A dream typed on the home page before signing in → captured into a real plan now.
  useEffect(() => {
    let text = '';
    try { text = localStorage.getItem('paywatch_pending_dream') || ''; localStorage.removeItem('paywatch_pending_dream'); } catch {}
    if (!text) return;
    const q = /want|wanna|chahiye|chahta|chahti|lena|jana|चाहिए|लेना|जाना|चाहता|चाहती/i.test(text) ? text : `I want ${text}`;
    post('/brain/capture', { text: q, source: 'landing' })
      .then((r: any) => (r?.captured ? window.dispatchEvent(new Event(DATA_CHANGED)) : assistant.open('chat', text)))
      .catch(() => assistant.open('chat', text));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // The assistant captured a dream / changed data → refresh + pulse the brain.
  useEffect(() => {
    const on = () => { setPulse((p) => p + 1); load().catch(() => {}); setTimeout(() => load().catch(() => {}), 2500); };
    window.addEventListener(DATA_CHANGED, on);
    return () => window.removeEventListener(DATA_CHANGED, on);
  }, [load]);

  if (err) return <p className="text-signal-red text-sm mt-8">{err}</p>;
  if (!brain && !score) return <OverviewSkeleton />;

  const items: any[] = brain?.plan?.items || [];
  const dreams = items.filter((i) => !i.virtual);
  const onTrack = dreams.filter((d) => d.status === 'on_track' || d.status === 'achieved').length;
  const planets = items.filter((i) => i.id !== 'virtual-future').map((d) => ({
    id: d.id, name: d.name, status: d.status,
    progress: d.adjustedTarget > 0 ? Math.min(1, (d.saved || 0) / d.adjustedTarget) : 0,
  }));
  const firstName = (me?.name || '').split(' ')[0];
  const n = dreams.length;
  const headline = !n ? t('ov.noDreams')
    : onTrack === n ? (n === 1 ? t('ov.h.oneOk') : t('ov.h.allOk', { n }))
    : onTrack === 0 ? (n === 1 ? t('ov.h.oneHelp') : t('ov.h.noneOk', { n }))
    : t('ov.dreamsOnTrack', { k: onTrack, n });
  const ask = (q: string) => assistant.open('chat', q);

  return (
    <div className="space-y-16 md:space-y-24 pb-6">
      {/* ── 1 · HERO ───────────────────────────────────────────────────── */}
      <section className="pw-bleed relative -mt-16 md:-mt-8 overflow-hidden text-white pw-voice-bg md:rounded-bl-[2.5rem]">
        <div className="absolute inset-0 opacity-60 pointer-events-none" aria-hidden
          style={{ background: 'radial-gradient(60% 50% at 80% 30%, rgba(47,188,155,.25), transparent 70%), radial-gradient(40% 40% at 10% 90%, rgba(70,201,224,.18), transparent 70%)' }} />
        <div className="relative grid lg:grid-cols-[1.05fr_1fr] items-center min-h-[560px] md:min-h-[620px]">
          <div className="px-6 sm:px-10 pt-24 md:pt-16 pb-6 lg:pb-16 z-10 pw-fade-up">
            <p className="text-[11px] font-bold uppercase tracking-[.25em] text-mint-300">{t('ov.kicker')}</p>
            <p className="mt-5 text-white/70 text-lg">{t('ov.hi')}{firstName ? `, ${firstName}` : ''} 👋</p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl leading-[1.05] mt-2 pw-hero-glow">{headline}</h1>
            <p className="mt-5 text-white/70 text-base sm:text-lg max-w-md leading-relaxed">{dreams.length ? t('ov.brainWorking') : t('ov.brainIdle')}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => assistant.open('voice')} className="group inline-flex items-center gap-3 rounded-full bg-mint-500 text-pine-950 pl-2 pr-6 py-2 font-bold hover:bg-mint-400 transition-all hover:shadow-[0_0_40px_-6px_rgba(47,188,155,.8)]">
                <span className="w-9 h-9 rounded-full pw-orb-mini" />{t('ov.tellDream')}
              </button>
              <form onSubmit={(e) => { e.preventDefault(); if (afford.trim()) { ask(`${t('ov.canIAfford').replace('?', '')} ${afford.trim()}?`); setAfford(''); } }}
                className="flex items-center rounded-full bg-white/10 border border-white/15 backdrop-blur pl-4 pr-1.5 py-1.5 focus-within:border-mint-400 transition-colors">
                <span className="text-sm text-white/60 mr-2 whitespace-nowrap">{t('ov.canIAfford')}</span>
                <input value={afford} onChange={(e) => setAfford(e.target.value)} placeholder={t('ov.affordPh')} data-no-translate
                  className="bg-transparent outline-none text-sm placeholder:text-white/35 w-36 sm:w-44" />
                <button className="rounded-full bg-white text-pine-950 text-xs font-bold px-3.5 py-2">{t('ov.affordGo')}</button>
              </form>
            </div>

            {brain?.plan?.hasData && (
              <div className="mt-10 grid grid-cols-3 gap-3 max-w-md">
                <HeroStat label={t('ov.guiltFree')} value={brain.plan.joyBudget} suffix={t('ov.perMonth')} />
                <HeroStat label={t('ov.setAside')} value={brain.plan.earmarkedTotal || 0} />
                <HeroStat label={t('ov.flow.safety')} value={brain.map?.liquid || 0} />
              </div>
            )}
          </div>
          <BrainScene planets={planets} pulseKey={pulse} className="h-[360px] sm:h-[440px] lg:h-[620px] w-full -mt-4 lg:mt-0" />
        </div>
        <p className="relative text-center text-[11px] text-white/40 pb-5 tracking-wider">{t('ov.scroll')} ↓</p>
      </section>

      {/* ── 2 · DREAMS ─────────────────────────────────────────────────── */}
      <section>
        <Reveal className="flex items-end justify-between flex-wrap gap-3 mb-6">
          <div>
            <h2 className="font-display text-3xl sm:text-4xl">{t('ov.yourDreams')}</h2>
            <p className="text-ink-soft mt-1.5">{t('ov.yourDreamsSub')}</p>
          </div>
          <Link href="/goals" className="text-sm font-semibold text-pine-700 hover:underline">{t('ov.seeAll')} →</Link>
        </Reveal>
        <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {dreams.map((d) => <DreamCard key={d.id} d={d} onOpen={() => ask(lang === 'hi' ? `मेरा "${d.name}" सपना कैसे चल रहा है?` : `How is my "${d.name}" dream doing?`)} />)}
          <Tilt className="rounded-3xl border-2 border-dashed border-paper-200 hover:border-mint-500 bg-paper-50 min-h-[260px] cursor-pointer transition-colors" onClick={() => assistant.open('chooser')}>
            <div className="h-full min-h-[260px] grid place-items-center text-center p-6">
              <div>
                <span className="mx-auto block w-16 h-16 rounded-full pw-orb-mini pw-float-y" />
                <p className="font-display text-xl mt-4">{t('ov.addDream')}</p>
                <p className="text-xs text-ink-faint mt-1.5 max-w-[220px] mx-auto">{t('ov.brainIdle')}</p>
              </div>
            </div>
          </Tilt>
        </Reveal>
      </section>

      {/* ── 3 · MONEY RIVER ────────────────────────────────────────────── */}
      {brain?.map?.hasData && (
        <section className="card p-6 sm:p-10 overflow-hidden relative">
          <div className="absolute -top-24 -right-20 w-72 h-72 rounded-full bg-mint-500/10 blur-3xl pointer-events-none" aria-hidden />
          <Reveal>
            <h2 className="font-display text-3xl">{t('ov.flowTitle')}</h2>
            <p className="text-ink-soft mt-1.5 mb-6">{t('ov.flowSub')}</p>
          </Reveal>
          <MoneyFlow map={brain.map} plan={brain.plan} />
        </section>
      )}

      {/* ── 4 · AUTOPILOT + NEXT MOVES ─────────────────────────────────── */}
      <section className="grid lg:grid-cols-5 gap-6 items-start">
        <Reveal className="lg:col-span-2 card p-6">
          <div className="flex items-center gap-2.5">
            <span className="relative flex w-2.5 h-2.5"><span className="absolute inset-0 rounded-full bg-mint-500 animate-ping opacity-60" /><span className="relative w-2.5 h-2.5 rounded-full bg-mint-500" /></span>
            <h2 className="font-display text-2xl">{t('ov.away')}</h2>
          </div>
          <p className="text-sm text-ink-soft mt-1 mb-5">{t('ov.awaySub')}</p>
          <AwayFeed items={activity} />
        </Reveal>
        <Reveal className="lg:col-span-3">
          <NextMoves brain={brain} />
        </Reveal>
      </section>

      {/* ── 5 · FUTURE YOU + NUMBERS ───────────────────────────────────── */}
      <section>
        <Reveal className="mb-6">
          <h2 className="font-display text-3xl sm:text-4xl">{t('ov.future')}</h2>
          <p className="text-ink-soft mt-1.5">{t('ov.futureSub')}</p>
        </Reveal>
        <div className="grid lg:grid-cols-5 gap-6 items-start">
          <Reveal className="lg:col-span-3"><FutureYou networth={networth} onRisk={async (r) => { await patch('/user/me', { risk_appetite: r }); await load(); }} /></Reveal>
          <Reveal stagger className="lg:col-span-2 grid gap-6">
            {score && (
              <Tilt max={6} className="card p-6 flex items-center gap-5">
                <div className="shrink-0 -my-4"><ScoreGauge score={score.score} size={140} /></div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint">{t('ov.health')}</p>
                  {score.change_since_last_month ? (
                    <p className={`text-sm font-semibold mt-1 ${score.change_since_last_month > 0 ? 'text-signal-green' : 'text-signal-red'}`}>
                      {score.change_since_last_month > 0 ? '▲' : '▼'} {Math.abs(score.change_since_last_month)}
                    </p>
                  ) : null}
                  <Link href="/actions" className="mt-2 inline-block text-xs font-bold text-pine-700">{t('ov.seeAll')} →</Link>
                </div>
              </Tilt>
            )}
            {networth && (
              <Tilt max={6} className="card p-6">
                <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint">{t('ov.networth')}</p>
                <p className="font-display text-4xl font-semibold mt-2 tabular-nums"><CountUp value={networth.netWorth || 0} format={(n) => inr(n)} /></p>
                <div className="mt-4 flex h-2 rounded-full overflow-hidden bg-paper-100">
                  {networth.totalAssets > 0 && <div className="bg-pine-700" style={{ width: `${(networth.totalAssets / ((networth.totalAssets + networth.totalLiabilities) || 1)) * 100}%` }} />}
                  {networth.totalLiabilities > 0 && <div className="bg-signal-amber" style={{ width: `${(networth.totalLiabilities / (networth.totalAssets + networth.totalLiabilities)) * 100}%` }} />}
                </div>
                <Link href="/networth" className="mt-4 inline-block text-xs font-bold text-pine-700">{t('ov.seeAll')} →</Link>
              </Tilt>
            )}
            {!aa?.linked && (
              <Link href="/statement" className="card p-5 flex items-center justify-between gap-3 hover:shadow-lift transition-shadow">
                <span className="text-sm font-semibold">Upload a bank statement — the brain re-plans automatically</span>
                <span className="text-pine-700">→</span>
              </Link>
            )}
          </Reveal>
        </div>
      </section>

      <p className="text-[11px] text-ink-faint leading-relaxed max-w-3xl">
        PayWatch provides financial education and organisation based on your data and published planning
        standards. It is not SEBI-registered investment advice. Plans, dates and projections are estimates, not guarantees.
      </p>
    </div>
  );
}

function HeroStat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.06] border border-white/10 px-3 py-3 backdrop-blur-sm">
      <p className="text-[10px] uppercase tracking-wider text-white/45 leading-tight line-clamp-1">{label}</p>
      <p className="font-display text-lg sm:text-xl mt-1 tabular-nums text-mint-300"><CountUp value={value} format={(n) => inr(n)} /><span className="text-[10px] text-white/40">{suffix}</span></p>
    </div>
  );
}

/* Growth projection: do-nothing vs with a plan (kept from the previous Overview). */
function FutureYou({ networth, onRisk }: { networth: any; onRisk: (r: string) => Promise<void> }) {
  const [hi, setHi] = useState(1);
  const [monthly, setMonthly] = useState(25000);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { const rec = networth?.growth?.improvedSurplus; if (!touched && rec) setMonthly(Math.round(rec / 100)); }, [networth, touched]);
  const g = networth?.growth;
  if (!g?.available || !g.horizons?.length) return <div className="card p-6 text-sm text-ink-soft">Add your income and savings in Settings to see what your future looks like.</div>;
  const h = g.horizons[Math.min(hi, g.horizons.length - 1)];
  const years = h.years, rWith = (g.assumedReturnPct || 11) / 100, rIdle = 0.035, cur = g.current || 0;
  const recRaw = Math.round((g.improvedSurplus || 0) / 100);
  const sliderMax = Math.max(100000, Math.ceil(recRaw / 1000) * 1000);
  const lump = (p: number, r: number, n: number) => p * Math.pow(1 + r, n);
  const sipFV = (mp: number, r: number, n: number, step: number) => { let tot = 0, p = mp; const i = r / 12; for (let y = 0; y < n; y++) { for (let m = 0; m < 12; m++) tot = (tot + p) * (1 + i); p *= 1 + step; } return tot; };
  const withPW = lump(cur, rWith, years) + sipFV(monthly * 100, rWith, years, 0.08);
  const alone = lump(cur, rIdle, years);
  const uplift = Math.max(0, withPW - alone);
  const basePct = Math.max(4, Math.min(100, (alone / (withPW || 1)) * 100));
  return (
    <section className="rounded-3xl p-6 sm:p-8 text-white overflow-hidden relative" style={{ background: 'linear-gradient(150deg,#07211D 0%,#0B2F2A 100%)' }}>
      <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-mint-500/10 blur-3xl pw-blob pointer-events-none" aria-hidden />
      <div className="relative">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-mint-300">In {years} years</p>
          <div className="inline-flex rounded-full bg-white/10 p-1">
            {g.horizons.map((x: any, i: number) => (
              <button key={x.years} onClick={() => setHi(i)} className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${hi === i ? 'bg-mint-500 text-pine-950' : 'text-white/70 hover:text-white'}`}>{x.years}y</button>
            ))}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs text-white/55">If you invest</span>
          <span className="font-display text-lg tabular-nums">{inr(monthly * 100)}<span className="text-white/40 text-xs">/mo</span></span>
        </div>
        <input type="range" min={5000} max={sliderMax} step={1000} value={Math.min(monthly, sliderMax)} onChange={(e) => { setTouched(true); setMonthly(Number(e.target.value)); }} className="w-full mt-2 accent-mint-500 h-2 cursor-pointer" />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Going it alone</p>
            <p className="font-display text-2xl sm:text-3xl tabular-nums mt-1.5 text-white/70">{inr(alone)}</p>
          </div>
          <div className="rounded-2xl border-2 border-mint-500 bg-mint-500/10 p-5 relative shadow-[0_0_30px_-8px_rgba(47,188,155,0.6)]">
            <span className="absolute -top-2.5 right-3 rounded-full bg-mint-500 text-pine-950 text-[11px] font-extrabold px-2.5 py-0.5">+{inr(uplift)}</span>
            <p className="text-[10px] font-bold uppercase tracking-wider text-mint-300">With a plan</p>
            <p className="font-display text-2xl sm:text-3xl tabular-nums mt-1.5 text-mint-300">{inr(withPW)}</p>
          </div>
        </div>
        <div className="mt-4 flex h-3 rounded-full overflow-hidden bg-white/[0.06]">
          <div className="bg-white/25" style={{ width: `${basePct}%`, transition: 'width .4s' }} />
          <div className="bg-mint-500" style={{ width: `${100 - basePct}%`, transition: 'width .4s', boxShadow: '0 0 16px rgba(47,188,155,.55)' }} />
        </div>
        <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-white/55"><strong className="text-white/85 capitalize">{g.riskAppetite}</strong> · ~{g.assumedReturnPct}%/yr</p>
          <div className="inline-flex rounded-full bg-white/10 p-0.5">
            {['conservative', 'moderate', 'aggressive'].map((r) => (
              <button key={r} disabled={saving} onClick={async () => { setSaving(true); try { await onRisk(r); } finally { setSaving(false); } }}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors disabled:opacity-50 ${g.riskAppetite === r ? 'bg-mint-500 text-pine-950' : 'text-white/70 hover:text-white'}`}>
                {r === 'conservative' ? 'Cautious' : r === 'aggressive' ? 'Aggressive' : 'Balanced'}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[10px] text-white/40 leading-relaxed">Illustration, not a guarantee. Idle savings ~3.5% vs your plan ~{g.assumedReturnPct}%/yr with an 8% yearly step-up. Markets fluctuate; nominal, before inflation.</p>
      </div>
    </section>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-10">
      <div className="pw-bleed -mt-16 md:-mt-8 h-[560px] pw-voice-bg md:rounded-bl-[2.5rem] grid place-items-center">
        <span className="relative w-40 h-40 rounded-full pw-orb" />
      </div>
      <div className="grid sm:grid-cols-3 gap-5">{[0, 1, 2].map((i) => <div key={i} className="h-72 rounded-3xl bg-paper-100 animate-pulse" />)}</div>
    </div>
  );
}
