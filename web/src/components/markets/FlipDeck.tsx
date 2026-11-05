'use client';

// "Money Wrapped" — the market news as a deck of bold pamphlets. The front shows what happened;
// tap it and it flips to show what that means for YOUR money (rupee impact from your own numbers,
// or a plain-words "why it matters"). Built from /market data only — no extra calls.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

export interface Pamphlet {
  id: string;
  kind: 'fact' | 'news';
  theme: string;
  themeLabel: string;
  forYou: boolean;
  // front
  kicker: string;              // small top line ("RBI repo rate", "PIB · 3h ago")
  big?: string;                // big number for facts ("5.5%")
  delta?: { text: string; up: boolean } | null;
  headline: string;
  source: string;
  link?: string;
  noTranslate?: boolean;
  // back
  backTitle: string;
  backBody: string;
  impacts: { title: string; detail: string; good: boolean | null; href: string; cta: string }[];
}

// Wrapped-style duotones per theme: [from, to, accent]
const THEME: Record<string, [string, string, string]> = {
  rates: ['#0F2F57', '#2E86C1', '#9BE7FF'],
  inflation: ['#7C2D12', '#F59E0B', '#FFE29A'],
  tax: ['#3B0F6E', '#8E5FD0', '#F0C4FF'],
  markets: ['#053B2F', '#2FBC9B', '#C8FFE9'],
  insurance: ['#6B0F3F', '#D45FA2', '#FFD1EA'],
  banking: ['#0A3D4E', '#45A6C2', '#CFF5FF'],
  savings: ['#123D20', '#3FBF6A', '#D9FFD0'],
  gold: ['#5C2A06', '#E0A23B', '#FFF0B8'],
  economy: ['#1C2430', '#5B6B82', '#E2E8F0'],
  scam: ['#5E0B0B', '#E5484D', '#FFD6D6'],
  other: ['#07211D', '#258274', '#C7F0E4'],
};
const SHAPES = ['circle', 'ring', 'blob', 'bars'] as const;

function Decor({ i, accent }: { i: number; accent: string }) {
  const s = SHAPES[i % SHAPES.length];
  return (
    <svg className="absolute -right-10 -bottom-10 w-56 h-56 opacity-30 pointer-events-none" viewBox="0 0 200 200" aria-hidden>
      {s === 'circle' && <circle cx="100" cy="100" r="80" fill={accent} />}
      {s === 'ring' && <><circle cx="100" cy="100" r="78" fill="none" stroke={accent} strokeWidth="18" /><circle cx="100" cy="100" r="34" fill={accent} /></>}
      {s === 'blob' && <path d="M45 40c35-30 95-20 120 15s20 95-20 115-100 10-115-30S10 70 45 40z" fill={accent} />}
      {s === 'bars' && [0, 1, 2, 3].map((k) => <rect key={k} x={20 + k * 42} y={160 - (k + 1) * 32} width="28" height={(k + 1) * 32} rx="6" fill={accent} />)}
    </svg>
  );
}

