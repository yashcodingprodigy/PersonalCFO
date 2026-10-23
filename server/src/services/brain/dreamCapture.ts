// Dream capture — the brain hears a dream anywhere (chat, voice, onboarding) and
// turns it into a planned dream automatically. No forms, no "target amount"
// required: if the user doesn't say a price, the brain estimates a sensible one
// (clearly marked "estimated — edit anytime"). English, Hindi and Hinglish.
//
// Pure parsing here (`detectDream`); persistence lives in `captureDream` (DB).

import { Lang } from './i18n';
import { DreamKind } from './dreams';

export interface DetectedDream {
  name: string;
  kind: DreamKind;
  goalType: string;
  amount: number;          // paise
  estimated: boolean;      // true when the user didn't state a price
  months: number;          // horizon
  inflation: number;
}

const INTENT = new RegExp([
  "\\bi\\s*(?:really\\s+)?(?:want|wanna|wish|hope|plan|am planning|'?m planning|'?d love|would love|dream)\\b",
  '\\bmy\\s+(?:dream|goal|plan)\\b', '\\bsav(?:e|ing)\\s+(?:up\\s+)?for\\b', '\\bsomeday\\b', '\\bone day\\b',
  '\\bplanning\\s+(?:a|to|for)\\b', '\\bneed\\s+to\\s+buy\\b',
  // Hinglish
  '\\b(?:jaana|jana|lena|leni|kharidna|karna|banana)\\s+hai\\b', '\\bchah(?:ta|ti|te)\\b', '\\bsapna\\b',
  // Hindi (Devanagari)
  'चाहता', 'चाहती', 'चाहते', 'सपना', 'जाना है', 'लेना है', 'खरीदना है', 'खरीदनी है', 'करना है',
].join('|'), 'i');

