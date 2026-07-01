'use client';
import { LoadingScreen } from '@/components/Skeleton';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { get } from '@/lib/api';
import { inr, inrRange } from '@/lib/format';
import { Ring, Disclosure, SectionNav, Section, Pill, C } from '@/components/kit';
import { InsurancePolicies } from '@/components/InsurancePolicies';

const INSURANCE_QUIPS = [
  'Reading the fine print so you don’t have to…',
  'Checking who actually pays their claims…',
  'Comparing insurers who’d rather you didn’t…',
  'Working out how much “peace of mind” costs…',
  'Sizing your cover, not overselling it…',
  'Separating real protection from sales pitches…',
];

const SEV_TONE: Record<string, any> = { high: 'red', medium: 'amber', low: 'gray' };
const PRIORITY_LABEL: Record<string, string> = { high: 'Get this first', medium: 'Worth getting', low: 'Optional' };

function CoverageCard({ title, current, recommended, gap, extra }: any) {
  const covered = recommended > 0 ? Math.min(100, (current / recommended) * 100) : 100;
  const color = covered >= 100 ? C.green : covered >= 50 ? C.amber : C.red;
  return (
    <div className="card p-6 flex items-center gap-5">
      <Ring pct={covered} size={104} color={color}>
        <p className="font-display text-lg font-semibold tabular-nums">{Math.round(covered)}%</p>
        <p className="text-[9px] uppercase tracking-wider text-ink-faint">covered</p>
      </Ring>
      <div className="min-w-0">
        <h3 className="text-sm font-bold uppercase tracking-widest text-ink-faint">{title}</h3>
        <p className="font-display text-2xl font-semibold mt-1 tabular-nums">{inr(current)}</p>
        <p className="text-xs text-ink-faint">target {recommended > 0 ? inrRange(recommended) : '—'}</p>
        {recommended > 0 && gap > 0 ? <p className="mt-1 text-sm font-semibold text-signal-red">Gap: {inrRange(gap)}</p>
          : <p className="mt-1 text-sm font-semibold text-signal-green">{recommended === 0 ? 'Not needed yet' : 'Fully covered'}</p>}
        {extra}
      </div>
    </div>
  );
}

