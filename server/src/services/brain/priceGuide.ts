// Price guide — "what does this dream usually cost?" while the user is still typing.
// Layer 1: a built-in Indian price table (works with no AI key, instant).
// Layer 2: Claude (fast model) for anything the table doesn't know, or to refine it.
// Every number is an approximate planning range — never a quote. Amounts in paise.

import { config } from '../../config';

export interface PriceOption { label: string; amount: number; note?: string }
export interface PriceGuide {
  found: boolean;
  item: string;            // what we think the dream is ("2BHK flat")
  location?: string;       // place we detected ("South Mumbai")
  options: PriceOption[];  // tap one to fill the cost
  low: number; typical: number; high: number;
  basis: string;           // one line on how it was estimated
  source: 'table' | 'ai';
  disclaimer: string;
}

const R = (rupees: number) => Math.round(rupees) * 100;
const round = (rupees: number) => {
  const step = rupees >= 1e7 ? 1e6 : rupees >= 1e6 ? 1e5 : rupees >= 1e5 ? 10000 : rupees >= 10000 ? 1000 : 500;
  return Math.round(rupees / step) * step;
};
const DISCLAIMER = 'Approximate planning ranges based on typical prices — not a quote. Check current prices before you commit.';
const lakhIN = (r: number) => `₹${round(r).toLocaleString('en-IN')}`;

// ── property: ₹ per sq ft by place (approximate 2025–26 ranges) ──────────────
const PLACES: { re: RegExp; name: string; psf: [number, number, number] }[] = [
  { re: /south (bombay|mumbai)|\bsobo\b|colaba|malabar hill|cuffe parade|breach candy|nariman point|tardeo|worli|lower parel|prabhadevi/i, name: 'South Mumbai', psf: [45000, 65000, 100000] },
  { re: /bandra|juhu|khar|santacruz|powai/i, name: 'Mumbai western suburbs (prime)', psf: [30000, 42000, 60000] },
  { re: /navi mumbai|thane|kalyan|panvel|mira road|vasai|virar/i, name: 'Thane / Navi Mumbai', psf: [8000, 13000, 20000] },
  { re: /mumbai|bombay|andheri|goregaon|malad|borivali|chembur|mulund/i, name: 'Mumbai suburbs', psf: [16000, 24000, 35000] },
  { re: /south delhi|vasant vihar|greater kailash|\bgk\b|defence colony|golf links/i, name: 'South Delhi', psf: [25000, 35000, 55000] },
  { re: /gurgaon|gurugram|noida|greater noida|ghaziabad|faridabad|delhi|ncr/i, name: 'Delhi NCR', psf: [7000, 11000, 18000] },
  { re: /indiranagar|koramangala|jayanagar|sadashivanagar|whitefield|hsr layout|bangalore|bengaluru/i, name: 'Bengaluru', psf: [7000, 10500, 18000] },
  { re: /hyderabad|gachibowli|hitec|banjara|jubilee hills|secunderabad/i, name: 'Hyderabad', psf: [6000, 8500, 14000] },
  { re: /pune|chennai|kolkata/i, name: 'Pune / Chennai / Kolkata', psf: [5500, 8000, 13000] },
  { re: /ahmedabad|surat|jaipur|lucknow|chandigarh|indore|kochi|coimbatore|nagpur|bhopal|vadodara|mangalore|mangaluru|mysore|mysuru/i, name: 'Tier-2 city', psf: [3800, 5500, 8500] },
  { re: /manipal|udupi|village|town|hometown|gaon/i, name: 'Smaller town', psf: [2800, 4000, 6000] },
];
const BHK: Record<string, number> = { '1': 550, '2': 900, '3': 1350, '4': 1900 };

