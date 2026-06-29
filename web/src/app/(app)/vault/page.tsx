'use client';

import { useEffect, useRef, useState } from 'react';
import { get, post, patch, del, downloadFile } from '@/lib/api';
import { fileToBase64 } from '@/components/CaThread';
import { UpgradeBanner } from '@/components/UpgradeBanner';
import { toast, PROFILE_UPDATED } from '@/lib/toast';

export default function VaultPage() {
  const [slots, setSlots] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [busy, setBusy] = useState('');           // slot currently uploading
  const [confirmId, setConfirmId] = useState(''); // doc awaiting delete confirm
  const [removing, setRemoving] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = useRef<{ slot: string; label: string } | null>(null);

  async function load() {
    const [s, d] = await Promise.all([get('/documents/slots'), get('/documents')]);
    setSlots(s); setDocs(d);
  }
  useEffect(() => { load().catch(() => {}); }, []);

  // All uploaded files under a slot (a slot can hold several — e.g. rent receipts).
  const filesForSlot = (slot: string) => docs.filter((d) => d.slot === slot && d.file_name);
  const metaRow = (slot: string) => docs.find((d) => d.slot === slot);

  function pickFile(slot: string, label: string) { pending.current = { slot, label }; fileRef.current?.click(); }
  async function onFile(file: File) {
    const p = pending.current; if (!p) return;
    setBusy(p.slot);
    try {
      // Each upload creates its own entry → multiple files per slot.
      const row = await post('/documents', { slot: p.slot, label: p.label, status: 'have' });
      const { data, mime } = await fileToBase64(file);
      await post(`/documents/${row.id}/file`, { file_name: file.name, mime_type: mime, data });
      await load(); toast(PROFILE_UPDATED);
    } catch (e: any) { toast(e?.message || 'Upload failed'); }
    finally { setBusy(''); if (fileRef.current) fileRef.current.value = ''; }
  }
  async function removeFile(id: string) {
    setRemoving(id);
    try { await del(`/documents/${id}`); setConfirmId(''); await load(); toast('Document removed — profile updated.'); }
    catch (e: any) { toast(e?.message || 'Could not remove'); }
    finally { setRemoving(''); }
  }
  async function saveMeta(slot: string, label: string, expiry: string, note: string) {
    const ex = metaRow(slot);
    const body = { expiry_date: expiry || null, note: note || null };
    if (ex) await patch(`/documents/${ex.id}`, body);
    else await post('/documents', { slot, label, status: 'missing', ...body });
    await load(); toast('Reminder saved.');
  }

  const readyCount = slots.filter((s) => filesForSlot(s.slot).length > 0).length;

  return (
    <div className="space-y-5">
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />

      <div>
        <h1 className="font-display text-3xl font-medium">Document vault</h1>
        <p className="text-sm text-ink-soft mt-1">Store the paperwork a CA would ask for — and get reminded before anything expires. {slots.length > 0 && <span className="font-semibold">{readyCount}/{slots.length} have a file.</span>}</p>
      </div>

      <UpgradeBanner feature="The document vault and renewal reminders" />

      <div className="card p-4 border-l-4 border-l-mint-500">
        <p className="text-xs text-ink-soft leading-relaxed">Add as many files as you like under each heading — each is <strong>AES-256 encrypted</strong> before storage. PayWatch reminds you in Alerts before anything lapses, and you can share a file straight to your CA. Removing a file asks for confirmation.</p>
      </div>

      <div className="space-y-3">
        {slots.map((s) => {
          const files = filesForSlot(s.slot);
          const has = files.length > 0;
          const datey = s.slot === 'insurance_policy' || s.slot === 'loan_certificate' || s.slot === 'vehicle_rc';
          return (
            <article key={s.slot} className="card p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full ${has ? 'bg-signal-green text-white' : 'bg-paper-100 text-ink-faint'}`}>
                    {has ? <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" /></svg> : '–'}
                  </span>
                  <div>
                    <h2 className="text-sm font-bold">{s.label} {files.length > 1 && <span className="text-[11px] text-ink-faint font-normal">· {files.length} files</span>}</h2>
                  </div>
                </div>
                <button onClick={() => pickFile(s.slot, s.label)} disabled={busy === s.slot}
                  className="rounded-full border border-paper-200 text-pine-700 px-3 py-1.5 text-xs font-bold hover:border-pine-600 disabled:opacity-50 shrink-0">
                  {busy === s.slot ? 'Uploading…' : has ? '+ Add another' : '+ Add file'}
                </button>
              </div>

              {has && (
                <ul className="mt-3 ml-9 space-y-1.5">
                  {files.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 text-xs">
                      <button onClick={() => downloadFile(`/documents/${d.id}/file`, d.file_name).catch(() => toast('Download failed'))} className="text-pine-700 hover:underline font-semibold truncate">📎 {d.file_name}</button>
                      {confirmId === d.id ? (
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-ink-soft">Remove?</span>
                          <button onClick={() => removeFile(d.id)} disabled={removing === d.id} className="rounded-full bg-signal-red text-white px-3 py-0.5 font-bold disabled:opacity-50">{removing === d.id ? '…' : 'Yes, remove'}</button>
                          <button onClick={() => setConfirmId('')} className="text-ink-faint underline">Cancel</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmId(d.id)} className="text-signal-red underline shrink-0">Remove</button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {datey && <MetaEditor slot={s.slot} label={s.label} doc={metaRow(s.slot)} onSave={saveMeta} />}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function MetaEditor({ slot, label, doc, onSave }: any) {
  const [expiry, setExpiry] = useState(doc?.expiry_date || '');
  const [note, setNote] = useState(doc?.note || '');
  return (
    <div className="mt-3 ml-9 grid sm:grid-cols-[180px_1fr_auto] gap-2 items-end">
      <div>
        <label className="label">Renewal / expiry date</label>
        <input type="date" className="input" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
      </div>
      <div>
        <label className="label">Note (insurer, policy no…)</label>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional" />
      </div>
      <button onClick={() => onSave(slot, label, expiry, note)} className="btn-secondary !py-2.5 text-xs">Save reminder</button>
    </div>
  );
}
