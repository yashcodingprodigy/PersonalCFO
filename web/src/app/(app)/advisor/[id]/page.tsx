'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { get, post, patch, downloadFile, subscribeEvents } from '@/lib/api';
import { CaThread, fileToBase64, type Msg, type Doc } from '@/components/CaThread';
import { ChecklistPanel } from '@/components/ChecklistPanel';

export default function AdvisorThread() {
  const { id } = useParams<{ id: string }>();
  const [caName, setCaName] = useState('Your CA');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [chk, setChk] = useState<any>(null);
  const [vaultDocs, setVaultDocs] = useState<any[]>([]);
  const [showVault, setShowVault] = useState(false);
  const [err, setErr] = useState('');
  const [draft] = useState(() => { try { return new URLSearchParams(window.location.search).get('draft') || ''; } catch { return ''; } });

  function loadMsgs() { get(`/user/ca/links/${id}/messages`).then(setMessages).catch((e) => setErr(e.message)); }
  function loadDocs() { get(`/user/ca/links/${id}/documents`).then(setDocs).catch(() => {}); }
  function loadChk() { get(`/user/ca/links/${id}/checklist`).then(setChk).catch(() => {}); }
  async function toggleChk(key: string, _field: 'sent' | 'received', value: boolean) { await patch(`/user/ca/links/${id}/checklist`, { key, sent: value }); loadChk(); }
  useEffect(() => {
    get('/user/ca').then((d) => { const l = (d.links || []).find((x: any) => x.link_id === id); if (l) setCaName(l.ca_name); }).catch(() => {});
    get('/documents').then((rows: any[]) => setVaultDocs(rows.filter((r) => r.file_name))).catch(() => {});
    loadMsgs(); loadDocs(); loadChk();
    const refresh = () => { loadMsgs(); loadDocs(); loadChk(); };
    const unsub = subscribeEvents(refresh);                         // instant via SSE
    const t = setInterval(() => { if (!document.hidden) refresh(); }, 8000); // fallback
    return () => { clearInterval(t); unsub(); };
  }, [id]);

  async function send(text: string) { await post(`/user/ca/links/${id}/messages`, { body: text }); loadMsgs(); }
  async function upload(file: File) { const { data, mime } = await fileToBase64(file); await post(`/user/ca/links/${id}/documents`, { file_name: file.name, mime_type: mime, data }); loadDocs(); }
  async function download(docId: string) { const d = docs.find((x) => x.document_id === docId); await downloadFile(`/user/ca/links/${id}/documents/${docId}/file`, d?.file_name || 'document'); }
  async function sendFromVault(vaultId: string) { try { await post(`/user/ca/links/${id}/documents/from-vault`, { vault_id: vaultId }); setShowVault(false); loadDocs(); } catch (e: any) { setErr(e.message); } }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/advisor" className="text-sm text-pine-700 underline">← Your CA</Link>
        <h1 className="font-display text-3xl font-medium mt-2">{caName}</h1>
        <p className="text-sm text-ink-soft mt-1">Message your CA and share documents securely.</p>
      </div>
      {err && <p className="text-sm text-signal-red">{err}</p>}

      <CaThread role="user" messages={messages} onSend={send} docs={docs} onUpload={upload} onDownload={download} initialDraft={draft} />

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
