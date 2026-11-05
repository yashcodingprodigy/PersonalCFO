// Visual cards that ride along with an Ask PayWatch reply (D-55).
// When the user talks about a dream ("Bali trip", "can I afford a car?"), the reply comes with
// small visuals built from PayWatch's own engines — the dream plan, a cost split, a savings path,
// price tiers and the afford verdict. Zero AI calls: every number comes from the brain/price tables,
// so visuals are free to produce and never contradict the plan. Amounts in paise.

import { PlanItem, DreamPlan, AffordResult, monthsToReach, ym } from './dreams';
import { PriceGuide, tableGuide } from './priceGuide';
import { Lang } from './i18n';

export type Visual =
  | { type: 'dream'; title: string; status: PlanItem['status']; target: number; saved: number; monthlyNeed: number; allocated: number; targetDate: string; eta: string | null; progress: number; estimated?: boolean }
  | { type: 'breakdown'; title: string; total: number; parts: { label: string; amount: number; pct: number }[]; note: string }
  | { type: 'path'; title: string; target: number; monthly: number; series: { label: string; points: { m: string; v: number }[]; reach: string | null }[]; note: string }
  | { type: 'tiers'; title: string; options: { label: string; amount: number; note?: string }[]; highlight: number | null; note: string }
  | { type: 'afford'; verdict: AffordResult['verdict']; headline: string; monthly: number | null; date: string | null; affects: { name: string; newDate: string | null }[] };

const L = {
  en: {
    plan: (n: string) => `${n} — your plan`, split: (n: string) => `Where the money for ${n} goes`, path: 'How your savings grow',
    now: 'Start this month', wait: 'Start in 6 months', tiers: (n: string) => `What ${n} usually costs`,
    splitNote: 'Typical split for this kind of dream — a planning guide, not a quote.',
    pathNote: (amt: string) => `Putting aside about ${amt} a month. Waiting 6 months pushes the finish line back.`,
    tiersNote: 'Approximate ranges from PayWatch’s price guide. Your plan uses the highlighted one.',
    flights: 'Flights / travel', stay: 'Stay', food: 'Food', fun: 'Activities & local travel', visa: 'Visa, insurance & forex', shopping: 'Shopping & extras',
    down: 'Down payment (~20%)', stamp: 'Stamp duty & registration', interiors: 'Interiors & moving', loan: 'Bank loan (not saved by you)',
    exShow: 'Ex-showroom price', rto: 'Registration (RTO) & taxes', insure: 'First-year insurance', acc: 'Accessories',
  },
  hi: {
    plan: (n: string) => `${n} — आपका प्लान`, split: (n: string) => `${n} का पैसा कहाँ जाएगा`, path: 'आपकी बचत कैसे बढ़ेगी',
    now: 'इस महीने से शुरू', wait: '6 महीने बाद शुरू', tiers: (n: string) => `${n} का आम ख़र्च`,
    splitNote: 'इस तरह के सपने का आम बँटवारा — प्लानिंग के लिए, कोटेशन नहीं।',
    pathNote: (amt: string) => `हर महीने लगभग ${amt} अलग रखकर। 6 महीने रुकने से मंज़िल आगे खिसक जाती है।`,
    tiersNote: 'PayWatch की प्राइस गाइड से अनुमानित रेंज। आपका प्लान हाइलाइट वाली रकम पर है।',
    flights: 'फ़्लाइट / सफ़र', stay: 'रहना', food: 'खाना', fun: 'घूमना-फिरना', visa: 'वीज़ा, बीमा और फ़ॉरेक्स', shopping: 'शॉपिंग और बाकी',
    down: 'डाउन पेमेंट (~20%)', stamp: 'स्टांप ड्यूटी और रजिस्ट्रेशन', interiors: 'इंटीरियर और शिफ़्टिंग', loan: 'बैंक लोन (आपकी बचत नहीं)',
    exShow: 'एक्स-शोरूम कीमत', rto: 'रजिस्ट्रेशन (RTO) और टैक्स', insure: 'पहले साल का बीमा', acc: 'एक्सेसरीज़',
  },
};

const rupees = (p: number) => `₹${Math.round(p / 100).toLocaleString('en-IN')}`;

/** Typical cost split for a dream, from the price guide's category. Pure. */
export function costSplit(name: string, total: number, guide: PriceGuide | null, lang: Lang): Visual | null {
  const T = L[lang === 'hi' ? 'hi' : 'en'];
  if (total <= 0) return null;
  const item = `${guide?.item || ''} ${name}`.toLowerCase();
  const loc = guide?.location || '';
  let shares: [string, number][] | null = null;
  if (/trip|यात्रा|ट्रिप/.test(item)) {
    shares = /long-haul/i.test(loc)
      ? [[T.flights, 0.42], [T.stay, 0.28], [T.food, 0.12], [T.fun, 0.1], [T.visa, 0.08]]
      : /short-haul/i.test(loc)
        ? [[T.flights, 0.35], [T.stay, 0.3], [T.food, 0.14], [T.fun, 0.14], [T.visa, 0.07]]
        : [[T.flights, 0.3], [T.stay, 0.35], [T.food, 0.2], [T.fun, 0.15]];
  } else if (/\bcar\b|कार|bike|बाइक|two-wheeler|porsche|bmw|mercedes|audi|tata|mahindra|maruti|royal enfield/.test(item)) {
    shares = [[T.exShow, 0.84], [T.rto, 0.1], [T.insure, 0.04], [T.acc, 0.02]];
  } else if (/home|house|flat|घर|bhk/.test(item)) {
    // A home dream is saved as the down payment; show what that cash covers.
    shares = [[T.down, 0.7], [T.stamp, 0.24], [T.interiors, 0.06]];
  }
  if (!shares) return null;
  return {
    type: 'breakdown', title: T.split(name), total, note: T.splitNote,
    parts: shares.map(([label, pct]) => ({ label, pct, amount: Math.round((total * pct) / 100) * 100 })),
  };
}

