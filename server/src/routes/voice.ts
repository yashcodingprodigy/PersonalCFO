// /v1/voice — human-sounding voice for PayWatch: English via ElevenLabs, Hindi via Sarvam AI
// (native Indian voices) or an auto-picked native-Hindi ElevenLabs voice.
//   GET  /voice/status → which engines are live (client falls back to the browser's own voice/recogniser)
//   POST /voice/tts    → { text, lang } → audio/mpeg (ElevenLabs multilingual TTS; cached)
//   POST /voice/stt    → { audio: base64, mime, lang? } → { text, language } (ElevenLabs Scribe)
// The API key never reaches the browser. Without ELEVENLABS_API_KEY both endpoints
// answer 503 and the app uses the device's built-in voice — nothing breaks.
import { Router } from 'express';
import crypto from 'crypto';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { config } from '../config';

export const voiceRouter = Router();
voiceRouter.use(requireAuth);

const live = () => !!config.elevenLabsKey;
const hiProvider = () => (config.sarvamKey ? 'sarvam' : live() ? 'elevenlabs' : 'browser');
voiceRouter.get('/status', (_req, res) => {
  res.json({
    tts: live() ? 'elevenlabs' : 'browser',           // English voice
    ttsHi: hiProvider(),                                  // Hindi voice (Sarvam = native Indian accent)
    stt: live() ? 'elevenlabs' : 'browser',
    languages: ['en', 'hi'],
  });
});

// Small in-memory LRU so repeated phrases ("Here's your plan…") are free and instant.
const cache = new Map<string, Buffer>();
const MAX_CACHE = 200;
function remember(k: string, v: Buffer) { cache.set(k, v); if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string); }

export function speakableText(raw: string): string {
  return String(raw || '')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')        // markdown links
    .replace(/[*_#`>|]/g, ' ')                  // markdown symbols
    .replace(/^\s*[-•]\s+/gm, '')               // bullets
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
}

// ── Hindi voice on ElevenLabs: use the configured one, or auto-pick a native Hindi
// speaker from the public Voice Library once and add it to the account. ─────────
let hiVoicePromise: Promise<string | null> | null = null;
const HI_NAME = 'PayWatch Hindi';
async function resolveHindiVoice(): Promise<string | null> {
  if (config.elevenVoiceHi) return config.elevenVoiceHi;
  if (!live()) return null;
  if (!hiVoicePromise) hiVoicePromise = (async () => {
    const H = { 'xi-api-key': config.elevenLabsKey };
    try {
      const mine: any = await (await fetch('https://api.elevenlabs.io/v1/voices', { headers: H })).json();
      const existing = (mine?.voices || []).find((v: any) => v?.name === HI_NAME);
      if (existing?.voice_id) return existing.voice_id as string;
      const lib: any = await (await fetch('https://api.elevenlabs.io/v1/shared-voices?language=hi&page_size=30', { headers: H })).json();
      const voices: any[] = (lib?.voices || []).filter((v: any) => v?.voice_id && v?.public_owner_id);
      const score = (v: any) => (/conversational|social|narrat|friendly|warm/i.test(`${v.use_case} ${v.descriptive} ${v.description}`) ? 2 : 0)
        + (/standard|indian|hindi/i.test(String(v.accent)) ? 1 : 0) + Math.min(2, (Number(v.cloned_by_count) || 0) / 5000);
      const pick = voices.sort((a, b) => score(b) - score(a))[0];
      if (!pick) return null;
      const added: any = await (await fetch(`https://api.elevenlabs.io/v1/voices/add/${encodeURIComponent(pick.public_owner_id)}/${encodeURIComponent(pick.voice_id)}`, {
        method: 'POST', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({ new_name: HI_NAME }),
      })).json();
      if (added?.voice_id) console.log('[voice] Hindi voice added from library:', pick.name, added.voice_id);
      return (added?.voice_id as string) || null;
    } catch (e: any) { console.warn('[voice] Hindi voice lookup failed', e?.message); return null; }
  })();
  const v = await hiVoicePromise;
  if (!v) hiVoicePromise = null; // retry later
  return v;
}

async function sarvamTts(text: string): Promise<Buffer | null> {
  try {
    const r = await fetch('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': config.sarvamKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.slice(0, 2400), language_code: 'hi-IN', model: config.sarvamTtsModel,
        speaker: config.sarvamSpeakerHi, pace: 1.0, speech_sample_rate: 24000, output_audio_codec: 'mp3',
      }),
    });
    if (!r.ok) { console.error('[voice] sarvam tts failed', r.status, (await r.text().catch(() => '')).slice(0, 300)); return null; }
    const j: any = await r.json();
    const b64 = j?.audios?.[0];
    return b64 ? Buffer.from(String(b64), 'base64') : null;
  } catch (e: any) { console.error('[voice] sarvam tts error', e?.message); return null; }
}