function Card({ p, i, flipped, onFlip }: { p: Pamphlet; i: number; flipped: boolean; onFlip: () => void }) {
  const [from, to, accent] = THEME[p.theme] || THEME.other;
  const tilt = ((i % 3) - 1) * 1.2; // tiny pamphlet tilt, like cards laid on a table
  return (
    <div className="pw-flip-wrap shrink-0 snap-center w-[78vw] max-w-[320px] sm:w-[300px] h-[440px]" style={{ ['--tilt' as any]: `${tilt}deg` }}>
      <div role="button" tabIndex={0} onClick={onFlip} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onFlip(); } }}
        aria-pressed={flipped} aria-label={flipped ? 'Show the news' : 'See what this means for you'}
        className={`cursor-pointer select-none pw-flip-card relative w-full h-full text-left rounded-[28px] focus:outline-none focus-visible:ring-4 focus-visible:ring-mint-400/60 ${flipped ? 'is-flipped' : ''}`}>
        {/* FRONT — the news */}
        <div className="pw-flip-face absolute inset-0 rounded-[28px] overflow-hidden text-white p-6 flex flex-col shadow-xl"
          style={{ background: `linear-gradient(155deg, ${from} 0%, ${to} 100%)` }}>
          <Decor i={i} accent={accent} />
          <div className="relative flex items-center justify-between gap-2">
            <span className="rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.18em]" style={{ background: accent, color: from }}>{p.themeLabel}</span>
            {p.forYou && <span className="rounded-full border border-white/40 px-2 py-0.5 text-[10px] font-bold">For you</span>}
          </div>
          <p className="relative mt-5 text-[11px] font-bold uppercase tracking-[.22em] text-white/70">{p.kicker}</p>
          {p.big && (
            <div className="relative mt-1 flex items-end gap-2">
              <p className="font-display text-7xl font-bold leading-none tracking-tight">{p.big}</p>
              {p.delta && <span className="mb-2 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-extrabold" style={{ background: accent, color: from }}>{p.delta.up ? '▲' : '▼'} {p.delta.text}</span>}
            </div>
          )}
          <h3 className={`relative font-display leading-[1.12] mt-3 ${p.big ? 'text-xl' : 'text-[26px] line-clamp-6'}`} data-no-translate={p.noTranslate ? '' : undefined}>{p.headline}</h3>
          <div className="relative mt-auto pt-4 flex items-end justify-between gap-3">
            <p className="text-[10px] text-white/70 leading-snug max-w-[60%]">Source: {p.source}</p>
            <span className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full bg-white text-[11px] font-extrabold px-3 py-1.5" style={{ color: from }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" /></svg>
              For you
            </span>
          </div>
        </div>

        {/* BACK — what it means for you */}
        <div className="pw-flip-face pw-flip-back absolute inset-0 rounded-[28px] overflow-hidden p-6 flex flex-col shadow-xl text-ink"
          style={{ background: `radial-gradient(120% 80% at 100% 0%, ${accent}55 0%, transparent 60%), #FFF9EE` }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-[.22em]" style={{ color: to }}>What it means for you</span>
            <span className="text-[10px] font-bold text-ink-faint">tap to flip back</span>
          </div>
          <p className="font-display text-[22px] leading-tight mt-3">{p.backTitle}</p>
          <div className="mt-3 space-y-2.5 overflow-y-auto pr-1 -mr-1 min-h-0 flex-1" onClick={(e) => e.stopPropagation()}>
            {p.backBody && <p className="text-sm text-ink-soft leading-relaxed">{p.backBody}</p>}
            {p.impacts.map((m, k) => (
              <div key={k} className="rounded-2xl bg-white/80 border border-black/5 p-3">
                <div className="flex items-start gap-2">
                  <span className={`mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 ${m.good === false ? 'bg-signal-amber' : m.good === true ? 'bg-signal-green' : 'bg-paper-200'}`} />
                  <p className="text-[13px] font-bold leading-snug">{m.title}</p>
                </div>
                <p className="text-xs text-ink-soft mt-1 leading-relaxed">{m.detail}</p>
                <Link href={m.href} className="inline-block mt-1.5 text-xs font-extrabold" style={{ color: to }}>{m.cta} →</Link>
              </div>
            ))}
          </div>
          {p.link && (
            <a href={p.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="mt-3 self-start text-[11px] font-bold text-ink-soft underline">Read the original at {p.source.split(',')[0]} ↗</a>
          )}
        </div>
      </div>
    </div>
  );
}

export function FlipDeck({ cards, emptyText }: { cards: Pamphlet[]; emptyText: string }) {
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [idx, setIdx] = useState(0);
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => { setFlipped(new Set()); setIdx(0); rail.current?.scrollTo({ left: 0 }); }, [cards]);

  const toggle = (id: string) => setFlipped((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allFlipped = cards.length > 0 && cards.every((c) => flipped.has(c.id));
  const go = (d: number) => {
    const el = rail.current; if (!el) return;
    const card = el.querySelector<HTMLElement>('.pw-flip-wrap'); const w = (card?.offsetWidth || 300) + 20;
    el.scrollBy({ left: d * w, behavior: 'smooth' });
  };
  const onScroll = () => {
    const el = rail.current; if (!el) return;
    const card = el.querySelector<HTMLElement>('.pw-flip-wrap'); const w = (card?.offsetWidth || 300) + 20;
    setIdx(Math.min(cards.length - 1, Math.max(0, Math.round(el.scrollLeft / w))));
  };
  const dots = useMemo(() => cards.slice(0, 20), [cards]);

  if (!cards.length) return <div className="card p-6 text-sm text-ink-soft">{emptyText}</div>;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs font-bold text-ink-faint tabular-nums">{idx + 1} / {cards.length}</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setFlipped(allFlipped ? new Set() : new Set(cards.map((c) => c.id)))}
            className="rounded-full border border-paper-200 bg-white px-3 py-1.5 text-xs font-bold text-ink-soft hover:border-pine-600">
            {allFlipped ? 'Show the news' : 'Flip all — what it means for me'}
          </button>
          <button onClick={() => go(-1)} aria-label="Previous" className="w-9 h-9 rounded-full border border-paper-200 bg-white grid place-items-center hover:border-pine-600">‹</button>
          <button onClick={() => go(1)} aria-label="Next" className="w-9 h-9 rounded-full border border-paper-200 bg-white grid place-items-center hover:border-pine-600">›</button>
        </div>
      </div>
      <div ref={rail} onScroll={onScroll} tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); }}
        className="pw-deck flex gap-5 overflow-x-auto snap-x snap-mandatory pb-6 pt-2 px-1 -mx-1 focus:outline-none">
        {cards.map((c, i) => (
          <div key={c.id} className="pw-deck-in" style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}>
            <Card p={c} i={i} flipped={flipped.has(c.id)} onFlip={() => toggle(c.id)} />
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 -mt-2" aria-hidden>
        {dots.map((c, i) => <span key={c.id} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-pine-800' : 'w-1.5 bg-paper-200'}`} />)}
      </div>
    </div>
  );
}
