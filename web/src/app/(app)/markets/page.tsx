'use client';

// Markets — what changed in the money world, and what it means for YOUR money.
// 1) Key facts (repo rate, inflation) from official sources, with the change since last time.
// 2) "What it means for you": rupee estimates on your loans, savings, spending and dreams.
// 3) Money news from sources we're allowed to use commercially, each with a personal "why it matters".
// Education only — never a tip on any security.

import { useEffect, useMemo, useState } from 'react';
import { get } from '@/lib/api';
import { useLang } from '@/lib/i18n';
import { LoadingScreen } from '@/components/Skeleton';
import { Disclosure } from '@/components/kit';
import { FlipDeck, Pamphlet } from '@/components/markets/FlipDeck';

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

  const deck: Pamphlet[] = useMemo(() => (m?.deck || []).map((c: any) => ({ ...c, kicker: c.published ? `${c.kicker} · ${ago(c.published)}` : c.kicker })), [m]);
  const themesPresent = useMemo(() => Array.from(new Set(deck.map((c) => c.theme))), [deck]);
  const shown = useMemo(() => {
    const f = deck.filter((c) => filter === 'all' ? true : filter === 'foryou' ? c.forYou : c.theme === filter);
    return filter === 'foryou' && f.length === 0 ? deck : f;
  }, [deck, filter]);
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

          {/* Money Wrapped — flip pamphlets */}
          <section>
            <div className="flex items-end justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-display text-2xl">This week in your money</h2>
                <p className="text-sm text-ink-soft mt-1">Each card is one piece of news. Tap it to flip and see what it means for you.</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {[['foryou', `For you (${deck.filter((c) => c.forYou).length})`], ['all', `All (${deck.length})`], ...themesPresent.map((t) => [t, m.themeLabels[t]])].map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${filter === k ? 'bg-pine-900 text-white' : 'bg-white border border-paper-200 text-ink-soft hover:border-pine-600'}`}>{l}</button>
              ))}
            </div>
            <div className="mt-5">
              <FlipDeck cards={shown}
                emptyText={m.newsError ? 'News sources couldn’t be reached right now — try again in a little while.' : filter === 'foryou' ? 'Nothing this week touches your money directly. Tap “All” to browse.' : 'No cards here right now.'} />
            </div>
            <p className="text-[11px] text-ink-faint mt-2">Rupee effects are estimates from the details you gave us. Headlines link to their original publisher.</p>
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
