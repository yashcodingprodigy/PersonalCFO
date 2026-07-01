'use client';
import { PageSkeleton } from '@/components/Skeleton';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api';
import { SectionNav, Section, C } from '@/components/kit';

const RISK_STYLE: Record<string, string> = {
  Low: 'bg-mint-100 text-pine-800',
  Medium: 'bg-signal-amber/10 text-signal-amber',
  High: 'bg-signal-red/10 text-signal-red',
};
const RISK_BAR: Record<string, string> = { Low: C.mint500, Medium: C.amber, High: C.red };

function timeAgo(d: string | null): string {
  if (!d) return '';
  const t = new Date(d).getTime();
  if (isNaN(t)) return '';
  const h = Math.floor((Date.now() - t) / 3600000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function MarketsPage() {
  const [m, setM] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => { get('/market').then(setM).catch((e) => setErr(e.message)); }, []);

  if (err) return <p className="text-signal-red text-sm mt-8">{err}</p>;
  if (!m) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium">News & markets</h1>
        <p className="text-sm text-ink-soft mt-1">The latest financial news first — plus investment themes explained simply.</p>
      </div>

      <SectionNav items={[{ id: 'news', label: 'News' }, { id: 'themes', label: 'Themes' }, { id: 'basics', label: 'Basics' }]} />

      <div className="card p-4 border-l-4 border-l-signal-amber">
        <p className="text-xs text-ink-soft leading-relaxed">
          <strong>Education, not tips.</strong> We don&apos;t list &ldquo;stocks to buy&rdquo; or predict prices — that needs a SEBI licence we don&apos;t hold. Instead we explain the <em>types</em> of investments and share news so you can learn and decide for yourself.
        </p>
      </div>

      {/* News (now first) */}
      <section id="news" className="card p-6 scroll-mt-20">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Latest financial news</h2>
        {m.news.length === 0 ? (
          <p className="text-sm text-ink-soft">{m.newsError ? 'News couldn’t be loaded right now — try again shortly.' : 'No recent headlines.'}</p>
        ) : (
          <ul className="divide-y divide-paper-100">
            {m.news.map((n: any, i: number) => (
              <li key={i} className="py-3">
                <a href={n.link} target="_blank" rel="noopener noreferrer" className="group flex items-start justify-between gap-3">
                  <span className="text-sm text-ink group-hover:text-pine-700 leading-snug">{n.title}</span>
                  <span className="text-[11px] text-ink-faint whitespace-nowrap shrink-0 mt-0.5">{timeAgo(n.published)}</span>
                </a>
                <p className="text-[11px] text-ink-faint mt-1">{n.source}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-ink-faint mt-3">Headlines are third-party news shown for awareness, opening on the publisher&apos;s site.</p>
      </section>

      {/* Trending themes */}
      <Section id="themes" title="Trending investment themes" hint="The building blocks, explained simply."
        action={<Link href="/invest" className="text-sm font-semibold text-pine-700 hover:underline whitespace-nowrap">Fit to my profile →</Link>}>
        <div className="grid sm:grid-cols-2 gap-4">
          {m.themes.map((t: any, i: number) => (
            <div key={i} className="card p-5 flex gap-4">
              <span className="w-1.5 rounded-full shrink-0" style={{ background: RISK_BAR[t.risk] }} />
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-bold">{t.theme}</h3>
                  <span className={`chip shrink-0 ${RISK_STYLE[t.risk]}`}>{t.risk} risk</span>
                </div>
                <p className="text-xs text-ink-soft mt-2 leading-relaxed">{t.whatItIs}</p>
                <p className="text-xs text-pine-800 mt-2 leading-relaxed"><strong>Who it suits:</strong> {t.whoItSuits}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Basics */}
      <section id="basics" className="card p-6 scroll-mt-20">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Smart-investor basics</h2>
        <ul className="space-y-2.5 text-sm text-ink-soft leading-relaxed">
          {m.basics.map((b: string, i: number) => (
            <li key={i} className="flex gap-2"><span className="text-mint-500 font-bold shrink-0">·</span>{b}</li>
          ))}
        </ul>
      </section>

      <p className="text-[11px] text-ink-faint leading-relaxed">{m.disclaimer}</p>
    </div>
  );
}