function propertyGuide(t: string): PriceGuide | null {
  if (!/\b(house|home|flat|apartment|bhk|villa|plot|ghar|makaan|मकान|घर|फ्लैट)\b/i.test(t) || /\b(rent|renovat|repair|paint|interior)\b/i.test(t)) return null;
  const place = PLACES.find((p) => p.re.test(t));
  const psf = place?.psf || [4000, 6000, 9000];
  const bhk = t.match(/([1-4])\s*-?\s*bhk/i)?.[1];
  const sizes = bhk ? [bhk] : ['1', '2', '3'];
  const options: PriceOption[] = sizes.map((b) => ({
    label: `${b}BHK (~${BHK[b]} sq ft)`, amount: R(round(BHK[b] * psf[1])),
    note: `${lakhIN(BHK[b] * psf[0])} – ${lakhIN(BHK[b] * psf[2])}`,
  }));
  const main = BHK[bhk || '2'] * psf[1];
  options.push({ label: 'Down payment (~20%)', amount: R(round(main * 0.2)), note: 'Banks usually lend ~75–80%; you need the rest + ~7% for stamp duty & registration' });
  const base = BHK[bhk || '2'];
  return {
    found: true, item: bhk ? `${bhk}BHK home` : 'A home', location: place?.name, options,
    low: R(round(base * psf[0])), typical: R(round(base * psf[1])), high: R(round(base * psf[2])),
    basis: `About ₹${psf[1].toLocaleString('en-IN')} per sq ft${place ? ` in ${place.name}` : ' (typical Indian city)'}.`,
    source: 'table', disclaimer: DISCLAIMER,
  };
}

// ── trips: per person, ~5 nights incl. travel ─────────────────────────────────
const INTL_FAR = /\b(europe|paris|london|switzerland|italy|usa|america|new york|canada|japan|tokyo|australia|new zealand|korea|seoul)\b/i;
const INTL_NEAR = /\b(bali|thailand|bangkok|phuket|vietnam|dubai|singapore|malaysia|maldives|sri lanka|nepal|bhutan|abroad|international|videsh|विदेश)\b/i;
const TRIP = /\b(trip|travel|vacation|holiday|tour|visit|ghoomna|ghumna|yatra|यात्रा|ट्रिप)\b/i;
function people(t: string): { n: number; who: string } {
  const m = t.match(/\b(\d{1,2})\s*(people|persons|friends|of us|log)\b/i);
  if (m) return { n: Math.max(1, Math.min(20, Number(m[1]))), who: `${m[1]} people` };
  if (/\b(couple|wife|husband|partner|girlfriend|boyfriend|honeymoon)\b/i.test(t)) return { n: 2, who: '2 people' };
  if (/\b(parents|mummy papa|mom and dad|maa papa)\b/i.test(t)) return { n: 3, who: 'you + parents' };
  if (/\b(family|parivar|परिवार)\b/i.test(t)) return { n: 4, who: 'a family of 4' };
  return { n: 1, who: 'per person' };
}
function tripGuide(t: string): PriceGuide | null {
  const far = INTL_FAR.test(t), near = INTL_NEAR.test(t);
  if (!TRIP.test(t) && !far && !near && !/\b(goa|manali|ladakh|kerala|kashmir|shimla|rishikesh|udaipur|andaman|coorg|ooty|darjeeling|meghalaya|sikkim|leh)\b/i.test(t)) return null;
  const tier = far ? [180000, 280000, 400000] : near ? [60000, 100000, 180000] : [15000, 30000, 60000];
  const p = people(t);
  const dest = (t.match(new RegExp(`${INTL_FAR.source}|${INTL_NEAR.source}|\\b(goa|manali|ladakh|kerala|kashmir|shimla|rishikesh|udaipur|andaman|coorg|ooty|darjeeling|meghalaya|sikkim|leh)\\b`, 'i')) || [])[0];
  const lbl = ['Budget', 'Comfortable', 'Premium'];
  return {
    found: true, item: `${dest ? dest[0].toUpperCase() + dest.slice(1).toLowerCase() + ' ' : ''}trip`, location: far ? 'Long-haul international' : near ? 'Short-haul international' : 'Within India',
    options: tier.map((x, i) => ({ label: `${lbl[i]} · ${p.who}`, amount: R(round(x * p.n)), note: p.n > 1 ? `${lakhIN(x)} per person` : undefined })),
    low: R(round(tier[0] * p.n)), typical: R(round(tier[1] * p.n)), high: R(round(tier[2] * p.n)),
    basis: `Flights/travel + ~5 nights stay + food & activities, ${p.n > 1 ? `for ${p.who}` : 'per person'}.`,
    source: 'table', disclaimer: DISCLAIMER,
  };
}