/** Month-by-month savings path: start now vs start in 6 months. Pure. */
export function savingsPath(item: PlanItem, lang: Lang, now = new Date()): Visual | null {
  const T = L[lang === 'hi' ? 'hi' : 'en'];
  const monthly = item.allocated > 0 ? item.allocated : item.need;
  if (monthly <= 0 || item.adjustedTarget <= 0) return null;
  const target = item.adjustedTarget;
  const run = (delay: number) => {
    const reachIn = monthsToReach(target, item.saved, monthly, 0);
    const total = reachIn == null ? 36 : Math.min(60, reachIn + delay);
    const pts: { m: string; v: number }[] = [];
    for (let i = 0; i <= total; i++) pts.push({ m: ym(now, i), v: Math.min(target, item.saved + monthly * Math.max(0, i - delay)) });
    return { points: pts, reach: reachIn == null ? null : ym(now, reachIn + delay) };
  };
  const a = run(0), b = run(6);
  const span = Math.max(a.points.length, b.points.length);
  const step = Math.max(1, Math.ceil(span / 13));
  const thin = (pts: { m: string; v: number }[]) => pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
  return {
    type: 'path', title: T.path, target, monthly, note: T.pathNote(rupees(monthly)),
    series: [{ label: T.now, points: thin(a.points), reach: a.reach }, { label: T.wait, points: thin(b.points), reach: b.reach }],
  };
}

export interface VisualInput {
  question: string;
  lang: Lang;
  plan: DreamPlan | null;
  focusName?: string | null;     // dream just captured / created / named
  afford?: AffordResult | null;
  now?: Date;
}

/** Find the dream the message is about: the one just captured, or one whose name the user mentioned. */
export function findDream(plan: DreamPlan | null, question: string, focusName?: string | null): PlanItem | null {
  if (!plan) return null;
  const items = plan.items.filter((i) => !i.virtual);
  if (focusName) {
    const hit = items.find((i) => i.name.toLowerCase() === focusName.toLowerCase());
    if (hit) return hit;
  }
  const q = question.toLowerCase();
  const STOP = new Set(['trip', 'my', 'the', 'new', 'a', 'own', 'fund', 'ट्रिप', 'का', 'की']);
  let best: PlanItem | null = null, bestScore = 0;
  for (const i of items) {
    const words = i.name.toLowerCase().split(/[^a-z0-9ऀ-ॿ]+/).filter((w) => w.length > 2 && !STOP.has(w));
    const score = words.filter((w) => q.includes(w)).length;
    if (score > bestScore) { best = i; bestScore = score; }
  }
  return best;
}

/** All visuals for one reply (max 4). Pure — the route supplies plan/afford from the brain. */
export function buildVisuals(inp: VisualInput): Visual[] {
  const lang = inp.lang === 'hi' ? 'hi' : 'en';
  const T = L[lang];
  const out: Visual[] = [];
  const item = findDream(inp.plan, inp.question, inp.focusName);
  const guide = tableGuide(inp.question) || (item ? tableGuide(item.name) : null);

  if (inp.afford && inp.afford.verdict !== 'need_data') {
    out.push({ type: 'afford', verdict: inp.afford.verdict, headline: inp.afford.headline, monthly: inp.afford.monthly, date: inp.afford.date, affects: inp.afford.affects.map((a) => ({ name: a.name, newDate: a.newDate })) });
  }
  if (item) {
    out.push({
      type: 'dream', title: T.plan(item.name), status: item.status, target: item.adjustedTarget, saved: item.saved,
      monthlyNeed: item.need, allocated: item.allocated, targetDate: item.targetDate, eta: item.projectedDate,
      progress: item.adjustedTarget > 0 ? Math.min(1, item.saved / item.adjustedTarget) : 0,
    });
  }
  const name = item?.name || guide?.item || '';
  const total = item?.adjustedTarget || guide?.typical || 0;
  const split = name ? costSplit(name, total, guide, lang) : null;
  if (split) out.push(split);
  if (item) { const p = savingsPath(item, lang, inp.now); if (p) out.push(p); }
  if (guide && guide.options.length >= 2 && out.length < 4) {
    const target = item?.adjustedTarget || 0;
    let hi: number | null = null;
    if (target > 0) {
      let d = Infinity;
      guide.options.forEach((o, i) => { const x = Math.abs(o.amount - target); if (x < d) { d = x; hi = i; } });
    }
    out.push({ type: 'tiers', title: T.tiers(name || guide.item), options: guide.options.slice(0, 4), highlight: hi, note: T.tiersNote });
  }
  return out.slice(0, 4);
}

/** Is this message about a dream / purchase at all? Cheap gate so ordinary questions skip the brain re-run. */
const DREAMY = /\b(want|wanna|plan|planning|dream|wish|save for|saving for|afford|buy|cost|costs|budget|trip|go to|how much|kitna|kitne|chahiye|lena|jana|jaana)\b|जाना|लेना|खरीद|सपना|कितना|ख़र्च|खर्च/i;
export function looksLikeDreamTalk(question: string, plan: DreamPlan | null): boolean {
  if (findDream(plan, question)) return true;
  return DREAMY.test(question) && !!tableGuide(question);
}
