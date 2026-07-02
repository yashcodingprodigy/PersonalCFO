'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { get, post } from '@/lib/api';
import { inr } from '@/lib/format';
import { insCatColor, PALETTE_HEX } from '@/lib/colors';
import { toast } from '@/lib/toast';
import { Skeleton, SkeletonCard, WittyLoader } from '@/components/Skeleton';

const CAT_ICON: Record<string, string> = {
  term_life: '🛡️', health: '🩺', personal_accident: '🦺', critical_illness: '❤️‍🩹', motor: '🚗', home: '🏠', travel: '✈️',
};
const NO_COVER_CATS = ['travel'];
const GST = 0.18;

// Deterministic insurer monogram (initials + colour) since we don't ship logos.
function monogram(name = '') {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'IN';
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { initials, color: PALETTE_HEX[h % PALETTE_HEX.length] };
}
const rupee = (n: number) => `₹${Math.round(n / 100).toLocaleString('en-IN')}`;

export default function InsuranceMarket() {
  const [cats, setCats] = useState<any[]>([]);
  const [verify, setVerify] = useState('');
  const [catsLoading, setCatsLoading] = useState(true);
  const [cat, setCat] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [coverR, setCoverR] = useState('');
  const [age, setAge] = useState('');
  const [family, setFamily] = useState('');
  const [smoker, setSmoker] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [buy, setBuy] = useState<any>(null);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    get('/insurance/market/categories').then((d: any) => {
      setCats(d.categories || []); setVerify(d.verifyNote || ''); setCatsLoading(false);
      try { const c = new URLSearchParams(window.location.search).get('category'); if (c) openCat(c, d.categories); } catch {}
    }).catch(() => setCatsLoading(false));
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
  const toggleCompare = (id: string) => setCompare((p) => p.includes(id) ? p.filter((x) => x !== id) : (p.length >= 3 ? p : [...p, id]));

  // ── Landing ──
  if (!cat) {
    return (
      <div className="space-y-5">
        <div>
          <Link href="/insurance" className="text-sm text-pine-700 underline">← Insurance</Link>
          <h1 className="font-display text-3xl font-medium mt-2">Find &amp; buy insurance</h1>
          <p className="text-sm text-ink-soft mt-1 max-w-2xl">Compare real plans from leading insurers and start your application here. Plans are arranged through our IRDAI-licensed insurance partner, who handles the quote, KYC, payment and policy. Premiums are indicative; in-app issuance is activating soon.</p>
        </div>
        {catsLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card p-5"><Skeleton className="w-11 h-11 rounded-xl" /><Skeleton className="h-3.5 w-2/3 mt-3" /><Skeleton className="h-3 w-1/2 mt-2" /></div>)}</div>
        ) : (
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
        )}
        {verify && <p className="text-[11px] text-ink-faint leading-relaxed">{verify}</p>}
      </div>
    );
  }

  // ── Category view ──
  const plans: any[] = data?.plans || [];
  const coverages: string[] = data?.coverages || [];
  const addOns: any[] = data?.addOns || [];
  const showCover = !NO_COVER_CATS.includes(cat);
  const showFamily = cat === 'health';
  const showSmoker = cat === 'term_life';
  const cheapest = plans.length ? Math.min(...plans.map((p) => p.indicativePremium || Infinity)) : 0;
  const compared = plans.filter((p) => compare.includes(p.id));
  const per = cat === 'travel' ? 'trip' : 'yr';

  return (
    <div className="space-y-5">
      <div>
        <button onClick={() => { setCat(''); setData(null); }} className="text-sm text-pine-700 underline">← All insurance types</button>
        <h1 className="font-display text-3xl font-medium mt-2">{CAT_ICON[cat]} {data?.label || ''}</h1>
        <p className="text-sm text-ink-soft mt-1">Sorted by how well each matches the details you entered. Premiums are <strong>indicative</strong>, not advice — your insurer confirms the final premium at issuance.</p>
      </div>

      <div className="rounded-xl bg-paper-100 border border-paper-200 px-4 py-2.5 text-[11px] text-ink-soft leading-relaxed">
        These are options shown for the details you provided, arranged through our IRDAI-licensed insurance partner and subject to insurer terms, underwriting and disclosures. This is information to help you choose, not insurance advice.
      </div>

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

      {loading ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} lines={2} />)}</div> : (
        plans.map((p) => (
          <PlanCard key={p.id} p={p} coverages={coverages} per={per} isCheapest={p.indicativePremium === cheapest}
            onSelect={() => setBuy(p)} inCompare={compare.includes(p.id)} onCompare={() => toggleCompare(p.id)} />
        ))
      )}

      {verify && !loading && <p className="text-[11px] text-ink-faint leading-relaxed">{verify}</p>}

      {compared.length >= 2 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 no-print">
          <CompareSheet plans={compared} cat={cat} coverages={coverages} onClose={() => setCompare([])} onBuy={setBuy} />
        </div>
      )}

      {buy && <Checkout plan={buy} category={cat} cover={data?.cover || 0} addOns={addOns} coverages={coverages} me={me} onClose={() => setBuy(null)} />}
    </div>
  );
}

