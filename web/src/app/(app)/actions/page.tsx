'use client';

import { useEffect, useState } from 'react';
import { get, patch } from '@/lib/api';

const DIFF_STYLE: Record<string, string> = {
  easy: 'bg-mint-100 text-pine-800',
  medium: 'bg-signal-amber/10 text-signal-amber',
  hard: 'bg-signal-red/10 text-signal-red',
};

export default function ActionsPage() {
  const [actions, setActions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open');
  const [toast, setToast] = useState('');

  async function load() {
    const [a, s] = await Promise.all([get('/actions'), get('/actions/stats/summary')]);
    setActions(a); setStats(s);
  }
  useEffect(() => { load().catch(() => {}); }, []);

  async function setStatus(id: string, status: string) {
    const updated = await patch(`/actions/${id}/status`, { status });
    setActions((prev) => prev.map((a) => (a.action_id === id ? { ...a, ...updated } : a)));
    if (status === 'done') {
      setToast('Action completed — your score has been recalculated.');
      setTimeout(() => setToast(''), 4000);
      get('/actions/stats/summary').then(setStats).catch(() => {});
    }
  }

  const visible = actions.filter((a) =>
    filter === 'all' ? true : filter === 'done' ? a.status === 'done' : ['pending', 'in_progress', 'deferred'].includes(a.status)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">Action plan</h1>
          <p className="text-sm text-ink-soft mt-1">Specific, quantified steps — sorted by score impact.</p>
        </div>
        {stats && (
          <div className="flex gap-6 text-center">
            <div><p className="font-display text-2xl font-semibold">{stats.done_this_month}</p><p className="text-[11px] text-ink-faint uppercase tracking-wider font-bold">done this month</p></div>
            <div><p className="font-display text-2xl font-semibold">{stats.open}</p><p className="text-[11px] text-ink-faint uppercase tracking-wider font-bold">open</p></div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {(['open', 'done', 'all'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize transition-colors ${filter === f ? 'bg-pine-900 text-white' : 'bg-white border border-paper-200 text-ink-soft hover:border-pine-600'}`}>
            {f}
          </button>
        ))}
      </div>

      {toast && <div className="rounded-xl bg-mint-100 text-pine-800 text-sm font-semibold px-4 py-3">{toast}</div>}

      <div className="space-y-4">
        {visible.length === 0 && (
          <div className="card p-10 text-center text-sm text-ink-soft">
            {filter === 'open' ? 'Nothing pending. Your financial plan is on track — actions appear here when your data suggests a move.' : 'Nothing here yet.'}
          </div>
        )}
        {visible.map((a) => (
          <article key={a.action_id} className={`card overflow-hidden ${a.status === 'done' ? 'opacity-60' : ''}`}>
            <button className="w-full text-left p-5" onClick={() => setOpen(open === a.action_id ? null : a.action_id)}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${a.status === 'done' ? 'bg-signal-green border-signal-green text-white' : 'border-paper-200'}`}>
                    {a.status === 'done' && <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" /></svg>}
                  </span>
                  <div>
                    <h2 className={`text-sm font-bold ${a.status === 'done' ? 'line-through' : ''}`}>{a.title}</h2>
                    <p className="text-xs text-ink-soft mt-1">{a.impact_text}</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <span className={`chip ${DIFF_STYLE[a.difficulty]}`}>{a.difficulty}</span>
                      <span className="chip bg-paper-100 text-ink-soft capitalize">{a.category}</span>
                      <span className="chip bg-mint-100 text-pine-800">+{a.impact_score} score pts</span>
                      {a.deadline && <span className="chip bg-signal-amber/10 text-signal-amber">deadline {new Date(a.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                      {a.months_pending >= 2 && a.status === 'pending' && (
                        <span className="chip bg-signal-red/10 text-signal-red">pending {a.months_pending} months</span>
                      )}
                    </div>
                  </div>
                </div>
                <svg className={`shrink-0 mt-1 transition-transform ${open === a.action_id ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6 1.4-1.4Z" /></svg>
              </div>
            </button>
            {open === a.action_id && (
              <div className="px-5 pb-5 ml-8">
                <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-line border-t border-paper-100 pt-4">{a.body}</p>
                {a.referral_link && (
                  <p className="mt-3 text-xs text-ink-faint">
                    Partner link (we may earn a disclosed commission): <a href={a.referral_link} className="underline text-pine-700" target="_blank" rel="noopener noreferrer">compare options</a>
                  </p>
                )}
                {a.status !== 'done' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => setStatus(a.action_id, 'done')} className="btn-primary !py-2 !px-5 text-xs">Mark done</button>
                    {a.status !== 'in_progress' && (
                      <button onClick={() => setStatus(a.action_id, 'in_progress')} className="btn-secondary !py-2 !px-5 text-xs">I&apos;m on it</button>
                    )}
                    <button onClick={() => setStatus(a.action_id, 'skipped')} className="text-xs text-ink-faint underline px-3">Skip — not relevant</button>
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
