'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get } from '@/lib/api';
import { inr } from '@/lib/format';

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
  const [buy, setBuy] = useState<any>(null);   // interstitial plan

  useEffect(() => {
    get('/insurance/market/categories').then((d: any) => {
      setCats(d.categories || []); setVerify(d.verifyNote || '');
      try { const c = new URLSearchParams(window.location.search).get('category'); if (c) openCat(c, d.categories); } catch {}
    }).catch(() => {});
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
          <p className="text-sm text-ink-soft mt-1 max-w-2xl">Compare real plans from leading insurers, see which fits your profile best, and we’ll guide you to buy it on the insurer’s site. Educational comparison — PayWatch doesn’t sell insurance.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cats.map((c) => (
            <button key={c.category} onClick={() => openCat(c.category)} className="card p-5 text-left hover:border-pine-600 hover:shadow-card transition-all">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{CAT_ICON[c.category] || '📄'}</span>
                <span className="text-[11px] text-ink-faint">{c.planCount} plans</span>
              </div>
              <p className="text-sm font-bold mt-2">{c.label}</p>
              {c.recommendedCover != null && <p className="text-[11px] text-ink-faint mt-0.5">suggested cover {inr(c.recommendedCover)}</p>}
              {c.gap > 0 && <p className="text-[11px] text-signal-red font-semibold mt-0.5">you have a gap of {inr(c.gap)}</p>}
            </button>
          ))}
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
        <p className="text-sm text-ink-soft mt-1">Ranked for your profile. Premiums are <strong>indicative estimates</strong> — confirm the live premium on the insurer’s site.</p>
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
            <button onClick={() => setBuy(p)} className="rounded-full bg-pine-900 text-white px-5 py-2 text-sm font-bold hover:bg-pine-800">View &amp; buy →</button>
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

      {/* Buy interstitial (compliant hand-off) */}
      {buy && (
        <div className="fixed inset-0 z-50 bg-pine-950/60 flex items-center justify-center p-4 no-print" onClick={() => setBuy(null)}>
          <div className="card p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-bold">{buy.insurer} · {buy.plan}</p>
            <p className="text-sm text-ink-soft mt-1">Indicative premium <strong>{inr(buy.indicativePremium)}/{cat === 'travel' ? 'trip' : 'yr'}</strong> for {buy.premiumBasis}.</p>
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-ink-soft leading-relaxed">
              You’re about to continue on <strong>{buy.insurer}</strong>’s own website to get the live premium and buy. PayWatch doesn’t sell insurance and isn’t paid by insurers — this is educational guidance. Confirm the exact premium, inclusions and exclusions there before paying.
            </div>
            <div className="mt-4 flex gap-2">
              <a href={buy.buyUrl} target="_blank" rel="noopener noreferrer" onClick={() => setBuy(null)} className="rounded-full bg-mint-500 text-pine-950 px-5 py-2.5 text-sm font-bold hover:bg-mint-400">Continue to {buy.insurer} →</a>
              <button onClick={() => setBuy(null)} className="text-sm text-ink-faint underline">Cancel</button>
            </div>
          </div>
        </div>
      )}
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