// ── CRED-style plan card ────────────────────────────────────────────
function PlanCard({ p, coverages, per, isCheapest, onSelect, inCompare, onCompare }: any) {
  const [open, setOpen] = useState(false);
  const m = monogram(p.insurer);
  const covShown = coverages.slice(0, 2).join(', ');
  const covMore = Math.max(0, coverages.length - 2);
  return (
    <div className={`card overflow-hidden ${p.bestFit ? 'ring-2 ring-mint-500/70' : ''}`}>
      {p.bestFit && <div className="bg-mint-500 text-pine-950 text-[11px] font-bold uppercase tracking-wider px-4 py-1.5">★ Matches your inputs</div>}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="grid place-items-center w-11 h-11 rounded-lg text-white text-sm font-bold shrink-0" style={{ background: m.color }}>{m.initials}</span>
            <div className="min-w-0">
              <p className="text-[13px] text-ink-faint">{p.insurer}</p>
              <p className="text-sm font-bold">{p.plan}</p>
            </div>
          </div>
          <button onClick={() => setOpen((o) => !o)} className="text-xs text-ocean-600 font-semibold underline shrink-0">View benefits</button>
        </div>

        {isCheapest && <div className="mt-3 rounded-lg bg-mint-100 text-pine-800 text-[11px] font-bold px-3 py-1.5 inline-flex items-center gap-1.5">💰 Lowest indicative premium here</div>}

        <dl className="mt-3 space-y-1.5 text-sm">
          {p.claimRatioPct && <div className="flex justify-between"><dt className="text-ink-faint">Claim settlement</dt><dd className="font-semibold">{p.claimRatioPct}%</dd></div>}
          <div className="flex justify-between gap-3"><dt className="text-ink-faint shrink-0">Coverages</dt><dd className="text-right">{covShown}{covMore > 0 && <button onClick={() => setOpen(true)} className="text-ocean-600 font-semibold"> +{covMore} more ›</button>}</dd></div>
        </dl>

        {p.reasons?.length > 0 && (
          <ul className="mt-2.5 space-y-0.5">
            {p.reasons.slice(0, 2).map((r: string, i: number) => <li key={i} className="text-xs text-pine-800 flex gap-1.5"><span className="text-mint-500 font-bold">✓</span>{r}</li>)}
          </ul>
        )}

        {open && (
          <div className="mt-3 rounded-xl bg-paper-50 border border-paper-200 p-3 pw-fade-up">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5">What’s covered</p>
            <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
              {coverages.map((c: string, i: number) => <li key={i} className="text-xs text-ink-soft flex gap-1.5"><span className="text-mint-500">✓</span>{c}</li>)}
            </ul>
            {p.highlights?.length > 0 && (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mt-3 mb-1.5">Plan highlights</p>
                <ul className="space-y-1">{p.highlights.map((h: string, i: number) => <li key={i} className="text-xs text-ink-soft flex gap-1.5"><span className="text-ink-faint">•</span>{h}</li>)}</ul>
              </>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-paper-100 pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-ink-faint">premium</p>
            <p className="font-display text-2xl font-semibold">{inr(p.indicativePremium)}<span className="text-xs text-ink-faint font-normal">/{per}</span></p>
            <p className="text-[10px] text-ink-faint">indicative</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] text-ink-soft cursor-pointer"><input type="checkbox" checked={inCompare} onChange={onCompare} className="accent-pine-700 w-4 h-4" /> Compare</label>
            <button onClick={onSelect} className="rounded-lg bg-pine-950 text-white px-5 py-2.5 text-sm font-bold hover:bg-pine-900 inline-flex items-center gap-1.5">Select →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Category-aware checkout (CRED-style) ────────────────────────────
const IDV_TIERS = [
  { id: 'min', label: 'minimum IDV', factor: 0.9, popular: true, desc: 'Lowest premium. If your car is written off or stolen, the payout is lower.' },
  { id: 'standard', label: 'standard IDV', factor: 1.0, desc: 'A balance between IDV and premium — a substantial claim payout.' },
  { id: 'max', label: 'maximum IDV', factor: 1.12, desc: 'Highest payout on total loss/theft. Best for newer cars.' },
];
const CALC_MSGS = ['crunching the numbers…', 'haggling with the insurer on your behalf…', 'reading 40 pages of fine print…', 'making it official…'];

function Checkout({ plan, category, cover, addOns, coverages, me, onClose }: any) {
  const [phase, setPhase] = useState<'configure' | 'calculating' | 'review' | 'done'>('configure');
  const [idv, setIdv] = useState('min');
  const [selected, setSelected] = useState<string[]>(addOns.filter((a: any) => a.popular).map((a: any) => a.id));
  const [form, setForm] = useState({ name: me?.name || '', dob: '', mobile: me?.mobile || '', email: me?.email || '' });
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const per = category === 'travel' ? 'trip' : 'yr';
  const upd = (p: any) => setForm((f: any) => ({ ...f, ...p }));

  const idvFactor = category === 'motor' ? (IDV_TIERS.find((t) => t.id === idv)?.factor || 1) : 1;
  const basePremium = Math.round(plan.indicativePremium * idvFactor);
  const idvValue = Math.round(cover * idvFactor);
  const addOnTotal = useMemo(() => addOns.filter((a: any) => selected.includes(a.id)).reduce((s: number, a: any) => s + a.price * 100, 0), [selected, addOns]);
  const net = basePremium + addOnTotal;
  const gst = Math.round(net * GST);
  const total = net + gst;
  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  function toCalc() { setPhase('calculating'); setTimeout(() => setPhase('review'), 1900); }

  async function submit() {
    setSubmitting(true); setErr('');
    try {
      await post('/insurance/applications', {
        plan_id: plan.id, category, insurer: plan.insurer, plan_name: plan.plan,
        cover: category === 'motor' ? idvValue : cover, premium_indicative: total,
        applicant: { ...form, notes: `IDV:${idv}; add-ons:${selected.join(',') || 'none'}; net:${rupee(net)}; gst:${rupee(gst)}; total:${rupee(total)}` },
      });
      setPhase('done'); toast('Application started — our licensed partner will take it from here.');
    } catch (e: any) { setErr(e?.message || 'Could not submit. Please try again.'); }
    finally { setSubmitting(false); }
  }

  const m = monogram(plan.insurer);
  return (
    <div className="fixed inset-0 z-50 bg-pine-950/70 flex items-end sm:items-center justify-center sm:p-4 no-print" onClick={onClose}>
      <div className="bg-paper rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {phase === 'calculating' ? (
          <div className="bg-pine-950 min-h-[60vh] flex items-center"><WittyLoader dark title="calculating your final premium" messages={CALC_MSGS} /></div>
        ) : phase === 'done' ? (
          <div className="p-6 text-center">
            <p className="text-4xl">🎉</p>
            <p className="text-lg font-bold mt-2">Application started</p>
            <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">Your application for <strong>{plan.insurer} · {plan.plan}</strong> is in. We’ll arrange it through our IRDAI-licensed insurer partner, confirm the exact premium and issue it here.</p>
            <div className="rounded-lg bg-mint-100 text-pine-800 text-xs px-3 py-2.5 mt-3 leading-relaxed">Issuance &amp; payment are <strong>activating soon</strong> — <strong>no premium has been collected</strong>. Track it under <Link href="/insurance" className="underline font-semibold">Insurance → Your applications</Link>.</div>
            <button onClick={onClose} className="btn-primary mt-4 w-full">Done</button>
          </div>
        ) : (
          <>
            {/* header */}
            <div className="sticky top-0 bg-paper border-b border-paper-200 px-5 py-3 flex items-center gap-3 z-10">
              <span className="grid place-items-center w-9 h-9 rounded-lg text-white text-xs font-bold" style={{ background: m.color }}>{m.initials}</span>
              <div className="flex-1 min-w-0"><p className="text-[11px] text-ink-faint truncate">{plan.insurer}</p><p className="text-sm font-bold truncate">{plan.plan}</p></div>
              <button onClick={onClose} className="text-ink-faint">✕</button>
            </div>

            {phase === 'configure' && (
              <div className="p-5 space-y-4">
                {category === 'motor' && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">Select your insured value (IDV)</p>
                    <div className="space-y-2">
                      {IDV_TIERS.map((t) => (
                        <button key={t.id} onClick={() => setIdv(t.id)} className={`w-full text-left rounded-xl border p-3 flex items-start gap-3 ${idv === t.id ? 'border-pine-700 bg-pine-900/5' : 'border-paper-200'}`}>
                          <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 ${idv === t.id ? 'border-pine-700 bg-pine-700' : 'border-paper-200'}`} />
                          <span className="min-w-0">
                            <span className="text-sm font-bold flex items-center gap-2">{t.label} {t.popular && <span className="chip bg-mint-100 text-pine-800 text-[9px]">POPULAR</span>}</span>
                            <span className="block text-[11px] text-ink-soft mt-0.5">{t.desc}</span>
                            <span className="block text-[11px] text-ink-faint mt-0.5">IDV ≈ {inr(Math.round(cover * t.factor))} · premium {inr(Math.round(plan.indicativePremium * t.factor))}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {addOns.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">{category === 'motor' ? 'Boost your policy with upgrades' : 'Optional add-ons'}</p>
                    <div className="space-y-2">
                      {addOns.map((a: any) => {
                        const on = selected.includes(a.id);
                        return (
                          <div key={a.id} className="rounded-xl border border-paper-200 p-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold flex items-center gap-2">{a.name} {a.popular && <span className="chip bg-mint-100 text-pine-800 text-[9px]">POPULAR</span>}</p>
                              <p className="text-[11px] text-ink-soft mt-0.5">{a.desc}</p>
                            </div>
                            <button onClick={() => toggle(a.id)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${on ? 'bg-pine-950 text-white' : 'border border-paper-200 text-pine-700'}`}>{on ? '✓ Added' : `+ ${rupee(a.price * 100)}`}</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="rounded-xl bg-paper-50 border border-paper-200 p-3 text-sm">
                  <div className="flex justify-between"><span className="text-ink-soft">Base premium</span><span className="tabular-nums">{inr(basePremium)}</span></div>
                  {addOnTotal > 0 && <div className="flex justify-between"><span className="text-ink-soft">Add-ons</span><span className="tabular-nums">{inr(addOnTotal)}</span></div>}
                  <div className="flex justify-between font-semibold border-t border-paper-100 pt-1.5 mt-1.5"><span>Total (excl. GST)</span><span className="tabular-nums">{inr(net)}/{per}</span></div>
                </div>
                <button onClick={toCalc} className="btn-primary w-full">Continue →</button>
              </div>
            )}

            {phase === 'review' && (
              <div className="bg-pine-800 text-white px-5 pt-5 pb-0">
                <p className="font-display text-2xl font-medium">review your details</p>
                <div className="bg-paper text-ink rounded-t-2xl -mx-5 mt-4 px-5 py-5 space-y-3">
                  <dl className="rounded-xl bg-paper-50 border border-paper-200 p-3 text-sm space-y-1">
                    <div className="flex justify-between"><dt className="text-ink-soft">{category === 'motor' ? 'Insured value (IDV)' : 'Cover'}</dt><dd className="tabular-nums">{inr(category === 'motor' ? idvValue : cover)}</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-soft">Valid till</dt><dd>{new Date(Date.now() + 365 * 864e5).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</dd></div>
                    <div className="flex justify-between font-semibold"><dt>Net premium</dt><dd className="tabular-nums">{inr(net)}</dd></div>
                  </dl>
                  {selected.length > 0 && (
                    <div className="rounded-xl bg-paper-50 border border-paper-200 p-3 text-sm">
                      <p className="text-[11px] uppercase tracking-wider text-ink-faint mb-1.5">Selected upgrades</p>
                      {addOns.filter((a: any) => selected.includes(a.id)).map((a: any) => <div key={a.id} className="flex justify-between"><span className="text-ink-soft">{a.name}</span><span className="tabular-nums">{rupee(a.price * 100)}</span></div>)}
                    </div>
                  )}
                  <div className="rounded-xl bg-paper-50 border border-paper-200 p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-ink-soft">GST (18%)</span><span className="tabular-nums">{inr(gst)}</span></div>
                    <div className="flex justify-between font-bold text-base border-t border-paper-100 pt-1.5 mt-1"><span>Total premium</span><span className="tabular-nums">{inr(total)}</span></div>
                  </div>

                  <p className="text-sm font-semibold pt-1">Your details</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2"><label className="label">Full name</label><input className="input" value={form.name} onChange={(e) => upd({ name: e.target.value })} /></div>
                    <div><label className="label">Date of birth</label><input type="date" className="input" value={form.dob} onChange={(e) => upd({ dob: e.target.value })} /></div>
                    <div><label className="label">Mobile</label><input className="input" value={form.mobile} onChange={(e) => upd({ mobile: e.target.value })} /></div>
                    <div className="col-span-2"><label className="label">Email</label><input className="input" value={form.email} onChange={(e) => upd({ email: e.target.value })} /></div>
                  </div>
                  <label className="flex items-start gap-2 text-xs text-ink-soft"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-mint-500 w-4 h-4 shrink-0" />I’d like PayWatch to arrange this policy through its IRDAI-licensed insurer partner and share these details for that purpose.</label>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-ink-soft leading-relaxed">Issuance &amp; payment are activating soon — <strong>no premium is collected now</strong>. This submits your application; the insurer confirms the final premium and issues the policy.</div>
                  {err && <p className="text-xs text-signal-red">{err}</p>}
                  <div className="flex gap-2">
                    <button onClick={submit} disabled={!consent || !form.name || submitting} className="btn-primary flex-1 disabled:opacity-50">{submitting ? 'Starting…' : 'Continue with our licensed partner'}</button>
                    <button onClick={() => setPhase('configure')} disabled={submitting} className="text-sm text-ink-faint underline px-2">Back</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CompareSheet({ plans, cat, coverages, onClose, onBuy }: any) {
  const per = cat === 'travel' ? 'trip' : 'yr';
  return (
    <div className="card p-4 shadow-lift w-[92vw] max-w-3xl">
      <div className="flex items-center justify-between mb-2"><p className="text-sm font-bold">Comparing {plans.length}</p><button onClick={onClose} className="text-xs text-ink-faint underline">Clear</button></div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-ink-faint text-left"><th className="py-1 pr-3 font-medium">Plan</th><th className="font-medium">Premium</th><th className="font-medium">Claims</th><th className="font-medium">Coverages</th><th></th></tr></thead>
          <tbody>
            {plans.map((p: any) => (
              <tr key={p.id} className="border-t border-paper-100 align-top">
                <td className="py-2 pr-3"><span className="font-bold">{p.insurer}</span><br /><span className="text-ink-faint">{p.plan}</span></td>
                <td className="tabular-nums whitespace-nowrap">{inr(p.indicativePremium)}/{per}</td>
                <td className="tabular-nums">{p.claimRatioPct ? `${p.claimRatioPct}%` : '—'}</td>
                <td className="max-w-[14rem]">{coverages.slice(0, 3).join(' · ')}</td>
                <td><button onClick={() => onBuy(p)} className="rounded-lg bg-pine-950 text-white px-3 py-1 font-bold whitespace-nowrap">Select →</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
