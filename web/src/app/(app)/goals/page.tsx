'use client';

import { useEffect, useState } from 'react';
import { get, post, del } from '@/lib/api';
import { inr, rupeesToPaise } from '@/lib/format';

const HEALTH: Record<string, { label: string; cls: string }> = {
  on_track: { label: 'On track', cls: 'bg-mint-100 text-pine-800' },
  at_risk: { label: 'At risk', cls: 'bg-signal-amber/10 text-signal-amber' },
  off_track: { label: 'Off track', cls: 'bg-signal-red/10 text-signal-red' },
  achieved: { label: 'Achieved 🎉', cls: 'bg-signal-green/10 text-signal-green' },
};

export default function GoalsPage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState('');

  const [gType, setGType] = useState('emergency_fund');
  const [gName, setGName] = useState('');
  const [gTarget, setGTarget] = useState('');
  const [gDate, setGDate] = useState('');
  const [gCurrent, setGCurrent] = useState('');
  const [gMonthly, setGMonthly] = useState('');

  async function load() {
    const [g, t] = await Promise.all([get('/goals'), get('/goals/types')]);
    setGoals(g); setTypes(t);
  }
  useEffect(() => { load().catch(() => {}); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    try {
      await post('/goals', {
        goal_type: gType,
        name: gName || types.find((t) => t.type === gType)?.label || 'Goal',
        target_amount: rupeesToPaise(gTarget),
        target_date: gDate || null,
        current_amount: gCurrent ? rupeesToPaise(gCurrent) : 0,
        monthly_contribution: gMonthly ? rupeesToPaise(gMonthly) : 0,
      });
      setShowForm(false); setGName(''); setGTarget(''); setGDate(''); setGCurrent(''); setGMonthly('');
      load();
    } catch (e: any) { setErr(e.message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-medium">Goals</h1>
          <p className="text-sm text-ink-soft mt-1">Inflation-adjusted targets with the exact monthly contribution needed.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary !py-2.5 text-xs">{showForm ? 'Close' : '+ New goal'}</button>
      </div>

      {showForm && (
        <form onSubmit={create} className="card p-6 grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Goal type</label>
            <select className="input" value={gType} onChange={(e) => setGType(e.target.value)}>
              {types.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
            </select>
          </div>
          <div><label className="label">Name</label><input className="input" value={gName} onChange={(e) => setGName(e.target.value)} placeholder="e.g. Aarav's college fund" /></div>
          <div><label className="label">Target amount (₹)</label><input className="input" inputMode="numeric" value={gTarget} onChange={(e) => setGTarget(e.target.value.replace(/[^\d]/g, ''))} placeholder="30,00,000" required /></div>
          <div><label className="label">Target date</label><input className="input" type="date" value={gDate} onChange={(e) => setGDate(e.target.value)} /></div>
          <div><label className="label">Already saved (₹)</label><input className="input" inputMode="numeric" value={gCurrent} onChange={(e) => setGCurrent(e.target.value.replace(/[^\d]/g, ''))} /></div>
          <div><label className="label">Current monthly contribution (₹)</label><input className="input" inputMode="numeric" value={gMonthly} onChange={(e) => setGMonthly(e.target.value.replace(/[^\d]/g, ''))} /></div>
          {err && <p className="text-sm text-signal-red sm:col-span-2">{err}</p>}
          <button className="btn-primary sm:col-span-2">Create goal</button>
        </form>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {goals.length === 0 && !showForm && (
          <div className="card p-10 text-center text-sm text-ink-soft lg:col-span-2">
            No goals yet. Start with an emergency fund — it&apos;s the foundation everything else builds on.
          </div>
        )}
        {goals.map((g) => {
          const m = g.math;
          const progress = Math.min(100, (Number(g.current_amount) / m.inflationAdjustedTarget) * 100);
          const h = HEALTH[m.health];
          return (
            <article key={g.goal_id} className="card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-bold">{g.name}</h2>
                  <p className="text-xs text-ink-faint capitalize">{g.goal_type.replace(/_/g, ' ')}</p>
                </div>
                <span className={`chip ${h.cls}`}>{h.label}</span>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-2xl font-semibold tabular-nums">{inr(g.current_amount)}</span>
                <span className="text-sm text-ink-faint">of {inr(m.inflationAdjustedTarget)} (inflation-adjusted)</span>
              </div>
              <div className="mt-2 h-2.5 bg-paper-100 rounded-full overflow-hidden">
                <div className="h-full bg-pine-600 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-ink-faint">Needed per month</dt><dd className="font-bold tabular-nums">{inr(m.requiredMonthly)}</dd></div>
                <div><dt className="text-xs text-ink-faint">You contribute</dt><dd className="font-bold tabular-nums">{inr(g.monthly_contribution)}</dd></div>
                <div><dt className="text-xs text-ink-faint">Projected at current rate</dt><dd className="font-bold tabular-nums">{inr(m.projectedAtCurrentRate)}</dd></div>
                <div><dt className="text-xs text-ink-faint">Time remaining</dt><dd className="font-bold">{Math.floor(m.monthsRemaining / 12)}y {m.monthsRemaining % 12}m</dd></div>
              </dl>
              <button onClick={async () => { await del(`/goals/${g.goal_id}`); load(); }} className="mt-4 text-xs text-ink-faint underline">
                Delete goal
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
