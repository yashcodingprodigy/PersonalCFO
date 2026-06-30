'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get, post } from '@/lib/api';
import { inr } from '@/lib/format';
import { insCatColor } from '@/lib/colors';
import { toast } from '@/lib/toast';

const CAT_ICON: Record<string, string> = {
  term_life: '🛡️', health: '🩺', personal_accident: '🦺', critical_illness: '❤️‍🩹', motor: '🚗', home: '🏠', travel: '✈️',
};
const SALARY_CATS = ['term_life', 'health', 'critical_illness', 'personal_accident', 'home']; // cover is editable
const NO_COVER_CATS = ['travel']; // per-trip, no cover slider

export default function InsuranceMarket() {
  const [cats, setCats] = useState<any[]>([]);
  const [verify, setVerify] = useState('');
  const [cat, setCat] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  // editable inputs
  const [coverR, setCoverR] = useState('');   // cover in rupees (string)
  const [age, setAge] = useState('');
  const [family, setFamily] = useState('');
  const [smoker, setSmoker] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [buy, setBuy] = useState<any>(null);   // plan being applied for
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    get('/insurance/market/categories').then((d: any) => {
      setCats(d.categories || []); setVerify(d.verifyNote || '');
      try { const c = new URLSearchParams(window.location.search).get('category'); if (c) openCat(c, d.categories); } catch {}
    }).catch(() => {});
    get('/user/me').then(setMe).catch(() => {});
  }, []);

  function openCat(category: string, list = cats) {
    setCat(category); setCompare([]); setData(null);
    const meta = (list || []).find((x) => x.category === category);
    loadPlans(category, meta?.recommendedCover);
  }

  async function loadPlans(category: string, coverPaise?: number) {
    setLoading(true);
    const params = new URLSearchParams({ category });
    if (coverPaise) params.set('cover', String(coverPaise));
    if (age) params.set('age', age);
    if (family) params.set('family', family);
    if (smoker) params.set('smoker', '1');
    const d = await get(`/insurance/market/plans?${params.toString()}`).catch(() => null);
    if (d) { setData(d); setCoverR(String(Math.round(d.cover / 100))); setAge(String(d.ctx.age)); setFamily(String(d.ctx.familySize)); }
    setLoading(false);
  }
  function applyControls() {
    const c = Math.round((parseFloat(coverR.replace(/[₹,\s]/g, '')) || 0) * 100);
    loadPlans(cat, c || undefined);
  }
  function toggleCompare(id: string) {
    setCompare((p) => p.includes(id) ? p.filter((x) => x !== id) : (p.length >= 3 ? p : [...p, id]));
  }

  // ── Landing: pick a category ──
  if (!cat) {
    return (
      <div className="space-y-5">
        <div>
          <Link href="/insurance" className="text-sm text-pine-700 underline">← Insurance</Link>
          <h1 className="font-display text-3xl font-medium mt-2">Find &amp; compare insurance</h1>
          <p className="text-sm text-ink-soft mt-1 max-w-2xl">Compare real plans from leading insurers, see which fits your profile best, and apply right here. We arrange your policy through our IRDAI-licensed insurer partners — in-app issuance is activating soon.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cats.map((c) => {
            const col = insCatColor(c.category);
            return (
              <button key={c.category} onClick={() => openCat(c.category)} className="card p-5 text-left hover:shadow-lift hover:border-pine-600 transition-all">
                <div className="flex items-center justify-between">
                  <span className={`grid place-items-center w-11 h-11 rounded-xl text-xl ${col.bg}`}>{CAT_ICON[c.category] || '📄'}</span>
                  <span className="text-[11px] text-ink-faint">{c.planCount} plans</span>
                </div>
                <p className={`text-sm font-bold mt-2.5 ${col.text}`}>{c.label}</p>
                {c.recommendedCover != null && <p className="text-[11px] text-ink-faint mt-0.5">suggested cover {inr(c.recommendedCover)}</p>}
                {c.gap > 0 && <p className="text-[11px] text-signal-red font-semibold mt-0.5">you have a gap of {inr(c.gap)}</p>}
              </button>
            );
          })}
        </div>
        {verify && <p className="text-[11px] text-ink-faint leading-relaxed">{verify}</p>}
      </div>
    );
  }

  // ── Category view: controls + ranked plans ──
  const plans: any[] = data?.plans || [];
  const showCover = !NO_COVER_CATS.includes(cat);
  const showFamily = cat === 'health';
  const showSmoker = cat === 'term_life';
  const compared = plans.filter((p) => compare.includes(p.id));

  return (
    <div className="space-y-5">
      <div>
        <button onClick={() => { setCat(''); setData(null); }} className="text-sm text-pine-700 underline">← All insurance types</button>
        <h1 className="font-display text-3xl font-medium mt-2">{CAT_ICON[cat]} {data?.label || ''}</h1>
        <p className="text-sm text-ink-soft mt-1">Ranked for your profile. Premiums are <strong>indicative</strong> — the insurer confirms the final premium at issuance.</p>
      </div>

      {/* Controls */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        {showCover && (
          <div><label className="label">{cat === 'motor' ? 'Vehicle value (IDV)' : cat === 'home' ? 'Cover (₹)' : 'Cover you want (₹)'}</label>
            <input className="input w-44" inputMode="numeric" value={coverR} onChange={(e) => setCoverR(e.target.value)} /></div>
        )}
        <div><label className="label">Age</label><input className="input w-20" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} /></div>
        {showFamily && <div><label className="label">Family size</label><input className="input w-20" inputMode="numeric" value={family} onChange={(e) => setFamily(e.target.value)} /></div>}
        {showSmoker && <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={smoker} onChange={(e) => setSmoker(e.target.checked)} className="accent-mint-500 w-4 h-4" /> Smoker</label>}
        <button onClick={applyControls} className="btn-primary !py-2.5">Update</button>
      </div>

      {loading && <div className="card h-40 animate-pulse" />}

      {/* Ranked plans */}
      {!loading && plans.map((p) => (
        <div key={p.id} className={`card p-5 ${p.bestFit ? 'border-2 border-mint-500/70' : ''}`}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {p.bestFit && <span className="chip bg-mint-500 text-pine-950 text-[10px] font-bold">★ Best fit for you</span>}
                {p.claimRatioPct && <span className="chip bg-pine-900 text-white text-[10px]">{p.claimRatioPct}% claims</span>}
              </div>
              <p className="text-base font-bold mt-1.5">{p.insurer} <span className="font-normal text-ink-soft">· {p.plan}</span></p>
              {p.reasons?.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {p.reasons.map((r: string, i: number) => <li key={i} className="text-xs text-pine-800 flex gap-1.5"><span className="text-mint-500 font-bold">✓</span>{r}</li>)}
                </ul>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="font-display text-2xl font-semibold">{inr(p.indicativePremium)}<span className="text-xs text-ink-faint font-normal">/{cat === 'travel' ? 'trip' : 'yr'}</span></p>
              <p className="text-[10px] text-ink-faint">indicative · {p.premiumBasis}</p>
            </div>
          </div>

          <div className="mt-3 border-t border-paper-100 pt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1">
            {p.highlights?.slice(0, 4).map((h: string, i: number) => (
              <p key={i} className="text-xs text-ink-soft flex gap-1.5"><span className="text-ink-faint shrink-0">•</span>{h}</p>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <button onClick={() => setBuy(p)} className="rounded-full bg-pine-900 text-white px-5 py-2 text-sm font-bold hover:bg-pine-800">Buy in app →</button>
            <label className="flex items-center gap-2 text-xs text-ink-soft cursor-pointer">
              <input type="checkbox" checked={compare.includes(p.id)} onChange={() => toggleCompare(p.id)} className="accent-pine-700 w-4 h-4" /> Compare
            </label>
          </div>
        </div>
      ))}

      {verify && <p className="text-[11px] text-ink-faint leading-relaxed">{verify}</p>}

      {/* Compare bar */}
      {compared.length >= 2 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 no-print">
          <CompareSheet plans={compared} cat={cat} onClose={() => setCompare([])} onBuy={setBuy} />
        </div>
      )}

      {/* In-app application / checkout (corporate-agent journey) */}
      {buy && <Checkout plan={buy} category={cat} cover={data?.cover || 0} me={me} onClose={() => setBuy(null)} />}
    </div>
  );
}

// In-app application flow (CRED-style). Captures the user's intent now; the live
// quote + KYC + payment + issuance plug in once the corporate-agent licence and
// the partner insurer's API are live. No premium is collected here.
function Checkout({ plan, category, cover, me, onClose }: { plan: any; category: string; cover: number; me: any; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: me?.name || '', dob: '', mobile: me?.mobile || '', email: me?.email || '', notes: '' });
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const per = category === 'travel' ? 'trip' : 'yr';
  const upd = (p: any) => setForm((f) => ({ ...f, ...p }));

  async function submit() {
    setSubmitting(true); setErr('');
    try {
      await post('/insurance/applications', {
        plan_id: plan.id, category, insurer: plan.insurer, plan_name: plan.plan,
        cover, premium_indicative: plan.indicativePremium, applicant: form,
      });
      setDone(true); toast('Application submitted — we’ll take it from here.');
    } catch (e: any) { setErr(e?.message || 'Could not submit. Please try again.'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-pine-950/60 flex items-center justify-center p-4 no-print" onClick={onClose}>
      <div className="card p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="text-center">
            <p className="text-4xl">🎉</p>
            <p className="text-lg font-bold mt-2">Application submitted</p>
            <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">
              Your application for <strong>{plan.insurer} · {plan.plan}</strong> is in. We’ll arrange it through our IRDAI-licensed insurer partner, confirm the exact premium, and issue the policy to you here.
            </p>
            <div className="rounded-lg bg-mint-100 text-pine-800 text-xs px-3 py-2.5 mt-3 leading-relaxed">
              In-app issuance & payment are <strong>activating soon</strong> — <strong>no premium has been collected</strong>. Track this under <Link href="/insurance" className="underline font-semibold">Insurance → Your applications</Link>.
            </div>
            <button onClick={onClose} className="btn-primary mt-4 w-full">Done</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-bold">{plan.insurer} · {plan.plan}</p>
              <button onClick={onClose} className="text-ink-faint text-sm">✕</button>
            </div>
            <p className="text-xs text-ink-faint">Step {step} of 2</p>

            {step === 1 && (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl bg-paper-50 border border-paper-200 p-3 text-sm">
                  <div className="flex justify-between"><span className="text-ink-soft">Cover</span><span className="font-semibold tabular-nums">{inr(cover)}</span></div>
                  <div className="flex justify-between"><span className="text-ink-soft">Indicative premium</span><span className="font-semibold tabular-nums">{inr(plan.indicativePremium)}/{per}</span></div>
                  <p className="text-[10px] text-ink-faint mt-1">Final premium is confirmed by the insurer at issuance.</p>
                </div>
                <p className="text-sm font-semibold">Your details</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2"><label className="label">Full name</label><input className="input" value={form.name} onChange={(e) => upd({ name: e.target.value })} /></div>
                  <div><label className="label">Date of birth</label><input type="date" className="input" value={form.dob} onChange={(e) => upd({ dob: e.target.value })} /></div>
                  <div><label className="label">Mobile</label><input className="input" value={form.mobile} onChange={(e) => upd({ mobile: e.target.value })} /></div>
                  <div className="col-span-2"><label className="label">Email</label><input className="input" value={form.email} onChange={(e) => upd({ email: e.target.value })} /></div>
                </div>
                <button onClick={() => setStep(2)} disabled={!form.name} className="btn-primary w-full disabled:opacity-50">Review →</button>
              </div>
            )}

            {step === 2 && (
              <div className="mt-3 space-y-3">
                <dl className="text-sm rounded-xl bg-paper-50 border border-paper-200 p-3 space-y-1">
                  <div className="flex justify-between"><dt className="text-ink-soft">Plan</dt><dd className="font-semibold text-right">{plan.plan}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-soft">Cover</dt><dd className="tabular-nums">{inr(cover)}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-soft">Indicative premium</dt><dd className="tabular-nums">{inr(plan.indicativePremium)}/{per}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink-soft">Applicant</dt><dd>{form.name}</dd></div>
                </dl>
                <label className="flex items-start gap-2 text-xs text-ink-soft">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-mint-500 w-4 h-4 shrink-0" />
                  I’d like PayWatch to arrange this policy through its IRDAI-licensed insurer partner and share these details with them for that purpose.
                </label>
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-ink-soft leading-relaxed">
                  In-app issuance & payment are activating soon — <strong>no premium is collected now</strong>. This submits your application; the insurer confirms the final premium and issues the policy.
                </div>
                {err && <p className="text-xs text-signal-red">{err}</p>}
                <div className="flex gap-2">
                  <button onClick={submit} disabled={!consent || submitting} className="btn-primary flex-1 disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit application'}</button>
                  <button onClick={() => setStep(1)} disabled={submitting} className="text-sm text-ink-faint underline px-2">Back</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CompareSheet({ plans, cat, onClose, onBuy }: { plans: any[]; cat: string; onClose: () => void; onBuy: (p: any) => void }) {
  return (
    <div className="card p-4 shadow-lift w-[92vw] max-w-3xl">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold">Comparing {plans.length}</p>
        <button onClick={onClose} className="text-xs text-ink-faint underline">Clear</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-ink-faint text-left"><th className="py-1 pr-3 font-medium">Plan</th><th className="font-medium">Premium</th><th className="font-medium">Claims</th><th className="font-medium">Key features</th><th></th></tr></thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id} className="border-t border-paper-100 align-top">
                <td className="py-2 pr-3"><span className="font-bold">{p.insurer}</span><br /><span className="text-ink-faint">{p.plan}</span></td>
                <td className="tabular-nums whitespace-nowrap">{inr(p.indicativePremium)}/{cat === 'travel' ? 'trip' : 'yr'}</td>
                <td className="tabular-nums">{p.claimRatioPct ? `${p.claimRatioPct}%` : '—'}</td>
                <td className="max-w-[16rem]">{(p.highlights || []).slice(0, 3).join(' · ')}</td>
                <td><button onClick={() => onBuy(p)} className="rounded-full bg-pine-900 text-white px-3 py-1 font-bold whitespace-nowrap">Buy →</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
