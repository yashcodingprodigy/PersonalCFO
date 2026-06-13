'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { get, post, patch, del, api, clearTokens } from '@/lib/api';
import { inr, rupeesToPaise } from '@/lib/format';
import { STATES, citiesForState } from '@/lib/india';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const [aa, setAa] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [tab, setTab] = useState<'profile' | 'data' | 'plan' | 'privacy'>('profile');

  // editable money fields (rupees)
  const [fields, setFields] = useState<Record<string, string>>({});
  // profile basics (non-money)
  const [stateName, setStateName] = useState('');
  const [city, setCity] = useState('');
  const [risk, setRisk] = useState('');

  async function load() {
    const [u, p, b, a] = await Promise.all([get('/user/me'), get('/user/profile'), get('/billing/subscription'), get('/aa/status')]);
    setUser(u); setProfile(p); setBilling(b); setAa(a);
    setStateName(u.state || ''); setCity(u.city || ''); setRisk(u.risk_appetite || '');
    setFields({
      take_home: String(Math.round((u.monthly_take_home || 0) / 100)),
      expenses: String(Math.round((p.assets?.monthly_expenses || 0) / 100)),
      savings: String(Math.round((p.assets?.savings_balance || 0) / 100)),
      epf: String(Math.round((p.assets?.epf || 0) / 100)),
      mf: String(Math.round((p.assets?.mutual_funds?.value || 0) / 100)),
      sip: String(Math.round((p.assets?.mutual_funds?.monthly_sip || 0) / 100)),
      term: String(Math.round((p.insurance?.term?.[0]?.sum_assured || 0) / 100)),
      health: String(Math.round((p.insurance?.health?.[0]?.sum_insured || 0) / 100)),
      epf_80c: String(Math.round((p.tax_data?.epf_contribution_annual || 0) / 100)),
      ppf_80c: String(Math.round((p.tax_data?.ppf_annual || 0) / 100)),
      elss: String(Math.round((p.tax_data?.elss_annual || 0) / 100)),
      nps: String(Math.round((p.tax_data?.nps_80ccd1b_annual || 0) / 100)),
      health_prem: String(Math.round((p.tax_data?.health_premium_self_annual || 0) / 100)),
      hl_interest: String(Math.round((p.tax_data?.home_loan_interest_annual || 0) / 100)),
      rent: String(Math.round((p.tax_data?.rent_paid_monthly || 0) / 100)),
      hra: String(Math.round((p.tax_data?.hra_received_annual || 0) / 100)),
    });
  }
  useEffect(() => { load().catch(() => {}); }, []);

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(''), 3500); }
  const F = (k: string) => ({ value: fields[k] ?? '', onChange: (e: any) => setFields((f) => ({ ...f, [k]: e.target.value.replace(/[^\d]/g, '') })) });

  async function saveProfile() {
    await patch('/user/me', {
      monthly_take_home: rupeesToPaise(fields.take_home || '0'),
      ...(stateName ? { state: stateName } : {}),
      ...(city ? { city } : {}),
      ...(risk ? { risk_appetite: risk } : {}),
    });
    await patch('/user/profile/assets', {
      monthly_expenses: rupeesToPaise(fields.expenses || '0'),
      savings_balance: rupeesToPaise(fields.savings || '0'),
      epf: rupeesToPaise(fields.epf || '0'),
      mutual_funds: { value: rupeesToPaise(fields.mf || '0'), monthly_sip: rupeesToPaise(fields.sip || '0') },
    });
    await patch('/user/profile/insurance', {
      term: fields.term && fields.term !== '0' ? [{ sum_assured: rupeesToPaise(fields.term) }] : [],
      health: fields.health && fields.health !== '0' ? [{ sum_insured: rupeesToPaise(fields.health) }] : [],
    });
    flash('Saved — your score has been recalculated.');
  }

  async function saveTax() {
    await patch('/user/profile/tax_data', {
      epf_contribution_annual: rupeesToPaise(fields.epf_80c || '0'),
      ppf_annual: rupeesToPaise(fields.ppf_80c || '0'),
      elss_annual: rupeesToPaise(fields.elss || '0'),
      nps_80ccd1b_annual: rupeesToPaise(fields.nps || '0'),
      health_premium_self_annual: rupeesToPaise(fields.health_prem || '0'),
      home_loan_interest_annual: rupeesToPaise(fields.hl_interest || '0'),
      rent_paid_monthly: rupeesToPaise(fields.rent || '0'),
      hra_received_annual: rupeesToPaise(fields.hra || '0'),
    });
    flash('Tax data saved.');
  }

  async function subscribe(plan: string) {
    const res = await post('/billing/subscribe', { plan, cycle: 'monthly' });
    flash(`Subscribed to ${plan.toUpperCase()} — invoice ${res.invoice_number} issued.`);
    load();
  }

  async function exportData() {
    const data = await get('/data/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'personalcfo-data-export.json';
    a.click();
  }

  async function deleteAccount() {
    if (!confirm('Permanently delete your account and ALL data? This cannot be undone.')) return;
    if (!confirm('Last check — everything will be erased: profile, scores, actions, conversations, goals.')) return;
    await api('/user/me', { method: 'DELETE' });
    clearTokens();
    router.replace('/');
  }

  async function revokeAa() {
    await del('/aa/consent');
    flash('AA consent revoked. All bank-sourced data deleted.');
    load();
  }

  if (!user) return <div className="card h-96 animate-pulse mt-4" />;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-medium">Settings</h1>
        <p className="text-sm text-ink-soft mt-1">{user.name || user.mobile} · member since {new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {([['profile', 'Financial data'], ['data', 'Tax data'], ['plan', 'Plan & billing'], ['privacy', 'Privacy & legal']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${tab === k ? 'bg-pine-900 text-white' : 'bg-white border border-paper-200 text-ink-soft hover:border-pine-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {msg && <div className="rounded-xl bg-mint-100 text-pine-800 text-sm font-semibold px-4 py-3">{msg}</div>}

      {tab === 'profile' && (
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">Profile basics</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label">State</label>
              <select className="input" value={stateName} onChange={(e) => { setStateName(e.target.value); setCity(''); }}>
                <option value="">Select…</option>
                {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">City</label>
              <select className="input" value={city} onChange={(e) => setCity(e.target.value)} disabled={!stateName}>
                <option value="">{stateName ? 'Select…' : 'Pick state first'}</option>
                {citiesForState(stateName).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Risk comfort</label>
              <select className="input" value={risk} onChange={(e) => setRisk(e.target.value)}>
                <option value="">Auto (from profile)</option>
                <option value="conservative">Play it safe</option>
                <option value="moderate">Balanced</option>
                <option value="aggressive">Go for growth</option>
              </select>
            </div>
          </div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint pt-2">Income, assets & cover (₹)</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">Monthly take-home</label><input className="input" inputMode="numeric" {...F('take_home')} /></div>
            <div><label className="label">Monthly expenses</label><input className="input" inputMode="numeric" {...F('expenses')} /></div>
            <div><label className="label">Savings balance</label><input className="input" inputMode="numeric" {...F('savings')} /></div>
            <div><label className="label">EPF balance</label><input className="input" inputMode="numeric" {...F('epf')} /></div>
            <div><label className="label">Mutual funds value</label><input className="input" inputMode="numeric" {...F('mf')} /></div>
            <div><label className="label">Monthly SIP</label><input className="input" inputMode="numeric" {...F('sip')} /></div>
            <div><label className="label">Term cover</label><input className="input" inputMode="numeric" {...F('term')} /></div>
            <div><label className="label">Health cover</label><input className="input" inputMode="numeric" {...F('health')} /></div>
          </div>
          <button onClick={saveProfile} className="btn-primary">Save & recalculate score</button>
        </section>
      )}

      {tab === 'data' && (
        <section className="card p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint">Annual tax inputs (₹)</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className="label">EPF contribution / year (80C)</label><input className="input" inputMode="numeric" {...F('epf_80c')} /></div>
            <div><label className="label">PPF / year (80C)</label><input className="input" inputMode="numeric" {...F('ppf_80c')} /></div>
            <div><label className="label">ELSS / year (80C)</label><input className="input" inputMode="numeric" {...F('elss')} /></div>
            <div><label className="label">NPS Tier-1 / year (80CCD-1B)</label><input className="input" inputMode="numeric" {...F('nps')} /></div>
            <div><label className="label">Health premium / year (80D)</label><input className="input" inputMode="numeric" {...F('health_prem')} /></div>
            <div><label className="label">Home loan interest / year (24b)</label><input className="input" inputMode="numeric" {...F('hl_interest')} /></div>
            <div><label className="label">Rent paid / month (HRA)</label><input className="input" inputMode="numeric" {...F('rent')} /></div>
            <div><label className="label">HRA received / year</label><input className="input" inputMode="numeric" {...F('hra')} /></div>
          </div>
          <button onClick={saveTax} className="btn-primary">Save tax data</button>
        </section>
      )}

      {tab === 'plan' && (
        <>
          <section className="card p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Current plan</h2>
            <p className="text-lg font-bold capitalize">{user.plan} <span className={`chip ml-2 ${user.plan_status === 'active' ? 'bg-mint-100 text-pine-800' : 'bg-paper-100 text-ink-soft'}`}>{user.plan_status}</span></p>
            <div className="mt-5 grid sm:grid-cols-3 gap-3">
              {[['starter', '₹299'], ['cfo', '₹699'], ['family', '₹1,199']].map(([p, price]) => (
                <button key={p} onClick={() => subscribe(p)} disabled={user.plan === p && user.plan_status === 'active'}
                  className={`rounded-xl border p-4 text-left transition-colors ${user.plan === p ? 'border-pine-700 bg-pine-900/5' : 'border-paper-200 hover:border-pine-600'}`}>
                  <p className="font-bold capitalize">{p}</p>
                  <p className="text-sm text-ink-soft">{price}/month incl. GST</p>
                </button>
              ))}
            </div>
            {user.plan_status === 'active' && (
              <button onClick={async () => { const r = await post('/billing/cancel'); flash(r.message); load(); }} className="mt-4 text-xs text-ink-faint underline">
                Cancel subscription
              </button>
            )}
          </section>
          {billing?.invoices?.length > 0 && (
            <section className="card p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">GST invoices</h2>
              <ul className="divide-y divide-paper-100 text-sm">
                {billing.invoices.map((inv: any) => (
                  <li key={inv.invoice_number} className="py-2.5 flex justify-between">
                    <span><span className="font-semibold">{inv.invoice_number}</span> · {inv.description}</span>
                    <span className="tabular-nums">{inr(inv.total_amount)} <span className="text-ink-faint">(GST {inr(inv.gst_amount)})</span></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === 'privacy' && (
        <>
          <section className="card p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Bank data (Account Aggregator)</h2>
            <p className="text-sm text-ink-soft leading-relaxed">
              {aa?.linked
                ? `Connected — ${aa.aa_transactions} transactions imported under your consent. Consent is time-bound (12 months) and revocable here at any time.`
                : 'Not connected. Connect from the dashboard to auto-import balances and transactions via the RBI-regulated AA framework — no credentials shared, ever.'}
            </p>
            {aa?.linked && <button onClick={revokeAa} className="mt-3 btn-secondary !py-2 text-xs">Revoke consent & delete bank data</button>}
          </section>
          <section className="card p-6">
            <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Your data rights</h2>
            <p className="text-sm text-ink-soft leading-relaxed mb-4">
              Aligned with the Digital Personal Data Protection Act, 2023: your data is stored encrypted in India,
              never sold, never shared without per-action consent. Export or erase everything, any time.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={exportData} className="btn-secondary !py-2.5 text-xs">Download my data (JSON)</button>
              <button onClick={deleteAccount} className="rounded-full border border-signal-red/40 text-signal-red px-6 py-2.5 text-xs font-semibold hover:bg-signal-red/5">
                Delete account permanently
              </button>
            </div>
          </section>
          <section className="card p-6 text-sm space-x-4">
            <Link href="/legal/terms" className="text-pine-700 underline">Terms of Service</Link>
            <Link href="/legal/privacy" className="text-pine-700 underline">Privacy Policy</Link>
            <Link href="/legal/disclosures" className="text-pine-700 underline">Regulatory Disclosures</Link>
          </section>
        </>
      )}
    </div>
  );
}
