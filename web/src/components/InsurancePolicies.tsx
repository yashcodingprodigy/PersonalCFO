'use client';

import { useEffect, useRef, useState } from 'react';
import { get, post, del, downloadFile } from '@/lib/api';
import { inr } from '@/lib/format';
import { fileToBase64 } from '@/components/CaThread';
import { readPdfText } from '@/lib/statementParse';

// Insurance categories the user can upload. Mirrors the server enum.
const CATS: { key: string; icon: string; label: string }[] = [
  { key: 'term_life', icon: '🛡️', label: 'Term life' },
  { key: 'health', icon: '🩺', label: 'Health' },
  { key: 'motor', icon: '🚗', label: 'Motor (car / bike)' },
  { key: 'personal_accident', icon: '🦺', label: 'Personal accident' },
  { key: 'critical_illness', icon: '❤️‍🩹', label: 'Critical illness' },
  { key: 'home', icon: '🏠', label: 'Home / property' },
  { key: 'travel', icon: '✈️', label: 'Travel' },
  { key: 'life_endowment', icon: '📜', label: 'Endowment / ULIP' },
  { key: 'other', icon: '📄', label: 'Other' },
];
const catLabel = (k: string) => CATS.find((c) => c.key === k)?.label || k;
const catIcon = (k: string) => CATS.find((c) => c.key === k)?.icon || '📄';

const RUPn = (n: any) => { const x = Number(n); return isFinite(x) && x > 0 ? Math.round(x * 100) : null; };
const isoOk = (s: any) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)) ? s : null;
const fmtD = (s?: string | null) => s ? new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

interface Policy {
  policy_id: string; category: string; insurer: string | null; plan_name: string | null;
  sum_assured: number | null; premium: number | null; premium_frequency: string | null;
  issue_date: string | null; start_date: string | null; expiry_date: string | null;
  maturity_date: string | null; renewal_date: string | null; status: string;
  file_name: string | null; has_file: boolean;
}

interface Staged {
  category: string; file: File; summary?: string;
  insurer?: string; plan_name?: string; policy_number?: string; holder_name?: string; nominee?: string;
  sum_assured?: number | null; premium?: number | null; premium_frequency?: string;
  issue_date?: string | null; start_date?: string | null; expiry_date?: string | null;
  maturity_date?: string | null; renewal_date?: string | null; extracted?: any;
  engine?: 'ai' | 'manual'; invalid?: boolean; unreadable?: boolean; detected?: string; aiReason?: string;
}

// Days until a date; null if no date.
const daysTo = (s?: string | null) => s ? Math.round((new Date(s).getTime() - Date.now()) / 86400000) : null;

function StatusBadge({ p }: { p: Policy }) {
  const renew = p.renewal_date || p.expiry_date;
  const d = daysTo(renew);
  if (d != null) {
    if (d < 0) return <span className="chip bg-signal-red/15 text-signal-red text-[10px] font-bold">Lapsed {fmtD(renew)}</span>;
    if (d <= 30) return <span className="chip bg-amber-100 text-amber-700 text-[10px] font-bold">Renew in {d}d</span>;
  }
  const md = daysTo(p.maturity_date);
  if (md != null && md >= 0 && md <= 60) return <span className="chip bg-pine-900 text-white text-[10px] font-bold">Matures in {md}d</span>;
  return <span className="chip bg-mint-100 text-pine-800 text-[10px] font-bold">Active</span>;
}

