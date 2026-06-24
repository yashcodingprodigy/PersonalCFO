'use client';

import { useEffect, useState } from 'react';
import { get, post } from '@/lib/api';
import { inr, rupeesToPaise } from '@/lib/format';
import { parseCapitalGainsCsv } from '@/lib/statementParse';
import { ItrDocPrep } from '@/components/ItrDocPrep';
import Link from 'next/link';
import { Disclosure, Pill } from '@/components/kit';
import { UpgradeBanner } from '@/components/UpgradeBanner';

type Inputs = Record<string, string>;

const FIELDS_INCOME = [
  { k: 'grossSalary', label: 'Salary for the year', hint: 'Gross salary from your Form 16 (before deductions).' },
  { k: 'interestIncome', label: 'Interest earned', hint: 'Savings account + fixed deposit interest for the year.' },
  { k: 'otherIncome', label: 'Any other income', hint: 'Dividends, freelance one-offs, etc. Leave 0 if none.' },
];
const FIELDS_CG = [
  { k: 'stcgEquity', label: 'Profit on stocks/funds held under 1 year', hint: 'Short-term gains on listed shares & equity funds.' },
  { k: 'ltcgEquity', label: 'Profit on stocks/funds held over 1 year', hint: 'Long-term gains — first ₹1.25L/year is tax-free.' },
  { k: 'housePropertyIncome', label: 'Net rental income (let-out property)', hint: 'Rent received minus 30% standard deduction & loan interest. 0 if none.' },
];
const FIELDS_DED = [
  { k: 'ded80C', label: '80C investments', hint: 'EPF, PPF, ELSS, LIC, home-loan principal, tuition — max ₹1.5L.' },
  { k: 'ded80CCD1B', label: 'NPS (80CCD-1B)', hint: 'Extra ₹50,000 for NPS Tier-1.' },
  { k: 'ded80D', label: 'Health insurance premium (80D)', hint: 'Premiums for you + family (+ parents).' },
  { k: 'ded24b', label: 'Home-loan interest (24b)', hint: 'Interest on a home loan — up to ₹2L for self-occupied.' },
  { k: 'hraExempt', label: 'HRA exemption', hint: 'The tax-free portion of your HRA (we pre-fill this).' },
  { k: 'ded80G', label: 'Donations (80G)', hint: 'Eligible donations. 0 if none.' },
  { k: 'ded80E', label: 'Education-loan interest (80E)', hint: 'Fully deductible. 0 if none.' },
  { k: 'employerNps', label: 'Employer NPS (80CCD-2)', hint: 'Employer’s NPS contribution — works in both regimes.' },
];
const FIELDS_PAID = [
  { k: 'tdsSalary', label: 'Tax already deducted from salary (TDS)', hint: 'From Form 16 / Form 26AS — tax your employer already cut.' },
  { k: 'tdsOther', label: 'Other TDS', hint: 'TDS on interest, etc. (from 26AS). 0 if none.' },
  { k: 'advanceTax', label: 'Advance / self-assessment tax paid', hint: 'Any tax you paid yourself during the year. 0 if none.' },
];

const STEPS = ['Income', 'Deductions', 'Tax paid', 'Your return'];

function MoneyRow({ f, value, onChange }: any) {
  return (
    <div>
      <label className="label">{f.label}</label>
      <div className="flex">
        <span className="inline-flex items-center rounded-l-lg border border-r-0 border-paper-200 bg-paper-100 px-3 text-sm font-semibold text-ink-soft">₹</span>
        <input className="input rounded-l-none" inputMode="numeric" placeholder="0" value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))} />
      </div>
      <p className="text-[11px] text-ink-faint mt-1">{f.hint}</p>
    </div>
  );
}

