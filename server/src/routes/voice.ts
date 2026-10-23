// /v1/voice — human-sounding voice for PayWatch (ElevenLabs), English + Hindi.
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
voiceRouter.get('/status', (_req, res) => {
  res.json({ tts: live() ? 'elevenlabs' : 'browser', stt: live() ? 'elevenlabs' : 'browser', languages: ['en', 'hi'] });
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

voiceRouter.post('/tts', rateLimit({ windowMs: 60_000, max: 40, keyPrefix: 'tts' }), async (req: AuthedRequest, res) => {
  if (!live()) return res.status(503).json({ error: 'tts_unavailable' });
  const text = speakableText(req.body?.text);
  if (!text) return res.status(400).json({ error: 'invalid_input' });
  const lang = req.body?.lang === 'hi' ? 'hi' : 'en';
  const voice = lang === 'hi' ? config.elevenVoiceHi : config.elevenVoiceEn;
  const key = crypto.createHash('sha1').update(`${voice}|${config.elevenTtsModel}|${text}`).digest('hex');
  const hit = cache.get(key);
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  if (hit) return res.end(hit);
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}/stream?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': config.elevenLabsKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: config.elevenTtsModel,
        ...(lang === 'hi' ? { language_code: 'hi' } : {}),
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
      }),
    });
    if (!r.ok || !r.body) {
      console.error('[voice] tts failed', r.status, await r.text().catch(() => ''));
      return res.status(502).json({ error: 'tts_failed' });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    remember(key, buf);
    res.end(buf);
  } catch (e: any) {
    console.error('[voice] tts error', e?.message);
    if (!res.headersSent) res.status(502).json({ error: 'tts_failed' });
  }
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