// ── fixed-price categories ───────────────────────────────────────────────────
const SIMPLE: { re: RegExp; item: string; opts: [string, number][]; basis: string }[] = [
  { re: /\b(car|gaadi|गाड़ी|कार|suv|sedan|hatchback|ev)\b/i, item: 'A car', basis: 'On-road price incl. registration & insurance.', opts: [['Hatchback', 750000], ['Sedan / compact SUV', 1200000], ['Mid-size SUV', 1900000], ['Premium SUV', 3200000]] },
  { re: /\b(bike|motorcycle|scooter|scooty|activa|royal enfield|bullet|ktm)\b/i, item: 'A two-wheeler', basis: 'On-road price.', opts: [['Scooter', 110000], ['Commuter bike', 100000], ['Royal Enfield-class', 230000], ['Premium / sports', 350000]] },
  { re: /\b(iphone|phone|mobile|smartphone|samsung|pixel|oneplus)\b/i, item: 'A phone', basis: 'Typical retail prices.', opts: [['Budget', 15000], ['Mid-range', 30000], ['Flagship Android', 75000], ['Latest iPhone', 90000]] },
  { re: /\b(laptop|macbook|computer|pc)\b/i, item: 'A laptop', basis: 'Typical retail prices.', opts: [['Everyday laptop', 45000], ['Performance laptop', 80000], ['MacBook Air', 110000], ['Gaming / pro', 160000]] },
  { re: /\b(wedding|shaadi|marriage|शादी)\b/i, item: 'A wedding', basis: 'Venue, food, clothes, jewellery & functions — varies hugely by city and guests.', opts: [['Simple (≈100 guests)', 600000], ['Mid-size (≈300 guests)', 1500000], ['Grand (500+ guests)', 3500000]] },
  { re: /\b(mba)\b/i, item: 'An MBA', basis: 'Total tuition; living costs extra.', opts: [['Tier-2 Indian college', 800000], ['Top Indian B-school', 2500000], ['MBA abroad', 6000000]] },
  { re: /\b(masters|ms abroad|study abroad|phd|degree)\b/i, item: 'Higher studies', basis: 'Tuition + living for the full course.', opts: [['India (2 years)', 400000], ['Germany / Ireland', 2000000], ['UK / Canada / Australia', 4000000], ['USA', 6000000]] },
  { re: /\b(course|certification|class|coaching|bootcamp|training)\b/i, item: 'A course', basis: 'Typical fees.', opts: [['Online certificate', 20000], ['Professional course', 80000], ['Bootcamp / diploma', 200000]] },
  { re: /\b(caf[eé]|restaurant|cloud kitchen|bakery|shop|store|business|startup|dukaan|dukan|franchise)\b/i, item: 'Your own business', basis: 'Setup: rent deposit, interiors, equipment, first 3–6 months of running costs.', opts: [['Kiosk / cart', 300000], ['Cloud kitchen / small shop', 700000], ['Small café', 1500000], ['Full restaurant', 4000000]] },
  { re: /\b(health (insurance|cover)|mediclaim|parents.{0,15}(insurance|cover|health))\b/i, item: 'Health cover', basis: 'Yearly premium for ₹5–10 lakh family floater; parents 60+ cost more.', opts: [['You (age < 30), ₹10L cover', 12000], ['Family floater, ₹10L', 25000], ['Parents 60+, ₹5–10L', 45000]] },
  { re: /\b(gold|jewell?ery|necklace|ring)\b/i, item: 'Gold / jewellery', basis: 'At roughly current gold rates; making charges extra.', opts: [['10 g gold', 75000], ['20 g gold', 150000], ['50 g gold', 375000]] },
  { re: /\b(tv|television|fridge|refrigerator|washing machine|ac|air conditioner)\b/i, item: 'Home appliance', basis: 'Typical retail prices.', opts: [['Basic', 20000], ['Mid-range', 40000], ['Premium', 80000]] },
];
function simpleGuide(t: string): PriceGuide | null {
  const s = SIMPLE.find((x) => x.re.test(t));
  if (!s) return null;
  const vals = s.opts.map(([, v]) => v);
  return {
    found: true, item: s.item, options: s.opts.map(([l, v]) => ({ label: l, amount: R(v) })),
    low: R(Math.min(...vals)), typical: R(vals[Math.floor(vals.length / 2)]), high: R(Math.max(...vals)),
    basis: s.basis, source: 'table', disclaimer: DISCLAIMER,
  };
}

