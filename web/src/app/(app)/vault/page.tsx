'use client';

import { useEffect, useState } from 'react';
import { get, post, patch, del } from '@/lib/api';

export default function VaultPage() {
  const [slots, setSlots] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [toast, setToast] = useState('');

  async function load() {
    const [s, d] = await Promise.all([get('/documents/slots'), get('/documents')]);
    setSlots(s); setDocs(d);
  }
  useEffect(() => { load().catch(() => {}); }, []);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(''), 2500); }
  const docFor = (slot: string) => docs.find((d) => d.slot === slot);

  async function setStatus(slot: string, label: string, status: 'have' | 'missing') {
    const ex = docFor(slot);
    if (ex) { const r = await patch(`/documents/${ex.id}`, { status }); setDocs((p) => p.map((d) => (d.id === ex.id ? r : d))); }
    else { const r = await post('/documents', { slot, label, status }); setDocs((p) => [...p, r]); }
  }
  async function saveMeta(slot: string, label: string, expiry: string, note: string) {
    const ex = docFor(slot);
    const body = { expiry_date: expiry || null, note: note || null };
    if (ex) { const r = await patch(`/documents/${ex.id}`, body); setDocs((p) => p.map((d) => (d.id === ex.id ? r : d))); }
    else { const r = await post('/documents', { slot, label, status: 'have', ...body }); setDocs((p) => [...p, r]); }
    flash('Saved.');
  }

  const haveCount = slots.filter((s) => docFor(s.slot)?.status === 'have').length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl font-medium">Document vault</h1>
        <p className="text-sm text-ink-soft mt-1">Track the paperwork a CA would ask for — and get reminded before anything expires. {slots.length > 0 && <span className="font-semibold">{haveCount}/{slots.length} ready.</span>}</p>
      </div>

      <div className="card p-4 border-l-4 border-l-mint-500">
        <p className="text-xs text-ink-soft leading-relaxed">This is an organiser, not a locker — mark what you have and add renewal dates. PayWatch will remind you in Alerts before a policy lapses or a deadline hits. (We don&apos;t store the files themselves.)</p>
      </div>

      <div className="space-y-3">
        {slots.map((s) => {
          const d = docFor(s.slot);
          const have = d?.status === 'have';
          const datey = s.slot === 'insurance_policy' || s.slot === 'loan_certificate';
          return (
            <article key={s.slot} className="card p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full ${have ? 'bg-signal-green text-white' : 'bg-paper-100 text-ink-faint'}`}>
                    {have ? <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" /></svg> : '–'}
                  </span>
                  <div>
                    <h2 className="text-sm font-bold">{s.label}</h2>
                    {d?.expiry_date && <p className="text-[11px] text-signal-amber mt-0.5">renews {new Date(d.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setStatus(s.slot, s.label, 'have')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${have ? 'bg-pine-900 text-white' : 'bg-white border border-paper-200 text-ink-soft'}`}>Have it</button>
                  <button onClick={() => setStatus(s.slot, s.label, 'missing')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${d && !have ? 'bg-signal-amber text-white' : 'bg-white border border-paper-200 text-ink-soft'}`}>Need it</button>
                </div>
              </div>
              {datey && (
                <MetaEditor slot={s.slot} label={s.label} doc={d} onSave={saveMeta} />
              )}
            </article>
          );
        })}
      </div>

      {toast && <div className="fixed bottom-6 right-6 rounded-xl bg-pine-900 text-white text-sm font-semibold px-4 py-3 shadow-lift">{toast}</div>}
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
      <button onClick={() => onSave(slot, label, expiry, note)} className="btn-secondary !py-2.5 text-xs">Save</button>
    </div>
  );
}
