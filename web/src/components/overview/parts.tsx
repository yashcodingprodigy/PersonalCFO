'use client';

// Building blocks for the dream-first Overview: reveal-on-scroll, 3D tilt cards,
// illustrated dream cards, the monthly money "river" and the autopilot feed.

import { useEffect, useRef, useState } from 'react';
import { inr } from '@/lib/format';
import { useLang, TKey } from '@/lib/i18n';

/* ── scroll reveal ─────────────────────────────────────────────────────── */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!('IntersectionObserver' in window)) { el.classList.add('in'); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add('in'); io.disconnect(); } }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    io.observe(el);
    const safety = setTimeout(() => el.classList.add('in'), 2500); // never leave content hidden
    return () => { io.disconnect(); clearTimeout(safety); };
  }, []);
  return ref;
}

export function Reveal({ children, className = '', as = 'div', stagger = false }: { children: React.ReactNode; className?: string; as?: 'div' | 'section'; stagger?: boolean }) {
  const ref = useReveal<HTMLDivElement>();
  const Tag = as as any;
  return <Tag ref={ref} className={`${stagger ? 'pw-stagger' : 'pw-rise'} ${className}`}>{children}</Tag>;
}

/* ── 3D tilt ───────────────────────────────────────────────────────────── */
export function Tilt({ children, className = '', max = 10, onClick }: { children: React.ReactNode; className?: string; max?: number; onClick?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent) => {
    const el = ref.current; if (!el || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty('--ry', `${(px - 0.5) * max * 2}deg`);
    el.style.setProperty('--rx', `${(0.5 - py) * max * 2}deg`);
    el.style.setProperty('--mx', `${px * 100}%`); el.style.setProperty('--my', `${py * 100}%`);
  };
  const leave = () => { const el = ref.current; if (!el) return; el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); };
  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} onClick={onClick} className={`pw-tilt relative ${className}`}>
      {children}
      <span className="pw-glare" aria-hidden />
    </div>
  );
}

/* ── dream art (original illustrations, one per kind) ───────────────────── */
const ART: Record<string, { from: string; to: string; glyph: JSX.Element }> = {
  experience: { from: '#FF9A62', to: '#E8546B', glyph: <path d="M2 16.5 21 8.6c1-.4 1.8.9 1 1.6l-6.2 5 1.4 6.3-2 .9-3.2-5.4-4.8 2.3-.6 2.6-1.6.6-.6-3.5L2 16.5Zm3-7.7 3.6-1.5 6.2 2.2-3.7 1.6L5 8.8Z" /> },
  purchase: { from: '#8B7CF6', to: '#4F46E5', glyph: <path d="M6 7V6a6 6 0 1 1 12 0v1h2.2a1 1 0 0 1 1 .9l1 13A1 1 0 0 1 21.2 22H2.8a1 1 0 0 1-1-1.1l1-13a1 1 0 0 1 1-.9H6Zm2 0h8V6a4 4 0 1 0-8 0v1Zm-1 3a1 1 0 1 0 2 0 1 1 0 0 0-2 0Zm8 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z" /> },
  family: { from: '#F472B6', to: '#E11D74', glyph: <path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3.1 4.5 6.7 4.5c2.1 0 3.8 1.2 5.3 3 1.5-1.8 3.2-3 5.3-3 3.6 0 5.8 3.7 4.3 7.2C19.5 16.4 12 21 12 21Z" /> },
  safety: { from: '#34D3B0', to: '#0F766E', glyph: <path d="M12 1.8 21 5v6.4c0 5.4-3.7 9.7-9 10.9-5.3-1.2-9-5.5-9-10.9V5l9-3.2Zm-1.2 13.5 6-6-1.4-1.4-4.6 4.6-2.2-2.2-1.4 1.4 3.6 3.6Z" /> },
  growth: { from: '#4ADE80', to: '#15803D', glyph: <path d="M11 22v-7.2C6.6 14.4 3.5 11.2 3.5 6.5V5h1.5c3.2 0 5.8 1.6 7 4 1.3-3.4 4.4-5.5 8-5.5h1.5V5c0 5-3.5 8.7-8.5 9.2V22h-2Z" /> },
  milestone: { from: '#FBBF24', to: '#D97706', glyph: <path d="m12 2 2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7L12 2Z" /> },
};
export function DreamArt({ kind, className = '' }: { kind: string; className?: string }) {
  const a = ART[kind] || ART.experience;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: `linear-gradient(135deg, ${a.from}, ${a.to})` }} aria-hidden>
      <span className="absolute -top-8 -right-6 w-32 h-32 rounded-full bg-white/20 blur-[2px]" style={{ transform: 'translateZ(10px)' }} />
      <span className="absolute -bottom-10 -left-8 w-36 h-36 rounded-full bg-black/10" />
      <span className="absolute top-4 left-6 w-2 h-2 rounded-full bg-white/70" />
      <span className="absolute top-10 left-14 w-1 h-1 rounded-full bg-white/60" />
      <span className="absolute bottom-6 right-10 w-1.5 h-1.5 rounded-full bg-white/60" />
      <div className="absolute inset-0 grid place-items-center pw-depth">
        <svg viewBox="0 0 24 24" className="w-14 h-14 fill-white drop-shadow-[0_10px_18px_rgba(0,0,0,.25)] pw-float-y">{a.glyph}</svg>
      </div>
    </div>
  );
}

