'use client';

// Hands-free voice conversation with the money brain (ChatGPT-voice style):
// tap once → it listens, notices when you stop talking, thinks, answers out loud
// in a natural voice, then listens again. Tap the orb to interrupt or pause.
// Replies in the language you spoke (English or Hindi).

import { useEffect, useRef, useState } from 'react';
import { post, api } from '@/lib/api';
import { listen, speak, stopSpeaking, voiceStatus, cleanForSpeech, ListenHandle, VoiceLang, ListenError, releaseMic, readyChime } from '@/lib/voice';
import type { TKey } from '@/lib/i18n';
import { ReplyVisuals } from './Visuals';

const ERR_KEY: Record<ListenError, TKey> = {
  denied: 'vo.err.denied', 'no-mic': 'vo.err.noMic', unsupported: 'vo.err.unsupported', network: 'vo.err.network',
  'dictation-off': 'vo.err.dictation', 'no-speech': 'vo.didntCatch', 'stt-failed': 'vo.err.stt',
};
import { useLang } from '@/lib/i18n';

type Phase = 'idle' | 'starting' | 'listening' | 'thinking' | 'speaking';

export function VoiceMode({ onClose, onSwitchToChat, onDataChanged, conversationId, onConversation, onActions }: {
  onClose: () => void; onSwitchToChat: () => void; onDataChanged?: () => void;
  conversationId?: string | null; onConversation?: (id: string) => void;
  /** Apply assistant actions; returns true when it navigated to another page. */
  onActions?: (a: any[]) => boolean;
}) {
  const { lang, setLang, t } = useLang();
  const [phase, setPhase] = useState<Phase>('idle');
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState('');
  const [reply, setReply] = useState('');
  const [visuals, setVisuals] = useState<any[] | null>(null);
  const [proposal, setProposal] = useState<any | null>(null);
  const [note, setNote] = useState('');
  const [engine, setEngine] = useState<'human' | 'browser'>('browser');
  const [opening, setOpening] = useState<string | null>(null); // "Opening Insurance…" while the answer is written
  const convRef = useRef<string | null>(conversationId || null);
  const handleRef = useRef<ListenHandle | null>(null);
  const alive = useRef(true);
  const phaseRef = useRef<Phase>('idle');
  const retriedStt = useRef(false);
  const replyRef = useRef<HTMLDivElement>(null);
  // Each new answer starts at the top, then the box follows the voice as it reads.
  useEffect(() => { const el = replyRef.current; if (el) el.scrollTo({ top: 0 }); }, [reply]);
  const follow = (r: number) => {
    const el = replyRef.current; if (!el) return;
    const max = el.scrollHeight - el.clientHeight; if (max <= 0) return;
    el.scrollTo({ top: Math.max(0, max * r - el.clientHeight * 0.25), behavior: 'smooth' });
  };
  const setP = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  useEffect(() => {
    alive.current = true;
    voiceStatus().then((s) => setEngine((lang === 'hi' ? (s.ttsHi || s.tts) : s.tts) !== 'browser' ? 'human' : 'browser'));
    const t0 = setTimeout(() => turn(), 350); // start listening right away
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', esc);
    return () => { alive.current = false; clearTimeout(t0); window.removeEventListener('keydown', esc); handleRef.current?.stop(); stopSpeaking(); releaseMic(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() { alive.current = false; handleRef.current?.stop(); stopSpeaking(); releaseMic(); onClose(); }

  async function turn() {
    if (!alive.current) return;
    // "Getting ready" until the recogniser is really live — then a chime says "talk now",
    // so the first words are never lost.
    setNote(''); setHeard(''); setP('starting');
    const h = listen(lang as VoiceLang, (v) => setLevel(v), (partial) => setHeard(partial), () => { if (alive.current) { setP('listening'); readyChime(); } });
    handleRef.current = h;
    const { text, language, error } = await h.result;
    handleRef.current = null;
    if (!alive.current) return;
    if (!text && error === 'stt-failed' && !retriedStt.current) {
      // The server couldn't transcribe — switch to the device recogniser and listen again straight away.
      retriedStt.current = true;
      const msg = lang === 'hi' ? 'फिर से बोलिए — अब डिवाइस से सुन रहा हूँ।' : 'Please say that again — listening with your device now.';
      setTimeout(() => { turn(); setNote(msg); }, 300);
      return;
    }
    if (!text) { setP('idle'); setHeard(''); setNote(t(ERR_KEY[error || 'no-speech'])); return; }
    await respond(text);
  }

  /** Send what the user said (or tapped) and play the answer. */
  async function respond(text: string) {
    setProposal(null);
    setHeard(text); setReply(''); setVisuals(null); setOpening(null); setP('thinking');
    // D-57: the app language decides; only Hindi in Devanagari (what speech-to-text gives for spoken Hindi) switches it.
    // (The speech engine's own language guess is ignored — it often tags accented English as Hindi.)
    const replyLang: VoiceLang = /[ऀ-ॿ]/.test(text) ? 'hi' : (lang as VoiceLang);
    // Instant intent preview: if this is "take me to…", go there now and show a skeleton
    // instead of a long "Thinking…" while the full answer is written.
    const openedPaths = new Set<string>();
    api('/qa/intent', { method: 'POST', body: JSON.stringify({ content: text, lang: replyLang }) }).then((r: any) => {
      if (!alive.current || phaseRef.current !== 'thinking') return;
      const nav = (r?.actions || []).find((a: any) => a.type === 'navigate');
      if (!nav) return;
      setOpening(nav.label);
      openedPaths.add(nav.path);
      onActions?.(r.actions);
    }).catch(() => {});
    try {
      const body = { content: text, lang: replyLang, mode: 'voice' };
      const res = convRef.current ? await post(`/qa/conversations/${convRef.current}/messages`, body) : await post('/qa/conversations', body);
      setOpening(null);
      if (res.conversation_id && res.conversation_id !== convRef.current) { convRef.current = res.conversation_id; onConversation?.(res.conversation_id); }
      const answer: string = res.message?.content || '';
      if (res.data_changed || /✨|✅/.test(answer)) onDataChanged?.();
      // Actions (open a page, pin a guide, update a dream…) happen right away, behind this screen.
      const fresh = (res.actions || []).filter((a: any) => !(a.type === 'navigate' && openedPaths.has(a.path)));
      const navigated = openedPaths.size > 0 || (fresh.length ? !!onActions?.(fresh) : false);
      if (!alive.current) return;
      setReply(cleanForSpeech(answer)); setVisuals(res.message?.visuals || null); setProposal(res.proposedAction?.kind === 'add_dream' ? res.proposedAction : null); setP('speaking');
      // Speak in the language the answer is actually in (the server answers in the language you used).
      const spokenLang: VoiceLang = res.reply_lang === 'hi' || res.reply_lang === 'en' ? res.reply_lang : /[ऀ-ॿ]/.test(answer) ? 'hi' : replyLang;
      await speak(answer, spokenLang, follow);
      if (!alive.current) return;
      if (navigated) { close(); return; } // step aside so the page (and its guide) is visible
      if (phaseRef.current === 'speaking') turn(); // keep the conversation going
    } catch (e: any) {
      setOpening(null); setP('idle'); setNote(e.message || 'Something went wrong.');
    }
  }

  function tapOrb() {
    if (phase === 'listening' || phase === 'starting') { handleRef.current?.stop(); return; }
    if (phase === 'speaking') { stopSpeaking(); setP('idle'); setTimeout(turn, 150); return; }
    if (phase === 'idle') turn();
  }

  const label = phase === 'starting' ? t('vo.starting') : phase === 'listening' ? t('vo.listening') : phase === 'thinking' ? (opening ? `${t('vo.opening')} ${opening}…` : t('vo.thinking')) : phase === 'speaking' ? t('vo.speaking') : t('vo.tapToTalk');
  const scale = 1 + (phase === 'listening' ? level * 0.35 : phase === 'speaking' ? 0.06 : 0);
  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center text-white pw-voice-bg" role="dialog" aria-label="PayWatch voice">
      <div className="w-full shrink-0 flex items-center justify-between px-5 pt-5">
        <div className="inline-flex rounded-full bg-white/10 p-1 text-xs font-bold">
          {(['en', 'hi'] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)} className={`rounded-full px-3 py-1 ${lang === l ? 'bg-white text-pine-950' : 'text-white/70'}`}>{l === 'en' ? 'English' : 'हिंदी'}</button>
          ))}
        </div>
        <span className="text-[11px] text-white/50">{engine === 'human' ? t('vo.human') : t('vo.device')}</span>
        <button onClick={close} aria-label={t('as.close')} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" /></svg>
        </button>
      </div>

      <div className="flex-1 min-h-0 w-full max-w-2xl flex flex-col items-center px-5 pt-4">
        <button onClick={tapOrb} aria-label={phase === 'idle' ? t('vo.tapToTalk') : t('vo.tapToStop')}
          className={`relative shrink-0 rounded-full focus:outline-none transition-all duration-500 ${reply ? 'w-28 h-28 sm:w-32 sm:h-32' : 'w-52 h-52 sm:w-64 sm:h-64 mt-[6vh]'}`}>
          <span className={`absolute inset-0 rounded-full pw-orb ${phase === 'thinking' ? 'pw-orb-think' : ''} ${phase === 'speaking' ? 'pw-orb-speak' : ''}`} style={{ transform: `scale(${scale})`, transition: 'transform 90ms linear' }} />
          <span className="absolute -inset-6 rounded-full pw-orb-halo" style={{ opacity: phase === 'idle' ? 0.35 : 0.8 }} />
        </button>
        <p className="mt-5 shrink-0 text-sm font-semibold tracking-wide text-mint-300">{label}</p>
        {heard && <p className="mt-3 shrink-0 text-white/55 text-sm text-center max-w-lg line-clamp-2">“{heard}”</p>}
        {note && <p className="mt-4 shrink-0 text-sm text-gold-500 text-center max-w-md leading-relaxed">{note}</p>}
        {phase === 'thinking' && !reply && (
          <div className="mt-6 w-full max-w-lg rounded-3xl bg-white/[0.06] border border-white/10 px-5 py-5 pw-fade-in" aria-busy="true" aria-label={opening || t('vo.thinking')}>
            {opening && <p className="text-[11px] font-bold uppercase tracking-widest text-mint-300 mb-3">{t('vo.opening')} {opening}</p>}
            <div className="space-y-2.5">
              {[92, 78, 85, 60].map((w, i) => (
                <div key={i} className="h-3 rounded-full bg-white/10 overflow-hidden" style={{ width: `${w}%` }}>
                  <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent pw-voice-shimmer" />
                </div>
              ))}
            </div>
          </div>
        )}
        {reply && (
          <div ref={replyRef} className="mt-5 w-full flex-1 min-h-0 overflow-y-auto overscroll-contain rounded-3xl bg-white/[0.06] border border-white/10 px-5 py-4 sm:px-7 sm:py-5 pw-fade-in">
            <p className="text-[15px] sm:text-base leading-7 text-white/90 whitespace-pre-line">{reply}</p>
            {proposal && (
              <div className="mt-4 rounded-2xl bg-white/10 border border-white/15 p-4">
                <p className="text-sm text-white/90" dangerouslySetInnerHTML={{ __html: String(proposal.summary).replace(/[<>&]/g, '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') }} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => { stopSpeaking(); respond(proposal.confirmText); }} className="rounded-full bg-white text-pine-950 px-4 py-2 text-sm font-bold">{t('as.addDream')}</button>
                  <button onClick={() => setProposal(null)} className="rounded-full bg-white/10 text-white px-4 py-2 text-sm font-bold">{t('as.changeDream')}</button>
                </div>
              </div>
            )}
            <div className="text-ink"><ReplyVisuals visuals={visuals} /></div>
          </div>
        )}
      </div>

      <div className="shrink-0 py-6">
        <button onClick={() => { close(); onSwitchToChat(); }} className="rounded-full bg-white/10 hover:bg-white/15 px-5 py-2.5 text-sm font-bold">{t('vo.switchChat')}</button>
      </div>
    </div>
  );
}
