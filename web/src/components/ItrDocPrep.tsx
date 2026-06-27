'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { get, post } from '@/lib/api';
import { fileToBase64 } from '@/components/CaThread';

// Keys match the shared CA checklist + the vault slots used here.
const DOCS = [
  { key: 'pan', icon: '🪪', name: 'PAN card', who: 'You', how: 'Your 10-character PAN — make sure it’s linked with Aadhaar.' },
  { key: 'aadhaar', icon: '🆔', name: 'Aadhaar', who: 'You', how: 'Used for e-verification (OTP) when you file.' },
  { key: 'form16', icon: '📄', name: 'Form 16', who: 'Employer', how: 'Your employer gives it after the year ends (by mid-June) — grab it from your payroll/HR portal.' },
  { key: 'form26as_ais', icon: '🧾', name: 'Form 26AS & AIS', who: 'You', how: 'On incometax.gov.in — 26AS under e-File → View 26AS; AIS under Services → AIS.' },
  { key: 'bank_interest', icon: '🏦', name: 'Bank interest certificate', who: 'Bank', how: 'From net-banking → interest/TDS certificate (savings + FD interest).' },
  { key: 'capital_gains', icon: '📈', name: 'Capital-gains statement', who: 'Broker / Fund', how: 'Download the realised P&L for the year from Zerodha/Groww or your AMC.' },
  { key: 'deduction_proofs', icon: '🧮', name: '80C / 80D / NPS proofs', who: 'You', how: 'ELSS/PPF/LIC receipts, NPS statement, health-insurance premium receipts.' },
  { key: 'home_loan', icon: '🏠', name: 'Home-loan interest certificate', who: 'Lender', how: 'From your bank — shows the principal (80C) and interest (24b) split.' },
  { key: 'rent_hra', icon: '🧾', name: 'Rent receipts + landlord PAN', who: 'You', how: 'For HRA. Landlord PAN needed if annual rent is over ₹1 lakh.' },
  { key: 'bank_for_refund', icon: '💳', name: 'Bank account for refund', who: 'You', how: 'Account number + IFSC, pre-validated on the portal so refunds land safely.' },
];

