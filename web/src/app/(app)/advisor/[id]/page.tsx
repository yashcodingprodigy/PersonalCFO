'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { get, post } from '@/lib/api';
import { CaThread, fileToBase64, type Msg, type Doc } from '@/components/CaThread';

export default function AdvisorThread() {
  const { id } = useParams<{ id: string }>();
  const [caName, setCaName] = useState('Your CA');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [err, setErr] = useState('');

  function loadMsgs() { get(`/user/ca/links/${id}/messages`).then(setMessages).catch((e) => setErr(e.message)); }
  function loadDocs() { get(`/user/ca/links/${id}/documents`).then(setDocs).catch(() => {}); }
  useEffect(() => {
    get('/user/ca').then((d) => { const l = (d.links || []).find((x: any) => x.link_id === id); if (l) setCaName(l.ca_name); }).catch(() => {});
    loadMsgs(); loadDocs();
  }, [id]);

  async function send(text: string) { await post(`/user/ca/links/${id}/messages`, { body: text }); loadMsgs(); }
  async function upload(file: File) { const { data, mime } = await fileToBase64(file); await post(`/user/ca/links/${id}/documents`, { file_name: file.name, mime_type: mime, data }); loadDocs(); }
  async function download(docId: string) { const r = await get(`/user/ca/links/${id}/documents/${docId}/url`); if (r?.url) window.open(r.url, '_blank'); }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/advisor" className="text-sm text-pine-700 underline">← Your CA</Link>
        <h1 className="font-display text-3xl font-medium mt-2">{caName}</h1>
        <p className="text-sm text-ink-soft mt-1">Message your CA and share documents securely.</p>
      </div>
      {err && <p className="text-sm text-signal-red">{err}</p>}
      <CaThread role="user" messages={messages} onSend={send} docs={docs} onUpload={upload} onDownload={download} />
    </div>
  );
}
