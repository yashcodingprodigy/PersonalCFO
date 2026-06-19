'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { get, post } from '@/lib/api';
import { inr } from '@/lib/format';

const FEATURES: Record<string, { tag: string; highlight?: boolean; feats: string[] }> = {
  starter: {
    tag: 'Get organised',
    feats: [
      'Full Money Health Score',
      'Personalised “what to invest in” plan',
      'Bank statement scan & spending breakdown',
      '3 actions per month · 2 goals',
      'Basic tax view · data export anytime',
    ],
  },
  cfo: {
    tag: 'Your always-on financial CFO',
    highlight: true,
    feats: [
      'Everything in Starter, unlimited',
      'Proactive Alerts + monthly email briefing',
      'Year-round Tax Copilot (advance tax, proofs, harvesting, CA-ready pack)',
      'Spending watchdog & goal autopilot',
      'Document vault with renewal reminders',
      'Full insurance analysis · unlimited Ask PayWatch',
    ],
  },
  family: {
    tag: 'For the whole family',
    feats: [
      'Everything in CFO — for up to 4 members',
      'Consolidated family net worth',
      'Family insurance overview',
      'Estate & nomination checklist',
    ],
  },
};

export default function PlansPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [sub, setSub] = useState<any>(null);
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [welcomePlan, setWelcomePlan] = useState<string | null>(null);

  async function load() {
    const [u, p, s] = await Promise.all([get('/user/me'), get('/billing/plans'), get('/billing/subscription')]);
    setUser(u); setPlans(p); setSub(s);
  }
  useEffect(() => { load().catch(() => {}); }, []);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 4000); }

  async function subscribe(plan: string) {
    setBusy(plan);
    try {
      await post('/billing/subscribe', { plan, cycle });
      await load();
      setWelcomePlan(plan);
    } catch (e: any) { flash(e.message); } finally { setBusy(''); }
  }
  async function cancel() {
    const r = await post('/billing/cancel');
    flash(r.message); load();
  }

  if (!user) return <div className="card h-96 animate-pulse mt-4" />;
  const isPaidActive = (user.plan === 'cfo' || user.plan === 'family') && user.plan_status === 'active';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-medium">Plans</h1>
        <p className="text-sm text-ink-soft mt-1">A private CFO in your pocket — plus everything your CA needs, organised and ready to hand over.</p>
      </div>

      {/* Current plan */}
      <div className="card p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Current plan</p>
          <p className="text-lg font-bold capitalize mt-0.5">{user.plan} <span className={`chip ml-2 ${user.plan_status === 'active' ? 'bg-mint-100 text-pine-800' : 'bg-paper-100 text-ink-soft'}`}>{user.plan_status}</span></p>
        </div>
        {isPaidActive && <button onClick={cancel} className="text-xs text-ink-faint underline">Cancel subscription</button>}
      </div>

      {msg && <div className="rounded-xl bg-mint-100 text-pine-800 text-sm font-semibold px-4 py-3">{msg}</div>}

      {/* Cycle toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-full bg-paper-100 p-1">
          <button onClick={() => setCycle('monthly')} className={`rounded-full px-4 py-1.5 text-xs font-bold ${cycle === 'monthly' ? 'bg-pine-900 text-white' : 'text-ink-soft'}`}>Monthly</button>
          <button onClick={() => setCycle('annual')} className={`rounded-full px-4 py-1.5 text-xs font-bold ${cycle === 'annual' ? 'bg-pine-900 text-white' : 'text-ink-soft'}`}>Annual · 2 months free</button>
        </div>
      </div>

      {/* Pricing cards */}
      <div className="grid lg:grid-cols-3 gap-5">
        {plans.map((p) => {
          const f = FEATURES[p.key] || { tag: '', feats: [] };
          const price = cycle === 'annual' ? p.annual_price : p.monthly_price;
          const isCurrent = user.plan === p.key && user.plan_status === 'active';
          return (
            <div key={p.key} className={`rounded-2xl border p-6 flex flex-col ${f.highlight ? 'border-pine-700 bg-pine-900/5 shadow-card relative' : 'border-paper-200'}`}>
              {f.highlight && <span className="absolute -top-3 left-6 chip bg-pine-900 text-white">Most popular</span>}
              <p className="font-bold text-lg capitalize">{p.name}</p>
              <p className="text-xs text-ink-faint">{f.tag}</p>
              <p className="font-display text-4xl font-semibold mt-3 tabular-nums">{inr(price)}<span className="text-sm text-ink-faint font-normal">/{cycle === 'annual' ? 'yr' : 'mo'}</span></p>
              <p className="text-[11px] text-ink-faint">incl. 18% GST</p>
              <ul className="mt-4 space-y-2 flex-1">
                {f.feats.map((x, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-soft leading-snug"><span className="text-mint-500 font-bold shrink-0">✓</span>{x}</li>
                ))}
              </ul>
              <button onClick={() => subscribe(p.key)} disabled={isCurrent || busy === p.key}
                className={`mt-5 w-full rounded-full py-2.5 text-sm font-bold transition-colors ${isCurrent ? 'bg-paper-100 text-ink-faint cursor-default' : f.highlight ? 'bg-mint-500 text-pine-950 hover:bg-mint-400' : 'bg-pine-900 text-white hover:bg-pine-800'}`}>
                {isCurrent ? 'Your current plan' : busy === p.key ? 'Processing…' : user.plan_status === 'active' ? 'Switch to this' : 'Choose plan'}
              </button>
            </div>
          );
        })}
      </div>

      {sub?.invoices?.length > 0 && (
        <section className="card p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">GST invoices</h2>
          <ul className="divide-y divide-paper-100 text-sm">
            {sub.invoices.map((inv: any) => (
              <li key={inv.invoice_number} className="py-2.5 flex justify-between">
                <span><span className="font-semibold">{inv.invoice_number}</span> · {inv.description}</span>
                <span className="tabular-nums">{inr(inv.total_amount)} <span className="text-ink-faint">(GST {inr(inv.gst_amount)})</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-ink-faint leading-relaxed">Billing is processed via Razorpay (sandbox in this environment). Cancel anytime — access continues to the end of your paid period. PayWatch provides financial education and organisation, not SEBI-registered investment advice.</p>

      {/* Welcome-to-Plus modal after a successful subscribe */}
      {welcomePlan && (() => {
        const f = FEATURES[welcomePlan] || { feats: [] as string[] };
        const isPlus = welcomePlan === 'cfo' || welcomePlan === 'family';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pine-950/70">
            <div className="card bg-white p-7 max-w-md w-full text-center relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-mint-500" />
              <div className="text-4xl mb-2">🎉</div>
              <h2 className="font-display text-2xl font-semibold">Welcome to PayWatch{isPlus ? ' Plus' : ''}!</h2>
              <p className="text-sm text-ink-soft mt-1.5">You&apos;re on the <span className="font-semibold capitalize">{welcomePlan}</span> plan. Here&apos;s everything you&apos;ve just unlocked:</p>
              <ul className="mt-5 space-y-2 text-left">
                {f.feats.map((x, i) => (
                  <li key={i} className="flex gap-2 text-sm text-ink-soft"><span className="text-mint-500 font-bold shrink-0">✓</span>{x}</li>
                ))}
              </ul>
              <button onClick={() => { setWelcomePlan(null); router.push('/dashboard'); }} className="btn-primary w-full mt-6">Start exploring →</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
