'use client';

import { useRef, useState } from 'react';

export interface Msg { message_id: string; sender: 'ca' | 'user'; body: string; created_at: string }
export interface Doc { document_id: string; uploaded_by: 'ca' | 'user'; file_name: string; size_bytes?: number; created_at: string }

function fmtSize(b?: number) { if (!b) return ''; if (b > 1e6) return `${(b / 1e6).toFixed(1)} MB`; return `${Math.round(b / 1024)} KB`; }

// Shared messaging + document panel used by both the CA and the user sides.
export function CaThread({ role, messages, onSend, docs, onUpload, onDownload }: {
  role: 'ca' | 'user';
  messages: Msg[];
  onSend: (text: string) => Promise<void>;
  docs: Doc[];
  onUpload: (file: File) => Promise<void>;
  onDownload: (docId: string) => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [upBusy, setUpBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault(); const t = text.trim(); if (!t || busy) return;
    setBusy(true); setErr('');
    try { await onSend(t); setText(''); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }
  async function upload(file: File) {
    setUpBusy(true); setErr('');
    try { await onUpload(file); } catch (e: any) { setErr(e.message); } finally { setUpBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Messages */}
      <div className="card p-0 flex flex-col h-[26rem]">
        <p className="text-sm font-bold uppercase tracking-widest text-ink-faint px-5 pt-4 pb-2">Messages</p>
        <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-3">
          {messages.length === 0 && <p className="text-sm text-ink-faint text-center mt-8">No messages yet. Say hello 👋</p>}
          {messages.map((m) => (
            <div key={m.message_id} className={`flex ${m.sender === role ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${m.sender === role ? 'bg-pine-900 text-white rounded-br-md' : 'bg-paper-50 border border-paper-200 rounded-bl-md'}`}>{m.body}</div>
            </div>
          ))}
        </div>
        <form onSubmit={send} className="border-t border-paper-100 p-3 flex gap-2">
          <input className="input flex-1" placeholder="Write a message…" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
          <button className="btn-primary !px-4" disabled={busy || !text.trim()}>Send</button>
        </form>
      </div>

      {/* Documents */}
      <div className="card p-5 flex flex-col h-[26rem]">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold uppercase tracking-widest text-ink-faint">Shared documents</p>
          <button onClick={() => fileRef.current?.click()} disabled={upBusy} className="rounded-full bg-mint-500 text-pine-950 px-4 py-1.5 text-xs font-bold hover:bg-mint-400 disabled:opacity-50">{upBusy ? 'Uploading…' : '+ Upload'}</button>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        </div>
        {err && <p className="text-xs text-signal-red mb-2">{err}</p>}
        <div className="flex-1 overflow-y-auto">
          {docs.length === 0 ? <p className="text-sm text-ink-faint text-center mt-8">No documents shared yet.</p> : (
            <ul className="divide-y divide-paper-100">
              {docs.map((d) => (
                <li key={d.document_id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <button onClick={() => onDownload(d.document_id)} className="text-sm text-pine-700 hover:underline truncate block text-left">{d.file_name}</button>
                    <p className="text-[11px] text-ink-faint">{d.uploaded_by === role ? 'You' : d.uploaded_by === 'ca' ? 'Your CA' : 'Client'} · {fmtSize(d.size_bytes)} · {new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <button onClick={() => onDownload(d.document_id)} className="text-xs text-ink-soft underline shrink-0">Open</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="text-[10px] text-ink-faint mt-2">Messages &amp; files are encrypted (AES-256) and private to this connection. Max 8 MB each.</p>
      </div>
    </div>
  );
}

// Reads a File into base64 (without the data: prefix) for upload.
export function fileToBase64(file: File): Promise<{ data: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); resolve({ data: s.slice(s.indexOf(',') + 1), mime: file.type || 'application/octet-stream' }); };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
