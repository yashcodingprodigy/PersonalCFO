// Which language should PayWatch answer in? (D-57, refined D-58)
//  1. An explicit request wins: "reply in Hindi", "hindi mein batao", "in English please".
//  2. Hindi wins when the user actually speaks/writes Hindi — in Devanagari, or Hindi in Latin letters
//     (device speech recognition often writes spoken Hindi that way: "mujhe goa jana hai").
//  3. A language the user asked for earlier in this conversation sticks (until they ask otherwise).
//  4. Otherwise the app language: English app → English; Hindi app → Hindi unless clearly plain English.
export type ReplyLang = 'en' | 'hi';

const HINGLISH = new Set([
  'hai', 'hain', 'ho', 'hoga', 'hogi', 'tha', 'thi', 'mujhe', 'mujhko', 'mera', 'meri', 'mere', 'main', 'mai', 'hum', 'humein', 'hamara',
  'aap', 'aapka', 'aapki', 'tum', 'tumhara', 'kya', 'kyu', 'kyun', 'kaise', 'kitna', 'kitni', 'kitne', 'kab', 'kahan', 'kaun', 'konsa',
  'chahiye', 'chahta', 'chahti', 'karna', 'karo', 'karu', 'karun', 'kar', 'karke', 'kardo', 'batao', 'bata', 'dikhao', 'dikha', 'lena', 'leni',
  'jana', 'jaana', 'paisa', 'paise', 'paiso', 'bachat', 'kharcha', 'kharch', 'naya', 'nayi', 'acha', 'accha', 'achha', 'theek', 'thik',
  'nahi', 'nahin', 'haan', 'bhi', 'aur', 'ya', 'se', 'ko', 'ka', 'ki', 'ke', 'mein', 'liye', 'abhi', 'sakta', 'sakti', 'sakte', 'wala', 'wali',
  'saal', 'mahina', 'mahine', 'lakh', 'hazaar', 'hazar', 'bahut', 'zyada', 'kam', 'sapna', 'sapne', 'ghar', 'gaadi', 'gadi',
  'hun', 'hoon', 'hu', 'raha', 'rahi', 'rahe', 'karta', 'karti', 'karte', 'sahi', 'galat', 'kuch', 'sab', 'kyunki', 'lekin', 'agar', 'toh',
  'yaar', 'bhai', 'chalo', 'achchha', 'samjhao', 'samjha', 'bolo', 'suno', 'jaldi', 'kaisa', 'kaisi', 'kidhar', 'idhar', 'udhar', 'wahan', 'yahan',
  'humko', 'tumko', 'unko', 'isko', 'usko', 'kitna', 'kharidna', 'kharid', 'bachana', 'bachaun', 'chahiye', 'milega', 'milegi', 'hoga', 'sakta',
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

/** "reply in Hindi" / "hindi mein bolo" / "in English please" → that language; otherwise null. */
export function explicitLang(text: string): ReplyLang | null {
  const q = String(text || '');
  const hi = /\b(in|into|to)\s+hindi\b|\bhindi\s*(me|mein|mai|main|mei)\b|\b(talk|speak|reply|answer|respond|baat|bolo|bol)\b[^.?!]{0,20}\bhindi\b|switch to hindi|हिंदी में|हिन्दी में|हिंदी मे/i.test(q);
  const en = /\b(in|into|to)\s+english\b|\benglish\s*(me|mein|mai|main|mei)\b|\b(talk|speak|reply|answer|respond|baat|bolo|bol)\b[^.?!]{0,20}\benglish\b|switch to english|अंग्रेज़ी में|अंग्रेजी में|इंग्लिश में/i.test(q);
  if (hi && !en) return 'hi';
  if (en && !hi) return 'en';
  return null;
}

/** The last language the user explicitly asked for in this conversation (most recent first). */
export function stickyLang(userMessages: string[]): ReplyLang | null {
  for (let i = userMessages.length - 1; i >= 0; i--) { const l = explicitLang(userMessages[i]); if (l) return l; }
  return null;
}

export function detectReplyLang(text: string, appLang: ReplyLang = 'en', sticky: ReplyLang | null = null): ReplyLang {
  const s = String(text || '');
  const ex = explicitLang(s);
  if (ex) return ex;                            // 1. asked for a language
  if (/[ऀ-ॿ]/.test(s)) return 'hi';             // 2. Hindi in Devanagari
  if (isHinglish(s)) return 'hi';               //    Hindi in Latin letters (typed or device speech-to-text)
  if (sticky) return sticky;                    // 3. asked earlier in this conversation
  if (appLang === 'en') return 'en';            // 4. English app
  const words = s.toLowerCase().match(/[a-z]+/g) || [];
  if (words.length >= 3) return 'en';           //    Hindi app, but a clearly English sentence
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
