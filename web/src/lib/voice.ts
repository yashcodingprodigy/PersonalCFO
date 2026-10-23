// Voice engine — speaks and listens in English and Hindi.
//
// Speaking:  ElevenLabs (human voice, via our server /voice/tts) → falls back to the
//            best voice the device has (prefers "Natural"/"Neural"/Google voices).
// Listening: records with a voice-activity detector (stops ~1s after you finish)
//            and transcribes with ElevenLabs Scribe (/voice/stt, great at Hindi &
//            Hinglish) → falls back to the browser's own speech recognition.
// Nothing here throws to the UI; every failure degrades to the next option.

import { api, apiBlob, get } from './api';

export type VoiceLang = 'en' | 'hi';
type Status = { tts: 'elevenlabs' | 'browser'; stt: 'elevenlabs' | 'browser' };

let statusP: Promise<Status> | null = null;
export function voiceStatus(): Promise<Status> {
  if (!statusP) statusP = get<Status>('/voice/status').catch(() => ({ tts: 'browser', stt: 'browser' } as Status));
  return statusP;
}

export function browserCanListen(): boolean {
  if (typeof window === 'undefined') return false;
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) || !!(navigator.mediaDevices && (window as any).MediaRecorder);
}

// ── speaking ─────────────────────────────────────────────────────────
let audioEl: HTMLAudioElement | null = null;
let speakingCancel: (() => void) | null = null;

export function cleanForSpeech(md: string): string {
  return (md || '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/[*_#`>|]/g, ' ')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/✨|✅|🎉|→/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1100);
}

function pickBrowserVoice(lang: VoiceLang): SpeechSynthesisVoice | null {
  const all = window.speechSynthesis?.getVoices?.() || [];
  const want = lang === 'hi' ? ['hi-IN', 'hi'] : ['en-IN', 'en-GB', 'en-US', 'en'];
  const quality = (v: SpeechSynthesisVoice) => (/natural|neural|premium|enhanced/i.test(v.name) ? 3 : /google/i.test(v.name) ? 2 : /microsoft|samantha|rishi|veena|lekha|kalpana|hemant/i.test(v.name) ? 1 : 0);
  for (const code of want) {
    const pool = all.filter((v) => v.lang?.toLowerCase().startsWith(code.toLowerCase()));
    if (pool.length) return pool.sort((a, b) => quality(b) - quality(a))[0];
  }
  return null;
}

function speakWithBrowser(text: string, lang: VoiceLang): Promise<void> {
  return new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return resolve();
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = pickBrowserVoice(lang);
      if (v) u.voice = v;
      u.lang = v?.lang || (lang === 'hi' ? 'hi-IN' : 'en-IN');
      u.rate = lang === 'hi' ? 0.98 : 1.02; u.pitch = 1;
      u.onend = () => resolve(); u.onerror = () => resolve();
      speakingCancel = () => { synth.cancel(); resolve(); };
      synth.speak(u);
    } catch { resolve(); }
  });
}

/** Speak text in a natural voice. Resolves when finished (or when stopped). */
export async function speak(text: string, lang: VoiceLang): Promise<void> {
  stopSpeaking();
  const clean = cleanForSpeech(text);
  if (!clean) return;
  const st = await voiceStatus();
  if (st.tts === 'elevenlabs') {
    try {
      const blob = await apiBlob('/voice/tts', { text: clean, lang });
      if (blob && blob.size > 0) {
        const url = URL.createObjectURL(blob);
        await new Promise<void>((resolve) => {
          audioEl = new Audio(url);
          audioEl.onended = () => { URL.revokeObjectURL(url); resolve(); };
          audioEl.onerror = () => { URL.revokeObjectURL(url); resolve(); };
          speakingCancel = () => { try { audioEl?.pause(); } catch {} URL.revokeObjectURL(url); resolve(); };
          audioEl.play().catch(() => resolve());
        });
        return;
      }
    } catch { /* fall through to device voice */ }
  }
  await speakWithBrowser(clean, lang);
}

export function stopSpeaking() {
  try { speakingCancel?.(); } catch {}
  speakingCancel = null;
  try { audioEl?.pause(); } catch {}
  try { window.speechSynthesis?.cancel(); } catch {}
}

// ── listening ────────────────────────────────────────────────────────
/** Why listening produced no text — shown to the user so they know what to fix. */
export type ListenError = 'denied' | 'no-mic' | 'unsupported' | 'network' | 'dictation-off' | 'no-speech' | 'stt-failed';
export interface ListenResult { text: string; language: string | null; error?: ListenError }
export interface ListenHandle { stop: () => void; result: Promise<ListenResult> }

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });
}

function micError(e: any): ListenError {
  const n = e?.name || '';
  if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'denied';
  if (n === 'NotFoundError' || n === 'DevicesNotFoundError' || n === 'NotReadableError' || n === 'OverconstrainedError') return 'no-mic';
  return 'no-mic';
}

