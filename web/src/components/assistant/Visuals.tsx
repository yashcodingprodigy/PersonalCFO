'use client';

// Visual cards under an Ask PayWatch reply (D-55): dream plan, cost split, savings path,
// price tiers and the afford verdict. All numbers come from the server's brain (paise).

import { inr } from '@/lib/format';

type V = any;
const PALETTE = ['#16544B', '#2FBC9B', '#E0A23B', '#2E86C1', '#8E5FD0', '#D45FA2'];
const isHi = (s?: string) => /[ऀ-ॿ]/.test(s || '');
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_HI = ['जन', 'फ़र', 'मार्च', 'अप्रै', 'मई', 'जून', 'जुला', 'अग', 'सित', 'अक्टू', 'नव', 'दिस'];
const ym = (s: string | null | undefined, hi: boolean) => {
  if (!s) return '—';
  const [y, m] = s.split('-');
  return `${(hi ? MONTHS_HI : MONTHS_EN)[Number(m) - 1]} ${y}`;
};
const STATUS: Record<string, { en: string; hi: string; cls: string }> = {
  achieved: { en: 'Done', hi: 'पूरा', cls: 'bg-mint-100 text-pine-800' },
  on_track: { en: 'On track', hi: 'सही रास्ते पर', cls: 'bg-mint-100 text-pine-800' },
  stretch: { en: 'A stretch', hi: 'थोड़ा मुश्किल', cls: 'bg-gold-100 text-gold-700' },
  needs_tradeoff: { en: 'Needs a trade-off', hi: 'कुछ बदलना होगा', cls: 'bg-signal-red/10 text-signal-red' },
};
const VERDICT: Record<string, { en: string; hi: string; cls: string; icon: string }> = {
  yes_now: { en: 'Yes, today', hi: 'हाँ, आज ही', cls: 'bg-signal-green text-white', icon: '✓' },
  yes_by: { en: 'Yes, with a plan', hi: 'हाँ, प्लान से', cls: 'bg-pine-900 text-white', icon: '✓' },
  stretch: { en: 'A stretch', hi: 'थोड़ा मुश्किल', cls: 'bg-gold-500 text-white', icon: '!' },
  not_yet: { en: 'Not yet', hi: 'अभी नहीं', cls: 'bg-signal-red text-white', icon: '×' },
};

