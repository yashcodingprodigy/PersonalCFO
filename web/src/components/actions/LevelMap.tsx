'use client';

// "Money Quest" — a Candy-Crush-style level map for the action plan. Every action is a level on a winding
// path: finished levels glow with a star, the current level pulses with a "you are here" pin, the rest
// wait locked above. Levels are grouped into worlds. Completing an action moves you up a level.

import { useEffect, useMemo, useRef } from 'react';

export interface Level { id: string; title: string; done: boolean; points: number; n: number }

const WORLDS = [
  { name: 'Sprout Valley', emoji: '🌱', bg: '#E6F6EE', ink: '#16544B' },
  { name: 'Shield Fort', emoji: '🛡️', bg: '#E4F0FA', ink: '#1B4F72' },
  { name: 'Tax Canyon', emoji: '🧾', bg: '#F1EAFB', ink: '#5B3A8E' },
  { name: 'Wealth Woods', emoji: '🌳', bg: '#FFF3DA', ink: '#9A6B12' },
  { name: 'Freedom Peak', emoji: '🏔️', bg: '#FCE7F1', ink: '#94306A' },
];
const PER_WORLD = 5;
export const worldOf = (n: number) => WORLDS[Math.min(WORLDS.length - 1, Math.floor((n - 1) / PER_WORLD))];

/** Done actions first (oldest completion = level 1), then open ones in the order you should do them. */
export function buildLevels(actions: any[]): Level[] {
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const done = actions.filter((a) => a.status === 'done')
    .sort((a, b) => String(a.completed_at || '').localeCompare(String(b.completed_at || '')));
  const open = actions.filter((a) => ['pending', 'in_progress', 'deferred'].includes(a.status))
    .sort((a, b) => (rank[a.priority || 'medium'] - rank[b.priority || 'medium']) || (b.impact_score - a.impact_score));
  return [...done, ...open].map((a, i) => ({ id: a.action_id, title: a.title, done: a.status === 'done', points: Number(a.impact_score) || 0, n: i + 1 }));
}

const GAP = 92, W = 260, AMP = 70, R = 24;