export function ItrDocPrep() {
  const router = useRouter();
  const [vault, setVault] = useState<any[]>([]);
  const [cas, setCas] = useState<any[]>([]);
  const [openMenu, setOpenMenu] = useState('');
  const [sendMenu, setSendMenu] = useState('');
  const [busy, setBusy] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = useRef<{ key: string; name: string } | null>(null);

  function load() {
    get('/documents').then(setVault).catch(() => {});
    get('/user/ca').then((d: any) => setCas((d.links || []).filter((l: any) => l.status === 'active'))).catch(() => {});
  }
  useEffect(() => { load(); }, []);

  const vaultFor = (key: string) => vault.find((v) => v.slot === key && v.file_name);
  const vaultFiles = vault.filter((v) => v.file_name);

  function pickUpload(key: string, name: string) { pending.current = { key, name }; fileRef.current?.click(); }
  async function onFile(file: File) {
    const p = pending.current; if (!p) return;
    setBusy(p.key); setOpenMenu('');
    try {
      let ex = vault.find((v) => v.slot === p.key);
      if (!ex) ex = await post('/documents', { slot: p.key, label: p.name, status: 'have' });
      const { data, mime } = await fileToBase64(file);
      await post(`/documents/${ex.id}/file`, { file_name: file.name, mime_type: mime, data });
      load();
    } catch { /* ignore */ } finally { setBusy(''); if (fileRef.current) fileRef.current.value = ''; }
  }
  async function fetchFromVault(key: string, name: string, sourceId: string) {
    setBusy(key); setOpenMenu('');
    try { await post(`/documents/${sourceId}/copy`, { to_slot: key, to_label: name }); load(); }
    catch { /* ignore */ } finally { setBusy(''); }
  }
  async function sendToCa(key: string, name: string, linkId: string) {
    const vf = vaultFor(key); if (!vf) return;
    setBusy(key); setSendMenu('');
    try {
      await post(`/user/ca/links/${linkId}/documents/from-vault`, { vault_id: vf.id, checklist_key: key });
      router.push(`/advisor/thread?id=${linkId}&draft=${encodeURIComponent(`Hi, I’ve sent my ${name} for the ITR. 📎`)}`);
    } catch { setBusy(''); }
  }

  const total = DOCS.length;
  const done = DOCS.filter((d) => vaultFor(d.key)).length;
  const pct = Math.round((done / total) * 100);
  const cheer = done === 0 ? 'Quicker than it looks — let’s gather your docs one tap at a time.'
    : done >= total ? '🎉 All set! Everything’s ready to send to your CA.'
    : done >= total / 2 ? 'Almost there — you’re crushing it 🔥'
    : 'Nice start! Keep going 💪';

  return (
    <div>
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />

      {/* Progress */}
      <div className="rounded-2xl bg-pine-950 text-white p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold">{done} of {total} ready</span>
          <span className="text-xs font-bold text-mint-300">{pct}%</span>
        </div>
        <div className="h-2.5 bg-white/15 rounded-full overflow-hidden"><div className="h-full bg-mint-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} /></div>
        <p className="text-xs text-white/70 mt-2">{cheer}</p>
      </div>

      {/* Doc cards */}
      <div className="space-y-2">
        {DOCS.map((d) => {
          const vf = vaultFor(d.key);
          return (
            <div key={d.key} className={`rounded-xl border p-3 transition-colors ${vf ? 'border-mint-500/60 bg-mint-50' : 'border-paper-200 bg-white hover:border-pine-600/40'}`}>
              <div className="flex items-center gap-3">
                <span className={`grid place-items-center w-10 h-10 rounded-full text-lg shrink-0 ${vf ? 'bg-mint-500 text-pine-950' : 'bg-paper-100'}`}>{vf ? '✓' : d.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold flex items-center gap-2">{d.name}{vf ? <span className="chip bg-mint-100 text-pine-800 text-[10px]">Ready</span> : <span className="text-[10px] text-ink-faint font-normal">from {d.who}</span>}</p>
                  <p className="text-[11px] text-ink-faint leading-snug mt-0.5 truncate">{vf ? <span className="text-pine-700">📎 {vf.file_name}</span> : d.how}</p>
                </div>

                {/* Actions */}
                <div className="relative shrink-0 flex items-center gap-1.5">
                  {vf && (
                    <button onClick={() => { setSendMenu(sendMenu === d.key ? '' : d.key); setOpenMenu(''); }} disabled={busy === d.key} title="Send to your CA"
                      className="rounded-full bg-mint-500 text-pine-950 w-8 h-8 grid place-items-center hover:bg-mint-400 disabled:opacity-50">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7Z" /></svg>
                    </button>
                  )}
                  <button onClick={() => { setOpenMenu(openMenu === d.key ? '' : d.key); setSendMenu(''); }} disabled={busy === d.key}
                    className="rounded-full bg-pine-900 text-white w-8 h-8 text-xl leading-none font-bold grid place-items-center hover:bg-pine-800 disabled:opacity-50">{busy === d.key ? '…' : '+'}</button>

                  {openMenu === d.key && (
                    <div className="absolute right-0 top-9 z-10 w-60 card p-2 shadow-lift text-sm max-h-72 overflow-y-auto">
                      <button onClick={() => pickUpload(d.key, d.name)} className="block w-full text-left px-3 py-2 rounded-lg hover:bg-paper-50">📤 {vf ? 'Replace file' : 'Upload a file'}</button>
                      <div className="border-t border-paper-100 mt-1 pt-1">
                        <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-ink-faint">Fetch from your vault</p>
                        {vaultFiles.length === 0 ? (
                          <p className="px-3 py-1.5 text-xs text-ink-faint">No files in your vault yet.</p>
                        ) : vaultFiles.map((v) => (
                          <button key={v.id} onClick={() => fetchFromVault(d.key, d.name, v.id)} className="block w-full text-left px-3 py-2 rounded-lg hover:bg-paper-50 truncate">📁 {v.label || v.file_name}</button>
                        ))}
                      </div>
                    </div>
                  )}

                  {sendMenu === d.key && vf && (
                    <div className="absolute right-0 top-9 z-10 w-56 card p-2 shadow-lift text-sm">
                      <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-ink-faint">Send to your CA</p>
                      {cas.length === 0 ? (
                        <Link href="/advisor" className="block px-3 py-2 rounded-lg hover:bg-paper-50 text-pine-700">Connect a CA first →</Link>
                      ) : cas.map((c) => (
                        <button key={c.link_id} onClick={() => sendToCa(d.key, d.name, c.link_id)} className="block w-full text-left px-3 py-2 rounded-lg hover:bg-paper-50">📨 Send to {c.ca_name}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-ink-faint mt-3">🔒 Every file is AES-256 encrypted. Sending one ticks it off automatically in your shared checklist and drops a ready note in the chat.</p>
    </div>
  );
}
