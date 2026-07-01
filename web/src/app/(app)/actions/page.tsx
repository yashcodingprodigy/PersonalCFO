'use client';

import { useEffect, useState } from 'react';
import { get, patch, post } from '@/lib/api';
import { rupeesToPaise } from '@/lib/format';
import { LoadingScreen } from '@/components/Skeleton';

// Sarcastic captions that rotate while the action plan loads.
const LOADING_QUIPS = [
  'Rounding up ways to make you richer…',
  'Finding money you forgot you had…',
  'Ranking your to-dos so you don’t have to…',
  'Doing the boring finance bit for you…',
  'Negotiating with your spreadsheet…',
  'Bribing your future self to save more…',
  'Alphabetising your excuses… almost done…',
];

const DIFF_STYLE: Record<string, string> = {
  easy: 'bg-mint-100 text-pine-800',
  medium: 'bg-signal-amber/10 text-signal-amber',
  hard: 'bg-signal-red/10 text-signal-red',
};
const PRIORITY_STYLE: Record<string, string> = {
  high: 'bg-signal-red/10 text-signal-red',
  medium: 'bg-signal-amber/10 text-signal-amber',
  low: 'bg-paper-100 text-ink-soft',
};
const PRIORITY_LABEL: Record<string, string> = { high: 'High priority', medium: 'Medium', low: 'Low priority' };

// Which "what did you do" options apply per action category.
const TYPE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  investment: [
    { value: 'index_fund', label: 'Index fund' },
    { value: 'mutual_fund', label: 'Mutual fund' },
    { value: 'stocks', label: 'Stocks' },
    { value: 'nps', label: 'NPS' },
    { value: 'ppf', label: 'PPF' },
    { value: 'gold', label: 'Gold (SGB / ETF)' },
    { value: 'fd', label: 'Fixed deposit' },
  ],
  savings: [
    { value: 'savings', label: 'Savings account' },
    { value: 'fd', label: 'Fixed deposit' },
  ],
  insurance: [
    { value: 'term_insurance', label: 'Term life cover (sum assured)' },
    { value: 'health_insurance', label: 'Health cover (sum insured)' },
  ],
};

