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
  const [err, setErr] = useState('');

  function loadMsgs() { get(`/user/ca/links/${id}/messages`).then(setMessages).catch((e) => setErr(e.message)); }
  function loadDocs() { get(`/user/ca/links/${id}/documents`).then(setDocs).catch(() => {}); }
  function loadChk() { get(`/user/ca/links/${id}/checklist`).then(setChk).catch(() => {}); }
  async function toggleChk(key: string, _field: 'sent' | 'received', value: boolean) { await patch(`/user/ca/links/${id}/checklist`, { key, sent: value }); loadChk(); }
  useEffect(() => {
    get('/user/ca').then((d) => { const l = (d.links || []).find((x: any) => x.link_id === id); if (l) setCaName(l.ca_name); }).catch(() => {});
    loadMsgs(); loadDocs(); loadChk();
    const refresh = () => { loadMsgs(); loadDocs(); loadChk(); };
    const unsub = subscribeEvents(refresh);                         // instant via SSE
    const t = setInterval(() => { if (!document.hidden) refresh(); }, 8000); // fallback
    return () => { clearInterval(t); unsub(); };
  }, [id]);

  async function send(text: string) { await post(`/user/ca/links/${id}/messages`, { body: text }); loadMsgs(); }
  async function upload(file: File) { const { data, mime } = await fileToBase64(file); await post(`/user/ca/links/${id}/documents`, { file_name: file.name, mime_type: mime, data }); loadDocs(); }
  async function download(docId: string) { const d = docs.find((x) => x.document_id === docId); await downloadFile(`/user/ca/links/${id}/documents/${docId}/file`, d?.file_name || 'document'); }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/advisor" className="text-sm text-pine-700 underline">← Your CA</Link>
        <h1 className="font-display text-3xl font-medium mt-2">{caName}</h1>
        <p className="text-sm text-ink-soft mt-1">Message your CA and share documents securely.</p>
      </div>
      {err && <p className="text-sm text-signal-red">{err}</p>}
      {chk?.documents && <ChecklistPanel role="user" documents={chk.documents} state={chk.state || {}} onToggle={toggleChk} />}
      <CaThread role="user" messages={messages} onSend={send} docs={docs} onUpload={upload} onDownload={download} />
    </div>
  );
}