function Shell({ title, children, note }: { title?: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-xl border border-paper-200 bg-white p-3.5 pw-vis-in">
      {title && <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2.5">{title}</p>}
      {children}
      {note && <p className="text-[10.5px] text-ink-faint mt-2.5 leading-snug">{note}</p>}
    </div>
  );
}

function DreamCard({ v }: { v: V }) {
  const hi = isHi(v.title);
  const st = STATUS[v.status] || STATUS.on_track;
  const pct = Math.round((v.progress || 0) * 100);
  const r = 26, c = 2 * Math.PI * r;
  return (
    <div className="rounded-xl overflow-hidden border border-pine-900/10 pw-vis-in">
      <div className="p-3.5 text-white flex items-center gap-3.5" style={{ background: 'linear-gradient(135deg,#0B2F2A 0%,#16544B 100%)' }}>
        <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0" aria-hidden>
          <circle cx="32" cy="32" r={r} stroke="rgba(255,255,255,.15)" strokeWidth="6" fill="none" />
          <circle cx="32" cy="32" r={r} stroke="#4ECCAE" strokeWidth="6" fill="none" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - (v.progress || 0))} transform="rotate(-90 32 32)" className="pw-ring-draw" />
          <text x="32" y="36" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{pct}%</text>
        </svg>
        <div className="min-w-0">
          <p className="font-semibold leading-tight truncate">{v.title}</p>
          <span className={`inline-block mt-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{hi ? st.hi : st.en}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-paper-200">
        {[
          [hi ? 'लक्ष्य' : 'Target', inr(v.target)],
          [hi ? 'जमा' : 'Saved', inr(v.saved)],
          [hi ? 'हर महीने' : 'Per month', inr(v.allocated || v.monthlyNeed)],
          [hi ? 'कब तक' : 'Done by', ym(v.eta || v.targetDate, hi)],
        ].map(([l, val]) => (
          <div key={l} className="bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-ink-faint font-bold">{l}</p>
            <p className="text-sm font-semibold tabular-nums">{val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Breakdown({ v }: { v: V }) {
  return (
    <Shell title={v.title} note={v.note}>
      <div className="flex h-3 rounded-full overflow-hidden">
        {v.parts.map((p: any, i: number) => (
          <div key={i} className="pw-grow" style={{ width: `${p.pct * 100}%`, background: PALETTE[i % PALETTE.length], animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {v.parts.map((p: any, i: number) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
            <span className="flex-1 text-ink-soft">{p.label}</span>
            <span className="font-semibold tabular-nums">{inr(p.amount)}</span>
            <span className="w-9 text-right text-ink-faint tabular-nums">{Math.round(p.pct * 100)}%</span>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function Path({ v }: { v: V }) {
  const hi = isHi(v.title);
  const W = 300, H = 120, P = 8;
  const all = v.series.flatMap((s: any) => s.points);
  const months = Array.from(new Set(all.map((p: any) => p.m))).sort() as string[];
  const x = (m: string) => P + ((W - 2 * P) * months.indexOf(m)) / Math.max(1, months.length - 1);
  const y = (val: number) => H - P - ((H - 2 * P) * val) / Math.max(1, v.target);
  const line = (pts: any[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.m).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const colors = ['#2FBC9B', '#E0A23B'];
  return (
    <Shell title={v.title} note={v.note}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={v.title}>
        <line x1={P} x2={W - P} y1={y(v.target)} y2={y(v.target)} stroke="#E7E2D6" strokeDasharray="4 4" />
        <text x={W - P} y={y(v.target) - 4} textAnchor="end" fontSize="9" fill="#7C8782">{inr(v.target)}</text>
        {v.series.map((s: any, i: number) => (
          <path key={i} d={line(s.points)} fill="none" stroke={colors[i]} strokeWidth={i ? 2 : 2.5} {...(i ? { strokeDasharray: '5 4', className: 'pw-vis-in' } : { pathLength: 1, className: 'pw-line-draw' })} />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-ink-faint mt-0.5"><span>{ym(months[0], hi)}</span><span>{ym(months[months.length - 1], hi)}</span></div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {v.series.map((s: any, i: number) => (
          <div key={i} className="rounded-lg bg-paper-50 border border-paper-200 px-2.5 py-1.5">
            <p className="text-[10px] font-bold flex items-center gap-1.5" style={{ color: colors[i] }}><span className="w-3 h-0.5 inline-block" style={{ background: colors[i] }} />{s.label}</p>
            <p className="text-xs font-semibold">{hi ? 'पूरा: ' : 'Done: '}{ym(s.reach, hi)}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function Tiers({ v }: { v: V }) {
  const max = Math.max(...v.options.map((o: any) => o.amount), 1);
  return (
    <Shell title={v.title} note={v.note}>
      <div className="space-y-2">
        {v.options.map((o: any, i: number) => (
          <div key={i}>
            <div className="flex justify-between text-xs mb-1">
              <span className={i === v.highlight ? 'font-bold text-pine-800' : 'text-ink-soft'}>{o.label}{i === v.highlight ? ' ★' : ''}</span>
              <span className="font-semibold tabular-nums">{inr(o.amount)}</span>
            </div>
            <div className="h-2 rounded-full bg-paper-100 overflow-hidden">
              <div className="h-full rounded-full pw-grow" style={{ width: `${(o.amount / max) * 100}%`, background: i === v.highlight ? '#16544B' : '#83DEC7', animationDelay: `${i * 80}ms` }} />
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

function Afford({ v }: { v: V }) {
  const hi = isHi(v.headline);
  const vd = VERDICT[v.verdict] || VERDICT.stretch;
  return (
    <div className="rounded-xl border border-paper-200 bg-white p-3.5 flex gap-3 pw-vis-in">
      <span className={`w-9 h-9 rounded-full grid place-items-center font-bold shrink-0 ${vd.cls}`}>{vd.icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{hi ? 'क्या मैं ले सकता हूँ?' : 'Can I afford it?'} · {hi ? vd.hi : vd.en}</p>
        <p className="text-sm mt-1 leading-snug">{v.headline}</p>
        {v.affects?.length > 0 && (
          <p className="text-xs text-signal-amber mt-1.5">{hi ? 'असर: ' : 'Moves: '}{v.affects.map((a: any) => `${a.name}${a.newDate ? ` → ${ym(a.newDate, hi)}` : ''}`).join(', ')}</p>
        )}
      </div>
    </div>
  );
}

export function ReplyVisuals({ visuals }: { visuals?: V[] | null }) {
  if (!visuals?.length) return null;
  return (
    <div className="mt-3 space-y-2.5" data-no-translate>
      {visuals.map((v, i) => {
        if (v.type === 'dream') return <DreamCard key={i} v={v} />;
        if (v.type === 'breakdown') return <Breakdown key={i} v={v} />;
        if (v.type === 'path') return <Path key={i} v={v} />;
        if (v.type === 'tiers') return <Tiers key={i} v={v} />;
        if (v.type === 'afford') return <Afford key={i} v={v} />;
        return null;
      })}
    </div>
  );
}
