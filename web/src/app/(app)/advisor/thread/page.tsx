'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { get, post, patch, del, downloadFile, subscribeEvents } from '@/lib/api';
import { CaThread, fileToBase64, type Msg, type Doc } from '@/components/CaThread';
import { ChecklistPanel } from '@/components/ChecklistPanel';

// NOTE: this route reads the link id from the `?id=` query param rather than a
// path segment. That keeps it a single static page so the Capacitor mobile
// build (`output: 'export'`) works without generateStaticParams. Web + mobile
// share this exact file.
export default function AdvisorThread() {
  const [id, setId] = useState('');
  const [caName, setCaName] = useState('Your CA');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [chk, setChk] = useState<any>(null);
  const [vaultDocs, setVaultDocs] = useState<any[]>([]);
  const [showVault, setShowVault] = useState(false);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState('');
  const [requests, setRequests] = useState<any[]>([]);
  const [busyReq, setBusyReq] = useState('');
  const [reqResult, setReqResult] = useState<Record<string, any>>({});
  const [packBusy, setPackBusy] = useState(false);
  const [packMsg, setPackMsg] = useState('');
  // Read id (+ optional draft) from the query string on mount.
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const linkId = sp.get('id') || '';
      setId(linkId);
      const d = sp.get('draft');
      if (d) { setDraft(d); window.history.replaceState({}, '', `/advisor/thread?id=${linkId}`); }
    } catch {}
  }, []);

  function loadMsgs() { get(`/user/ca/links/${id}/messages`).then(setMessages).catch((e) => setErr(e.message)); }
  function loadDocs() { get(`/user/ca/links/${id}/documents`).then(setDocs).catch(() => {}); }
  function loadChk() { get(`/user/ca/links/${id}/checklist`).then(setChk).catch(() => {}); }
  function loadReqs() { get(`/user/ca/links/${id}/requests`).then(setRequests).catch(() => {}); }
  // One tap: PayWatch finds every requested document it already holds and sends it to the CA (D-71).
  async function fulfil(rid: string) {
    setBusyReq(rid); setErr('');
    try { const r = await post(`/user/ca/links/${id}/requests/${rid}/fulfil`, {}); setReqResult((m) => ({ ...m, [rid]: r })); loadMsgs(); loadDocs(); loadChk(); loadReqs(); }
    catch (e: any) { setErr(e.message); } finally { setBusyReq(''); }
  }
  async function sendPack() {
    setPackBusy(true); setPackMsg(''); setErr('');
    try { const r = await post(`/user/ca/links/${id}/itr-pack`, {}); setPackMsg(`📦 Sent your ITR pack (FY ${r.fy}) — ${r.included.length} sections.${r.missing.length ? ` Not in PayWatch yet: ${r.missing.join(', ')}.` : ''}`); loadMsgs(); loadDocs(); loadChk(); }
    catch (e: any) { setErr(e.message); } finally { setPackBusy(false); }
  }
  async function toggleChk(key: string, _field: 'sent' | 'received', value: boolean) { await patch(`/user/ca/links/${id}/checklist`, { key, sent: value }); loadChk(); }
  useEffect(() => {
    if (!id) return;
    get('/user/ca').then((d) => { const l = (d.links || []).find((x: any) => x.link_id === id); if (l) setCaName(l.ca_name); }).catch(() => {});
    get('/documents').then((rows: any[]) => setVaultDocs(rows.filter((r) => r.file_name))).catch(() => {});
    loadMsgs(); loadDocs(); loadChk(); loadReqs();
    const refresh = () => { loadMsgs(); loadDocs(); loadChk(); loadReqs(); };
    const unsub = subscribeEvents(refresh);                         // instant via SSE
    const t = setInterval(() => { if (!document.hidden) refresh(); }, 8000); // fallback
    return () => { clearInterval(t); unsub(); };
  }, [id]);

  async function send(text: string) { await post(`/user/ca/links/${id}/messages`, { body: text }); loadMsgs(); }
  async function upload(file: File) { const { data, mime } = await fileToBase64(file); await post(`/user/ca/links/${id}/documents`, { file_name: file.name, mime_type: mime, data }); loadDocs(); }
  async function download(docId: string) { const d = docs.find((x) => x.document_id === docId); await downloadFile(`/user/ca/links/${id}/documents/${docId}/file`, d?.file_name || 'document'); }
  async function removeDoc(docId: string) { await del(`/user/ca/links/${id}/documents/${docId}`); loadDocs(); }
  async function sendFromVault(vaultId: string) { try { await post(`/user/ca/links/${id}/documents/from-vault`, { vault_id: vaultId }); setShowVault(false); loadDocs(); } catch (e: any) { setErr(e.message); } }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/advisor" className="text-sm text-pine-700 underline">← Your CA</Link>
        <h1 className="font-display text-3xl font-medium mt-2">{caName}</h1>
        <p className="text-sm text-ink-soft mt-1">Message your CA and share documents securely.</p>
      </div>
      {err && <p className="text-sm text-signal-red">{err}</p>}

      {/* CA document requests — PayWatch sends them for you (D-71) */}
      {requests.filter((r) => r.status !== 'fulfilled').map((r) => (
        <div key={r.request_id} className="card p-5 border-l-4 border-l-signal-amber">
          <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">{caName} asked for</p>
          <ul className="mt-2 flex flex-wrap gap-2">{r.items.map((it: any) => <li key={it.key} className="chip bg-paper-100 text-ink">{it.label}</li>)}</ul>
          {r.note && <p className="text-sm text-ink-soft mt-2">“{r.note}”</p>}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={() => fulfil(r.request_id)} disabled={busyReq === r.request_id} className="rounded-full bg-pine-900 text-white px-5 py-2 text-sm font-bold hover:bg-pine-800 disabled:opacity-50">{busyReq === r.request_id ? 'Finding your documents…' : '✨ Let PayWatch send them'}</button>
            <span className="text-xs text-ink-faint">PayWatch picks them from your records, vault and policies. Or just tell Ask PayWatch: “send my CA what he asked for”.</span>
          </div>
          {reqResult[r.request_id] && <p className="text-sm mt-3 whitespace-pre-wrap">{reqResult[r.request_id].message}</p>}
          {r.status === 'partial' && r.result?.missing?.length > 0 && <p className="text-xs text-ink-soft mt-2">Still missing: {r.result.missing.join(', ')} — upload them on <Link href="/records" className="text-pine-700 underline">Monthly records</Link>, then tap again.</p>}
        </div>
      ))}

      {/* One click: the whole ITR pack as a single zip */}
      <div className="card p-5 flex flex-wrap items-center justify-between gap-3 bg-mint-50 border-pine-600/30">
        <div className="min-w-0">
          <p className="text-sm font-bold">📦 Send everything for filing in one go</p>
          <p className="text-xs text-ink-soft mt-0.5">Your tax computation + Form 16, 26AS, payslips, proofs and policies — one zip, sorted into folders for your CA.</p>
          {packMsg && <p className="text-xs text-pine-800 mt-1.5">{packMsg}</p>}
        </div>
        <button onClick={sendPack} disabled={packBusy} className="rounded-full bg-mint-500 text-pine-950 px-5 py-2 text-sm font-bold hover:bg-mint-400 disabled:opacity-50 shrink-0">{packBusy ? 'Packing…' : 'Send my ITR pack'}</button>
      </div>

      <CaThread role="user" messages={messages} onSend={send} docs={docs} onUpload={upload} onDownload={download} onDelete={removeDoc} initialDraft={draft} />

      {/* Send a file straight from the vault */}
      <div className="card p-5">
        <button onClick={() => setShowVault((v) => !v)} className="text-sm font-semibold text-pine-700 hover:underline">📎 Send a file from your vault {showVault ? '▴' : '▾'}</button>
        {showVault && (
          vaultDocs.length === 0
            ? <p className="text-xs text-ink-faint mt-3">No files in your vault yet. Upload them under <Link href="/vault" className="text-pine-700 underline">Document vault</Link>.</p>
            : <ul className="mt-3 divide-y divide-paper-100">
                {vaultDocs.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-sm truncate">{v.label} <span className="text-[11px] text-ink-faint">· {v.file_name}</span></span>
                    <button onClick={() => sendFromVault(v.id)} className="rounded-full bg-mint-500 text-pine-950 px-3 py-1 text-xs font-bold shrink-0">Send to CA</button>
                  </li>
                ))}
              </ul>
        )}
      </div>

      {chk?.documents && <ChecklistPanel role="user" documents={chk.documents} state={chk.state || {}} onToggle={toggleChk} />}
    </div>
  );
}
