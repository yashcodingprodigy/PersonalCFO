// Which language should PayWatch answer in? (D-57 — the app language is the default; only an
// unmistakable switch overrides it.)
//  • App in English → English. Only Hindi typed/spoken in Devanagari switches the reply to Hindi.
//    (Hinglish typed in Latin letters gets an English reply — the user chose English for the app.)
//  • App in Hindi → Hindi, unless the message is clearly plain English (3+ words, no Hinglish).
//  • Numbers/emoji/one-word messages → the app language.
export type ReplyLang = 'en' | 'hi';

const HINGLISH = new Set([
  'hai', 'hain', 'ho', 'hoga', 'hogi', 'tha', 'thi', 'mujhe', 'mujhko', 'mera', 'meri', 'mere', 'main', 'mai', 'hum', 'humein', 'hamara',
  'aap', 'aapka', 'aapki', 'tum', 'tumhara', 'kya', 'kyu', 'kyun', 'kaise', 'kitna', 'kitni', 'kitne', 'kab', 'kahan', 'kaun', 'konsa',
  'chahiye', 'chahta', 'chahti', 'karna', 'karo', 'karu', 'karun', 'kar', 'karke', 'kardo', 'batao', 'bata', 'dikhao', 'dikha', 'lena', 'leni',
  'jana', 'jaana', 'paisa', 'paise', 'paiso', 'bachat', 'kharcha', 'kharch', 'naya', 'nayi', 'acha', 'accha', 'achha', 'theek', 'thik',
  'nahi', 'nahin', 'haan', 'bhi', 'aur', 'ya', 'se', 'ko', 'ka', 'ki', 'ke', 'mein', 'liye', 'abhi', 'sakta', 'sakti', 'sakte', 'wala', 'wali',
  'saal', 'mahina', 'mahine', 'lakh', 'hazaar', 'hazar', 'bahut', 'zyada', 'kam', 'sapna', 'sapne', 'ghar', 'gaadi', 'gadi',
]);
// Words shared with English that shouldn't count on their own.
const AMBIGUOUS = new Set(['main', 'ho', 'ya', 'se', 'ko', 'ka', 'ki', 'ke', 'kam', 'bhi', 'aur', 'kar']);

/** True when the text is mostly Hinglish (Hindi written in Latin letters). */
export function isHinglish(text: string): boolean {
  const words = String(text || '').toLowerCase().match(/[a-z]+/g) || [];
  if (!words.length) return false;
  let strong = 0, weak = 0;
  for (const w of words) if (HINGLISH.has(w)) (AMBIGUOUS.has(w) ? weak++ : strong++);
  const score = strong + weak * 0.5;
  return strong >= 2 || (strong >= 1 && score / words.length >= 0.2);
}

export function detectReplyLang(text: string, appLang: ReplyLang = 'en'): ReplyLang {
  const s = String(text || '');
  if (/[ऀ-ॿ]/.test(s)) return 'hi';             // Devanagari is an unmistakable choice of Hindi
  if (appLang === 'en') return 'en';            // English app: Latin-script messages always get English
  const words = s.toLowerCase().match(/[a-z]+/g) || [];
  if (words.length >= 3 && !isHinglish(s)) return 'en';   // Hindi app, but a clearly English sentence
  return 'hi';
}

/** Share of letters that are Devanagari (0..1) — used to check a reply came out in the right language. */
export function devanagariShare(text: string): number {
  const letters = String(text || '').match(/[A-Za-zऀ-ॿ]/g) || [];
  if (!letters.length) return 0;
  return letters.filter((c) => /[ऀ-ॿ]/.test(c)).length / letters.length;
}

/** Does this reply match the language we asked for? (Hindi replies keep English terms like SIP/EMI, so the bar is low.) */
export function replyMatches(text: string, lang: ReplyLang): boolean {
  const d = devanagariShare(text);
  return lang === 'hi' ? d >= 0.3 : d <= 0.05;
}
