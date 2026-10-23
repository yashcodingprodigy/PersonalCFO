'use client';

// Dreams — the dreams-first heart of PayWatch. Every dream gets a plan from the
// money brain (/brain): what it needs a month, what the plan sets aside, when it
// will be done, and — if it doesn't fit — the exact levers that make it a yes.
// Dreams are stored as goals (meta.kind / meta.priority), so nothing else breaks.

import { useLang } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get, post, put, del, swr } from '@/lib/api';
import { inr, rupeesToPaise } from '@/lib/format';
import { Ring, C } from '@/components/kit';

const STATUS: Record<string, { label: string; cls: string; color: string }> = {
  achieved: { label: 'Done 🎉', cls: 'bg-signal-green/10 text-signal-green', color: C.green },
  on_track: { label: 'On track', cls: 'bg-mint-100 text-pine-800', color: C.pine700 },
  stretch: { label: 'A stretch', cls: 'bg-signal-amber/10 text-signal-amber', color: C.amber },
  needs_tradeoff: { label: 'Needs a decision', cls: 'bg-signal-red/10 text-signal-red', color: C.red },
};
const PRIORITY = [
  { v: 1, label: 'Must-have' },
  { v: 2, label: 'Important' },
  { v: 3, label: 'Nice to have' },
];
// Quick picks → goal_type + dream kind (+ sensible inflation for long horizons).
const PICKS = [
  { key: 'trip', emoji: '✈️', label: 'A trip', goal_type: 'custom', kind: 'experience', name: 'Trip' },
  { key: 'gadget', emoji: '📱', label: 'A gadget', goal_type: 'custom', kind: 'purchase', name: 'New gadget' },
  { key: 'parents', emoji: '💚', label: 'Parents’ health cover', goal_type: 'custom', kind: 'family', name: 'Parents’ health cover' },
  { key: 'course', emoji: '🎓', label: 'A course', goal_type: 'custom', kind: 'purchase', name: 'Course' },
  { key: 'emergency', emoji: '🛟', label: 'Emergency fund', goal_type: 'emergency_fund', kind: 'safety', name: 'Emergency fund' },
  { key: 'vehicle', emoji: '🛵', label: 'A vehicle', goal_type: 'car_purchase', kind: 'purchase', name: 'Vehicle' },
  { key: 'home', emoji: '🏡', label: 'A home', goal_type: 'home_purchase', kind: 'purchase', name: 'Home down payment' },
  { key: 'wedding', emoji: '💍', label: 'A wedding', goal_type: 'custom', kind: 'family', name: 'Wedding' },
  { key: 'business', emoji: '☕', label: 'My own business', goal_type: 'custom', kind: 'milestone', name: 'My own business' },
  { key: 'other', emoji: '✨', label: 'Something else', goal_type: 'custom', kind: 'experience', name: '' },
];
const ym = (s: string | null) => {
  if (!s) return '—';
  const [y, m] = s.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

export default function DreamsPage() {
  const { lang } = useLang();
  const [brain, setBrain] = useState<any>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  // add-dream form
  const [pick, setPick] = useState(PICKS[0]);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [saved, setSaved] = useState('');
  const [prio, setPrio] = useState(2);
  const [busy, setBusy] = useState(false);

  // can-I-afford-it
  const [aLabel, setALabel] = useState('');
  const [aAmount, setAAmount] = useState('');
  const [aMonths, setAMonths] = useState<string>('');
  const [aRes, setARes] = useState<any>(null);
  const [aBusy, setABusy] = useState(false);

  async function load() {
    await Promise.all([swr(`/brain?lang=${lang}`, setBrain), get('/goals').then(setGoals)]);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch((e) => setErr(e.message)); }, [lang]);

  async function addDream(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      await post('/goals', {
        goal_type: pick.goal_type,
        name: (name || pick.name || 'My dream').slice(0, 100),
        target_amount: rupeesToPaise(amount),
        target_date: date || null,
        current_amount: saved ? rupeesToPaise(saved) : 0,
        monthly_contribution: 0,
        meta: { kind: pick.kind, priority: pick.kind === 'safety' ? 1 : prio },
      });
      setShowForm(false); setName(''); setAmount(''); setDate(''); setSaved(''); setPrio(2);
      await load();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function setPriority(goalId: string, v: number) {
    try { await put(`/goals/${goalId}`, { meta: { priority: v } }); await load(); } catch (e: any) { setErr(e.message); }
  }
  async function remove(goalId: string) {
    if (!confirm('Remove this dream? Your plan will be recalculated.')) return;
    try { await del(`/goals/${goalId}`); await load(); } catch (e: any) { setErr(e.message); }
  }
  async function afford(e: React.FormEvent) {
    e.preventDefault(); setABusy(true); setARes(null);
    try {
      const r = await post('/brain/afford', { amount: rupeesToPaise(aAmount), months: aMonths ? Number(aMonths) : null, label: aLabel.trim() || undefined });
      setARes(r);
    } catch (e: any) { setARes({ verdict: 'error', headline: e.message, levers: [], affects: [] }); } finally { setABusy(false); }
  }

  const plan = brain?.plan;
  const map = brain?.map;
  const byId = new Map(goals.map((g) => [String(g.goal_id), g]));
  const items: any[] = plan?.items || [];
  const real = items.filter((i) => !i.virtual);
  const safety = items.find((i) => i.id === 'virtual-safety');

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">Your dreams</h1>
          <p className="text-sm text-ink-soft mt-1">Tell me what you want — I’ll turn it into a plan, and quietly handle the money behind it.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary !py-2.5 text-xs">{showForm ? 'Close' : '+ Add a dream'}</button>
      </div>
      {err && <p className="text-sm text-signal-red">{err}</p>}

      {/* Plan strip */}
      {plan && (
        <section className="card p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(150deg,#07211D 0%,#0B2F2A 100%)' }}>
          <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-mint-500/10 blur-3xl pointer-events-none" aria-hidden />
          <p className="relative font-display text-xl leading-snug max-w-2xl">{plan.summary}</p>
          {plan.hasData && (
            <div className="relative mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Free to plan', `${inr(plan.free)}/mo`],
                ['Guilt-free money', `${inr(plan.joyBudget)}/mo`],
                ['Spare cash', inr(map?.excessCash || 0)],
                ['Safety net', map?.emergencyGap > 0 ? `${inr(map.emergencyGap)} to go` : 'Covered ✓'],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-white/[0.06] border border-white/10 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">{k}</p>
                  <p className="font-display text-lg text-mint-300 tabular-nums mt-1">{v}</p>
                </div>
              ))}
            </div>
          )}
          {plan && !plan.hasData && <Link href="/settings" className="relative mt-4 inline-block rounded-full bg-mint-500 text-pine-950 px-5 py-2 text-sm font-bold">Add income & spending →</Link>}
        </section>
      )}

      {/* Add a dream */}
      {showForm && (
        <form onSubmit={addDream} className="card p-6 space-y-4">
          <div>
            <p className="label">What’s the dream?</p>
            <div className="flex flex-wrap gap-2">
              {PICKS.map((p) => (
                <button type="button" key={p.key} onClick={() => { setPick(p); setName(p.name); }}
                  className={`rounded-full px-3.5 py-1.5 text-sm border transition-colors ${pick.key === p.key ? 'bg-pine-900 text-white border-pine-900' : 'bg-white border-paper-200 hover:border-pine-600'}`}>
                  <span className="mr-1">{p.emoji}</span>{p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Name it</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Goa with the gang" /></div>
            <div><label className="label">How much will it cost? (₹)</label><input className="input" inputMode="numeric" required value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))} placeholder="60,000" /></div>
            <div><label className="label">By when? (optional)</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div><label className="label">Already saved for it (₹)</label><input className="input" inputMode="numeric" value={saved} onChange={(e) => setSaved(e.target.value.replace(/[^\d]/g, ''))} placeholder="0" /></div>
          </div>
          {pick.kind !== 'safety' && (
            <div>
              <p className="label">How important is it?</p>
              <div className="inline-flex rounded-full bg-paper-100 p-1">
                {PRIORITY.map((p) => (
                  <button type="button" key={p.v} onClick={() => setPrio(p.v)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${prio === p.v ? 'bg-white shadow-sm text-ink' : 'text-ink-soft'}`}>{p.label}</button>
                ))}
              </div>
            </div>
          )}
          <button className="btn-primary" disabled={busy || !amount}>{busy ? 'Planning…' : 'Make it a plan'}</button>
        </form>
      )}

      {/* Can I afford it? */}
      <section className="card p-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-ink-faint">Can I afford it?</p>
        <form onSubmit={afford} className="mt-3 grid sm:grid-cols-[1.4fr_1fr_1fr_auto] gap-3 items-end">
          <div><label className="label">What?</label><input className="input" value={aLabel} onChange={(e) => setALabel(e.target.value)} placeholder="a laptop, Seoul trip…" /></div>
          <div><label className="label">Cost (₹)</label><input className="input" inputMode="numeric" required value={aAmount} onChange={(e) => setAAmount(e.target.value.replace(/[^\d]/g, ''))} placeholder="80,000" /></div>
          <div>
            <label className="label">When?</label>
            <select className="input" value={aMonths} onChange={(e) => setAMonths(e.target.value)}>
              <option value="">Earliest possible</option>
              {[1, 3, 6, 12, 24, 36, 60].map((m) => <option key={m} value={m}>{m < 12 ? `In ${m} month${m > 1 ? 's' : ''}` : `In ${m / 12} year${m > 12 ? 's' : ''}`}</option>)}
            </select>
          </div>
          <button className="btn-primary !py-3" disabled={aBusy || !aAmount}>{aBusy ? 'Thinking…' : 'Check'}</button>
        </form>
        {aRes && (
          <div className={`mt-4 rounded-2xl p-4 border ${aRes.verdict === 'yes_now' || aRes.verdict === 'yes_by' ? 'bg-mint-100/60 border-mint-500/40' : aRes.verdict === 'stretch' ? 'bg-signal-amber/5 border-signal-amber/30' : 'bg-paper-50 border-paper-200'}`}>
            <p className="font-semibold">{aRes.headline}</p>
            {aRes.levers?.length > 0 && (
              <ul className="mt-2 space-y-1">{aRes.levers.slice(0, 4).map((l: any, i: number) => <li key={i} className="text-sm text-ink-soft flex gap-2"><span className="text-pine-700">→</span>{l.label}</li>)}</ul>
            )}
            {aRes.verdict !== 'error' && aRes.verdict !== 'need_data' && (
              <button onClick={() => { const p = PICKS.find((x) => x.key === 'other')!; setPick(p); setName(aLabel || ''); setAmount(aAmount); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className="mt-3 text-xs font-bold text-pine-700 underline">Turn this into a dream →</button>
            )}
          </div>
        )}
        <p className="text-[11px] text-ink-faint mt-3">Planning estimate from your own numbers, using conservative growth assumptions — not investment advice or a promise of returns.</p>
      </section>

      {/* Dreams */}
      {plan && real.length === 0 && !showForm && (
        <div className="card p-8 text-center">
          <p className="font-display text-xl">What do you want this year?</p>
          <p className="text-sm text-ink-soft mt-1">A trip, a gadget, your parents’ health cover, your own café one day…</p>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-4 !py-2.5 text-xs">+ Add your first dream</button>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {[...(safety ? [safety] : []), ...real].map((it) => {
          const g = byId.get(String(it.id));
          const cur = g ? Number(g.current_amount) : 0;
          const progress = it.adjustedTarget > 0 ? Math.min(100, (cur / it.adjustedTarget) * 100) : 0;
          const st = STATUS[it.status] || STATUS.on_track;
          const isOpen = open === it.id;
          return (
            <article key={it.id} className={`card p-6 ${it.virtual ? 'border-dashed' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-bold truncate">{it.name}</h2>
                  <p className="text-xs text-ink-faint capitalize">{it.virtual ? 'suggested by PayWatch' : `${it.kind} · ${PRIORITY.find((p) => p.v === it.priority)?.label}`}</p>
                </div>
                <span className={`chip shrink-0 ${st.cls}`}>{st.label}</span>
              </div>
              <div className="mt-4 flex items-center gap-4">
                <Ring pct={it.virtual ? 0 : progress} size={84} color={st.color}>
                  <span className="font-display text-sm font-semibold tabular-nums">{it.virtual ? '🛟' : `${Math.round(progress)}%`}</span>
                </Ring>
                <dl className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm flex-1">
                  <div><dt className="text-[11px] text-ink-faint">Target</dt><dd className="font-bold tabular-nums">{inr(it.adjustedTarget)}</dd></div>
                  <div><dt className="text-[11px] text-ink-faint">Done by</dt><dd className="font-bold">{it.status === 'achieved' ? 'Now' : ym(it.projectedDate)}</dd></div>
                  <div><dt className="text-[11px] text-ink-faint">Needs</dt><dd className="font-bold tabular-nums">{inr(it.need)}/mo</dd></div>
                  <div><dt className="text-[11px] text-ink-faint">Plan sets aside</dt><dd className={`font-bold tabular-nums ${it.allocated < it.need ? 'text-signal-amber' : 'text-pine-700'}`}>{inr(it.allocated)}/mo</dd></div>
                </dl>
              </div>

              {it.levers?.length > 0 && (
                <div className="mt-4">
                  <button onClick={() => setOpen(isOpen ? null : it.id)} className="text-sm font-bold text-pine-700">{isOpen ? 'Hide options ▴' : 'Make it a yes ▾'}</button>
                  {isOpen && (
                    <ul className="mt-2 space-y-1.5">
                      {it.levers.map((l: any, i: number) => <li key={i} className="text-sm text-ink-soft flex gap-2"><span className="text-pine-700 shrink-0">→</span>{l.label}</li>)}
                    </ul>
                  )}
                </div>
              )}

              {!it.virtual && g && (
                <div className="mt-4 pt-3 border-t border-paper-200 flex items-center justify-between gap-3 flex-wrap">
                  <div className="inline-flex rounded-full bg-paper-100 p-0.5">
                    {PRIORITY.map((p) => (
                      <button key={p.v} onClick={() => setPriority(String(it.id), p.v)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${it.priority === p.v ? 'bg-white shadow-sm text-ink' : 'text-ink-soft'}`}>{p.label}</button>
                    ))}
                  </div>
                  <button onClick={() => remove(String(it.id))} className="text-xs text-ink-faint underline">Remove</button>
                </div>
              )}
              {it.virtual && (
                <p className="mt-4 text-xs text-ink-soft">A safety net keeps a surprise bill from eating your dreams. I’ve put it first in your plan — <button onClick={() => { setPick(PICKS.find((p) => p.key === 'emergency')!); setName('Emergency fund'); setAmount(String(Math.round(it.adjustedTarget / 100))); setShowForm(true); }} className="underline text-pine-700">make it yours</button>.</p>
              )}
            </article>
          );
        })}
      </div>
      <p className="text-[11px] text-ink-faint">Plans use your take-home, spending and existing SIPs, with conservative growth assumptions by time horizon. Educational planning — not investment advice.</p>
    </div>
  );
}
