'use client';

// Markets — what changed in the money world, and what it means for YOUR money.
// 1) Key facts (repo rate, inflation) from official sources, with the change since last time.
// 2) "What it means for you": rupee estimates on your loans, savings, spending and dreams.
// 3) Money news from sources we're allowed to use commercially, each with a personal "why it matters".
// Education only — never a tip on any security.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { LoadingScreen } from '@/components/Skeleton';
import { Disclosure } from '@/components/kit';

const QUIPS = ['Reading the official numbers…', 'Working out what it means for you…', 'Skipping the noise, keeping the signal…'];
const THEME_TONE: Record<string, string> = {
  rates: 'bg-ocean-100 text-ocean-700', inflation: 'bg-gold-100 text-gold-700', tax: 'bg-violet-100 text-violet-700',
  markets: 'bg-mint-100 text-pine-800', insurance: 'bg-berry-100 text-berry-700', banking: 'bg-sky-100 text-sky-700',
  savings: 'bg-mint-100 text-pine-800', gold: 'bg-gold-100 text-gold-700', economy: 'bg-paper-100 text-ink-soft',
  scam: 'bg-signal-red/10 text-signal-red', other: 'bg-paper-100 text-ink-soft',
};
const fmtDate = (s?: string | null) => {
  if (!s) return '';
  const d = new Date(s); if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
function ago(s?: string | null) {
  if (!s) return '';
  const t = new Date(s).getTime(); if (isNaN(t)) return '';
  const h = Math.floor((Date.now() - t) / 3600000);
  return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export default function MarketsPage() {
  const { lang } = useLang();
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<string>('foryou');
  useEffect(() => { get(`/market?lang=${lang}`).then(setM).catch((e) => setErr(e.message)); }, [lang]);

  const news: any[] = m?.news || [];
  const themesPresent = useMemo(() => Array.from(new Set(news.map((n) => n.theme))), [news]);
  const shown = news.filter((n) => filter === 'all' ? true : filter === 'foryou' ? n.forYou : n.theme === filter);
  const impacts: any[] = m?.impacts || [];
  const costly = impacts.filter((i) => i.good === false && i.amount);

  if (err) return <p className="text-signal-red text-sm mt-8">{err}</p>;
  return (
    <div className="relative min-h-[60vh]">
      <LoadingScreen loading={!m} quips={QUIPS} />
      {m && (
        <div className="space-y-8 pw-page-in">
          {/* Hero */}
          <section className="rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden" style={{ background: 'linear-gradient(150deg,#07211D 0%,#0B2F2A 100%)' }}>
            <div className="absolute -top-20 -right-10 w-64 h-64 rounded-full bg-mint-500/10 blur-3xl pointer-events-none" aria-hidden />
            <p className="text-[11px] font-bold uppercase tracking-[.25em] text-mint-300">Markets, in your money</p>
            <h1 className="font-display text-3xl sm:text-4xl mt-2 leading-tight max-w-2xl">
              {impacts.length ? `${impacts.length} thing${impacts.length > 1 ? 's' : ''} in the money world touch${impacts.length > 1 ? '' : 'es'} your finances right now.` : 'Here’s what’s moving in the money world.'}
            </h1>
            <p className="text-white/70 mt-3 max-w-2xl">We read the official numbers and money news, then work out what they mean for your loans, savings, spending and dreams — in rupees.</p>
            {costly.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {costly.slice(0, 3).map((i) => (
                  <span key={i.id} className="rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs">{i.title}</span>
                ))}
              </div>
            )}
          </section>

          {/* Key facts */}
          <section>
            <h2 className="font-display text-2xl">What changed</h2>
            <p className="text-sm text-ink-soft mt-1">Official figures, with the change since the last reading.</p>
            <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {m.facts.map((f: any) => {
                const d = f.prev != null ? +(f.value - f.prev).toFixed(2) : null;
                return (
                  <div key={f.key} className="card p-5">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint">{f.label}</p>
                    <div className="flex items-end gap-2 mt-2">
                      <p className="font-display text-3xl font-semibold tabular-nums">{f.value}%</p>
                      {d != null && d !== 0 && (
                        <span className={`mb-1 text-sm font-bold ${d > 0 ? 'text-signal-red' : 'text-signal-green'}`}>{d > 0 ? '▲' : '▼'} {Math.abs(d)} pts</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-faint mt-1">{f.period ? `${f.period} · ` : ''}{fmtDate(f.asOf)}{f.prev != null ? ` · was ${f.prev}%` : ''}</p>
                    {f.note && <p className="text-xs text-ink-soft mt-2 leading-relaxed">{f.note}</p>}
                    {f.next && <p className="text-[11px] text-pine-700 font-semibold mt-2">{f.next}</p>}
                    <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="block text-[10px] text-ink-faint underline mt-2">Source: {f.source}</a>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Personal impact */}
          <section>
            <h2 className="font-display text-2xl">What it means for you</h2>
            <p className="text-sm text-ink-soft mt-1">Estimates from your own numbers. Each card says how we worked it out.</p>
            {impacts.length === 0 ? (
              <div className="card p-6 mt-4 text-sm text-ink-soft">Add your loans, savings and spending in Settings and we’ll show exactly how these changes touch your money.</div>
            ) : (
              <div className="mt-4 grid md:grid-cols-2 gap-4">
                {impacts.map((i) => (
                  <div key={i.id} className={`card p-5 border-l-4 ${i.good === false ? 'border-l-signal-amber' : i.good === true ? 'border-l-signal-green' : 'border-l-paper-200'}`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`chip !text-[10px] ${THEME_TONE[i.theme] || THEME_TONE.other}`}>{m.themeLabels[i.theme]}</span>
                      {i.good === false && <span className="chip !text-[10px] bg-signal-amber/10 text-signal-amber">Costs you</span>}
                      {i.good === true && <span className="chip !text-[10px] bg-signal-green/10 text-signal-green">Good for you</span>}
                    </div>
                    <p className="font-semibold mt-2 leading-snug">{i.title}</p>
                    <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">{i.detail}</p>
                    <Link href={i.href} className="inline-block mt-3 text-xs font-bold text-pine-700 hover:text-pine-900">{i.cta} →</Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* News */}
          <section>
            <div className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-display text-2xl">Money news</h2>
                <p className="text-sm text-ink-soft mt-1">From sources we’re licensed or permitted to show. Tap a headline to read it at the source.</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {[['foryou', `For you (${news.filter((n) => n.forYou).length})`], ['all', `All (${news.length})`], ...themesPresent.map((t) => [t, m.themeLabels[t]])].map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${filter === k ? 'bg-pine-900 text-white' : 'bg-white border border-paper-200 text-ink-soft hover:border-pine-600'}`}>{l}</button>
              ))}
            </div>
            <div className="mt-4 card divide-y divide-paper-100">
              {shown.length === 0 ? (
                <p className="p-5 text-sm text-ink-soft">{m.newsError ? 'News sources couldn’t be reached right now — try again in a little while.' : filter === 'foryou' ? 'Nothing in today’s news touches your money directly. Tap “All” to browse.' : 'No headlines here right now.'}</p>
              ) : shown.map((n, idx) => (
                <article key={idx} className="p-5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`chip !text-[10px] ${THEME_TONE[n.theme] || THEME_TONE.other}`}>{n.themeLabel}</span>
                    {n.forYou && <span className="chip !text-[10px] bg-pine-900 text-white">For you</span>}
                  </div>
                  <a href={n.link} target="_blank" rel="noopener noreferrer" className="block mt-2 font-semibold leading-snug hover:text-pine-700" data-no-translate={n.lang === lang ? '' : undefined}>{n.title}</a>
                  <p className="text-sm text-pine-800 mt-1.5 leading-relaxed"><span className="font-bold">Why it matters to you: </span>{n.whyItMatters}</p>
                  <p className="text-[11px] text-ink-faint mt-1.5">Source: {n.source}{n.published ? ` · ${ago(n.published)}` : ''} · opens the original publisher</p>
                </article>
              ))}
            </div>
          </section>

          {/* Learn */}
          <section>
            <h2 className="font-display text-2xl">Understand the building blocks</h2>
            <div className="mt-4 space-y-2.5">
              <Disclosure title="Investment types, explained simply" subtitle={`${m.themes.length} categories — never specific products`}>
                <div className="grid sm:grid-cols-2 gap-3 border-t border-paper-100 pt-3">
                  {m.themes.map((t: any) => (
                    <div key={t.theme} className="rounded-xl bg-paper-50 border border-paper-200 p-4">
                      <div className="flex justify-between gap-2"><p className="text-sm font-bold">{t.theme}</p><span className="chip !text-[10px] bg-paper-100 text-ink-soft">{t.risk} risk</span></div>
                      <p className="text-xs text-ink-soft mt-1.5 leading-relaxed">{t.whatItIs}</p>
                      <p className="text-xs text-pine-800 mt-1.5"><strong>Who it suits:</strong> {t.whoItSuits}</p>
                    </div>
                  ))}
                </div>
              </Disclosure>
              <Disclosure title="Smart-money basics" subtitle="Five habits that matter more than any headline">
                <ul className="space-y-2 text-sm text-ink-soft border-t border-paper-100 pt-3">{m.basics.map((b: string, i: number) => <li key={i} className="flex gap-2"><span className="text-mint-500 font-bold">·</span>{b}</li>)}</ul>
              </Disclosure>
            </div>
          </section>

          {/* Sources */}
          <section className="rounded-2xl bg-paper-100 border border-paper-200 p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint">Sources & permissions</p>
            <ul className="mt-2 space-y-1.5 text-xs text-ink-soft">
              {m.sources.filter((s: any) => s.enabled).map((s: any) => <li key={s.id}><strong>{s.name}</strong> — {s.license}</li>)}
              <li><strong>RBI and MoSPI figures</strong> — official public data, cited on each card.</li>
            </ul>
            <p className="text-[11px] text-ink-faint mt-3 leading-relaxed">{m.disclaimer}</p>
          </section>
        </div>
      )}
    </div>
  );
}
