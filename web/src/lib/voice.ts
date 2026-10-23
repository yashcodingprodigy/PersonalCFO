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
export interface ListenHandle { stop: () => void; result: Promise<{ text: string; language: string | null }> }

function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });
}

/** Start listening. `onLevel` gets 0..1 mic loudness for the orb animation. */
export function listen(lang: VoiceLang, onLevel?: (v: number) => void): ListenHandle {
  let stopFn = () => {};
  const result = (async () => {
    const st = await voiceStatus();
    const canRecord = !!((navigator.mediaDevices as any)?.getUserMedia && (window as any).MediaRecorder);
    if (st.stt === 'elevenlabs' && canRecord) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => (window as any).MediaRecorder.isTypeSupported?.(m)) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      // Voice-activity detection: stop ~1.1s after speech ends (max 20s).
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser(); an.fftSize = 512; src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      let spoke = false, lastLoud = Date.now(); const started = Date.now();
      let raf = 0;
      const done = new Promise<void>((resolve) => {
        rec.onstop = () => resolve();
        const tick = () => {
          an.getByteTimeDomainData(buf);
          let sum = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
          const rms = Math.sqrt(sum / buf.length);
          onLevel?.(Math.min(1, rms * 6));
          if (rms > 0.035) { spoke = true; lastLoud = Date.now(); }
          const now = Date.now();
          if ((spoke && now - lastLoud > 1100) || now - started > 20000 || (!spoke && now - started > 8000)) { try { rec.stop(); } catch {} return; }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      });
      stopFn = () => { try { rec.stop(); } catch {} };
      rec.start(250);
      await done;
      cancelAnimationFrame(raf); onLevel?.(0);
      stream.getTracks().forEach((t) => t.stop()); ctx.close().catch(() => {});
      if (!spoke || !chunks.length) return { text: '', language: null };
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      try {
        const r = await api<{ text: string; language: string | null }>('/voice/stt', { method: 'POST', body: JSON.stringify({ audio: await blobToBase64(blob), mime: blob.type }) });
        return { text: r.text || '', language: r.language };
      } catch { return { text: '', language: null }; }
    }
    // Browser recogniser fallback (Chrome/Edge/Android; Safari partially).
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return { text: '', language: null };
    return await new Promise<{ text: string; language: string | null }>((resolve) => {
      const r = new SR(); r.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; r.interimResults = false; r.maxAlternatives = 1;
      let got = '';
      r.onresult = (e: any) => { got = e.results?.[0]?.[0]?.transcript?.trim() || ''; };
      r.onend = () => { onLevel?.(0); resolve({ text: got, language: lang }); };
      r.onerror = () => { onLevel?.(0); resolve({ text: got, language: lang }); };
      r.onsoundstart = () => onLevel?.(0.5);
      stopFn = () => { try { r.stop(); } catch {} };
      try { r.start(); } catch { resolve({ text: '', language: null }); }
    });
  })().catch(() => ({ text: '', language: null }));
  return { stop: () => stopFn(), result };
}
