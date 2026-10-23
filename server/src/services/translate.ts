// Translation service — English UI/engine text → Hindi, cached forever in the
// shared `translations` table (one translation per unique string, for everyone),
// plus an in-memory cache. Uses Claude when ANTHROPIC_API_KEY is set; otherwise
// returns the original text (the app keeps working in English).
import crypto from 'crypto';
import { config } from '../config';
import { query } from '../db';

const mem = new Map<string, string>();               // `${lang}:${hash}` → text
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
// Strings not worth translating: numbers, currency, codes, very short tokens.
const skip = (s: string) => !/[A-Za-z]{2,}/.test(s) || s.length > 2000;

export const translationAvailable = () => !!config.anthropicApiKey;

export async function translateTexts(texts: string[], lang: string): Promise<string[]> {
  if (lang !== 'hi' || !texts.length) return texts;
  const out = texts.slice();
  const todo: { i: number; h: string; s: string }[] = [];
  for (let i = 0; i < texts.length; i++) {
    const s = (texts[i] || '').trim();
    if (!s || skip(s)) continue;
    const h = hash(s);
    const hit = mem.get(`${lang}:${h}`);
    if (hit) out[i] = texts[i].replace(s, hit); else todo.push({ i, h, s });
  }
  if (!todo.length) return out;

  // DB cache
  try {
    const rows = await query<{ src_hash: string; dst: string }>(`SELECT src_hash, dst FROM translations WHERE lang = $1 AND src_hash = ANY($2::text[])`, [lang, [...new Set(todo.map((t) => t.h))]]);
    const byHash = new Map(rows.map((r) => [r.src_hash, r.dst]));
    for (const t of todo) { const d = byHash.get(t.h); if (d) { mem.set(`${lang}:${t.h}`, d); out[t.i] = texts[t.i].replace(t.s, d); } }
  } catch { /* cache table optional */ }
  const missing = todo.filter((t) => !mem.has(`${lang}:${t.h}`));
  if (!missing.length || !config.anthropicApiKey) return out;

  // Translate the misses in small parallel chunks (Hindi uses many tokens — one huge
  // call gets truncated and fails). Keyed JSON so a partial reply still saves what it can.
  const uniq = [...new Map(missing.map((t) => [t.h, t.s])).entries()];
  const chunks: [string, string][][] = [];
  for (let k = 0; k < uniq.length; k += 20) chunks.push(uniq.slice(k, k + 20));
  const runChunk = async (chunk: [string, string][]) => {
    const got = await callClaude(chunk.map(([, s]) => s));
    chunk.forEach(([h, s], k) => {
      const d = (got[k] || '').trim();
      if (!d || d === s) return;
      mem.set(`${lang}:${h}`, d);
      query(`INSERT INTO translations (src_hash, lang, src, dst) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [h, lang, s, d]).catch(() => {});
    });
  };
  for (let k = 0; k < chunks.length; k += 4) await Promise.all(chunks.slice(k, k + 4).map((c) => runChunk(c).catch(() => {})));
  for (const t of missing) { const d = mem.get(`${lang}:${t.h}`); if (d) out[t.i] = texts[t.i].replace(t.s, d); }
  return out;
}

const SYS = `You translate English text from an Indian personal-finance app into natural, simple everyday Hindi (Devanagari) that a young Indian would actually say — warm and clear, not formal/sarkari Hindi. Keep ₹ amounts, numbers, dates, %, and these terms exactly as written: PayWatch, SIP, EMI, ITR, PAN, UPI, CA, KYC, GST, TDS, HRA, NPS, EPF, PPF, ELSS, 80C, 80D, AI. Keep markdown (**bold**, bullets), emoji and punctuation. Similar length or shorter.
Input is a JSON object of id → English. Return ONLY a JSON object with the same ids → Hindi. No commentary.`;

let lastError = '';
export const translationStatus = () => ({ available: translationAvailable(), model: config.translateModel, lastError });

/** One Claude call for up to ~20 strings. Returns translations by index ('' when missing). */
async function callClaude(src: string[]): Promise<string[]> {
  const input: Record<string, string> = {};
  src.forEach((s, i) => { input[String(i)] = s; });
  const models = [config.translateModel, config.anthropicModel].filter((m, i, a) => m && a.indexOf(m) === i);
  for (const model of models) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': config.anthropicApiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 8000, system: SYS, messages: [{ role: 'user', content: JSON.stringify(input) }] }),
      });
      if (!res.ok) { lastError = `${model}: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`; console.warn('[translate]', lastError); continue; }
      const data: any = await res.json();
      const text: string = data.content?.[0]?.text || '';
      const start = text.indexOf('{');
      if (start < 0) { lastError = `${model}: no JSON in reply`; continue; }
      const end = text.lastIndexOf('}');
      const raw = end > start ? text.slice(start, end + 1) : text.slice(start);
      let obj: Record<string, string> = {};
      try { obj = JSON.parse(raw); } catch {
        // truncated reply → salvage complete "id": "text" pairs
        for (const mm of raw.matchAll(/"(\d+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) { try { obj[mm[1]] = JSON.parse(`"${mm[2]}"`); } catch {} }
      }
      lastError = '';
      return src.map((_, i) => String(obj[String(i)] ?? ''));
    } catch (e: any) { lastError = `${model}: ${e.message}`; console.warn('[translate]', lastError); }
  }
  return src.map(() => '');
}