/* ── progress ring ──────────────────────────────────────────────────────── */
export function Ring({ value, size = 46, color = '#2FBC9B' }: { value: number; size?: number; color?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => { const id = requestAnimationFrame(() => setV(Math.max(0, Math.min(1, value)))); return () => cancelAnimationFrame(id); }, [value]);
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(.16,1,.3,1)' }} />
    </svg>
  );
}

export const STATUS_STYLE: Record<string, { color: string; chip: string }> = {
  achieved: { color: '#D99B0B', chip: 'bg-gold-100 text-gold-700' },
  on_track: { color: '#2FBC9B', chip: 'bg-mint-100 text-pine-800' },
  stretch: { color: '#F59E0B', chip: 'bg-signal-amber/10 text-signal-amber' },
  needs_tradeoff: { color: '#EF4444', chip: 'bg-signal-red/10 text-signal-red' },
};

export function prettyMonth(ym: string | null | undefined, lang: string) {
  if (!ym) return '—';
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { month: 'short', year: 'numeric' });
}

/* ── dream card ─────────────────────────────────────────────────────────── */
export function DreamCard({ d, onOpen }: { d: any; onOpen?: () => void }) {
  const { t, lang } = useLang();
  const progress = d.adjustedTarget > 0 ? Math.min(1, (d.saved || 0) / d.adjustedTarget) : 0;
  const st = STATUS_STYLE[d.status] || STATUS_STYLE.on_track;
  const doneBy = d.status === 'achieved' ? t('ov.ready') : prettyMonth(d.projectedDate || d.targetDate, lang);
  return (
    <Tilt className="rounded-3xl bg-white shadow-card cursor-pointer" onClick={onOpen}>
      <DreamArt kind={d.kind} className="h-32 rounded-t-3xl" />
      <div className="p-5" style={{ transform: 'translateZ(20px)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight line-clamp-2" data-no-translate>{d.name}</p>
            <span className={`chip !text-[10px] mt-1.5 ${st.chip}`}>{t(`ov.st.${d.status}` as TKey)}</span>
          </div>
          <div className="relative text-ink">
            <Ring value={progress} color={st.color} />
            <span className="absolute inset-0 grid place-items-center text-[10px] font-bold tabular-nums">{Math.round(progress * 100)}%</span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-paper-50 px-3 py-2">
            <p className="text-ink-faint">{t('ov.doneBy')}</p>
            <p className="font-bold mt-0.5">{doneBy}</p>
          </div>
          <div className="rounded-xl bg-paper-50 px-3 py-2">
            <p className="text-ink-faint">{t('ov.planned')}</p>
            <p className="font-bold mt-0.5 tabular-nums">{inr(d.allocated)}{t('ov.perMonth')}</p>
          </div>
        </div>
        {d.earmarked > 0 && (
          <p className="mt-3 text-[11px] text-pine-700 font-semibold">✨ {inr(d.earmarked)} {t('ov.setAside')}</p>
        )}
      </div>
    </Tilt>
  );
}

/* ── money river ────────────────────────────────────────────────────────── */
export function MoneyFlow({ map, plan }: { map: any; plan: any }) {
  const { t } = useLang();
  const ref = useReveal<HTMLDivElement>();
  if (!map?.hasData || !(map.takeHome > 0)) return null;
  const items = plan?.items || [];
  const safety = items.filter((i: any) => i.kind === 'safety').reduce((a: number, i: any) => a + (i.allocated || 0), 0);
  const future = items.filter((i: any) => i.id === 'virtual-future').reduce((a: number, i: any) => a + (i.allocated || 0), 0);
  const dreams = items.filter((i: any) => !i.virtual && i.kind !== 'safety').reduce((a: number, i: any) => a + (i.allocated || 0), 0);
  const buckets = [
    { k: 'ov.flow.life', v: (map.expenses || 0), c: '#94A3B8' },
    { k: 'ov.flow.sip', v: (map.currentSip || 0) + future, c: '#22C55E' },
    { k: 'ov.flow.safety', v: safety, c: '#14B8A6' },
    { k: 'ov.flow.dreams', v: dreams, c: '#8B5CF6' },
    { k: 'ov.flow.joy', v: plan?.joyBudget || 0, c: '#F59E0B' },
  ].filter((b) => b.v > 0) as { k: TKey; v: number; c: string }[];
  const total = buckets.reduce((a, b) => a + b.v, 0) || 1;
  const H = 340, W = 640, x0 = 150, x1 = 470;
  let ySrc = 30, yDst = 12; const gap = 26;
  const span = H - 60, dstSpan = H - 24 - gap * (buckets.length - 1);
  const flows = buckets.map((b) => {
    const h = Math.max(4, (b.v / total) * span), hd = Math.max(6, (b.v / total) * dstSpan);
    const f = { ...b, sy: ySrc + h / 2, dy: yDst + hd / 2, w: h, hd };
    ySrc += h; yDst += hd + gap; return f;
  });
  return (
    <div ref={ref} className="pw-rise">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={t('ov.flowTitle')}>
        <defs>
          {flows.map((f, i) => (
            <linearGradient key={i} id={`pwf${i}`} x1="0" x2="1"><stop offset="0" stopColor="#2FBC9B" stopOpacity=".55" /><stop offset="1" stopColor={f.c} stopOpacity=".85" /></linearGradient>
          ))}
        </defs>
        <rect x={x0 - 14} y={30} width={14} height={span} rx={7} fill="#0B2F2A" />
        <text x={x0 - 24} y={H / 2 - 8} textAnchor="end" className="fill-ink-faint" fontSize="12">{t('ov.flow.income')}</text>
        <text x={x0 - 24} y={H / 2 + 12} textAnchor="end" className="fill-ink" fontSize="16" fontWeight="700">{inr(map.takeHome)}</text>
        {flows.map((f, i) => (
          <g key={f.k}>
            <path d={`M${x0},${f.sy} C${(x0 + x1) / 2},${f.sy} ${(x0 + x1) / 2},${f.dy} ${x1},${f.dy}`} fill="none" stroke={`url(#pwf${i})`} strokeWidth={f.w} strokeOpacity=".9">
              <title>{t(f.k)} {inr(f.v)}</title>
            </path>
            <path d={`M${x0},${f.sy} C${(x0 + x1) / 2},${f.sy} ${(x0 + x1) / 2},${f.dy} ${x1},${f.dy}`} fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth={1.4} className="pw-flow-path" />
            <rect x={x1} y={f.dy - f.hd / 2} width={10} height={f.hd} rx={5} fill={f.c} />
            <text x={x1 + 20} y={f.dy - 2} fontSize="12" className="fill-ink-faint">{t(f.k)}</text>
            <text x={x1 + 20} y={f.dy + 14} fontSize="14" fontWeight="700" className="fill-ink">{inr(f.v)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ── autopilot feed ─────────────────────────────────────────────────────── */
const KIND_ICON: Record<string, string> = {
  dream_captured: '✨', earmark: '🪙', dream_done: '🎉', dream_better: '📈', dream_worse: '⚠️',
  sooner: '⏩', later: '⏳', free_change: '💸', life_event: '🔔', plan_built: '🧠',
};
function ago(iso: string, lang: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  const rtf = new Intl.RelativeTimeFormat(lang === 'hi' ? 'hi' : 'en', { numeric: 'auto' });
  if (s < 3600) return rtf.format(-Math.round(s / 60) || -1, 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}
export function AwayFeed({ items }: { items: any[] }) {
  const { t, lang } = useLang();
  if (!items.length) return <p className="text-sm text-ink-soft py-6">{t('ov.awayEmpty')}</p>;
  return (
    <ol className="relative pl-6 pw-stagger in">
      <span className="absolute left-[11px] top-2 bottom-2 w-px bg-gradient-to-b from-mint-500/60 to-transparent" aria-hidden />
      {items.slice(0, 6).map((a) => (
        <li key={a.id} className="relative pb-4">
          <span className="absolute -left-6 top-0.5 w-6 h-6 rounded-full bg-white shadow-card grid place-items-center text-[12px]">{KIND_ICON[a.kind] || '•'}</span>
          <p className="text-sm font-semibold leading-snug">{a.title}</p>
          {a.body && <p className="text-xs text-ink-soft mt-0.5 leading-relaxed">{a.body}</p>}
          <p className="text-[10px] text-ink-faint mt-1">{ago(a.created_at, lang)}</p>
        </li>
      ))}
    </ol>
  );
}

/* ── count-up number ─────────────────────────────────────────────────────── */
export function CountUp({ value, format = (n: number) => String(Math.round(n)) }: { value: number; format?: (n: number) => string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(value); return; }
    let raf = 0; const start = performance.now(); const from = 0;
    const step = (now: number) => { const p = Math.min(1, (now - start) / 1100); const e = 1 - Math.pow(1 - p, 3); setN(from + (value - from) * e); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(n)}</>;
}