export function LevelMap({ actions, onPick, celebrate }: { actions: any[]; onPick: (id: string) => void; celebrate?: number }) {
  const levels = useMemo(() => buildLevels(actions), [actions]);
  const scroller = useRef<HTMLDivElement>(null);
  const current = levels.find((l) => !l.done);
  const doneCount = levels.filter((l) => l.done).length;
  const xpDone = levels.filter((l) => l.done).reduce((s, l) => s + l.points, 0);
  const xpAll = levels.reduce((s, l) => s + l.points, 0) || 1;
  const height = Math.max(levels.length, 1) * GAP + 120;
  // Level 1 at the bottom, climbing upward (like Candy Crush).
  const pos = (n: number) => ({ x: W / 2 + Math.sin((n - 1) * 1.1) * AMP, y: height - 70 - (n - 1) * GAP });

  const path = useMemo(() => {
    if (!levels.length) return { all: '', done: '' };
    const pts = levels.map((l) => pos(l.n));
    const seg = (to: number) => pts.slice(0, to).reduce((d, p, i) => {
      if (i === 0) return `M${p.x},${p.y}`;
      const q = pts[i - 1]; const my = (q.y + p.y) / 2;
      return `${d} C${q.x},${my} ${p.x},${my} ${p.x},${p.y}`;
    }, '');
    return { all: seg(pts.length), done: seg(Math.max(1, doneCount + (current ? 1 : 0))) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels, doneCount, height]);

  // Keep "you are here" in view.
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const target = current ? pos(current.n).y : 0;
    el.scrollTo({ top: Math.max(0, target - el.clientHeight / 2), behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, levels.length]);

  const levelNo = current ? current.n : levels.length;
  const world = worldOf(Math.max(1, levelNo));

  return (
    <aside className="card overflow-hidden relative lg:sticky lg:top-6">
      {/* Header: level + XP */}
      <div className="p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(150deg,#07211D 0%,#16544B 100%)' }}>
        <div className="absolute -top-10 -right-8 w-36 h-36 rounded-full bg-mint-500/20 blur-2xl" aria-hidden />
        <p className="text-[10px] font-extrabold uppercase tracking-[.25em] text-mint-300">Money Quest</p>
        <div className="flex items-end justify-between mt-1">
          <p className="font-display text-3xl font-semibold">{current ? `Level ${levelNo}` : levels.length ? 'All levels cleared!' : 'Level 1'}</p>
          <p className="text-xs text-white/70 mb-1">{doneCount}/{levels.length} done</p>
        </div>
        <p className="text-xs text-white/75 mt-0.5">{world.emoji} {world.name}</p>
        <div className="mt-3 h-2.5 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-mint-400 to-gold-500 transition-all duration-700" style={{ width: `${Math.round((xpDone / xpAll) * 100)}%` }} />
        </div>
        <p className="text-[11px] text-white/70 mt-1.5">{xpDone} / {xpAll} score points earned</p>
      </div>

      {/* The map */}
      <div ref={scroller} className="relative h-[380px] lg:h-[540px] overflow-y-auto overflow-x-hidden pw-deck" aria-label="Level map">
        {levels.length === 0 ? (
          <p className="p-6 text-sm text-ink-soft text-center">Your levels appear here as PayWatch finds steps for you.</p>
        ) : (
          <div className="relative mx-auto" style={{ width: W, height }}>
            {/* world bands */}
            {Array.from({ length: Math.ceil(levels.length / PER_WORLD) }).map((_, w) => {
              const first = w * PER_WORLD + 1, last = Math.min(levels.length, first + PER_WORLD - 1);
              const top = pos(last).y - GAP / 2, bottom = pos(first).y + GAP / 2;
              const wd = WORLDS[Math.min(WORLDS.length - 1, w)];
              return (
                <div key={w} className="absolute -left-10 -right-10" style={{ top, height: bottom - top, background: wd.bg }}>
                  <span className="absolute right-12 bottom-2 rounded-full bg-white/80 px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-[.16em] shadow-sm" style={{ color: wd.ink }}>{wd.emoji} {wd.name}</span>
                </div>
              );
            })}
            <svg className="absolute inset-0" width={W} height={height} aria-hidden>
              <path d={path.all} fill="none" stroke="#E7E2D6" strokeWidth={14} strokeLinecap="round" />
              <path d={path.all} fill="none" stroke="#fff" strokeWidth={4} strokeDasharray="2 12" strokeLinecap="round" />
              <path d={path.done} fill="none" stroke="#2FBC9B" strokeWidth={14} strokeLinecap="round" className="pw-quest-path" />
            </svg>
            {levels.map((l) => {
              const p = pos(l.n);
              const isCur = current?.id === l.id;
              return (
                <button key={l.id} onClick={() => onPick(l.id)} title={l.title}
                  className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none" style={{ left: p.x, top: p.y }}>
                  {isCur && (
                    <span className="absolute left-1/2 -translate-x-1/2 -top-11 pw-quest-pin" aria-hidden>
                      <svg width="30" height="38" viewBox="0 0 30 38"><path d="M15 37s13-13.3 13-22A13 13 0 0 0 2 15c0 8.7 13 22 13 22z" fill="#E5484D" /><circle cx="15" cy="15" r="6" fill="#fff" /></svg>
                    </span>
                  )}
                  <span className={`relative grid place-items-center rounded-full font-display font-bold border-4 shadow-md transition-transform group-hover:scale-110
                    ${l.done ? 'bg-gradient-to-br from-gold-500 to-[#F59E0B] border-white text-white' : isCur ? 'bg-gradient-to-br from-mint-400 to-pine-600 border-white text-white pw-quest-cur' : 'bg-paper-100 border-white text-ink-faint'}`}
                    style={{ width: isCur ? R * 2.5 : R * 2, height: isCur ? R * 2.5 : R * 2, fontSize: isCur ? 20 : 15 }}>
                    {l.done ? '★' : l.n}
                    {!l.done && !isCur && <span className="absolute -bottom-1 -right-1 text-[11px]" aria-hidden>🔒</span>}
                  </span>
                  <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-1.5 w-40 text-center text-[10.5px] leading-tight font-semibold text-ink-soft opacity-0 group-hover:opacity-100 transition-opacity bg-white/95 rounded-lg px-2 py-1 shadow">
                    Level {l.n}: {l.title}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {celebrate ? <Confetti key={celebrate} /> : null}
      {current && (
        <div className="p-4 border-t border-paper-100">
          <p className="text-[10px] font-extrabold uppercase tracking-[.2em] text-ink-faint">Next up · Level {current.n}</p>
          <button onClick={() => onPick(current.id)} className="mt-1 text-sm font-bold text-left hover:text-pine-700">{current.title} →</button>
          <p className="text-[11px] text-ink-faint mt-0.5">+{current.points} score points when you finish it</p>
        </div>
      )}
    </aside>
  );
}

function Confetti() {
  const bits = Array.from({ length: 28 });
  const colors = ['#2FBC9B', '#E0A23B', '#E5484D', '#2E86C1', '#8E5FD0'];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bits.map((_, i) => (
        <span key={i} className="pw-confetti absolute top-0 w-2 h-3 rounded-sm"
          style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 7) * 60}ms`, transform: `rotate(${i * 29}deg)` }} />
      ))}
    </div>
  );
}