export function InsurancePolicies({ onChange }: { onChange?: () => void }) {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [confirmId, setConfirmId] = useState('');
  const [removing, setRemoving] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingCat = useRef('');

  function load() { get('/insurance/policies').then(setPolicies).catch(() => {}); }
  useEffect(() => { load(); }, []);

  function pick(cat: string) { pendingCat.current = cat; setErr(''); fileRef.current?.click(); }

  async function onFile(file: File) {
    const cat = pendingCat.current; if (!cat) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErr(`Please upload a PDF policy document — a photo or scan can’t be read accurately.`);
      return;
    }
    setBusy(true); setErr(''); setStaged(null);
    try {
      const text = (await readPdfText(file).catch(() => '')).replace(/\s+/g, ' ').trim();
      if (text.length < 60) {
        setStaged({ category: cat, file, engine: 'manual', invalid: true, unreadable: true,
          aiReason: 'This file has almost no readable text — it looks like a scan or photo. Upload a clearer, text-based PDF, or fill the details in by hand below.' });
        return;
      }
      const ai = await post('/insurance/ai-extract', { category: cat, text }).catch(() => null);
      if (ai?.available && ai.result) {
        const f = ai.result.fields || {};
        setStaged({
          category: cat, file, summary: ai.result.summary,
          insurer: f.insurer, plan_name: f.planName, policy_number: f.policyNumber, holder_name: f.holderName, nominee: f.nominee,
          sum_assured: RUPn(f.sumAssured), premium: RUPn(f.premium), premium_frequency: f.premiumFrequency,
          issue_date: isoOk(f.issueDate), start_date: isoOk(f.startDate), expiry_date: isoOk(f.expiryDate),
          maturity_date: isoOk(f.maturityDate), renewal_date: isoOk(f.renewalDate), extracted: f,
          engine: 'ai', invalid: ai.result.matchesExpected === false || ai.result.readable === false,
          unreadable: ai.result.readable === false, detected: ai.result.documentType, aiReason: ai.result.reason,
        });
      } else {
        setStaged({ category: cat, file, engine: 'manual' });
      }
    } catch (e: any) { setErr(e?.message || 'Could not read that file.'); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  function upd(patch: Partial<Staged>) { setStaged((s) => s ? { ...s, ...patch } : s); }

  async function save() {
    if (!staged) return;
    setSaving(true); setErr('');
    try {
      const body: any = {
        category: staged.category, insurer: staged.insurer || null, plan_name: staged.plan_name || null,
        policy_number: staged.policy_number || null, holder_name: staged.holder_name || null, nominee: staged.nominee || null,
        sum_assured: staged.sum_assured ?? null, premium: staged.premium ?? null, premium_frequency: staged.premium_frequency || null,
        issue_date: staged.issue_date || null, start_date: staged.start_date || null, expiry_date: staged.expiry_date || null,
        maturity_date: staged.maturity_date || null, renewal_date: staged.renewal_date || null, extracted: staged.extracted || {},
      };
      const rec = await post('/insurance/policies', body);
      const { data, mime } = await fileToBase64(staged.file);
      await post(`/insurance/policies/${rec.policy_id}/file`, { file_name: staged.file.name, mime_type: mime, data }).catch(() => {});
      setStaged(null); load(); onChange?.();
    } catch (e: any) { setErr(e?.message || 'Could not save the policy.'); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    setRemoving(id); setErr('');
    try { await del(`/insurance/policies/${id}`); setConfirmId(''); load(); onChange?.(); }
    catch (e: any) { setErr(e?.message || 'Could not remove.'); }
    finally { setRemoving(''); }
  }

  // ₹ input bound to a paise field
  const RupInput = ({ val, on }: { val?: number | null; on: (p: number | null) => void }) => (
    <input className="input" inputMode="numeric" defaultValue={val ? Math.round(val / 100).toString() : ''}
      onChange={(e) => { const n = parseFloat(e.target.value.replace(/[₹,\s]/g, '')); on(isFinite(n) && n > 0 ? Math.round(n * 100) : null); }} />
  );
  const DateInput = ({ val, on }: { val?: string | null; on: (s: string | null) => void }) => (
    <input type="date" className="input" defaultValue={val || ''} onChange={(e) => on(e.target.value || null)} />
  );

  const lifeCover = policies.filter((p) => p.category === 'term_life' || p.category === 'life_endowment').reduce((s, p) => s + (p.sum_assured || 0), 0);
  const healthCover = policies.filter((p) => p.category === 'health').reduce((s, p) => s + (p.sum_assured || 0), 0);
  const dueSoon = policies.filter((p) => { const d = daysTo(p.renewal_date || p.expiry_date); return d != null && d <= 30; }).length;

  return (
    <div className="space-y-4">
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />

      {/* Hero: add a policy by category */}
      <div className="rounded-2xl bg-gradient-to-br from-pine-950 to-pine-900 text-white p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="font-display text-xl font-medium">Add your insurance policies</p>
            <p className="text-sm text-white/70 mt-1 max-w-md">Upload a PDF and AI reads the cover, premium and every date — issue, expiry, maturity and renewal — then tracks renewals so you never miss one.</p>
          </div>
          {policies.length > 0 && (
            <div className="flex gap-4 text-right">
              <div><p className="text-[10px] uppercase tracking-wider text-white/50">Policies</p><p className="font-display text-2xl font-semibold">{policies.length}</p></div>
              {dueSoon > 0 && <div><p className="text-[10px] uppercase tracking-wider text-mint-300">Due soon</p><p className="font-display text-2xl font-semibold text-mint-300">{dueSoon}</p></div>}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-5">
          {CATS.map((c) => {
            const reading = busy && pendingCat.current === c.key;
            return (
              <button key={c.key} onClick={() => pick(c.key)} disabled={busy}
                className="group flex items-center gap-3 rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/10 px-3.5 py-3 text-left transition-colors disabled:opacity-50">
                <span className="grid place-items-center w-9 h-9 rounded-full bg-white/15 text-lg shrink-0">{reading ? '…' : c.icon}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">{c.label}</span>
                  <span className="block text-[10px] text-white/60 group-hover:text-mint-300">{reading ? 'Reading…' : '+ Upload PDF'}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {policies.length > 0 && (lifeCover > 0 || healthCover > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4"><p className="text-[11px] uppercase tracking-wider text-ink-faint font-bold">Life cover held</p><p className="font-display text-xl font-semibold mt-0.5">{inr(lifeCover)}</p></div>
          <div className="card p-4"><p className="text-[11px] uppercase tracking-wider text-ink-faint font-bold">Health cover held</p><p className="font-display text-xl font-semibold mt-0.5">{inr(healthCover)}</p></div>
        </div>
      )}

      {err && <div className="rounded-lg bg-signal-red/10 border border-signal-red/30 text-signal-red text-sm px-4 py-3">{err}</div>}

      {/* Staged confirm */}
      {staged && (
        <div className={`card p-5 border-2 space-y-3 ${staged.invalid ? 'border-signal-red/60 bg-signal-red/5' : 'border-mint-500/60 bg-mint-50'}`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-bold text-sm">{catIcon(staged.category)} Review your {catLabel(staged.category).toLowerCase()} policy</p>
            <span className="flex items-center gap-2 text-[11px] text-ink-faint">
              {staged.engine === 'ai' && <span className="chip bg-pine-900 text-white text-[10px]">✨ Read by AI</span>}
              📎 {staged.file.name}
            </span>
          </div>

          {staged.invalid && (
            <div className="rounded-lg bg-signal-red/10 border border-signal-red/40 px-3 py-2.5">
              <p className="text-sm font-bold text-signal-red">{staged.unreadable ? '⚠ We couldn’t read this file clearly.' : '⚠ This doesn’t look like an insurance policy.'}</p>
              <p className="text-xs text-ink-soft mt-1">{staged.aiReason || 'Please check it’s the right document.'} You can fix the details below and save anyway, or choose another file.</p>
              <button onClick={() => pick(staged.category)} className="mt-2 rounded-full bg-signal-red text-white px-4 py-1.5 text-[11px] font-bold">Choose a different file</button>
            </div>
          )}
          {staged.summary && !staged.invalid && <p className="text-sm text-ink-soft">{staged.summary}</p>}

          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Category</label>
              <select className="input" value={staged.category} onChange={(e) => upd({ category: e.target.value })}>
                {CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select></div>
            <div><label className="label">Insurer</label><input className="input" defaultValue={staged.insurer || ''} onChange={(e) => upd({ insurer: e.target.value })} /></div>
            <div><label className="label">{staged.category === 'health' ? 'Sum insured' : 'Sum assured / cover'} (₹)</label><RupInput val={staged.sum_assured} on={(p) => upd({ sum_assured: p })} /></div>
            <div><label className="label">Premium (₹)</label>
              <div className="flex gap-2">
                <RupInput val={staged.premium} on={(p) => upd({ premium: p })} />
                <select className="input w-32" value={staged.premium_frequency || ''} onChange={(e) => upd({ premium_frequency: e.target.value })}>
                  <option value="">/ —</option><option value="monthly">/ month</option><option value="quarterly">/ quarter</option><option value="yearly">/ year</option><option value="single">single</option>
                </select>
              </div></div>
            <div><label className="label">Start / issue date</label><DateInput val={staged.start_date || staged.issue_date} on={(s) => upd({ start_date: s })} /></div>
            <div><label className="label">Expiry / renewal date</label><DateInput val={staged.renewal_date || staged.expiry_date} on={(s) => upd({ renewal_date: s, expiry_date: s })} /></div>
            <div><label className="label">Maturity date (if any)</label><DateInput val={staged.maturity_date} on={(s) => upd({ maturity_date: s })} /></div>
            <div><label className="label">Nominee</label><input className="input" defaultValue={staged.nominee || ''} onChange={(e) => upd({ nominee: e.target.value })} /></div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">{saving ? 'Saving…' : 'Save policy'}</button>
            <button onClick={() => setStaged(null)} disabled={saving} className="text-sm text-ink-faint underline">Cancel</button>
          </div>
          <p className="text-[11px] text-ink-faint">🔒 The policy file is AES-256 encrypted. We’ll remind you in Alerts before it’s due for renewal — and update your cover when you upload the renewed policy.</p>
        </div>
      )}

      {/* Empty state — encourage the first upload */}
      {policies.length === 0 && !staged && (
        <div className="card p-8 text-center border-dashed">
          <p className="text-3xl">🛡️</p>
          <p className="text-sm font-bold mt-2">No policies added yet</p>
          <p className="text-xs text-ink-soft mt-1 max-w-sm mx-auto">Add even one above and PayWatch will track its renewal, fold it into your cover analysis, and sharpen your Money Score. The more you add, the more accurate your advice.</p>
        </div>
      )}

      {/* Existing policies */}
      {policies.length > 0 && (
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-ink-faint mb-2">Your policies ({policies.length})</p>
          <div className="space-y-2">
            {policies.map((p) => (
              <div key={p.policy_id} className="card p-4">
                <div className="flex items-start gap-3">
                  <span className="grid place-items-center w-10 h-10 rounded-full bg-paper-100 text-lg shrink-0">{catIcon(p.category)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold truncate">{p.insurer || catLabel(p.category)}</p>
                      <StatusBadge p={p} />
                    </div>
                    <p className="text-xs text-ink-soft mt-0.5">
                      {catLabel(p.category)}
                      {p.sum_assured ? ` · cover ${inr(p.sum_assured)}` : ''}
                      {p.premium ? ` · ${inr(p.premium)}${p.premium_frequency ? '/' + p.premium_frequency.slice(0, 2) : ''} premium` : ''}
                    </p>
                    <p className="text-[11px] text-ink-faint mt-0.5">
                      {(p.renewal_date || p.expiry_date) ? `Renews ${fmtD(p.renewal_date || p.expiry_date)}` : 'No renewal date on file'}
                      {p.maturity_date ? ` · matures ${fmtD(p.maturity_date)}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 text-[11px] shrink-0">
                    {p.has_file && <button onClick={() => downloadFile(`/insurance/policies/${p.policy_id}/file`, p.file_name || 'policy')} className="text-pine-700 underline">📎 File</button>}
                    {confirmId === p.policy_id ? (
                      <span className="flex items-center gap-2">
                        <span className="text-ink-soft">Remove?</span>
                        <button onClick={() => remove(p.policy_id)} disabled={removing === p.policy_id} className="rounded-full bg-signal-red text-white px-3 py-0.5 font-bold disabled:opacity-50">{removing === p.policy_id ? '…' : 'Yes'}</button>
                        <button onClick={() => setConfirmId('')} className="text-ink-faint underline">No</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmId(p.policy_id)} className="text-signal-red underline">Remove</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-faint mt-2">Add any other policies above for a complete cover picture — more policies mean a sharper analysis and timely renewal reminders.</p>
        </div>
      )}
    </div>
  );
}
