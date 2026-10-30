// Native voice for Ask PayWatch.
//  Listening: record with the phone mic (expo-audio, metering on) and detect when the user
//    stops talking; the clip goes to our server (/voice/stt → ElevenLabs Scribe, EN/HI auto-detect).
//    If the server has no speech key, fall back to the phone's own recogniser (expo-speech-recognition).
//  Speaking: natural voice from /voice/tts (ElevenLabs EN, Sarvam HI) played with expo-audio;
//    falls back to the device voice (expo-speech).
import { AudioModule, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, createAudioPlayer } from 'expo-audio';
import type { AudioRecorder, AudioPlayer, RecordingOptions } from 'expo-audio';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { File, Paths } from 'expo-file-system';
import { api, apiBinary } from './api';

export type VoiceLang = 'en' | 'hi';
export type ListenError = 'denied' | 'no-mic' | 'unsupported' | 'no-speech' | 'stt-failed' | 'network';
export interface ListenResult { text: string; language: VoiceLang | null; error?: ListenError }
export interface ListenHandle { result: Promise<ListenResult>; stop: () => void; cancel: () => void }

export const RECORDING: RecordingOptions = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000, sampleRate: 22050, isMeteringEnabled: true };

let statusCache: { tts: string; ttsHi: string; stt: string } | null = null;
export async function voiceStatus() {
  if (statusCache) return statusCache;
  try { statusCache = await api('/voice/status'); } catch { statusCache = { tts: 'browser', ttsHi: 'browser', stt: 'browser' }; }
  return statusCache!;
}

export async function ensureMic(): Promise<boolean> {
  try { const p = await requestRecordingPermissionsAsync(); return p.granted; } catch { return false; }
}

async function recordMode() {
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: 'doNotMix', shouldPlayInBackground: false }).catch(() => {});
}
async function playMode() {
  await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, interruptionMode: 'doNotMix', shouldPlayInBackground: false }).catch(() => {});
}

/** Hands-free listen. `recorder` comes from useAudioRecorder(RECORDING) in the voice screen. */
export function listen(recorder: AudioRecorder, lang: VoiceLang, cb: { onLevel?: (v: number) => void; onPartial?: (s: string) => void; onReady?: () => void } = {}): ListenHandle {
  let stopRequested = false, cancelled = false;
  let finish: () => void = () => {};
  const result = (async (): Promise<ListenResult> => {
    if (!(await ensureMic())) return { text: '', language: null, error: 'denied' };
    const st = await voiceStatus();
    if (st.stt !== 'elevenlabs') return deviceListen(lang, cb, () => stopRequested || cancelled, (f) => { finish = f; });
    try {
      await recordMode();
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch { return { text: '', language: null, error: 'no-mic' }; }
    cb.onReady?.();
    // Simple voice-activity detection on the metering level.
    const started = Date.now();
    let heardAt = 0, lastLoud = 0;
    await new Promise<void>((resolve) => {
      finish = resolve;
      const iv = setInterval(() => {
        if (stopRequested || cancelled) { clearInterval(iv); resolve(); return; }
        let db = -160;
        try { db = recorder.getStatus().metering ?? -160; } catch {}
        const level = Math.max(0, Math.min(1, (db + 55) / 45));
        cb.onLevel?.(level);
        const now = Date.now();
        if (level > 0.28) { if (!heardAt) heardAt = now; lastLoud = now; }
        const silentFor = lastLoud ? now - lastLoud : 0;
        if ((heardAt && silentFor > 1300 && now - heardAt > 500) || now - started > 20000 || (!heardAt && now - started > 7000)) { clearInterval(iv); resolve(); }
      }, 100);
    });
    try { await recorder.stop(); } catch {}
    cb.onLevel?.(0);
    if (cancelled) return { text: '', language: null };
    if (!heardAt) return { text: '', language: null, error: 'no-speech' };
    const uri = recorder.uri;
    if (!uri) return { text: '', language: null, error: 'stt-failed' };
    try {
      const b64 = await new File(uri).base64();
      const r = await api<{ text: string; language: string | null }>('/voice/stt', { method: 'POST', body: { audio: b64, mime: 'audio/mp4' }, timeoutMs: 30000 });
      try { new File(uri).delete(); } catch {}
      const text = (r.text || '').trim();
      if (!text) return { text: '', language: null, error: 'no-speech' };
      return { text, language: r.language === 'hi' ? 'hi' : r.language === 'en' ? 'en' : null };
    } catch (e: any) {
      return { text: '', language: null, error: e?.status === 0 ? 'network' : 'stt-failed' };
    }
  })();
  return {
    result,
    stop: () => { stopRequested = true; finish(); try { ExpoSpeechRecognitionModule.stop(); } catch {} },
    cancel: () => { cancelled = true; finish(); try { ExpoSpeechRecognitionModule.abort(); } catch {} },
  };
}

/** Phone's own recogniser (Apple Speech / Google). Used when the server has no speech key. */
async function deviceListen(lang: VoiceLang, cb: { onLevel?: (v: number) => void; onPartial?: (s: string) => void; onReady?: () => void }, isStopped: () => boolean, setFinish: (f: () => void) => void): Promise<ListenResult> {
  try {
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) return { text: '', language: null, error: 'unsupported' };
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return { text: '', language: null, error: 'denied' };
  } catch { return { text: '', language: null, error: 'unsupported' }; }
  return new Promise<ListenResult>((resolve) => {
    let finalText = '', done = false;
    const subs: { remove: () => void }[] = [];
    const end = (r: ListenResult) => { if (done) return; done = true; subs.forEach((s) => s.remove()); cb.onLevel?.(0); resolve(r); };
    setFinish(() => { try { ExpoSpeechRecognitionModule.stop(); } catch {} });
    subs.push(ExpoSpeechRecognitionModule.addListener('start', () => cb.onReady?.()));
    subs.push(ExpoSpeechRecognitionModule.addListener('volumechange', (e: any) => cb.onLevel?.(Math.max(0, Math.min(1, ((e?.value ?? -2) + 2) / 12)))));
    subs.push(ExpoSpeechRecognitionModule.addListener('result', (e: any) => {
      const t = e?.results?.[0]?.transcript || '';
      if (e?.isFinal) finalText = t; else cb.onPartial?.(t);
      if (e?.isFinal) end({ text: t.trim(), language: lang, error: t.trim() ? undefined : 'no-speech' });
    }));
    subs.push(ExpoSpeechRecognitionModule.addListener('error', (e: any) => {
      const code = String(e?.error || '');
      end({ text: '', language: null, error: code === 'not-allowed' ? 'denied' : code === 'network' ? 'network' : code === 'no-speech' || code === 'speech-timeout' ? 'no-speech' : 'stt-failed' });
    }));
    subs.push(ExpoSpeechRecognitionModule.addListener('end', () => end({ text: finalText.trim(), language: lang, error: finalText.trim() ? undefined : 'no-speech' })));
    try {
      ExpoSpeechRecognitionModule.start({ lang: lang === 'hi' ? 'hi-IN' : 'en-IN', interimResults: true, continuous: false, volumeChangeEventOptions: { enabled: true, intervalMillis: 100 } });
    } catch { end({ text: '', language: null, error: 'unsupported' }); }
    if (isStopped()) { try { ExpoSpeechRecognitionModule.stop(); } catch {} }
  });
}

