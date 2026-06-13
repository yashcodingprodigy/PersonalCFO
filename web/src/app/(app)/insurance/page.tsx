'use client';

import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { inr } from '@/lib/format';

const SEV: Record<string, string> = {
  high: 'bg-signal-red/10 text-signal-red',
  medium: 'bg-signal-amber/10 text-signal-amber',
  low: 'bg-paper-100 text-ink-soft',
};

function GapCard({ title, current, recommended, gap, extra }: any) {
  const covered = recommended > 0 ? Math.min(100, (current / recommended) * 100) : 100;
  return (
    <div className="card p-6">
      <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">{title}</h2>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold tabular-nums">{inr(current)}</span>
        <span className="text-sm text-ink-faint">of {inr(recommended)} recommended</span>
      </div>
      <div className="mt-3 h-2.5 bg-paper-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${covered >= 100 ? 'bg-signal-green' : covered >= 50 ? 'bg-signal-amber' : 'bg-signal-red'}`} style={{ width: `${covered}%` }} />
      </div>
      {gap > 0 ? (
        <p className="mt-3 text-sm font-semibold text-signal-red">Gap: {inr(gap)}</p>
      ) : (
        <p className="mt-3 text-sm font-semibold text-signal-green">Fully covered</p>
      )}
      {extra}
    </div>
  );
}

export default function InsurancePage() {
  const [ins, setIns] = useState<any>(null);
  useEffect(() => { get('/insurance').then(setIns).catch(() => {}); }, []);
  if (!ins) return <div className="card h-96 animate-pulse mt-4" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium">Insurance analyser</h1>
        <p className="text-sm text-ink-soft mt-1">Coverage measured against standard planning benchmarks — category guidance only, never specific products.</p>
      </div>

      {ins.beginnerIntro && (
        <div className="card p-5 border-l-4 border-l-mint-500">
          <p className="text-sm text-ink-soft leading-relaxed">{ins.beginnerIntro}</p>
        </div>
      )}

      {ins.flags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ins.flags.map((f: any, i: number) => (
            <span key={i} className={`chip ${SEV[f.severity]} !py-1.5 !px-3`}>{f.message}</span>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <GapCard
          title="Term life cover" current={ins.term.current} recommended={ins.term.recommended} gap={ins.term.gap}
          extra={ins.term.premiumEstimateAnnual && (
            <p className="mt-2 text-xs text-ink-soft">
              Closing the gap costs roughly {inr(ins.term.premiumEstimateAnnual.low)}–{inr(ins.term.premiumEstimateAnnual.high)}/year at your age.
            </p>
          )}
        />
        <GapCard title="Health cover" current={ins.health.current} recommended={ins.health.recommended} gap={ins.health.gap} />
      </div>

      {/* Personalised: what you should get */}
      {ins.recommendations?.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">What you should get — in order</h2>
          <div className="space-y-3">
            {ins.recommendations.map((r: any, i: number) => (
              <article key={i} className="card p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3">
                    <span className={`chip ${SEV[r.priority]} shrink-0`}>{r.priority === 'high' ? 'Get this first' : r.priority === 'medium' ? 'Worth getting' : 'Optional'}</span>
                    <div>
                      <h3 className="text-sm font-bold">{r.title}</h3>
                      <p className="text-xs text-ink-soft mt-1 leading-relaxed">{r.whatItIs}</p>
                      <p className="text-xs text-pine-800 mt-2 leading-relaxed"><strong>Why you:</strong> {r.whyForYou}</p>
                      <p className="text-xs text-ink-soft mt-1.5 leading-relaxed"><strong>How:</strong> {r.howTo}</p>
                    </div>
                  </div>
                  {r.estCostAnnual && (
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">{inr(r.estCostAnnual.low)}–{inr(r.estCostAnnual.high)}</p>
                      <p className="text-[11px] text-ink-faint">est. / year</p>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {ins.avoid?.length > 0 && (
        <section className="card p-6 border-l-4 border-l-signal-amber">
          <h2 className="text-sm font-bold uppercase tracking-widest text-signal-amber mb-3">What to avoid</h2>
          <ul className="space-y-2.5 text-sm text-ink-soft leading-relaxed">
            {ins.avoid.map((a: string, i: number) => (
              <li key={i} className="flex gap-2"><span className="text-signal-amber font-bold shrink-0">✕</span>{a}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">What to know</h2>
        <ul className="space-y-3 text-sm text-ink-soft leading-relaxed">
          {[...ins.term.notes, ...ins.health.notes].map((n: string, i: number) => (
            <li key={i} className="flex gap-2"><span className="text-mint-500 font-bold shrink-0">·</span>{n}</li>
          ))}
        </ul>
      </section>

      <p className="text-[11px] text-ink-faint leading-relaxed">{ins.disclaimer}</p>
    </div>
  );
}