export default function FilePage() {
  const [step, setStep] = useState(0);
  const [inputs, setInputs] = useState<Inputs>({});
  const [hasCG, setHasCG] = useState(false);
  const [fy, setFy] = useState('');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [cgNote, setCgNote] = useState('');

  async function onCgCsv(file: File) {
    setCgNote('Reading your statement…');
    try {
      const { stcg, ltcg, rows } = await parseCapitalGainsCsv(file);
      if (rows === 0) { setCgNote("Couldn't read that CSV — enter the amounts manually below."); return; }
      setInputs((p) => ({ ...p, stcgEquity: String(Math.max(0, Math.round(stcg / 100))), ltcgEquity: String(Math.max(0, Math.round(ltcg / 100))) }));
      setCgNote(`Read ${rows} rows → short-term ${inr(Math.max(0, stcg))}, long-term ${inr(Math.max(0, ltcg))}. Please verify below.`);
    } catch { setCgNote('Could not read that file — enter the amounts manually.'); }
  }


  useEffect(() => {
    get('/tax/filing/prefill').then((r) => {
      setFy(r.fy);
      const rupees: Inputs = {};
      Object.entries(r.inputs).forEach(([k, v]) => { if (typeof v === 'number') rupees[k] = v ? String(Math.round(v / 100)) : ''; });
      setInputs(rupees);
      if (Number(r.inputs.stcgEquity) || Number(r.inputs.ltcgEquity) || Number(r.inputs.housePropertyIncome)) setHasCG(true);
    }).catch(() => {});
  }, []);

  const set = (k: string) => (v: string) => setInputs((p) => ({ ...p, [k]: v }));
  const v = (k: string) => inputs[k] ?? '';

  async function compute() {
    setBusy(true);
    try {
      const payload: any = {};
      [...FIELDS_INCOME, ...FIELDS_CG, ...FIELDS_DED, ...FIELDS_PAID].forEach((f) => { payload[f.k] = rupeesToPaise(inputs[f.k] || '0'); });
      payload.otherCapitalGains = 0;
      const r = await post('/tax/filing/compute', payload);
      setResult(r); setStep(3);
    } catch (e: any) { alert(e.message); } finally { setBusy(false); }
  }

  function downloadPack() {
    const reg = result.recommendedRegime === 'old' ? result.old : result.new;
    const lines = [
      `PayWatch — ITR computation (FY ${result.fy})`,
      `Form: ${result.form.code} (${result.form.name}) · Regime: ${result.recommendedRegime.toUpperCase()}`, '',
      `Gross total income:  ₹${Math.round(reg.grossTotalIncome / 100).toLocaleString('en-IN')}`,
      `Deductions:          ₹${Math.round(reg.deductions / 100).toLocaleString('en-IN')}`,
      `Taxable income:      ₹${Math.round(reg.totalIncome / 100).toLocaleString('en-IN')}`,
      `Total tax:           ₹${Math.round(reg.totalTax / 100).toLocaleString('en-IN')}`,
      `Tax already paid:    ₹${Math.round(reg.taxesPaid / 100).toLocaleString('en-IN')}`,
      `${reg.refundOrPayable >= 0 ? 'Refund due' : 'Tax payable'}:    ₹${Math.abs(Math.round(reg.refundOrPayable / 100)).toLocaleString('en-IN')}`, '',
      'Documents to keep ready:', ...result.checklist.map((c: string) => `  • ${c}`), '',
      'Estimate for self-filing — cross-check with Form 26AS/AIS on incometax.gov.in.',
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `paywatch-itr-${result.fy}.txt`; a.click();
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <div>
        <h1 className="font-display text-3xl font-medium">Prepare your ITR docs</h1>
        <p className="text-sm text-ink-soft mt-1">Get everything you need to file your taxes in one place. Gather each document below, store it safely, and send it to your CA in a tap — or use the wizard to compute your return yourself. {fy && <>FY {fy}.</>}</p>
      </div>

      {/* Documents to prepare — upload, store & send to your CA */}
      <div className="card p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-1">📋 Documents to prepare</h2>
        <p className="text-xs text-ink-soft mb-3">Tap <strong>+</strong> on any document to upload it (encrypted) or send it to your CA. Sent items tick off automatically in your shared checklist.</p>
        <ItrDocPrep />
      </div>

      <UpgradeBanner feature="Guided ITR preparation and filing" />

      {/* Progress */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-pine-700' : 'bg-paper-200'}`} />
            <p className={`text-[10px] mt-1 font-semibold ${i === step ? 'text-pine-700' : 'text-ink-faint'}`}>{s}</p>
          </div>
        ))}
      </div>

      {step === 0 && (
        <section className="card p-6 space-y-4">
          <h2 className="font-display text-xl font-medium">What did you earn?</h2>
          {FIELDS_INCOME.map((f) => <MoneyRow key={f.k} f={f} value={v(f.k)} onChange={set(f.k)} />)}
          <label className="flex items-center gap-2 text-sm text-ink-soft pt-1">
            <input type="checkbox" checked={hasCG} onChange={(e) => setHasCG(e.target.checked)} />
            I sold stocks/mutual funds or have rental income this year
          </label>
          {hasCG && (
            <div className="space-y-4 border-t border-paper-100 pt-4">
              <div className="rounded-lg bg-mint-100 px-4 py-3">
                <label className="text-sm font-semibold cursor-pointer text-pine-800 inline-flex items-center gap-2">
                  📈 Upload your broker capital-gains CSV to auto-fill
                  <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onCgCsv(f); }} />
                </label>
                <p className="text-[11px] text-ink-soft mt-1">{cgNote || 'Zerodha / Groww / etc. tax P&L export — read on your device.'}</p>
              </div>
              {FIELDS_CG.map((f) => <MoneyRow key={f.k} f={f} value={v(f.k)} onChange={set(f.k)} />)}
            </div>
          )}
          <button onClick={() => setStep(1)} className="btn-primary w-full">Next — deductions</button>
        </section>
      )}

      {step === 1 && (
        <section className="card p-6 space-y-4">
          <h2 className="font-display text-xl font-medium">What can you deduct?</h2>
          <p className="text-xs text-ink-soft">We&apos;ve pre-filled these from your profile — edit anything that changed.</p>
          {FIELDS_DED.map((f) => <MoneyRow key={f.k} f={f} value={v(f.k)} onChange={set(f.k)} />)}
          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="btn-secondary flex-1">Back</button>
            <button onClick={() => setStep(2)} className="btn-primary flex-1">Next — tax paid</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card p-6 space-y-4">
          <h2 className="font-display text-xl font-medium">Tax you&apos;ve already paid</h2>
          <p className="text-xs text-ink-soft">From your Form 16 / Form 26AS. This decides your refund.</p>
          {FIELDS_PAID.map((f) => <MoneyRow key={f.k} f={f} value={v(f.k)} onChange={set(f.k)} />)}
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="btn-secondary flex-1">Back</button>
            <button onClick={compute} disabled={busy} className="btn-primary flex-1">{busy ? 'Computing…' : 'Compute my return'}</button>
          </div>
        </section>
      )}

      {step === 3 && result && (() => {
        const reg = result.recommendedRegime === 'old' ? result.old : result.new;
        const refund = reg.refundOrPayable >= 0;
        return (
          <div className="space-y-4">
            <section className={`card p-6 text-center ${refund ? 'bg-signal-green/5 border border-signal-green/30' : 'bg-signal-amber/5 border border-signal-amber/30'}`}>
              <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">{refund ? 'Your refund' : 'You need to pay'}</p>
              <p className={`font-display text-5xl font-semibold tabular-nums mt-2 ${refund ? 'text-signal-green' : 'text-signal-amber'}`}>{inr(Math.abs(reg.refundOrPayable))}</p>
              <div className="mt-3 flex justify-center gap-2 flex-wrap">
                <Pill tone="pine">{result.form.code} · {result.form.name}</Pill>
                <Pill tone="mint">{result.recommendedRegime} regime</Pill>
              </div>
              <p className="text-xs text-ink-soft mt-3">{result.form.why}</p>
            </section>

            {result.needsCA?.required && (
              <div className="card p-4 border-l-4 border-l-signal-amber"><p className="text-sm text-ink-soft leading-relaxed">{result.needsCA.reason}</p></div>
            )}

            <Disclosure title="See the full computation" subtitle="Every number, both regimes">
              <div className="border-t border-paper-100 pt-3 grid sm:grid-cols-2 gap-4 text-sm">
                {[result.old, result.new].map((r: any) => (
                  <div key={r.regime} className={`rounded-lg p-3 ${r.regime === result.recommendedRegime ? 'bg-mint-100' : 'bg-paper-50 border border-paper-200'}`}>
                    <p className="font-bold capitalize mb-1">{r.regime} regime {r.regime === result.recommendedRegime && '✓'}</p>
                    <ul className="space-y-1 text-xs text-ink-soft">
                      <li className="flex justify-between"><span>Taxable income</span><span className="tabular-nums">{inr(r.totalIncome)}</span></li>
                      <li className="flex justify-between"><span>Tax on income</span><span className="tabular-nums">{inr(r.slabTax)}</span></li>
                      {r.capitalGainsTax > 0 && <li className="flex justify-between"><span>Capital-gains tax</span><span className="tabular-nums">{inr(r.capitalGainsTax)}</span></li>}
                      <li className="flex justify-between"><span>Cess</span><span className="tabular-nums">{inr(r.cess)}</span></li>
                      <li className="flex justify-between font-semibold text-ink"><span>Total tax</span><span className="tabular-nums">{inr(r.totalTax)}</span></li>
                      <li className="flex justify-between"><span>Tax paid</span><span className="tabular-nums">{inr(r.taxesPaid)}</span></li>
                      <li className={`flex justify-between font-semibold ${r.refundOrPayable >= 0 ? 'text-signal-green' : 'text-signal-amber'}`}><span>{r.refundOrPayable >= 0 ? 'Refund' : 'Payable'}</span><span className="tabular-nums">{inr(Math.abs(r.refundOrPayable))}</span></li>
                    </ul>
                  </div>
                ))}
              </div>
            </Disclosure>

            <section className="card p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">How to file it yourself</h2>
              <ol className="space-y-2.5 text-sm text-ink-soft leading-relaxed list-decimal list-inside">
                {result.portalSteps.map((s: string, i: number) => <li key={i}>{s}</li>)}
              </ol>
            </section>

            <section className="card p-6">
              <h2 className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-3">Documents to keep ready</h2>
              <ul className="space-y-2 text-sm text-ink-soft">
                {result.checklist.map((c: string, i: number) => <li key={i} className="flex gap-2"><span className="text-pine-700 font-bold shrink-0">✓</span>{c}</li>)}
              </ul>
              <Link href="/rent-receipts" className="inline-block mt-3 text-sm font-semibold text-pine-700 hover:underline">Need HRA rent receipts? Generate them →</Link>
            </section>

            <section className="card p-6 bg-pine-950 text-white">
              <h2 className="text-sm font-bold uppercase tracking-widest text-mint-300 mb-1">Prefer to use a CA?</h2>
              <p className="text-sm text-white/80 leading-relaxed">Many people still want a Chartered Accountant to file and sign off — and for audits or certifications, that&apos;s legally required. We make their job faster: your whole return is computed, the right ITR form is picked, and the documents are checklisted. Download the pack and hand it over — your CA gets a head start instead of starting from scratch.</p>
              <button onClick={downloadPack} className="mt-3 rounded-full bg-mint-500 text-pine-950 px-5 py-2 text-sm font-bold hover:bg-mint-400 transition-colors">Download CA-ready pack</button>
            </section>

            <div className="flex flex-wrap gap-2">
              <button onClick={downloadPack} className="btn-primary">Download my computation</button>
              <a href="https://www.incometax.gov.in" target="_blank" rel="noopener noreferrer" className="btn-secondary !inline-flex items-center">Open the filing portal ↗</a>
              <button onClick={() => setStep(0)} className="text-xs text-ink-faint underline px-3">Edit my answers</button>
            </div>

            <p className="text-[11px] text-ink-faint leading-relaxed">{result.disclaimer}</p>
          </div>
        );
      })()}
    </div>
  );
}