/** Mic level meter so the orb visibly reacts — proves the mic is actually hearing you. */
function meter(stream: MediaStream, onLevel?: (v: number) => void) {
  let raf = 0, ctx: AudioContext | null = null, lastLoud = 0, spoke = false;
  try {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    ctx.resume?.().catch(() => {});
    const an = ctx.createAnalyser(); an.fftSize = 512; ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    const tick = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / buf.length);
      onLevel?.(Math.min(1, rms * 6));
      if (rms > 0.035) { spoke = true; lastLoud = Date.now(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  } catch { /* level meter is cosmetic */ }
  return {
    get spoke() { return spoke; }, get lastLoud() { return lastLoud; },
    /** false when the browser kept the meter suspended — then we can't detect silence. */
    get working() { return !!ctx && ctx.state === 'running'; },
    stop() { cancelAnimationFrame(raf); onLevel?.(0); ctx?.close().catch(() => {}); },
  };
}

/** Start listening. `onLevel` gets 0..1 mic loudness; `onPartial` gets live words as you speak. */
export function listen(lang: VoiceLang, onLevel?: (v: number) => void, onPartial?: (t: string) => void): ListenHandle {
  let stopFn = () => {};
  const result = (async (): Promise<ListenResult> => {
    const st = await voiceStatus();
    const md: any = navigator.mediaDevices;
    if (!md?.getUserMedia) return { text: '', language: null, error: 'unsupported' };

    // 1) Ask for the mic first — gives a clear "blocked / no mic" answer instead of silence.
    let stream: MediaStream;
    try { stream = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (e) { return { text: '', language: null, error: micError(e) }; }
    const m = meter(stream, onLevel);
    const release = () => { m.stop(); stream.getTracks().forEach((t) => t.stop()); };

    // 2a) ElevenLabs Scribe: record → transcribe on our server (works in every modern browser).
    if (st.stt === 'elevenlabs' && (window as any).MediaRecorder) {
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((x) => (window as any).MediaRecorder.isTypeSupported?.(x)) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const started = Date.now();
      const done = new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        const iv = setInterval(() => {
          const now = Date.now();
          const limit = m.working ? 8000 : 7000; // no meter → just record a fixed window
          if ((m.spoke && now - m.lastLoud > 1100) || now - started > 20000 || (!m.spoke && now - started > limit)) { clearInterval(iv); try { rec.stop(); } catch {} }
        }, 100);
        stopFn = () => { clearInterval(iv); try { rec.stop(); } catch {} };
      });
      rec.start(250);
      await done;
      const spoke = m.spoke || !m.working;
      release();
      if (!spoke || !chunks.length) return { text: '', language: null, error: 'no-speech' };
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      try {
        const r = await api<{ text: string; language: string | null }>('/voice/stt', { method: 'POST', body: JSON.stringify({ audio: await blobToBase64(blob), mime: blob.type }) });
        return r.text ? { text: r.text, language: r.language } : { text: '', language: null, error: 'no-speech' };
      } catch { return { text: '', language: null, error: 'stt-failed' }; }
    }

    // 2b) Browser speech recognition (Chrome, Edge, Safari with Dictation on, Android).
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { release(); return { text: '', language: null, error: 'unsupported' }; }
    // Mobile Chrome can't share the mic between our level meter and its recogniser — hand it over.
    const shareMic = !/Android|iPhone|iPad/i.test(navigator.userAgent);
    let released = false;
    const releaseOnce = () => { if (!released) { released = true; release(); } };
    if (!shareMic) releaseOnce();
    return await new Promise<ListenResult>((resolve) => {
      const r = new SR();
      r.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      let finalText = '', interim = '', err: ListenError | undefined, settled = false;
      const finish = () => {
        if (settled) return; settled = true; releaseOnce();
        const text = (finalText || interim).trim();
        resolve(text ? { text, language: lang } : { text: '', language: null, error: err || 'no-speech' });
      };
      r.onresult = (e: any) => {
        interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0]?.transcript || '';
          if (e.results[i].isFinal) finalText += t; else interim += t;
        }
        onPartial?.((finalText + ' ' + interim).trim());
      };
      r.onerror = (e: any) => {
        const c = e?.error;
        err = c === 'not-allowed' ? 'denied'
          : c === 'service-not-allowed' ? 'dictation-off'
          : c === 'audio-capture' ? 'no-mic'
          : c === 'network' ? 'network'
          : c === 'language-not-supported' ? 'unsupported'
          : 'no-speech';
      };
      r.onend = finish;
      r.onsoundstart = () => { if (!shareMic) onLevel?.(0.5); };
      r.onspeechend = () => { if (!shareMic) onLevel?.(0); };
      stopFn = () => { try { r.stop(); } catch { finish(); } };
      // Safety: never hang forever.
      setTimeout(() => { try { r.stop(); } catch {} setTimeout(finish, 800); }, 25000);
      try { r.start(); } catch { err = 'unsupported'; finish(); }
    });
  })().catch(() => ({ text: '', language: null, error: 'no-mic' as ListenError }));
  return { stop: () => stopFn(), result };
}
