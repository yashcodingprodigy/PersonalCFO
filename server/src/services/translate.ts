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

  // Translate the misses in one batch (deduped), capped per call.
  const uniq = [...new Map(missing.map((t) => [t.h, t.s])).entries()].slice(0, 120);
  try {
    const sys = `Translate each English string for an Indian personal-finance app into natural, simple everyday Hindi (Devanagari) that a young Indian would actually say. Keep ₹ amounts, numbers, dates, % and brand names (PayWatch, SIP, EMI, ITR, PAN, UPI, CA) exactly as they are. Keep markdown (**bold**, bullets) and punctuation structure. Keep it the same length or shorter. Return STRICT JSON: an array of strings in the same order, nothing else.`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': config.anthropicApiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: config.translateModel, max_tokens: 4000, system: sys, messages: [{ role: 'user', content: JSON.stringify(uniq.map(([, s]) => s)) }] }),
    });
    if (!res.ok) return out;
    const data: any = await res.json();
    const m = (data.content?.[0]?.text || '').match(/\[[\s\S]*\]/);
    const arr: string[] = m ? JSON.parse(m[0]) : [];
    if (!Array.isArray(arr) || arr.length !== uniq.length) return out;
    for (let k = 0; k < uniq.length; k++) {
      const [h, s] = uniq[k]; const d = String(arr[k] || '').trim();
      if (!d) continue;
      mem.set(`${lang}:${h}`, d);
      query(`INSERT INTO translations (src_hash, lang, src, dst) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [h, lang, s, d]).catch(() => {});
    }
    for (const t of missing) { const d = mem.get(`${lang}:${t.h}`); if (d) out[t.i] = texts[t.i].replace(t.s, d); }
  } catch { /* fall back to English */ }
  return out;
}