/** Built-in table only (fast, offline). */
export function tableGuide(text: string): PriceGuide | null {
  const t = (text || '').trim();
  if (t.length < 3) return null;
  return propertyGuide(t) || tripGuide(t) || simpleGuide(t);
}

// ── AI layer ─────────────────────────────────────────────────────────────────
const cache = new Map<string, { at: number; g: PriceGuide | null }>();
const TTL = 24 * 3600e3;

async function aiGuide(text: string, hint: PriceGuide | null): Promise<PriceGuide | null> {
  if (!config.anthropicApiKey) return null;
  const sys = `You estimate what a personal goal ("dream") typically costs in INDIA today, for a money-planning app. Reply with STRICT JSON only:
{"found":boolean,"item":string,"location":string|null,"options":[{"label":string,"rupees":number,"note":string|null}],"low_rupees":number,"typical_rupees":number,"high_rupees":number,"basis":string}
Rules: 2–4 options covering realistic choices (e.g. 1BHK/2BHK/3BHK, budget/comfortable/premium, per-person vs group). Use realistic Indian market prices for the place named (e.g. South Mumbai property is far costlier per sq ft than suburbs). Amounts in whole rupees. "basis" = one short sentence on assumptions. Never name a specific stock, fund or insurance product. If the text is not a purchasable goal or cost cannot be estimated, return {"found":false}.`;
  const user = hint ? `Dream: "${text}"\nOur rough table estimate (refine if wrong): ${JSON.stringify({ item: hint.item, location: hint.location, typical_rupees: hint.typical / 100 })}` : `Dream: "${text}"`;
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'x-api-key': config.anthropicApiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: config.translateModel, max_tokens: 700, system: sys, messages: [{ role: 'user', content: user }] }),
    });
    clearTimeout(to);
    if (!res.ok) return null;
    const data: any = await res.json();
    const raw = (data.content?.[0]?.text || '').match(/\{[\s\S]*\}/)?.[0];
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j.found) return { ...(hint || emptyGuide()), found: !!hint };
    const ok = (n: any) => Number.isFinite(Number(n)) && Number(n) > 0 && Number(n) < 1e10;
    const options: PriceOption[] = (Array.isArray(j.options) ? j.options : []).filter((o: any) => o && ok(o.rupees)).slice(0, 4)
      .map((o: any) => ({ label: String(o.label).slice(0, 60), amount: R(round(Number(o.rupees))), note: o.note ? String(o.note).slice(0, 140) : undefined }));
    if (!options.length || !ok(j.typical_rupees)) return hint;
    return {
      found: true, item: String(j.item || hint?.item || 'Your dream').slice(0, 60), location: j.location ? String(j.location).slice(0, 60) : hint?.location,
      options, low: R(round(Number(j.low_rupees) || Number(j.typical_rupees))), typical: R(round(Number(j.typical_rupees))), high: R(round(Number(j.high_rupees) || Number(j.typical_rupees))),
      basis: String(j.basis || '').slice(0, 200), source: 'ai', disclaimer: DISCLAIMER,
    };
  } catch { return null; }
}
const emptyGuide = (): PriceGuide => ({ found: false, item: '', options: [], low: 0, typical: 0, high: 0, basis: '', source: 'table', disclaimer: DISCLAIMER });

/** Table first; AI refines (or fills in) when a key is set. Cached for a day. */
export async function priceGuide(text: string): Promise<PriceGuide> {
  const key = (text || '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 200);
  if (key.length < 3) return emptyGuide();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.g || emptyGuide();
  const table = tableGuide(key);
  const ai = await aiGuide(text.trim(), table);
  const g = ai || table;
  cache.set(key, { at: Date.now(), g });
  if (cache.size > 800) cache.delete(cache.keys().next().value as string);
  return g || emptyGuide();
}
