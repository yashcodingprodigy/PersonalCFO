// Which language should PayWatch answer in? The one the user just used.
// Devanagari → Hindi. Latin script → English, unless it's clearly Hinglish
// ("mujhe bike chahiye", "kitna invest karu") → Hindi. Numbers/emoji only → fallback.
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

export function detectReplyLang(text: string, fallback: ReplyLang = 'en'): ReplyLang {
  const s = String(text || '');
  if (/[ऀ-ॿ]/.test(s)) return 'hi';
  const words = s.toLowerCase().match(/[a-z]+/g) || [];
  if (!words.length) return fallback;
  let strong = 0, weak = 0;
  for (const w of words) if (HINGLISH.has(w)) (AMBIGUOUS.has(w) ? weak++ : strong++);
  const score = strong + weak * 0.5;
  if (strong >= 2 || (strong >= 1 && score / words.length >= 0.25)) return 'hi';
  // A word or two with no Hinglish ("SIP?", "term plan") doesn't tell us much — keep the app language.
  if (words.length <= 2) return fallback;
  return 'en';
}
