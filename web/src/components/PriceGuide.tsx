'use client';

// Live "what does this usually cost?" card under a dream's name field.
// Debounced as the user types; tap an option to fill the cost field.

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { inr } from '@/lib/format';

interface Opt { label: string; amount: number; note?: string }
interface Guide { found: boolean; item: string; location?: string; options: Opt[]; low: number; typical: number; high: number; basis: string; source: 'table' | 'ai'; disclaimer: string }

export function PriceGuide({ text, onPick, selected }: { text: string; onPick: (rupees: string) => void; selected?: string }) {
  const [g, setG] = useState<Guide | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = text.trim();
    if (q.length < 3) { setG(null); return; }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await api<Guide>('/brain/price-guide', { method: 'POST', body: JSON.stringify({ text: q }) });
        if (my === seq.current) setG(r.found ? r : null);
      } catch { if (my === seq.current) setG(null); }
      finally { if (my === seq.current) setLoading(false); }
    }, 550);
    return () => clearTimeout(t);
  }, [text]);

  if (!g && !loading) return null;
  return (
    <div className="rounded-2xl border border-mint-500/30 bg-mint-100/40 p-4 pw-fade-in" aria-live="polite">
      {loading && !g ? (
        <p className="text-xs text-ink-soft flex items-center gap-2"><span className="pw-typing"><i /><i /><i /></span>Looking up typical prices…</p>
      ) : g && (
        <>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <p className="text-sm font-bold text-pine-800">
              {g.item}{g.location ? ` · ${g.location}` : ''}
            </p>
            <p className="text-xs text-ink-soft">Usually <strong className="text-ink">{inr(g.low)} – {inr(g.high)}</strong></p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {g.options.map((o) => {
              const rupees = String(Math.round(o.amount / 100));
              const on = selected === rupees;
              return (
                <button type="button" key={o.label} onClick={() => onPick(rupees)} title={o.note || ''}
                  className={`text-left rounded-xl border px-3 py-2 transition-colors ${on ? 'bg-pine-900 border-pine-900 text-white' : 'bg-white border-paper-200 hover:border-pine-600'}`}>
                  <span className={`block text-[11px] ${on ? 'text-mint-300' : 'text-ink-faint'}`}>{o.label}</span>
                  <span className="block text-sm font-bold tabular-nums">{inr(o.amount)}</span>
                  {o.note && <span className={`block text-[10px] mt-0.5 max-w-[220px] ${on ? 'text-white/70' : 'text-ink-faint'}`}>{o.note}</span>}
                </button>
              );
            })}
          </div>
          <p className="mt-2.5 text-[11px] text-ink-soft">{g.basis} Tap one to use it.</p>
          <p className="text-[10px] text-ink-faint mt-0.5">{g.disclaimer}{g.source === 'ai' ? ' · AI estimate' : ''}</p>
        </>
      )}
    </div>
  );
}
