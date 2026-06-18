'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { get, post } from '@/lib/api';

const SUGGESTIONS = [
  'Should I prepay my home loan or invest in equity?',
  'Which tax regime saves me more this year?',
  'Is my term cover enough for my family?',
  'How big should my emergency fund be?',
];

export default function AskPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    get('/qa/conversations').then(setConversations).catch(() => {});
    get('/qa/disclaimer').then((d) => setDisclaimer(d.disclaimer)).catch(() => {});
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function openConversation(id: string) {
    setActiveId(id);
    const conv = await get(`/qa/conversations/${id}`);
    setMessages(conv.messages);
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    setBusy(true); setErr(''); setInput('');
    setMessages((m) => [...m, { message_id: `tmp_${Date.now()}`, role: 'user', content }]);
    try {
      const res = activeId
        ? await post(`/qa/conversations/${activeId}/messages`, { content })
        : await post('/qa/conversations', { content });
      if (!activeId) {
        setActiveId(res.conversation_id);
        get('/qa/conversations').then(setConversations).catch(() => {});
      }
      setMessages((m) => [...m, res.message]);
    } catch (e: any) {
      setErr(e.message);
      setMessages((m) => m.slice(0, -1));
      setInput(content);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 8rem)' }}>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="font-display text-3xl font-medium">Ask your CFO</h1>
          <p className="text-sm text-ink-soft mt-1">Answers grounded in your actual numbers — not generic advice.</p>
        </div>
        {conversations.length > 0 && (
          <select className="input !w-auto !py-2 text-xs" value={activeId || ''} onChange={(e) => (e.target.value ? openConversation(e.target.value) : (setActiveId(null), setMessages([])))}>
            <option value="">+ New conversation</option>
            {conversations.map((c) => <option key={c.conversation_id} value={c.conversation_id}>{c.title}</option>)}
          </select>
        )}
      </div>

      <div className="card flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <p className="text-sm text-ink-soft mb-6 max-w-md">
                Your CFO knows your income, net worth, score, and gaps. Ask anything about your taxes,
                insurance, debt or savings — and get an answer with your numbers in it.
              </p>
              <div className="grid sm:grid-cols-2 gap-2 w-full max-w-lg">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-xl border border-paper-200 bg-paper-50 px-4 py-3 text-left text-xs font-medium hover:border-pine-600 transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.message_id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === 'user' ? 'bg-pine-900 text-white rounded-br-md whitespace-pre-wrap' : 'bg-paper-50 border border-paper-200 rounded-bl-md'}`}>
                {m.role === 'user' ? m.content : <Markdown text={m.content} />}
                {m.role === 'assistant' && Array.isArray(m.citations) && m.citations.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-paper-200 flex flex-wrap gap-1.5">
                    {m.citations.map((c: any, i: number) => (
                      <span key={i} className="chip bg-white border border-paper-200 text-ink-faint">{c.tag}</span>
                    ))}
                  </div>
                )}
                {m.role === 'assistant' && m.review_status === 'pending_review' && (
                  <p className="mt-2 text-[10px] text-signal-amber font-semibold">⏳ Flagged for human advisor review (CFO plan) — may be refined within 4 hours.</p>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="bg-paper-50 border border-paper-200 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-ink-faint">Reading your numbers…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {err && <p className="px-5 py-2 text-xs text-signal-red bg-signal-red/5">{err}</p>}

        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-paper-100 p-3 flex gap-2">
          <input className="input flex-1" placeholder="Ask about your money…" value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} />
          <button className="btn-primary !px-5" disabled={busy || !input.trim()}>Send</button>
        </form>
      </div>

      <p className="text-[10px] text-ink-faint mt-3 leading-relaxed">{disclaimer}</p>
    </div>
  );
}

// Inline formatting: **bold** and *italic*.
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  });
}

// Lightweight markdown renderer: headings, bullet & numbered lists, dividers,
// paragraphs and inline bold/italic — enough to make answers read like a chat.
function Markdown({ text }: { text: string }) {
  const lines = (text || '').replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0, key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (/^\s*---+\s*$/.test(line)) { blocks.push(<hr key={key++} className="my-3 border-paper-200" />); i++; continue; }
    const h = line.match(/^\s*(#{1,3})\s+(.*)$/);
    if (h) { blocks.push(<p key={key++} className={`font-semibold ${h[1].length === 1 ? 'text-base' : 'text-sm'} mt-2 mb-1`}>{inline(h[2])}</p>); i++; continue; }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*•]\s+/, '')); i++; }
      blocks.push(<ul key={key++} className="list-disc pl-5 my-1.5 space-y-1">{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
      blocks.push(<ol key={key++} className="list-decimal pl-5 my-1.5 space-y-1">{items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]) && !/^\s*---+\s*$/.test(lines[i]) && !/^\s*#{1,3}\s+/.test(lines[i])) {
      para.push(lines[i]); i++;
    }
    blocks.push(<p key={key++} className="my-1.5 first:mt-0 last:mb-0">{inline(para.join(' '))}</p>);
  }
  return <div>{blocks}</div>;
}
