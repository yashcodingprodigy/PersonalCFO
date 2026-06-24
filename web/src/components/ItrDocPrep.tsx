'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { get, post } from '@/lib/api';
import { fileToBase64 } from '@/components/CaThread';

// Keys match the shared CA checklist + the vault slots used here.
const DOCS = [
  { key: 'pan', name: 'PAN & Aadhaar', who: 'You', how: 'Keep your PAN handy and ensure it is linked with Aadhaar (used for e-verification).' },
  { key: 'form16', name: 'Form 16', who: 'Employer', how: 'Your employer issues it after the year ends (by mid-June). Download from your payroll/HR portal.' },
  { key: 'form26as_ais', name: 'Form 26AS & AIS', who: 'You', how: 'On incometax.gov.in — 26AS under e-File → View 26AS; AIS under Services → AIS.' },
  { key: 'bank_interest', name: 'Bank interest certificate', who: 'Bank', how: 'From net-banking → interest/TDS certificate, for savings and FD interest.' },
  { key: 'capital_gains', name: 'Capital-gains statement', who: 'Broker / Fund', how: 'Download the realised P&L for the FY from your broker (Zerodha, Groww) or AMC (CAMS/KFintech).' },
  { key: 'deduction_proofs', name: '80C / 80D / NPS proofs', who: 'You', how: 'ELSS/PPF/LIC receipts, NPS statement, and health-insurance premium receipts.' },
  { key: 'home_loan', name: 'Home-loan interest certificate', who: 'Lender', how: 'From your bank — shows the principal (80C) and interest (24b) split.' },
  { key: 'rent_hra', name: 'Rent receipts + landlord PAN', who: 'You', how: 'For HRA. Landlord PAN required if annual rent exceeds ₹1 lakh.' },
  { key: 'bank_for_refund', name: 'Bank account for refund', who: 'You', how: 'Account number + IFSC, pre-validated on the portal so refunds can be credited.' },
];

export function ItrDocPrep() {
  const router = useRouter();
  const [vault, setVault] = useState<any[]>([]);
  const [cas, setCas] = useState<any[]>([]);
  const [openMenu, setOpenMenu] = useState('');   // doc key whose "+" menu is open
  const [sendMenu, setSendMenu] = useState('');   // doc key whose send picker is open
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
      // Take them to the chat with a ready-to-send message.
      router.push(`/advisor/${linkId}?draft=${encodeURIComponent(`I have sent ${name}.`)}`);
    } catch { setBusy(''); }
  }

  return (
    <div>
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <ul className="space-y-1">
        {DOCS.map((d) => {
          const vf = vaultFor(d.key);
          return (
            <li key={d.key} className="border-b border-paper-100 py-3 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    {vf && <span className="text-signal-green">✓</span>}{d.name}
                    <span className="text-[10px] text-ink-faint font-normal">· from {d.who}</span>
                  </p>
                  <p className="text-xs text-ink-soft leading-relaxed mt-0.5">{d.how}</p>
                  {vf && <p className="text-[11px] text-pine-700 mt-1">📎 {vf.file_name}</p>}
                </div>
                <div className="relative shrink-0 flex items-center gap-1.5">
                  {/* Quick send — appears once a file is attached */}
                  {vf && (
                    <button onClick={() => { setSendMenu(sendMenu === d.key ? '' : d.key); setOpenMenu(''); }} disabled={busy === d.key} title="Send to your CA"
                      className="rounded-full bg-mint-500 text-pine-950 w-7 h-7 grid place-items-center disabled:opacity-50">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7Z" /></svg>
                    </button>
                  )}
                  <button onClick={() => { setOpenMenu(openMenu === d.key ? '' : d.key); setSendMenu(''); }} disabled={busy === d.key}
                    className="rounded-full bg-pine-900 text-white w-7 h-7 text-lg leading-none font-bold disabled:opacity-50">{busy === d.key ? '…' : '+'}</button>

                  {/* "+" menu: upload / fetch from vault */}
                  {openMenu === d.key && (
                    <div className="absolute right-0 top-8 z-10 w-60 card p-2 shadow-lift text-sm max-h-72 overflow-y-auto">
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

                  {/* Send picker */}
                  {sendMenu === d.key && vf && (
                    <div className="absolute right-0 top-8 z-10 w-56 card p-2 shadow-lift text-sm">
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
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-ink-faint mt-3">Files are AES-256 encrypted. Sending one to your CA ticks it off automatically in your shared checklist and drops a ready-to-send note in the chat.</p>
    </div>
  );
}