interface CatalogItem { re: RegExp; en: string; hi: string; kind: DreamKind; goalType: string; rupees: number; months: number; inflation: number }
// Rough Indian price points for a first estimate (paise computed below). Order matters: specific first.
const CATALOG: CatalogItem[] = [
  { re: /europe|paris|london|switzerland|usa|america|japan|tokyo|australia|new york|यूरोप|अमेरिका|जापान/i, en: 'International trip', hi: 'विदेश यात्रा', kind: 'experience', goalType: 'custom', rupees: 250000, months: 12, inflation: 0.05 },
  { re: /bali|thailand|bangkok|dubai|singapore|maldives|vietnam|seoul|korea|sri lanka|nepal|bhutan|abroad|international|बाली|थाईलैंड|दुबई|विदेश/i, en: 'Trip abroad', hi: 'विदेश यात्रा', kind: 'experience', goalType: 'custom', rupees: 150000, months: 12, inflation: 0.05 },
  { re: /goa|manali|ladakh|leh|kerala|kashmir|rishikesh|udaipur|jaipur|shimla|ooty|andaman|गोवा|मनाली|लद्दाख|केरल/i, en: 'Trip', hi: 'यात्रा', kind: 'experience', goalType: 'custom', rupees: 50000, months: 6, inflation: 0.05 },
  { re: /\b(?:trip|vacation|holiday|travel|yatra|ghum(?:ne|na))\b|यात्रा|घूमने|छुट्टी/i, en: 'Trip', hi: 'यात्रा', kind: 'experience', goalType: 'custom', rupees: 50000, months: 6, inflation: 0.05 },
  { re: /\b(?:house|home|flat|apartment|ghar)\b|घर|फ्लैट|मकान/i, en: 'Home down payment', hi: 'घर का डाउन पेमेंट', kind: 'purchase', goalType: 'home_purchase', rupees: 1500000, months: 60, inflation: 0.06 },
  { re: /\b(?:car|gaadi|gadi)\b|कार|गाड़ी/i, en: 'Car', hi: 'कार', kind: 'purchase', goalType: 'car_purchase', rupees: 800000, months: 36, inflation: 0.04 },
  { re: /\b(?:bike|scooter|activa|scooty|motorcycle|royal enfield|bullet)\b|बाइक|स्कूटर/i, en: 'Bike', hi: 'बाइक', kind: 'purchase', goalType: 'car_purchase', rupees: 120000, months: 12, inflation: 0.04 },
  { re: /\b(?:wedding|marriage|shaadi|shadi)\b|शादी|विवाह/i, en: 'Wedding', hi: 'शादी', kind: 'family', goalType: 'custom', rupees: 1000000, months: 24, inflation: 0.06 },
  { re: /(?:parents?|mom|mother|dad|father|mummy|papa|maa)[^.]{0,30}(?:health|insurance|medical|cover)|माता-पिता|मम्मी|पापा|हेल्थ इंश्योरेंस/i, en: 'Parents’ health cover', hi: 'माता-पिता का हेल्थ कवर', kind: 'family', goalType: 'custom', rupees: 35000, months: 6, inflation: 0.1 },
  { re: /\b(?:emergency fund|safety net)\b|इमरजेंसी/i, en: 'Emergency fund', hi: 'इमरजेंसी फंड', kind: 'safety', goalType: 'emergency_fund', rupees: 0, months: 12, inflation: 0 },
  { re: /\b(?:mba|masters|ms abroad|course|certification|degree|coaching|upsc|cat prep)\b|कोर्स|पढ़ाई/i, en: 'Course', hi: 'कोर्स', kind: 'purchase', goalType: 'custom', rupees: 200000, months: 12, inflation: 0.08 },
  { re: /\b(?:caf[eé]|business|startup|shop|restaurant|bakery|dukaan|dukan)(?![a-z])|कैफ़े|बिज़नेस|दुकान/i, en: 'My own business', hi: 'मेरा अपना बिज़नेस', kind: 'milestone', goalType: 'custom', rupees: 500000, months: 36, inflation: 0.05 },
  { re: /\b(?:iphone|phone|mobile|smartphone|pixel|samsung)\b|फ़ोन|फोन|मोबाइल/i, en: 'New phone', hi: 'नया फ़ोन', kind: 'purchase', goalType: 'custom', rupees: 70000, months: 6, inflation: 0 },
  { re: /\b(?:laptop|macbook|computer|pc)\b|लैपटॉप/i, en: 'Laptop', hi: 'लैपटॉप', kind: 'purchase', goalType: 'custom', rupees: 90000, months: 6, inflation: 0 },
  { re: /\b(?:camera|dslr|gopro)\b|कैमरा/i, en: 'Camera', hi: 'कैमरा', kind: 'purchase', goalType: 'custom', rupees: 60000, months: 6, inflation: 0 },
  { re: /\b(?:ps5|playstation|xbox|console|gaming)\b/i, en: 'Gaming console', hi: 'गेमिंग कंसोल', kind: 'purchase', goalType: 'custom', rupees: 50000, months: 6, inflation: 0 },
  { re: /\b(?:concert|festival|coldplay|show)\b|कॉन्सर्ट/i, en: 'Concert', hi: 'कॉन्सर्ट', kind: 'experience', goalType: 'custom', rupees: 15000, months: 3, inflation: 0 },
  { re: /\b(?:jewel+ery|gold|necklace)\b|ज़ेवर|गहने|सोना/i, en: 'Jewellery', hi: 'गहने', kind: 'purchase', goalType: 'custom', rupees: 100000, months: 12, inflation: 0.05 },
  { re: /\b(?:retire|retirement)\b|रिटायर/i, en: 'Retirement', hi: 'रिटायरमेंट', kind: 'growth', goalType: 'retirement', rupees: 30000000, months: 360, inflation: 0.06 },
  { re: /\b(?:gift|birthday|anniversary)\b|तोहफ़ा|गिफ़्ट/i, en: 'A special gift', hi: 'एक ख़ास तोहफ़ा', kind: 'experience', goalType: 'custom', rupees: 20000, months: 3, inflation: 0 },
];