export default function InsurancePage() {
  const [ins, setIns] = useState<any>(null);
  const loadIns = () => get('/insurance').then(setIns).catch(() => {});
  useEffect(() => { loadIns(); }, []);
  return (
    <div className="relative min-h-[60vh]">
      <LoadingScreen loading={!ins} quips={INSURANCE_QUIPS} />
      {ins && (
    <div className="space-y-5 pw-page-in">
      <div>
        <h1 className="font-display text-3xl font-medium">Insurance</h1>
        <p className="text-sm text-ink-soft mt-1">Measured against standard planning benchmarks — category guidance only, never specific products.</p>
      </div>

      <SectionNav items={[{ id: 'policies', label: 'My policies' }, { id: 'coverage', label: 'Coverage' }, { id: 'get', label: 'What to get' }, { id: 'notes', label: 'Good to know' }]} />

      {ins.beginnerIntro && (
        <div className="card p-5 border-l-4 border-l-mint-500"><p className="text-sm text-ink-soft leading-relaxed">{ins.beginnerIntro}</p></div>
      )}

      {ins.flags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ins.flags.map((f: any, i: number) => <Pill key={i} tone={SEV_TONE[f.severity]}>{f.message}</Pill>)}
        </div>
      )}

      {/* Marketplace CTA — find & compare real plans */}
      <Link href="/insurance/market" className="group block card text-white overflow-hidden relative p-6 hover:ring-2 hover:ring-mint-500/50 transition-all" style={{ background: 'linear-gradient(135deg,#0F3D34 0%,#134e43 60%,#177a67 130%)' }}>
        <div className="absolute -top-16 -right-8 w-56 h-56 rounded-full bg-mint-500/15 blur-3xl pw-blob pointer-events-none" aria-hidden />
        <div className="relative flex items-center gap-5">
          <span className="hidden sm:flex shrink-0 items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-mint-400 to-mint-500 text-pine-950 shadow-lg shadow-mint-500/20">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Zm-1 14-4-4 1.4-1.4L11 13.2l5.6-5.6L18 9l-7 7Z" /></svg>
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-mint-300">Marketplace</span>
            <h3 className="font-display text-xl font-semibold mt-0.5">Find your best-fit cover</h3>
            <p className="text-sm text-white/70 mt-1 max-w-lg leading-relaxed">Real plans from top insurers, ranked for your profile with indicative premiums — compare and apply in minutes.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {['Term life', 'Health', 'Motor', 'Personal accident', 'Travel'].map((c) => (
                <span key={c} className="rounded-full bg-white/10 border border-white/15 px-2.5 py-1 text-[11px] text-white/85">{c}</span>
              ))}
            </div>
          </div>
          <span className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white text-pine-950 px-5 py-2.5 text-sm font-bold group-hover:bg-mint-100 transition-colors">Compare plans <span className="group-hover:translate-x-0.5 transition-transform">→</span></span>
        </div>
      </Link>

      {/* My policies — upload, AI-read, expiry tracking */}
      <Section id="policies" title="My policies">
        <InsurancePolicies onChange={loadIns} />
      </Section>

      {/* Coverage rings */}
      <Section id="coverage" title="Your coverage">
        <div className="grid lg:grid-cols-2 gap-6">
          <CoverageCard title="Term life cover" current={ins.term.current} recommended={ins.term.recommended} gap={ins.term.gap}
            extra={ins.term.premiumEstimateAnnual && <p className="mt-2 text-xs text-ink-soft">Closing the gap: ~{inr(ins.term.premiumEstimateAnnual.low)}–{inr(ins.term.premiumEstimateAnnual.high)}/yr.</p>} />
          <CoverageCard title="Health cover" current={ins.health.current} recommended={ins.health.recommended} gap={ins.health.gap} />
        </div>
      </Section>

      {/* What to get — collapsible recommendations */}
      {ins.recommendations?.length > 0 && (
        <Section id="get" title="What you should get — in order">
          <div className="space-y-2.5">
            {ins.recommendations.map((r: any, i: number) => (
              <Disclosure key={i}
                left={<Pill tone={SEV_TONE[r.priority]}>{PRIORITY_LABEL[r.priority]}</Pill>}
                title={r.title}
                right={r.estCostAnnual ? <span className="text-xs font-semibold tabular-nums whitespace-nowrap text-ink-soft">{inr(r.estCostAnnual.low)}–{inr(r.estCostAnnual.high)}/yr</span> : undefined}>
                <p className="text-xs text-ink-soft leading-relaxed border-t border-paper-100 pt-3">{r.whatItIs}</p>
                <p className="text-xs text-pine-800 mt-2 leading-relaxed"><strong>Why you:</strong> {r.whyForYou}</p>
                <p className="text-xs text-ink-soft mt-1.5 leading-relaxed"><strong>How:</strong> {r.howTo}</p>
              </Disclosure>
            ))}
          </div>
        </Section>
      )}

      {ins.avoid?.length > 0 && (
        <section className="card p-6 border-l-4 border-l-signal-amber">
          <h2 className="text-sm font-bold uppercase tracking-widest text-signal-amber mb-3">What to avoid</h2>
          <ul className="space-y-2.5 text-sm text-ink-soft leading-relaxed">
            {ins.avoid.map((a: string, i: number) => <li key={i} className="flex gap-2"><span className="text-signal-amber font-bold shrink-0">✕</span>{a}</li>)}
          </ul>
        </section>
      )}

      {/* Notes */}
      <Section id="notes" title="Good to know">
        <div className="card p-6">
          <ul className="space-y-3 text-sm text-ink-soft leading-relaxed">
            {[...ins.term.notes, ...ins.health.notes].map((n: string, i: number) => (
              <li key={i} className="flex gap-2"><span className="text-mint-500 font-bold shrink-0">·</span>{n}</li>
            ))}
          </ul>
        </div>
      </Section>

      <p className="text-[11px] text-ink-faint leading-relaxed">{ins.disclaimer}</p>
    </div>
      )}
    </div>
  );
}
