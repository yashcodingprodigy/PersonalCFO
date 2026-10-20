'use client';

// "Your next moves" — the money brain's ranked answer to "what should I do now?".
// Reads /brain (money map + dreams plan + moves) and shows the top moves with a
// plain-language why and a one-tap link to where it gets done.

import Link from 'next/link';
import { inr } from '@/lib/format';

const URG: Record<string, { label: string; cls: string }> = {
  now: { label: 'Now', cls: 'bg-signal-red/10 text-signal-red' },
  soon: { label: 'Soon', cls: 'bg-signal-amber/10 text-signal-amber' },
  anytime: { label: 'Anytime', cls: 'bg-paper-100 text-ink-soft' },
};

export function NextMoves({ brain, max = 4 }: { brain: any; max?: number }) {
  if (!brain) return null;
  const moves: any[] = (brain.moves || []).slice(0, max);
  const plan = brain.plan || {};
  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint">Your next moves</p>
          <p className="font-display text-xl mt-1 leading-snug max-w-xl">{plan.summary || 'Here’s what matters most right now.'}</p>
        </div>
        {plan.hasData && (
          <div className="flex gap-2 flex-wrap">
            <span className="chip bg-mint-100 text-pine-800">Guilt-free: {inr(plan.joyBudget)}/mo</span>
            {brain.map?.excessCash > 0 && <span className="chip bg-paper-100 text-ink-soft">Spare cash: {inr(brain.map.excessCash)}</span>}
          </div>
        )}
      </div>

      {moves.length === 0 ? (
        <p className="text-sm text-ink-soft mt-4">You’re all caught up. I’ll tap you when something needs a decision.</p>
      ) : (
        <ol className="mt-4 divide-y divide-paper-200">
          {moves.map((m, i) => (
            <li key={m.id} className="py-3.5 flex items-start gap-3">
              <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-pine-900 text-white text-xs font-bold grid place-items-center tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{m.title}</p>
                  <span className={`chip !text-[10px] ${URG[m.urgency]?.cls || URG.anytime.cls}`}>{URG[m.urgency]?.label || 'Anytime'}</span>
                  {m.impact && <span className="chip !text-[10px] bg-mint-100 text-pine-800">{m.impact}</span>}
                </div>
                <p className="text-sm text-ink-soft mt-1 leading-relaxed">{m.why}</p>
              </div>
              <Link href={m.href} className="shrink-0 text-xs font-bold text-pine-700 hover:text-pine-900 whitespace-nowrap mt-0.5">{m.cta} →</Link>
            </li>
          ))}
        </ol>
      )}
      {(brain.moves || []).length > max && (
        <Link href="/actions" className="mt-1 inline-block text-xs text-pine-700 underline">See all {brain.moves.length} moves</Link>
      )}
    </section>
  );
}
