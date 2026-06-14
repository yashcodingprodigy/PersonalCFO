'use client';

import { useEffect, useRef, useState } from 'react';

// ── Brand palette (matches tailwind.config) for SVG fills ────────────
export const C = {
  pine900: '#0B2F2A', pine700: '#16544B', pine500: '#258274',
  mint500: '#2FBC9B', mint300: '#83DEC7', mint100: '#DFF5EE',
  paper100: '#F2EFE8', paper200: '#E7E2D6',
  inkFaint: '#7C8782', inkSoft: '#48544F',
  red: '#C2402A', amber: '#C77E1F', teal: '#1D8A78', green: '#2E9E44',
};
export const ALLOC_COLORS: Record<string, string> = {
  equity: C.pine700, debt: C.mint500, gold: C.amber, cash: C.paper200, realEstate: C.pine500, other: C.inkFaint,
};

// ── Donut chart ──────────────────────────────────────────────────────
export function Donut({ data, size = 168, thickness = 24, children }: {
  data: { label: string; value: number; color: string }[];
  size?: number; thickness?: number; children?: React.ReactNode;
}) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.paper100} strokeWidth={thickness} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {data.filter((d) => d.value > 0).map((d, i) => {
            const dash = (d.value / total) * circ;
            const el = (
              <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color}
                strokeWidth={thickness} strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-offset}
                strokeLinecap="butt" />
            );
            offset += dash;
            return el;
          })}
        </g>
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}

// ── Single-value ring / gauge ────────────────────────────────────────
export function Ring({ pct, size = 120, thickness = 12, color = C.mint500, children }: {
  pct: number; size?: number; thickness?: number; color?: string; children?: React.ReactNode;
}) {
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(100, pct)) / 100 * circ;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.paper200} strokeWidth={thickness} />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round" />
        </g>
      </svg>
      {children && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>}
    </div>
  );
}

// ── Horizontal stacked bar ───────────────────────────────────────────
export function StackedBar({ data, height = 14, rounded = true }: {
  data: { label: string; value: number; color: string }[]; height?: number; rounded?: boolean;
}) {
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1;
  return (
    <div className={`flex w-full overflow-hidden ${rounded ? 'rounded-full' : ''}`} style={{ height }}>
      {data.filter((d) => d.value > 0).map((d, i) => (
        <div key={i} style={{ width: `${(d.value / total) * 100}%`, background: d.color }} title={`${d.label}: ${Math.round((d.value / total) * 100)}%`} />
      ))}
    </div>
  );
}

// ── Legend dot ───────────────────────────────────────────────────────
export function Dot({ color }: { color: string }) {
  return <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />;
}

// ── Stat tile ────────────────────────────────────────────────────────
export function StatTile({ label, value, sub, accentClass = '', icon }: {
  label: string; value: string; sub?: string; accentClass?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-ink-faint">
        {icon}
        <p className="text-[11px] font-bold uppercase tracking-wider">{label}</p>
      </div>
      <p className={`font-display text-2xl font-semibold mt-1 tabular-nums ${accentClass}`}>{value}</p>
      {sub && <p className="text-[11px] text-ink-faint mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Pill ─────────────────────────────────────────────────────────────
const PILL: Record<string, string> = {
  red: 'bg-signal-red/10 text-signal-red', amber: 'bg-signal-amber/10 text-signal-amber',
  green: 'bg-signal-green/10 text-signal-green', mint: 'bg-mint-100 text-pine-800',
  gray: 'bg-paper-100 text-ink-soft', pine: 'bg-pine-900 text-white',
};
export function Pill({ children, tone = 'gray' }: { children: React.ReactNode; tone?: keyof typeof PILL }) {
  return <span className={`chip ${PILL[tone]}`}>{children}</span>;
}

// ── Collapsible disclosure ───────────────────────────────────────────
export function Disclosure({ title, subtitle, right, children, defaultOpen = false, left }: {
  title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode;
  children: React.ReactNode; defaultOpen?: boolean; left?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full text-left p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          {left}
          <div className="min-w-0">
            <div className="text-sm font-bold">{title}</div>
            {subtitle && <div className="text-xs text-ink-soft mt-1">{subtitle}</div>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {right}
          <svg className={`transition-transform ${open ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6 1.4-1.4Z" /></svg>
        </div>
      </button>
      {open && <div className="px-5 pb-5 -mt-1">{children}</div>}
    </div>
  );
}

// ── Sticky in-page section nav with active highlighting ──────────────
export function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );
    items.forEach((it) => { const el = document.getElementById(it.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [items]);
  function jump(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  return (
    <div className="sticky top-2 z-10 -mx-1 overflow-x-auto no-print">
      <div className="inline-flex gap-1 rounded-full bg-white/90 backdrop-blur border border-paper-200 p-1 shadow-card">
        {items.map((it) => (
          <button key={it.id} onClick={() => jump(it.id)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${active === it.id ? 'bg-pine-900 text-white' : 'text-ink-soft hover:text-pine-700'}`}>
            {it.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Section heading anchor ───────────────────────────────────────────
export function Section({ id, title, hint, children, action }: {
  id: string; title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="font-display text-xl font-medium">{title}</h2>
          {hint && <p className="text-xs text-ink-soft mt-0.5">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ── Category / topic icons ───────────────────────────────────────────
const ICONS: Record<string, string> = {
  investment: 'M3 13h2v7H3v-7Zm4-4h2v11H7V9Zm4-5h2v16h-2V4Zm4 8h2v8h-2v-8Z',
  tax: 'M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Zm-1 14-4-4 1.4-1.4L11 13.2l5.6-5.6L18 9l-7 7Z',
  insurance: 'M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z',
  debt: 'M3 6h18v2H3V6Zm0 5h18v2H3v-2Zm0 5h12v2H3v-2Z',
  savings: 'M5 4h14a2 2 0 0 1 2 2v3h-3a3 3 0 0 0 0 6h3v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm14 7a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z',
  estate: 'M12 3 2 10h3v9h5v-5h4v5h5v-9h3L12 3Z',
  gold: 'M12 2 4 7v10l8 5 8-5V7l-8-5Z',
};
export function TopicIcon({ name, tone = 'mint' }: { name: string; tone?: 'mint' | 'pine' | 'amber' | 'red' }) {
  const bg = tone === 'pine' ? 'bg-pine-900 text-white' : tone === 'amber' ? 'bg-signal-amber/15 text-signal-amber' : tone === 'red' ? 'bg-signal-red/10 text-signal-red' : 'bg-mint-100 text-pine-700';
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${bg}`}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d={ICONS[name] || ICONS.investment} /></svg>
    </span>
  );
}