// ₹ amount in a sentence (₹, rs, k/thousand, lakh, crore; Hindi हज़ार/लाख/करोड़). Years are never amounts.
export function parseRupees(raw: string): number {
  const q = raw.toLowerCase().replace(/by\s+20\d{2}|in\s+20\d{2}|20\d{2}\s+(?:tak|में)/g, ' ').replace(/,/g, '');
  const num = '(\\d+(?:\\.\\d+)?)';
  const pick = (re: RegExp, mult: number) => { const m = q.match(re); return m ? Math.round(parseFloat(m[1]) * mult * 100) : 0; };
  return pick(new RegExp(`${num}\\s*(?:crores?|cr|करोड़)(?![a-z])`), 1e7)
    || pick(new RegExp(`${num}\\s*(?:l|lakh|lakhs|lac|lacs|लाख)(?![a-z])`), 1e5)
    || pick(new RegExp(`${num}\\s*(?:k|thousand|hazaar|hazar|हज़ार|हजार)(?![a-z])`), 1e3)
    || pick(/(?:₹|rs\.?\s*|inr\s*)(\d{3,})/, 1)
    || pick(/\b(\d{4,})\b/, 1);
}

// Horizon in months ("next year", "in 6 months", "by 2028", "agle saal", "अगले साल").
export function parseMonths(raw: string, now = new Date()): number | null {
  const q = raw.toLowerCase();
  const m = q.match(/(?:in|within|next)\s+(\d{1,2})\s*(?:months?|mahine|महीने)/) || q.match(/(\d{1,2})\s*(?:months?|mahine|महीने)\s*(?:me|mein|में)/);
  if (m) return Math.max(1, Math.min(120, parseInt(m[1], 10)));
  const y = q.match(/(?:in|within|next)\s+(\d{1,2})\s*(?:years?|yrs?|saal|साल)/) || q.match(/(\d{1,2})\s*(?:years?|saal|साल)\s*(?:me|mein|में)/);
  if (y) return Math.max(1, Math.min(120, parseInt(y[1], 10) * 12));
  if (/next year|agle saal|अगले साल/.test(q)) return 12;
  if (/this year|is saal|इस साल/.test(q)) return Math.max(1, 11 - now.getMonth());
  if (/next month|agle mahine|अगले महीने/.test(q)) return 1;
  const by = q.match(/(?:by|till|until|tak|तक)?\s*(20\d{2})/);
  if (by) return Math.max(1, Math.min(120, (parseInt(by[1], 10) - now.getFullYear()) * 12 + (11 - now.getMonth())));
  return null;
}

const PLACE = /\b(goa|manali|ladakh|kerala|kashmir|bali|thailand|dubai|singapore|maldives|vietnam|seoul|europe|paris|london|japan|tokyo|usa|america|australia|rishikesh|udaipur|jaipur|shimla|andaman)\b/i;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function detectDream(text: string, lang: Lang = 'en', now = new Date()): DetectedDream | null {
  if (!text || text.length > 400) return null;
  if (!INTENT.test(text)) return null;
  const item = CATALOG.find((c) => c.re.test(text));
  if (!item) return null;
  const stated = parseRupees(text);
  const months = parseMonths(text, now) ?? item.months;
  const place = text.match(PLACE)?.[1];
  let name = lang === 'hi' ? item.hi : item.en;
  if (place && item.kind === 'experience') name = lang === 'hi' ? `${cap(place)} ${item.hi}` : `${cap(place)} trip`;
  return {
    name, kind: item.kind, goalType: item.goalType,
    amount: stated > 0 ? stated : item.rupees * 100,
    estimated: stated <= 0,
    months, inflation: item.inflation,
  };
}

// Name of the thing mentioned (for "can I afford…?" labels), in the user's language.
export function catalogName(text: string, lang: Lang = 'en'): string | null {
  const item = CATALOG.find((c) => c.re.test(text));
  return item ? (lang === 'hi' ? item.hi : item.en.toLowerCase()) : null;
}
