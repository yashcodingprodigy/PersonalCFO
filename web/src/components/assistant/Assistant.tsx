'use client';

// Ask PayWatch, everywhere. One tap from any screen opens a small chooser —
// Talk (voice) or Type (chat) — and the assistant appears ON TOP of the page you
// are on. Voice and chat share ONE conversation (switch any time, history stays),
// and the assistant can act: open pages, update dreams, change settings, and pin
// a short "what to do / what to avoid" guide in the corner of the page it opens.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatPanel } from './ChatPanel';
import { VoiceMode } from './VoiceMode';
import { GuidePanel, Guide } from './GuidePanel';
import { useLang } from '@/lib/i18n';
import { clearCache } from '@/lib/api';

type Mode = null | 'chooser' | 'chat' | 'voice';
export type AssistantAction =
  | { type: 'navigate'; path: string; label: string }
  | ({ type: 'guide' } & Guide)
  | { type: 'refresh' }
  | { type: 'set_language'; value: 'en' | 'hi' };

interface Ctx {
  open: (m?: 'chooser' | 'chat' | 'voice', question?: string) => void;
  close: () => void;
  mode: Mode;
  /** Apply what the assistant decided to do. Returns true if it navigated. */
  runActions: (a?: AssistantAction[]) => boolean;
}
const AssistantCtx = createContext<Ctx>({ open: () => {}, close: () => {}, mode: null, runActions: () => false });
export const useAssistant = () => useContext(AssistantCtx);

/** Fired after the assistant changes data (e.g. captured a dream) so pages refresh. */
export const DATA_CHANGED = 'paywatch:data-changed';
const CONV_KEY = 'paywatch_conv';
const GUIDE_KEY = 'paywatch_guide';

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [question, setQuestion] = useState<string | undefined>();
  const [convId, setConvIdState] = useState<string | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const { t, setLang } = useLang();

  // The current conversation (shared by voice + chat) and any pinned guide survive reloads within the session.
  useEffect(() => {
    try {
      setConvIdState(sessionStorage.getItem(CONV_KEY));
      const g = sessionStorage.getItem(GUIDE_KEY); if (g) setGuide(JSON.parse(g));
    } catch {}
  }, []);
  const setConvId = useCallback((id: string | null) => {
    setConvIdState(id);
    try { id ? sessionStorage.setItem(CONV_KEY, id) : sessionStorage.removeItem(CONV_KEY); } catch {}
  }, []);
  const showGuide = useCallback((g: Guide | null) => {
    setGuide(g);
    try { g ? sessionStorage.setItem(GUIDE_KEY, JSON.stringify(g)) : sessionStorage.removeItem(GUIDE_KEY); } catch {}
  }, []);

  const newChat = useCallback(() => { setConvId(null); setQuestion(undefined); setChatKey((k) => k + 1); }, [setConvId]);
  const open = useCallback((m: 'chooser' | 'chat' | 'voice' = 'chooser', q?: string) => { setQuestion(q); setMode(m); }, []);
  const close = useCallback(() => { setMode(null); setQuestion(undefined); }, []);
  const changed = useCallback(() => { clearCache(); window.dispatchEvent(new Event(DATA_CHANGED)); }, []);

  const runActions = useCallback((actions?: AssistantAction[]) => {
    if (!actions?.length) return false;
    let navigated = false;
    for (const a of actions) {
      if (a.type === 'navigate') { router.push(a.path); navigated = true; }
      else if (a.type === 'guide') { const { type, ...g } = a; showGuide(g as Guide); }
      else if (a.type === 'refresh') changed();
      else if (a.type === 'set_language') setLang(a.value);
    }
    if (navigated && !actions.some((a) => a.type === 'guide')) showGuide(null);
    return navigated;
  }, [router, showGuide, changed, setLang]);

  useEffect(() => {
    if (mode !== 'chooser' && mode !== 'chat') return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [mode, close]);

  return (
    <AssistantCtx.Provider value={{ open, close, mode, runActions }}>
      {children}

      {guide && mode !== 'voice' && <GuidePanel guide={guide} onClose={() => showGuide(null)} onAsk={() => open('chat')} />}

      {mode === 'chooser' && (
        <div className="fixed inset-0 z-[70] no-print" onClick={close}>
          <div className="absolute inset-0 bg-pine-950/30 backdrop-blur-[2px] pw-fade-in" />
          <div onClick={(e) => e.stopPropagation()}
            className="absolute bottom-24 right-4 md:bottom-24 md:right-6 left-4 md:left-auto md:w-[360px] rounded-3xl bg-white shadow-lift p-5 pw-pop-in">
            <p className="font-display text-lg">{t('as.howTalk')}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => setMode('voice')} className="group rounded-2xl p-4 text-left text-white pw-voice-bg hover:scale-[1.02] transition-transform">
                <span className="block w-10 h-10 rounded-full pw-orb-mini mb-3" />
                <span className="block font-bold">{t('as.voice')}</span>
                <span className="block text-[11px] text-white/70 mt-0.5">{t('as.voiceSub')}</span>
              </button>
              <button onClick={() => setMode('chat')} className="rounded-2xl p-4 text-left border-2 border-paper-200 hover:border-pine-700 transition-colors">
                <span className="block w-10 h-10 rounded-full bg-mint-100 text-pine-800 grid place-items-center mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h16v12H7l-3 3V4Zm4 5h8v2H8V9Z" /></svg>
                </span>
                <span className="block font-bold">{t('as.chat')}</span>
                <span className="block text-[11px] text-ink-faint mt-0.5">{t('as.chatSub')}</span>
              </button>
            </div>
            {convId && (
              <button onClick={newChat} className="mt-3 text-[11px] text-ink-faint hover:text-pine-700 underline">{t('as.newChat')}</button>
            )}
          </div>
        </div>
      )}

      {mode === 'chat' && (
        <div className="fixed inset-0 z-[70] no-print" onClick={close}>
          <div className="absolute inset-0 bg-pine-950/25 pw-fade-in" />
          <aside onClick={(e) => e.stopPropagation()}
            className="absolute bg-white shadow-lift flex flex-col overflow-hidden inset-x-0 bottom-0 h-[86vh] rounded-t-3xl md:inset-y-3 md:right-3 md:left-auto md:bottom-3 md:h-auto md:w-[440px] md:rounded-3xl pw-slide-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-paper-100">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-full pw-orb-mini" />
                <p className="font-bold">{t('nav./ask')}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={newChat} title={t('as.newChat')} className="w-9 h-9 rounded-full hover:bg-paper-100 grid place-items-center text-ink-soft">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" /></svg>
                </button>
                <button onClick={() => setMode('voice')} title={t('as.voice')} className="w-9 h-9 rounded-full hover:bg-paper-100 grid place-items-center text-pine-800">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M19 10v1a7 7 0 0 1-14 0v-1" /><line x1="12" y1="18" x2="12" y2="22" /></svg>
                </button>
                <button onClick={close} aria-label={t('as.close')} className="w-9 h-9 rounded-full hover:bg-paper-100 grid place-items-center text-ink-soft">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" /></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <ChatPanel key={chatKey} variant="overlay" initialQuestion={question} conversationId={convId}
                onConversation={setConvId} onDataChanged={changed}
                onActions={(a) => { if (runActions(a)) setTimeout(close, 900); }} />
            </div>
          </aside>
        </div>
      )}

      {mode === 'voice' && (
        <VoiceMode conversationId={convId} onConversation={setConvId} onClose={close}
          onSwitchToChat={() => setMode('chat')} onDataChanged={changed} onActions={runActions} />
      )}
    </AssistantCtx.Provider>
  );
}
