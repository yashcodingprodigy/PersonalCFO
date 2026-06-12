'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wordmark } from '@/components/Logo';
import { patch, post } from '@/lib/api';
import { rupeesToPaise, inr } from '@/lib/format';

// Progressive 3-session onboarding (SRS §5.2). Every field except income
// is optional — 'Fill later' never blocks progress.

function Money({ label, value, onChange, hint, placeholder = '0' }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex">
        <span className="inline-flex items-center rounded-l-lg border border-r-0 border-paper-200 bg-paper-100 px-3.5 text-sm font-semibold text-ink-soft">₹</span>
        <input className="input rounded-l-none" inputMode="numeric" placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))} />
      </div>
      {hint && <p className="text-[11px] text-ink-faint mt-1">{hint}</p>}
    </div>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [learned, setLearned] = useState<string | null>(null);

  // Session 1
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [age, setAge] = useState('');
  const [employment, setEmployment] = useState('salaried');
  const [takeHome, setTakeHome] = useState('');
  const [grossBand, setGrossBand] = useState('10-20');
  const [dependents, setDependents] = useState('0');
  const [expenses, setExpenses] = useState('');

  // Session 2
  const [sip, setSip] = useState(''); const [mfValue, setMfValue] = useState('');
  const [epf, setEpf] = useState(''); const [ppf, setPpf] = useState('');
  const [fd, setFd] = useState(''); const [stocks, setStocks] = useState('');
  const [savings, setSavings] = useState(''); const [property, setProperty] = useState('');

  // Session 3
  const [homeLoanOut, setHomeLoanOut] = useState(''); const [homeLoanEmi, setHomeLoanEmi] = useState('');
  const [plOut, setPlOut] = useState(''); const [plEmi, setPlEmi] = useState('');
  const [ccOut, setCcOut] = useState(''); const [ccLimit, setCcLimit] = useState('');
  const [termCover, setTermCover] = useState(''); const [healthCover, setHealthCover] = useState('');

  const bandToGross: Record<string, number> = { '5-10': 75000000, '10-20': 150000000, '20-35': 275000000, '35+': 450000000 };

  async function submit1(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      await patch('/user/me', {
        name: name || undefined, city: city || undefined,
        age: age ? Number(age) : undefined,
        employment_type: employment,
        annual_gross_income: bandToGross[grossBand],
        monthly_take_home: rupeesToPaise(takeHome),
        dependents_count: Number(dependents),
        onboarding_status: { session_1: 'complete', session_2: 'pending', session_3: 'pending' },
      });
      if (expenses) await patch('/user/profile/assets', { monthly_expenses: rupeesToPaise(expenses) });
      const save = expenses ? Math.round(((Number(takeHome) - Number(expenses)) / Number(takeHome)) * 100) : null;
      setLearned(save != null
        ? `You save roughly ${save}% of your take-home each month. The 25% benchmark ${save >= 25 ? 'is already behind you — strong start' : 'is your first target'}. Your Income & Savings dimension is now live.`
        : 'Your income profile is set. Add expenses later to unlock your savings rate.');
      setStep(2);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function submit2(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const assets: any = {};
      if (savings) assets.savings_balance = rupeesToPaise(savings);
      if (fd) assets.fd_total = rupeesToPaise(fd);
      if (mfValue || sip) assets.mutual_funds = { value: rupeesToPaise(mfValue || '0'), monthly_sip: rupeesToPaise(sip || '0') };
      if (epf) assets.epf = rupeesToPaise(epf);
      if (ppf) assets.ppf = rupeesToPaise(ppf);
      if (stocks) assets.stocks = rupeesToPaise(stocks);
      if (property) assets.property = rupeesToPaise(property);
      if (Object.keys(assets).length) await patch('/user/profile/assets', assets);
      await patch('/user/me', { onboarding_status: { session_1: 'complete', session_2: 'complete', session_3: 'pending' } });
      const total = Object.values({ s: savings, f: fd, m: mfValue, e: epf, p: ppf, st: stocks, pr: property })
        .reduce((acc: number, v: any) => acc + (Number(v) || 0), 0);
      setLearned(total > 0
        ? `Your assets total roughly ${inr(total * 100)}. Your net worth estimate and diversification score are now unlocked.`
        : 'No assets yet — that itself is useful to know. Your action plan will start with the foundations.');
      setStep(3);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function submit3(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const liabilities: any = {};
      if (homeLoanOut) liabilities.home_loans = [{ outstanding: rupeesToPaise(homeLoanOut), emi: rupeesToPaise(homeLoanEmi || '0'), rate: 8.5 }];
      if (plOut) liabilities.personal_loans = [{ outstanding: rupeesToPaise(plOut), emi: rupeesToPaise(plEmi || '0'), rate: 13 }];
      if (ccOut || ccLimit) liabilities.credit_cards = [{ outstanding: rupeesToPaise(ccOut || '0'), limit: rupeesToPaise(ccLimit || '0') }];
      if (Object.keys(liabilities).length) await patch('/user/profile/liabilities', liabilities);

      const insurance: any = {};
      if (termCover) insurance.term = [{ sum_assured: rupeesToPaise(termCover) }];
      if (healthCover) insurance.health = [{ sum_insured: rupeesToPaise(healthCover) }];
      if (Object.keys(insurance).length) await patch('/user/profile/insurance', insurance);

      await patch('/user/me', { onboarding_status: { session_1: 'complete', session_2: 'complete', session_3: 'complete' } });
      await post('/score/recalculate');
      router.push('/dashboard?welcome=1');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function fillLater() {
    if (step === 1) { setErr('Income is the one field we need — everything else can wait.'); return; }
    const status = step === 2
      ? { session_1: 'complete', session_2: 'deferred', session_3: 'pending' }
      : { session_1: 'complete', session_2: 'deferred', session_3: 'deferred' };
    await patch('/user/me', { onboarding_status: status });
    if (step === 2) setStep(3); else { await post('/score/recalculate'); router.push('/dashboard'); }
  }

  const pctDone = step === 1 ? 8 : step === 2 ? 40 : 75;

  return (
    <main className="min-h-screen bg-paper">
      <header className="max-w-2xl mx-auto px-6 pt-8 flex items-center justify-between">
        <Wordmark size="sm" />
        <span className="text-xs text-ink-faint font-semibold">{pctDone}% complete</span>
      </header>
      <div className="max-w-2xl mx-auto px-6 mt-3">
        <div className="h-1.5 bg-paper-200 rounded-full"><div className="h-full bg-mint-500 rounded-full transition-all duration-500" style={{ width: `${pctDone}%` }} /></div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {learned && (
          <div className="card p-5 mb-8 border-l-4 border-l-mint-500">
            <p className="text-xs font-bold uppercase tracking-widest text-pine-700 mb-1">Here&apos;s what we learned</p>
            <p className="text-sm text-ink-soft leading-relaxed">{learned}</p>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={submit1} className="card p-8 space-y-5">
            <div>
              <h1 className="font-display text-2xl font-medium">About you & your income</h1>
              <p className="text-sm text-ink-soft mt-1">Takes about 5 minutes. Only income is required — everything else helps us be precise.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div><label className="label">Full name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></div>
              <div><label className="label">City</label><input className="input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bengaluru" /></div>
              <div><label className="label">Age</label><input className="input" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="29" /></div>
              <div>
                <label className="label">Employment</label>
                <select className="input" value={employment} onChange={(e) => setEmployment(e.target.value)}>
                  <option value="salaried">Salaried</option><option value="self_employed">Self-employed</option>
                  <option value="freelancer">Freelancer</option><option value="business">Business owner</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Annual gross income</label>
              <div className="grid grid-cols-4 gap-2">
                {['5-10', '10-20', '20-35', '35+'].map((b) => (
                  <button type="button" key={b} onClick={() => setGrossBand(b)}
                    className={`rounded-lg border px-2 py-2.5 text-xs font-semibold transition-colors ${grossBand === b ? 'border-pine-700 bg-pine-900 text-white' : 'border-paper-200 bg-white hover:border-pine-600'}`}>
                    ₹{b}L
                  </button>
                ))}
              </div>
            </div>
            <Money label="Monthly take-home (after tax & PF) *" value={takeHome} onChange={setTakeHome} placeholder="1,08,000" hint="The exact amount that lands in your account." />
            <Money label="Approximate monthly expenses" value={expenses} onChange={setExpenses} hint="Unlocks your savings rate — your most important number. Estimate is fine." />
            <div>
              <label className="label">Financial dependents (spouse, children, parents)</label>
              <select className="input" value={dependents} onChange={(e) => setDependents(e.target.value)}>
                {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <p className="text-[11px] text-ink-faint mt-1">We use this to check if your insurance cover is adequate.</p>
            </div>
            {err && <p className="text-sm text-signal-red">{err}</p>}
            <button className="btn-primary w-full" disabled={busy || !takeHome}>{busy ? 'Saving…' : 'Continue — unlock my savings score'}</button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submit2} className="card p-8 space-y-5">
            <div>
              <h1 className="font-display text-2xl font-medium">Assets & investments</h1>
              <p className="text-sm text-ink-soft mt-1">About 8 minutes. Approximations are fine — you can refine anytime. Every field is optional.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <Money label="Savings account balance" value={savings} onChange={setSavings} hint="Used for your emergency fund check." />
              <Money label="Fixed deposits (total)" value={fd} onChange={setFd} />
              <Money label="Mutual funds — current value" value={mfValue} onChange={setMfValue} />
              <Money label="Monthly SIP amount" value={sip} onChange={setSip} />
              <Money label="EPF balance" value={epf} onChange={setEpf} hint="Shown on the EPFO portal — or fill later." />
              <Money label="PPF balance" value={ppf} onChange={setPpf} />
              <Money label="Stocks (Zerodha, Groww…)" value={stocks} onChange={setStocks} />
              <Money label="Property value (if owned)" value={property} onChange={setProperty} />
            </div>
            {err && <p className="text-sm text-signal-red">{err}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={fillLater} className="btn-secondary flex-1">Fill later</button>
              <button className="btn-primary flex-1" disabled={busy}>{busy ? 'Saving…' : 'Continue'}</button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={submit3} className="card p-8 space-y-5">
            <div>
              <h1 className="font-display text-2xl font-medium">Loans & insurance</h1>
              <p className="text-sm text-ink-soft mt-1">Last step — unlocks your full Money Health Score across all six dimensions.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <Money label="Home loan outstanding" value={homeLoanOut} onChange={setHomeLoanOut} />
              <Money label="Home loan EMI / month" value={homeLoanEmi} onChange={setHomeLoanEmi} />
              <Money label="Personal/car loan outstanding" value={plOut} onChange={setPlOut} />
              <Money label="Its EMI / month" value={plEmi} onChange={setPlEmi} />
              <Money label="Credit card outstanding" value={ccOut} onChange={setCcOut} />
              <Money label="Total credit card limit" value={ccLimit} onChange={setCcLimit} />
              <Money label="Term life cover (sum assured)" value={termCover} onChange={setTermCover} hint="Pure term plan only — not LIC endowment." />
              <Money label="Health cover (sum insured)" value={healthCover} onChange={setHealthCover} hint="Include employer cover if you have it." />
            </div>
            {err && <p className="text-sm text-signal-red">{err}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={fillLater} className="btn-secondary flex-1">Fill later</button>
              <button className="btn-primary flex-1" disabled={busy}>{busy ? 'Calculating…' : 'Reveal my Money Health Score'}</button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