// ── speaking ────────────────────────────────────────────────────────
let player: AudioPlayer | null = null;
let speakingToken = 0;
export function stopSpeaking() {
  speakingToken++;
  try { player?.pause(); player?.remove(); } catch {}
  player = null;
  Speech.stop().catch(() => {});
}

/** Text that sounds right when read aloud (no markdown, no emoji, ₹ read as rupees). */
export function cleanForSpeech(s: string) {
  return String(s || '')
    .replace(/```[\s\S]*?```/g, ' ').replace(/\*\*|__|`|#+\s/g, '').replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/^\s*[-•*]\s+/gm, '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\n{3,}/g, '\n\n').trim();
}

/** Speak and resolve when finished. onProgress(0..1) lets the UI follow along. */
export async function speak(text: string, lang: VoiceLang, onProgress?: (r: number) => void): Promise<void> {
  stopSpeaking();
  const my = ++speakingToken;
  const clean = cleanForSpeech(text).slice(0, 1800);
  if (!clean) return;
  await playMode();
  const st = await voiceStatus();
  const human = (lang === 'hi' ? st.ttsHi : st.tts) !== 'browser';
  if (human) {
    const buf = await apiBinary('/voice/tts', { text: clean, lang });
    if (my !== speakingToken) return;
    if (buf && buf.byteLength > 500) {
      try {
        const f = new File(Paths.cache, `pw-tts-${Date.now()}.mp3`);
        f.create({ overwrite: true });
        f.write(new Uint8Array(buf));
        await new Promise<void>((resolve) => {
          const p = createAudioPlayer({ uri: f.uri });
          player = p;
          let finished = false;
          const done = () => { if (finished) return; finished = true; try { sub.remove(); } catch {} try { p.remove(); } catch {} try { f.delete(); } catch {} if (player === p) player = null; resolve(); };
          const sub = p.addListener('playbackStatusUpdate', (s: any) => {
            if (my !== speakingToken) { done(); return; }
            if (s?.duration > 0) onProgress?.(Math.min(1, (s.currentTime || 0) / s.duration));
            if (s?.didJustFinish) done();
          });
          p.play();
          setTimeout(done, 90_000); // safety
        });
        return;
      } catch { /* fall through to device voice */ }
    }
  }
  if (my !== speakingToken) return;
  await new Promise<void>((resolve) => {
    let i = 0; const total = clean.length || 1;
    Speech.speak(clean, {
      language: lang === 'hi' ? 'hi-IN' : 'en-IN', rate: 1.0, pitch: 1.0,
      onBoundary: (e: any) => { i = e?.charIndex ?? i; onProgress?.(Math.min(1, i / total)); },
      onDone: () => resolve(), onStopped: () => resolve(), onError: () => resolve(),
    });
  });
}

export { AudioModule };