export default function ActionsPage() {
  const [actions, setActions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<'open' | 'done' | 'all'>('open');
  const [priority, setPriority] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [sortBy, setSortBy] = useState<'priority' | 'points'>('priority');
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);

  // confirmation flow state
  const [confirm, setConfirm] = useState<{ id: string; step: 'ask' | 'details' } | null>(null);
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const [a, s] = await Promise.all([get('/actions'), get('/actions/stats/summary')]);
    setActions(a); setStats(s);
  }
  useEffect(() => { load().catch(() => {}).finally(() => setLoading(false)); }, []);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 4000); }

  function startDone(a: any) {
    setConfirm({ id: a.action_id, step: 'ask' });
    setAmount(''); setType((TYPE_OPTIONS[a.category]?.[0]?.value) || '');
  }

  async function confirmYes(a: any) {
    const opts = TYPE_OPTIONS[a.category];
    if (opts && opts.length) { setConfirm({ id: a.action_id, step: 'details' }); return; }
    await complete(a, {});
  }

  async function complete(a: any, body: any) {
    setBusy(true);
    try {
      const res = await post(`/actions/${a.action_id}/complete`, body);
      setActions((prev) => prev.map((x) => (x.action_id === a.action_id ? { ...x, ...res.action } : x)));
      setConfirm(null); setOpenId(null);
      flash(body.invested_amount ? 'Marked done — added to your profile and your score has been updated.' : 'Marked done — your score has been updated.');
      get('/actions/stats/summary').then(setStats).catch(() => {});
    } catch (e: any) { flash(e.message); } finally { setBusy(false); }
  }

  async function skip(id: string) {
    const updated = await patch(`/actions/${id}/status`, { status: 'skipped' });
    setActions((prev) => prev.map((a) => (a.action_id === id ? { ...a, ...updated } : a)));
    setConfirm(null);
  }

  let visible = actions.filter((a) =>
    status === 'all' ? true : status === 'done' ? a.status === 'done' : ['pending', 'in_progress', 'deferred'].includes(a.status)
  );
  if (priority !== 'all') visible = visible.filter((a) => (a.priority || 'medium') === priority);
  const prRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  visible = [...visible].sort((x, y) =>
    sortBy === 'points'
      ? y.impact_score - x.impact_score
      : (prRank[x.priority || 'medium'] - prRank[y.priority || 'medium']) || (y.impact_score - x.impact_score)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-medium">Action plan</h1>
          <p className="text-sm text-ink-soft mt-1">Specific, quantified steps — prioritised for your profile.</p>
        </div>
        {stats && (
          <div className="flex gap-6 text-center">
            <div><p className="font-display text-2xl font-semibold">{stats.done_this_month}</p><p className="text-[11px] text-ink-faint uppercase tracking-wider font-bold">done this month</p></div>
            <div><p className="font-display text-2xl font-semibold">{stats.open}</p><p className="text-[11px] text-ink-faint uppercase tracking-wider font-bold">open</p></div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex gap-2">
          {(['open', 'done', 'all'] as const).map((f) => (
            <button key={f} onClick={() => setStatus(f)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize transition-colors ${status === f ? 'bg-pine-900 text-white' : 'bg-white border border-paper-200 text-ink-soft hover:border-pine-600'}`}>{f}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider font-bold text-ink-faint">Priority</span>
          {(['all', 'high', 'medium', 'low'] as const).map((f) => (
            <button key={f} onClick={() => setPriority(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${priority === f ? 'bg-pine-900 text-white' : 'bg-white border border-paper-200 text-ink-soft hover:border-pine-600'}`}>{f}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider font-bold text-ink-faint">Sort</span>
          <button onClick={() => setSortBy('priority')} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${sortBy === 'priority' ? 'bg-pine-900 text-white' : 'bg-white border border-paper-200 text-ink-soft hover:border-pine-600'}`}>Priority</button>
          <button onClick={() => setSortBy('points')} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${sortBy === 'points' ? 'bg-pine-900 text-white' : 'bg-white border border-paper-200 text-ink-soft hover:border-pine-600'}`}>Points</button>
        </div>
      </div>

      {toast && <div className="rounded-xl bg-mint-100 text-pine-800 text-sm font-semibold px-4 py-3">{toast}</div>}

      <div className="relative min-h-[60vh]">
        <LoadingScreen loading={loading} quips={LOADING_QUIPS} />
        {!loading && (
        <div className="space-y-4 pw-page-in">
        {visible.length === 0 && (
          <div className="card p-10 text-center text-sm text-ink-soft">
            {status === 'open' ? 'Nothing here with these filters. Your plan is on track — new actions appear as your data changes.' : 'Nothing here yet.'}
          </div>
        )}
        {visible.map((a) => {
          const opts = TYPE_OPTIONS[a.category];
          const isInsurance = a.category === 'insurance';
          return (
            <article key={a.action_id} className={`card overflow-hidden ${a.status === 'done' ? 'opacity-60' : ''}`}>
              <button className="w-full text-left p-5" onClick={() => setOpenId(openId === a.action_id ? null : a.action_id)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${a.status === 'done' ? 'bg-signal-green border-signal-green text-white' : 'border-paper-200'}`}>
                      {a.status === 'done' && <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" /></svg>}
                    </span>
                    <div>
                      <h2 className={`text-sm font-bold ${a.status === 'done' ? 'line-through' : ''}`}>{a.title}</h2>
                      <p className="text-xs text-ink-soft mt-1">{a.impact_text}</p>
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <span className={`chip ${PRIORITY_STYLE[a.priority || 'medium']}`}>{PRIORITY_LABEL[a.priority || 'medium']}</span>
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
                  <svg className={`shrink-0 mt-1 transition-transform ${openId === a.action_id ? 'rotate-180' : ''}`} width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6 1.4-1.4Z" /></svg>
                </div>
              </button>

              {openId === a.action_id && (
                <div className="px-5 pb-5 ml-8">
                  <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-line border-t border-paper-100 pt-4">{a.body}</p>

                  {a.status !== 'done' && confirm?.id !== a.action_id && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => startDone(a)} className="btn-primary !py-2 !px-5 text-xs">Mark done</button>
                      <button onClick={() => skip(a.action_id)} className="text-xs text-ink-faint underline px-3">Skip — not relevant</button>
                    </div>
                  )}

                  {/* Confirmation: did you actually do it? */}
                  {confirm && confirm.id === a.action_id && confirm.step === 'ask' && (
                    <div className="mt-4 rounded-xl border border-paper-200 bg-paper-50 p-4">
                      <p className="text-sm font-semibold">Did you actually complete this?</p>
                      <p className="text-xs text-ink-soft mt-1">We only update your score and profile for things you&apos;ve really done — that keeps your numbers honest.</p>
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => confirmYes(a)} disabled={busy} className="btn-primary !py-2 !px-5 text-xs">Yes, I did it</button>
                        <button onClick={() => setConfirm(null)} className="btn-secondary !py-2 !px-5 text-xs">Not yet</button>
                      </div>
                    </div>
                  )}

                  {/* Details: how much + what type → updates profile */}
                  {confirm && confirm.id === a.action_id && confirm.step === 'details' && opts && (
                    <div className="mt-4 rounded-xl border border-paper-200 bg-paper-50 p-4 space-y-3">
                      <p className="text-sm font-semibold">Nice work! Let&apos;s keep your profile accurate.</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="label">{isInsurance ? 'Cover amount you got' : 'How much did you put in?'}</label>
                          <div className="flex">
                            <span className="inline-flex items-center rounded-l-lg border border-r-0 border-paper-200 bg-paper-100 px-3 text-sm font-semibold text-ink-soft">₹</span>
                            <input className="input rounded-l-none" inputMode="numeric" placeholder="0" value={amount}
                              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} />
                          </div>
                        </div>
                        <div>
                          <label className="label">{isInsurance ? 'Type of cover' : 'Where did it go?'}</label>
                          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                            {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button onClick={() => complete(a, amount ? { invested_amount: rupeesToPaise(amount), invested_type: type } : {})} disabled={busy} className="btn-primary !py-2 !px-5 text-xs">
                          {busy ? 'Saving…' : 'Save & mark done'}
                        </button>
                        <button onClick={() => complete(a, {})} disabled={busy} className="btn-secondary !py-2 !px-5 text-xs">Mark done without details</button>
                        <button onClick={() => setConfirm(null)} className="text-xs text-ink-faint underline px-3">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
        </div>
        )}
      </div>
    </div>
  );
}