async function elevenTts(text: string, voice: string, lang: 'en' | 'hi'): Promise<Buffer | null> {
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': config.elevenLabsKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: config.elevenTtsModel,
        // only the v2.5 family accepts an explicit language code; multilingual v2 detects it from the text
        ...(lang === 'hi' && /2_5/.test(config.elevenTtsModel) ? { language_code: 'hi' } : {}),
        // Lower stability + some style = more expressive, human delivery (less flat/robotic).
        voice_settings: { stability: 0.35, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true },
      }),
    });
    if (!r.ok || !r.body) { console.error('[voice] tts failed', r.status, await r.text().catch(() => '')); return null; }
    return Buffer.from(await r.arrayBuffer());
  } catch (e: any) { console.error('[voice] tts error', e?.message); return null; }
}

voiceRouter.post('/tts', rateLimit({ windowMs: 60_000, max: 40, keyPrefix: 'tts' }), async (req: AuthedRequest, res) => {
  const text = speakableText(req.body?.text);
  if (!text) return res.status(400).json({ error: 'invalid_input' });
  const lang: 'en' | 'hi' = req.body?.lang === 'hi' || /[\u0900-\u097F]/.test(text) ? 'hi' : 'en';
  if (lang === 'en' && !live()) return res.status(503).json({ error: 'tts_unavailable' });
  if (lang === 'hi' && hiProvider() === 'browser') return res.status(503).json({ error: 'tts_unavailable' });

  let audio: Buffer | null = null, tag = '';
  const fromCache = (k: string) => cache.get(k) || null;
  if (lang === 'hi' && config.sarvamKey) {
    tag = crypto.createHash('sha1').update(`sarvam|${config.sarvamSpeakerHi}|${text}`).digest('hex');
    audio = fromCache(tag) || await sarvamTts(text);
  }
  if (!audio && live()) {
    const voice = lang === 'hi' ? ((await resolveHindiVoice()) || config.elevenVoiceEn) : config.elevenVoiceEn;
    tag = crypto.createHash('sha1').update(`${voice}|${config.elevenTtsModel}|${text}`).digest('hex');
    audio = fromCache(tag) || await elevenTts(text, voice, lang);
  }
  if (!audio) return res.status(502).json({ error: 'tts_failed' });
  remember(tag, audio);
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.end(audio);
});

voiceRouter.post('/stt', rateLimit({ windowMs: 60_000, max: 30, keyPrefix: 'stt' }), async (req: AuthedRequest, res) => {
  if (!live()) return res.status(503).json({ error: 'stt_unavailable' });
  const b64 = String(req.body?.audio || '');
  if (!b64 || b64.length > 8_000_000) return res.status(400).json({ error: 'invalid_audio' });
  const mime = String(req.body?.mime || 'audio/webm').slice(0, 40);
  try {
    const bytes = Buffer.from(b64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    const form = new FormData();
    form.append('model_id', config.elevenSttModel);
    form.append('file', new Blob([bytes], { type: mime }), `speech.${mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm'}`);
    if (req.body?.lang === 'hi' || req.body?.lang === 'en') form.append('language_code', req.body.lang === 'hi' ? 'hin' : 'eng');
    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': config.elevenLabsKey }, body: form });
    if (!r.ok) {
      console.error('[voice] stt failed', r.status, await r.text().catch(() => ''));
      return res.status(502).json({ error: 'stt_failed' });
    }
    const j: any = await r.json();
    const lc = String(j.language_code || '').toLowerCase();
    res.json({ text: String(j.text || '').trim(), language: lc.startsWith('hi') ? 'hi' : lc.startsWith('en') ? 'en' : lc || null });
  } catch (e: any) {
    console.error('[voice] stt error', e?.message);
    res.status(502).json({ error: 'stt_failed' });
  }
});
