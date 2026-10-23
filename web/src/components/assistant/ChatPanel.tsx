'use client';

// Ask PayWatch chat — one component used both as the full /ask page and as the
// on-page overlay drawer. Answers come from the money brain in the user's
// language; dreams mentioned in chat are planned automatically by the server.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { get, post } from '@/lib/api';
import { useLang, TKey } from '@/lib/i18n';
import { Markdown } from './Markdown';

export function ChatPanel({ variant = 'page', initialQuestion, onDataChanged }: { variant?: 'page' | 'overlay'; initialQuestion?: string; onDataChanged?: () => void }) {
  const { lang, t } = useLang();
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const asked = useRef(false);

  useEffect(() => {
    if (variant === 'page') get('/qa/conversations').then(setConversations).catch(() => {});
    get('/qa/disclaimer').then((d) => setDisclaimer(d.disclaimer)).catch(() => {});
    if (initialQuestion && !asked.current) { asked.current = true; send(initialQuestion); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);

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
      const body = { content, lang, mode: 'chat' };
      const res = activeId ? await post(`/qa/conversations/${activeId}/messages`, body) : await post('/qa/conversations', body);
      if (!activeId) {
        setActiveId(res.conversation_id);
        if (variant === 'page') get('/qa/conversations').then(setConversations).catch(() => {});
      }
      setMessages((m) => [...m, { ...res.message, proposedAction: res.proposedAction }]);
      if (/✨|✅/.test(res.message?.content || '')) onDataChanged?.();
    } catch (e: any) {
      setErr(e.message); setMessages((m) => m.slice(0, -1)); setInput(content);
    } finally { setBusy(false); }
  }

  async function confirmProposed(mid: string, benefit: any) {
    try { await post('/context/benefits', benefit); setMessages((ms) => ms.map((x) => (x.message_id === mid ? { ...x, _actionState: 'added' } : x))); onDataChanged?.(); }
    catch (e: any) { setErr(e.message || 'Could not save that. Please try again.'); }
  }
  const dismissProposed = (mid: string) => setMessages((ms) => ms.map((x) => (x.message_id === mid ? { ...x, _actionState: 'dismissed' } : x)));

  const suggestions: TKey[] = ['as.s1', 'as.s2', 'as.s3', 'as.s4'];
  return (
    <div className={`flex flex-col min-h-0 ${variant === 'page' ? '' : 'h-full'}`} style={variant === 'page' ? { height: 'calc(100vh - 8rem)' } : undefined}>
      {variant === 'page' && (
        <div className="flex items-end justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="font-display text-3xl font-medium">{t('nav./ask')}</h1>
          </div>
          {conversations.length > 0 && (
            <select className="input !w-auto !py-2 text-xs" value={activeId || ''} onChange={(e) => (e.target.value ? openConversation(e.target.value) : (setActiveId(null), setMessages([])))}>
              <option value="">+ New conversation</option>
              {conversations.map((c) => <option key={c.conversation_id} value={c.conversation_id}>{c.title}</option>)}
            </select>
          )}
        </div>
      )}
      <div className={`${variant === 'page' ? 'card' : ''} flex-1 min-h-0 flex flex-col overflow-hidden`}>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="w-14 h-14 rounded-full pw-orb-mini mb-4" aria-hidden />
              <p className="text-sm text-ink-soft mb-5 max-w-sm">{t('as.hello')}</p>
              <div className="grid gap-2 w-full max-w-sm">
                {suggestions.map((s) => (
                  <button key={s} onClick={() => send(t(s))} className="rounded-xl border border-paper-200 bg-paper-50 px-4 py-2.5 text-left text-xs font-medium hover:border-pine-600 transition-colors">{t(s)}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.message_id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-pine-900 text-white rounded-br-md whitespace-pre-wrap' : 'bg-paper-50 border border-paper-200 rounded-bl-md'}`}>
                {m.role === 'user' ? <span data-no-translate>{m.content}</span> : <Markdown text={m.content} />}
                {m.role === 'assistant' && m.proposedAction && m._actionState !== 'dismissed' && (
                  <div className="mt-3 rounded-xl border border-pine-700/30 bg-mint-100/50 p-3">
                    {m._actionState === 'added' ? <p className="text-xs font-semibold text-pine-800">✓ Added to your profile.</p> : (
                      <>
                        <p className="text-xs text-ink-soft mb-2">{m.proposedAction.summary}</p>
                        <div className="flex gap-2">
                          <button onClick={() => confirmProposed(m.message_id, m.proposedAction.benefit)} className="rounded-full bg-pine-900 text-white px-3 py-1.5 text-xs font-bold">Yes, add it</button>
                          <button onClick={() => dismissProposed(m.message_id)} className="rounded-full bg-paper-100 text-ink-soft px-3 py-1.5 text-xs font-bold">No thanks</button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="bg-paper-50 border border-paper-200 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-ink-faint flex items-center gap-2">
                <span className="pw-typing"><i /><i /><i /></span>{t('as.thinking')}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {err && <p className="px-5 py-2 text-xs text-signal-red bg-signal-red/5">{err}</p>}
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t border-paper-100 p-3 flex gap-2 items-center bg-white">
          <input className="input flex-1" placeholder={t('as.placeholder')} value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} data-no-translate />
          <button className="btn-primary !px-5" disabled={busy || !input.trim()}>{t('as.send')}</button>
        </form>
      </div>
      {variant === 'overlay' ? (
        <div className="px-4 py-2 flex items-center justify-between text-[10px] text-ink-faint border-t border-paper-100 bg-white">
          <span className="truncate pr-3">Educational guidance, not investment advice.</span>
          <Link href="/ask" className="text-pine-700 font-bold whitespace-nowrap">{t('as.fullpage')} →</Link>
        </div>
      ) : <p className="text-[10px] text-ink-faint mt-3 leading-relaxed">{disclaimer}</p>}
    </div>
  );
}
