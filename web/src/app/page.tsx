'use client';

// paywatch.in — the public home page, told as a story about dreams:
//   hero (live 3D money brain) → say it like you'd tell a friend → every dream gets a plan
//   → how it works (tell · it plans · it runs itself) → quietly in the background
//   → talk to it → future you → pricing → "what's your dream?"
// Fully bilingual (English / हिंदी) without any AI call — copy lives in COPY below.

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Wordmark, LogoMark } from '@/components/Logo';
import { AuthRedirect } from '@/components/AuthRedirect';
import { useLang } from '@/lib/i18n';
import { getTokens } from '@/lib/api';
import { DreamCard, MoneyFlow, AwayFeed, Reveal, Tilt } from '@/components/overview/parts';

const BrainScene = dynamic(() => import('@/components/overview/BrainScene').then((m) => m.BrainScene), {
  ssr: false,
  loading: () => <div className="w-full h-full grid place-items-center"><span className="relative w-44 h-44 rounded-full pw-orb" /></div>,
});

/* ── copy ──────────────────────────────────────────────────────────────── */
const COPY = {
  en: {
    nav: { how: 'How it works', bg: 'What it handles', pricing: 'Pricing', signin: 'Sign in', open: 'Open my app' },
    kicker: 'Your money brain',
    h1a: 'Tell us your dreams.', h1b: 'We’ll handle the money.',
    sub: 'PayWatch turns every dream — a trip, a laptop, your parents’ health cover, your own café — into a plan with a date. Tax, insurance and investing are handled quietly in the background.',
    cta: 'Start free →', cta2: 'See how it works', small: 'No card · English & हिंदी · talk or type',
    trust: ['Bank-grade encryption', 'DPDP-ready', 'SEBI-compliant education', 'Works alongside your CA'],
    sayK: 'Just say it', sayH: 'Say it like you’d tell a friend.',
    saySub: 'Type it or say it — in English, Hindi or Hinglish. The brain works out the cost, the date, and where the money comes from.',
    chat: [
      { u: 'I want to go to Bali next year with my friends', b: '✨ Added **Bali trip** — about ₹1.5L. I’ve set aside ₹40,000 of your spare cash; ₹9,000 a month gets you there by July 2027.' },
      { u: 'mujhe 6 mahine me 80k ka laptop lena hai', b: '✨ Added **Laptop** — ₹80,000. ₹13,300 a month and it’s yours by April. Nothing else slips.' },
      { u: 'Can I afford a ₹2L bike this year?', b: 'It’s a stretch — it would push Bali back by 3 months. Wait till March, or put ₹50k down now and it’s a yes.' },
    ],
    dreamsK: 'Your dreams', dreamsH: 'Every dream gets a plan, a date and a status.',
    dreamsSub: 'Hover a card. Each one shows how much is already set aside, what goes in every month, and when it’s done.',
    howK: 'How it works', howH: 'You live. It plans.',
    steps: [
      { t: 'Tell it', d: 'Say a dream, upload a payslip or a bank statement — or answer a few quick questions. That’s the only work you do.' },
      { t: 'It plans', d: 'Every rupee you earn gets a job: living costs, a safety net, investing, your dreams — and guilt-free money you can just spend.' },
      { t: 'It runs itself', d: 'A raise, a bonus, a new EMI, a big purchase — the plan rewrites itself and tells you only when something needs you.' },
    ],
    bgK: 'Quietly, in the background', bgH: 'The boring stuff, handled.',
    bg: [
      { t: 'Tax', d: 'Both regimes compared, every deduction tracked, your return computed — file it yourself or hand it to your CA.' },
      { t: 'Insurance', d: 'Right-sized health and term cover, policies read from your PDFs, renewals never missed.' },
      { t: 'Investing', d: 'A simple category-level plan for your risk — no products pushed, ever.' },
      { t: 'Money health', d: 'One score across savings, safety, debt, tax and cover — moving up as you go.' },
    ],
    voiceK: 'Talk to it', voiceH: 'A voice that sounds like a person — in English and हिंदी.',
    voiceSub: 'Tap once and talk. It listens, answers out loud, and keeps your plan updated while you speak. Or type, if you prefer.',
    voiceCta: 'Try it free',
    futureK: 'Future you', futureH: 'Every month you wait has a price.',
    invest: 'If you invest', drifting: 'Drifting along', idle: 'in 10 years, idle savings', withPlan: 'With a plan', planned: 'disciplined, stepped-up, diversified',
    thats: 'That’s a', diff: 'difference',
    disc: 'Illustrative, nominal, not a guarantee of returns. Assumes ~3.5% idle vs ~11% diversified with an 8% yearly step-up. Markets carry risk.',
    priceH: 'Less than your streaming.', launch: 'Launch offer', priceSub: 'Lock in the launch price · prices include 18% GST',
    plans: [
      { name: 'Free', price: '₹0', was: null as string | null, tag: 'Start here — no card', per: 'free forever', cta: 'Start free', feats: ['Your money brain + dreams', 'Money Health Score', 'Top moves to make first', 'A taste of Ask PayWatch'] },
      { name: 'Starter', price: '₹199', was: '₹349', tag: 'Get organised', per: '/month', cta: 'Start Starter', feats: ['Unlimited dreams & plans', 'Bank statement scan', 'Insurance & invest guidance', 'Prepare your ITR docs'] },
      { name: 'CFO', price: '₹499', was: '₹799', tag: 'Most popular', per: '/month', cta: 'Start CFO', hl: true, feats: ['Everything, unlimited', 'Voice assistant (EN + हिंदी)', 'Full tax engine + Tax Copilot', 'Alerts, briefing & document vault', 'Connect your CA'] },
    ],
    popular: 'Most popular',
    endH: 'What’s your dream?', endSub: 'Write it down. We’ll turn it into a plan the moment you sign in.',
    endPh: 'e.g. A trip to Ladakh next summer', endCta: 'Plan it →',
    footer: 'Financial education and organisation platform. Not a SEBI-registered Investment Adviser — we never recommend specific securities. Your data is encrypted and never sold.',
    legal: 'Legal', terms: 'Terms of Service', privacy: 'Privacy Policy', disclosures: 'Regulatory Disclosures', contact: 'Contact', grievance: 'Grievance officer',
  },
  hi: {
    nav: { how: 'कैसे काम करता है', bg: 'क्या-क्या संभालता है', pricing: 'कीमत', signin: 'साइन इन', open: 'मेरा ऐप खोलें' },
    kicker: 'आपका मनी ब्रेन',
    h1a: 'अपने सपने बताइए।', h1b: 'पैसों का इंतज़ाम हम करेंगे।',
    sub: 'PayWatch हर सपने को — एक ट्रिप, लैपटॉप, माता-पिता का हेल्थ कवर, आपका अपना कैफ़े — तारीख़ वाले प्लान में बदल देता है। टैक्स, इंश्योरेंस और निवेश पीछे से चुपचाप संभलते रहते हैं।',
    cta: 'मुफ़्त शुरू करें →', cta2: 'देखें कैसे काम करता है', small: 'कार्ड की ज़रूरत नहीं · English और हिंदी · बोलिए या लिखिए',
    trust: ['बैंक-स्तर एन्क्रिप्शन', 'DPDP के अनुरूप', 'SEBI-अनुरूप शिक्षा', 'आपके CA के साथ काम करता है'],
    sayK: 'बस बोल दीजिए', sayH: 'जैसे दोस्त को बताते हैं, वैसे ही बताइए।',
    saySub: 'लिखिए या बोलिए — अंग्रेज़ी, हिंदी या हिंग्लिश में। ब्रेन ख़ुद क़ीमत, तारीख़ और पैसा कहाँ से आएगा, सब तय कर देता है।',
    chat: [
      { u: 'अगले साल दोस्तों के साथ बाली जाना है', b: '✨ **बाली ट्रिप** जोड़ दी — लगभग ₹1.5 लाख। आपके अतिरिक्त पैसे में से ₹40,000 अलग रख दिए; हर महीने ₹9,000 से जुलाई 2027 तक हो जाएगा।' },
      { u: 'mujhe 6 mahine me 80k ka laptop lena hai', b: '✨ **लैपटॉप** ₹80,000 जोड़ दिया। हर महीने ₹13,300 — अप्रैल तक आपका। बाक़ी कोई सपना पीछे नहीं होगा।' },
      { u: 'क्या मैं इस साल ₹2 लाख की बाइक ले सकता हूँ?', b: 'थोड़ा मुश्किल है — बाली ट्रिप 3 महीने आगे खिसक जाएगी। मार्च तक रुकिए, या अभी ₹50 हज़ार डाउन पेमेंट दीजिए तो हाँ।' },
    ],
    dreamsK: 'आपके सपने', dreamsH: 'हर सपने को मिलता है प्लान, तारीख़ और स्टेटस।',
    dreamsSub: 'कार्ड पर माउस ले जाइए। हर कार्ड बताता है कितना पैसा अलग रखा है, हर महीने कितना जाता है, और कब पूरा होगा।',
    howK: 'कैसे काम करता है', howH: 'आप जीइए। प्लान वो बनाएगा।',
    steps: [
      { t: 'बताइए', d: 'कोई सपना बोलिए, सैलरी स्लिप या बैंक स्टेटमेंट डालिए — या कुछ आसान सवालों के जवाब दीजिए। बस इतना ही काम आपका।' },
      { t: 'प्लान बनता है', d: 'आपकी कमाई के हर रुपये को काम मिलता है: घर-खर्च, सुरक्षा कवच, निवेश, आपके सपने — और बेफ़िक्र ख़र्च करने के पैसे।' },
      { t: 'ख़ुद चलता है', d: 'इंक्रीमेंट, बोनस, नई EMI, कोई बड़ी ख़रीद — प्लान ख़ुद बदल जाता है और आपको तभी बताता है जब आपकी ज़रूरत हो।' },
    ],
    bgK: 'पीछे से, चुपचाप', bgH: 'उबाऊ काम, हमारे ज़िम्मे।',
    bg: [
      { t: 'टैक्स', d: 'दोनों रिजीम की तुलना, हर छूट का हिसाब, आपका रिटर्न तैयार — ख़ुद फ़ाइल करें या अपने CA को दें।' },
      { t: 'इंश्योरेंस', d: 'सही साइज़ का हेल्थ और टर्म कवर, आपकी PDF से पॉलिसी पढ़ी जाती है, रिन्यूअल कभी नहीं छूटता।' },
      { t: 'निवेश', d: 'आपके जोखिम के हिसाब से आसान कैटेगरी-स्तर का प्लान — कोई प्रोडक्ट नहीं थोपा जाता।' },
      { t: 'पैसों की सेहत', d: 'बचत, सुरक्षा, क़र्ज़, टैक्स और कवर — सब मिलाकर एक स्कोर, जो आगे बढ़ता रहता है।' },
    ],
    voiceK: 'बात कीजिए', voiceH: 'इंसान जैसी आवाज़ — English और हिंदी में।',
    voiceSub: 'एक बार टैप कीजिए और बोलिए। वो सुनता है, बोलकर जवाब देता है, और साथ-साथ आपका प्लान अपडेट करता है। चाहें तो लिखकर भी पूछ सकते हैं।',
    voiceCta: 'मुफ़्त आज़माइए',
    futureK: 'भविष्य के आप', futureH: 'हर महीने की देरी की एक क़ीमत है।',
    invest: 'अगर आप निवेश करें', drifting: 'ऐसे ही चलता रहा तो', idle: '10 साल में, पड़ी हुई बचत', withPlan: 'प्लान के साथ', planned: 'नियमित, हर साल बढ़ता, विविध',
    thats: 'यानी', diff: 'का फ़र्क़',
    disc: 'सिर्फ़ उदाहरण, रिटर्न की गारंटी नहीं। ~3.5% पड़ी बचत बनाम ~11% विविध निवेश, हर साल 8% बढ़ोतरी के साथ। बाज़ार में जोखिम होता है।',
    priceH: 'आपके OTT से भी सस्ता।', launch: 'लॉन्च ऑफ़र', priceSub: 'लॉन्च क़ीमत अभी लॉक करें · क़ीमतों में 18% GST शामिल',
    plans: [
      { name: 'Free', price: '₹0', was: null as string | null, tag: 'यहाँ से शुरू करें — कार्ड नहीं', per: 'हमेशा मुफ़्त', cta: 'मुफ़्त शुरू करें', feats: ['आपका मनी ब्रेन + सपने', 'मनी हेल्थ स्कोर', 'सबसे पहले करने वाले कदम', 'Ask PayWatch की झलक'] },
      { name: 'Starter', price: '₹199', was: '₹349', tag: 'व्यवस्थित हो जाइए', per: '/महीना', cta: 'Starter लें', feats: ['असीमित सपने और प्लान', 'बैंक स्टेटमेंट स्कैन', 'इंश्योरेंस और निवेश गाइडेंस', 'ITR के डॉक्यूमेंट तैयार'] },
      { name: 'CFO', price: '₹499', was: '₹799', tag: 'सबसे लोकप्रिय', per: '/महीना', cta: 'CFO लें', hl: true, feats: ['सब कुछ, असीमित', 'वॉइस असिस्टेंट (EN + हिंदी)', 'पूरा टैक्स इंजन + टैक्स कोपायलट', 'अलर्ट, ब्रीफ़िंग और डॉक्यूमेंट वॉल्ट', 'अपने CA को जोड़ें'] },
    ],
    popular: 'सबसे लोकप्रिय',
    endH: 'आपका सपना क्या है?', endSub: 'लिख दीजिए। साइन इन करते ही हम उसे प्लान में बदल देंगे।',
    endPh: 'जैसे अगली गर्मियों में लद्दाख ट्रिप', endCta: 'प्लान बनाइए →',
    footer: 'वित्तीय शिक्षा और व्यवस्था का प्लेटफ़ॉर्म। SEBI-रजिस्टर्ड निवेश सलाहकार नहीं — हम कभी किसी ख़ास सिक्योरिटी की सलाह नहीं देते। आपका डेटा एन्क्रिप्टेड है और कभी बेचा नहीं जाता।',
    legal: 'क़ानूनी', terms: 'सेवा की शर्तें', privacy: 'प्राइवेसी पॉलिसी', disclosures: 'नियामक जानकारी', contact: 'संपर्क', grievance: 'शिकायत अधिकारी',
  },
};

/* ── demo data (illustrative persona) ──────────────────────────────────── */
const L = 100;
const demoDreams = (hi: boolean) => [
  { id: 'a', name: hi ? 'बाली ट्रिप' : 'Bali trip', kind: 'experience', status: 'on_track', adjustedTarget: 150000 * L, saved: 60000 * L, allocated: 9000 * L, earmarked: 40000 * L, targetDate: '2027-08', projectedDate: '2027-07' },
  { id: 'b', name: hi ? 'मैकबुक' : 'MacBook Air', kind: 'purchase', status: 'achieved', adjustedTarget: 90000 * L, saved: 90000 * L, allocated: 0, earmarked: 90000 * L, targetDate: '2026-12' },
  { id: 'c', name: hi ? 'माता-पिता का हेल्थ कवर' : 'Parents’ health cover', kind: 'family', status: 'stretch', adjustedTarget: 35000 * L, saved: 8000 * L, allocated: 2500 * L, earmarked: 0, targetDate: '2027-02', projectedDate: '2027-05' },
];
const demoPlanets = [
  { id: 's', name: 'Safety net', status: 'on_track', progress: 0.7 },
  { id: 'a', name: 'Bali trip', status: 'on_track', progress: 0.4 },
  { id: 'b', name: 'MacBook Air', status: 'achieved', progress: 1 },
  { id: 'c', name: 'Parents’ health cover', status: 'stretch', progress: 0.23 },
  { id: 'd', name: 'Own café', status: 'needs_tradeoff', progress: 0.05 },
];
const demoMap = { hasData: true, takeHome: 85000 * L, expenses: 42000 * L, currentSip: 8000 * L, liquid: 210000 * L };
const demoPlan = { items: [{ kind: 'safety', virtual: true, allocated: 6000 * L }, { kind: 'experience', allocated: 9000 * L }, { kind: 'purchase', allocated: 4000 * L }, { kind: 'family', allocated: 2500 * L }], joyBudget: 7500 * L };
const demoActivity = (hi: boolean) => {
  const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
  return hi ? [
    { id: 1, kind: 'life_event', title: 'इस महीने सैलरी ₹8,000 बढ़ी — प्लान अपडेट कर दिया', body: 'बाली ट्रिप अब 1 महीना पहले पूरी होगी।', created_at: ago(2) },
    { id: 2, kind: 'earmark', title: 'बाली ट्रिप के लिए ₹40,000 अलग रख दिए', body: '', created_at: ago(5) },
    { id: 3, kind: 'dream_done', title: 'मैकबुक का पूरा पैसा तैयार — जब चाहें ले लीजिए', body: '', created_at: ago(30) },
  ] : [
    { id: 1, kind: 'life_event', title: 'Your salary went up ₹8,000 this month — plan updated', body: 'Bali trip now finishes a month earlier.', created_at: ago(2) },
    { id: 2, kind: 'earmark', title: 'Set aside ₹40,000 of spare cash for your Bali trip', body: '', created_at: ago(5) },
    { id: 3, kind: 'dream_done', title: 'MacBook Air is fully funded — ready when you are', body: '', created_at: ago(30) },
  ];
};

/* ── helpers ───────────────────────────────────────────────────────────── */
function inrCompact(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`; // Indian commas: ₹1,20,000
}
function fv(monthly: number, annualRate: number, years: number, stepUp: number): number {
  let total = 0, p = monthly; const i = annualRate / 12;
  for (let y = 0; y < years; y++) { for (let m = 0; m < 12; m++) total = (total + p) * (1 + i); p *= 1 + stepUp; }
  return total;
}
const bold = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (/^\*\*/.test(p) ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));

/* Chat demo that plays when scrolled into view and loops through the examples */
function ChatDemo({ items }: { items: { u: string; b: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [i, setI] = useState(0);
  const [phase, setPhase] = useState<'user' | 'typing' | 'brain'>('user');
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { threshold: 0.4 });
    io.observe(el); return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!on) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setPhase('brain'); return; }
    setPhase('user');
    const t1 = setTimeout(() => setPhase('typing'), 900);
    const t2 = setTimeout(() => setPhase('brain'), 2300);
    const t3 = setTimeout(() => setI((x) => (x + 1) % items.length), 6800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [on, i, items.length]);
  const it = items[i];
  return (
    <div ref={ref} className="rounded-[2rem] pw-voice-bg p-5 sm:p-7 shadow-2xl border border-white/10 min-h-[330px] flex flex-col">
      <div className="flex items-center gap-2.5 pb-4 border-b border-white/10">
        <span className="w-8 h-8 rounded-full pw-orb-mini" />
        <span className="font-bold text-sm">Ask PayWatch</span>
        <span className="ml-auto flex gap-1.5">{items.map((_, k) => <span key={k} className={`h-1.5 rounded-full transition-all ${k === i ? 'w-5 bg-mint-400' : 'w-1.5 bg-white/25'}`} />)}</span>
      </div>
      <div key={i} className="flex-1 pt-5 space-y-3">
        <div className="flex justify-end pw-pop-in"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-mint-500 text-pine-950 px-4 py-2.5 text-sm font-medium">{it.u}</div></div>
        {phase === 'typing' && <div className="flex pw-fade-in"><div className="rounded-2xl rounded-bl-md pw-glass px-4 py-3"><span className="pw-typing"><i /><i /><i /></span></div></div>}
        {phase === 'brain' && <div className="flex pw-pop-in"><div className="max-w-[90%] rounded-2xl rounded-bl-md pw-glass px-4 py-3 text-sm leading-relaxed text-white/90">{bold(it.b)}</div></div>}
      </div>
    </div>
  );
}

const BG_ICONS = [
  'M4 3h12l4 4v14H4V3Zm11 1.5V8h3.5L15 4.5ZM7 11h10v2H7v-2Zm0 4h10v2H7v-2Z',
  'M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4Z',
  'M3 13h2v7H3v-7Zm4-4h2v11H7V9Zm4-5h2v16h-2V4Zm4 8h2v8h-2v-8Zm4-3h2v11h-2V9Z',
  'M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3.1 4.5 6.7 4.5c2.1 0 3.8 1.2 5.3 3 1.5-1.8 3.2-3 5.3-3 3.6 0 5.8 3.7 4.3 7.2C19.5 16.4 12 21 12 21Z',
];

export default function Landing() {
  const { lang, setLang } = useLang();
  const c = COPY[lang === 'hi' ? 'hi' : 'en'];
  const hi = lang === 'hi';
  const [monthly, setMonthly] = useState(15000);
  const [scrolled, setScrolled] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [dream, setDream] = useState('');

  useEffect(() => {
    setSignedIn(!!getTokens().access);
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const doNothing = fv(monthly, 0.035, 10, 0);
  const withPW = fv(monthly, 0.11, 10, 0.08);
  const appHref = signedIn ? '/dashboard' : '/login';

  function planDream(e: React.FormEvent) {
    e.preventDefault();
    // Remember the dream; the app captures it into a real plan right after sign-in.
    try { if (dream.trim()) localStorage.setItem('paywatch_pending_dream', dream.trim().slice(0, 300)); } catch {}
    window.location.href = appHref;
  }

  return (
    <main className="min-h-screen bg-pine-950 text-white overflow-x-hidden">
      <AuthRedirect />

      {/* Nav */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all ${scrolled ? 'bg-pine-950/80 backdrop-blur-md border-b border-white/10' : ''}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link href="/" aria-label="PayWatch home" className="transition-opacity hover:opacity-80"><Wordmark dark /></Link>
          <nav className="flex items-center gap-5 text-sm text-white/70">
            <a href="#how" className="hover:text-white transition-colors hidden md:block">{c.nav.how}</a>
            <a href="#background" className="hover:text-white transition-colors hidden md:block">{c.nav.bg}</a>
            <a href="#pricing" className="hover:text-white transition-colors hidden md:block">{c.nav.pricing}</a>
            <div className="inline-flex rounded-full bg-white/10 p-0.5 text-xs font-bold">
              {(['en', 'hi'] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} className={`rounded-full px-2.5 py-1 transition-colors ${lang === l ? 'bg-white text-pine-950' : 'text-white/70 hover:text-white'}`}>{l === 'en' ? 'EN' : 'हिं'}</button>
              ))}
            </div>
            <Link href={appHref} className="rounded-full bg-white text-pine-950 px-5 py-2 font-semibold hover:bg-mint-100 transition-colors whitespace-nowrap">{signedIn ? c.nav.open : c.nav.signin}</Link>
          </nav>
        </div>
      </header>

      {/* 1 · Hero */}
      <section className="relative pw-voice-bg overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" aria-hidden
          style={{ background: 'radial-gradient(55% 55% at 78% 45%, rgba(47,188,155,.22), transparent 70%), radial-gradient(40% 40% at 8% 95%, rgba(70,201,224,.16), transparent 70%)' }} />
        <div className="relative max-w-7xl mx-auto grid lg:grid-cols-[1.05fr_1fr] items-center min-h-[100svh]">
          <div className="px-6 pt-2 lg:pt-24 pb-16 lg:pb-24 z-10 pw-fade-up">
            <p className="text-[11px] font-bold uppercase tracking-[.28em] text-mint-300">{c.kicker}</p>
            <h1 className="font-display text-5xl sm:text-6xl xl:text-7xl leading-[1.02] mt-5 pw-hero-glow">
              {c.h1a}<br /><span className="pw-gradient-text">{c.h1b}</span>
            </h1>
            <p className="mt-6 text-lg text-white/70 leading-relaxed max-w-xl">{c.sub}</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href={appHref} className="pw-shimmer-cta rounded-full text-pine-950 px-8 py-4 font-bold shadow-lg shadow-mint-500/20 hover:scale-[1.03] transition-transform">{c.cta}</Link>
              <a href="#how" className="rounded-full border border-white/20 px-6 py-3.5 text-sm font-semibold text-white/85 hover:bg-white/10 transition-colors">{c.cta2}</a>
            </div>
            <p className="mt-4 text-sm text-white/45">{c.small}</p>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-white/45">
              {c.trust.map((t) => <span key={t} className="flex items-center gap-1.5"><span className="text-mint-400">✓</span>{t}</span>)}
            </div>
          </div>
          <BrainScene planets={demoPlanets} className="order-first lg:order-none mt-16 lg:mt-0 h-[340px] sm:h-[440px] lg:h-[100svh] w-full" />
        </div>
        <a href="#say" aria-label="Scroll" className="group absolute bottom-6 left-1/2 -translate-x-1/2 hidden lg:flex">
          <svg className="pw-bounce text-mint-400/70 group-hover:text-mint-300" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
        </a>
      </section>

      {/* 2 · Just say it */}
      <section id="say" className="bg-paper text-ink py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-14 items-center">
          <Reveal>
            <p className="text-signal-teal text-sm font-semibold tracking-[0.2em] uppercase mb-3">{c.sayK}</p>
            <h2 className="font-display text-4xl sm:text-5xl leading-tight">{c.sayH}</h2>
            <p className="mt-5 text-lg text-ink-soft leading-relaxed max-w-lg">{c.saySub}</p>
          </Reveal>
          <Reveal><ChatDemo key={lang} items={c.chat} /></Reveal>
        </div>
      </section>

      {/* 3 · Dreams */}
      <section className="bg-paper text-ink pb-24 sm:pb-32">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="max-w-2xl mb-10">
            <p className="text-signal-teal text-sm font-semibold tracking-[0.2em] uppercase mb-3">{c.dreamsK}</p>
            <h2 className="font-display text-4xl sm:text-5xl leading-tight">{c.dreamsH}</h2>
            <p className="mt-4 text-ink-soft leading-relaxed">{c.dreamsSub}</p>
          </Reveal>
          <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {demoDreams(hi).map((d) => <DreamCard key={d.id} d={d} />)}
          </Reveal>
        </div>
      </section>

      {/* 4 · How it works */}
      <section id="how" className="bg-white text-ink py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-signal-teal text-sm font-semibold tracking-[0.2em] uppercase mb-3">{c.howK}</p>
            <h2 className="font-display text-4xl sm:text-5xl">{c.howH}</h2>
          </Reveal>
          <Reveal stagger className="grid md:grid-cols-3 gap-6 mb-14">
            {c.steps.map((s, i) => (
              <Tilt key={s.t} max={6} className="rounded-3xl bg-paper-50 border border-paper-200 p-7">
                <span className="font-display text-5xl pw-gradient-text">{i + 1}</span>
                <h3 className="font-display text-2xl mt-3">{s.t}</h3>
                <p className="text-ink-soft mt-2 leading-relaxed text-sm">{s.d}</p>
              </Tilt>
            ))}
          </Reveal>
          <div className="grid lg:grid-cols-5 gap-6 items-start">
            <div className="lg:col-span-3 card p-6 sm:p-8"><MoneyFlow map={demoMap} plan={demoPlan} /></div>
            <Reveal className="lg:col-span-2 card p-6"><AwayFeed items={demoActivity(hi)} /></Reveal>
          </div>
        </div>
      </section>

      {/* 5 · In the background */}
      <section id="background" className="bg-pine-950 py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute top-1/3 -right-20 w-96 h-96 rounded-full bg-mint-500/10 blur-3xl pw-blob" />
        <div className="max-w-6xl mx-auto px-6 relative">
          <Reveal className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-mint-300 text-sm font-semibold tracking-[0.2em] uppercase mb-3">{c.bgK}</p>
            <h2 className="font-display text-4xl sm:text-5xl leading-tight">{c.bgH}</h2>
          </Reveal>
          <Reveal stagger className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {c.bg.map((b, i) => (
              <Tilt key={b.t} max={8} className="pw-glass rounded-3xl p-6 min-h-[220px]">
                <span className="inline-flex w-11 h-11 items-center justify-center rounded-2xl bg-gradient-to-br from-mint-400 to-mint-500 text-pine-950 pw-depth">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d={BG_ICONS[i]} /></svg>
                </span>
                <h3 className="font-display text-2xl mt-5">{b.t}</h3>
                <p className="mt-2 text-sm text-white/65 leading-relaxed">{b.d}</p>
              </Tilt>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 6 · Voice */}
      <section className="pw-voice-bg py-24 sm:py-32 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-14 items-center">
          <Reveal className="flex justify-center order-2 lg:order-1">
            <div className="relative w-64 h-64 sm:w-80 sm:h-80">
              <span className="absolute -inset-10 rounded-full pw-orb-halo" />
              <span className="absolute inset-0 rounded-full pw-orb pw-orb-speak" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-1 h-8" aria-hidden>
                {[0, 1, 2, 3, 4, 5, 6].map((k) => <i key={k} className="w-1.5 rounded-full bg-mint-300/80 pw-eq" style={{ animationDelay: `${k * 0.11}s` }} />)}
              </span>
            </div>
          </Reveal>
          <Reveal className="order-1 lg:order-2">
            <p className="text-mint-300 text-sm font-semibold tracking-[0.2em] uppercase mb-3">{c.voiceK}</p>
            <h2 className="font-display text-4xl sm:text-5xl leading-tight">{c.voiceH}</h2>
            <p className="mt-5 text-lg text-white/70 leading-relaxed max-w-lg">{c.voiceSub}</p>
            <Link href={appHref} className="inline-flex items-center gap-3 mt-8 rounded-full bg-mint-500 text-pine-950 pl-2 pr-6 py-2 font-bold hover:bg-mint-400 transition-colors">
              <span className="w-9 h-9 rounded-full pw-orb-mini" />{c.voiceCta}
            </Link>
          </Reveal>
        </div>
      </section>

      {/* 7 · Future you */}
      <section className="bg-paper text-ink py-24 sm:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal className="text-center mb-12">
            <p className="text-signal-teal text-sm font-semibold tracking-[0.2em] uppercase mb-3">{c.futureK}</p>
            <h2 className="font-display text-4xl sm:text-5xl">{c.futureH}</h2>
          </Reveal>
          <Reveal className="card p-8 sm:p-10">
            <div className="flex items-center justify-between text-sm font-semibold text-ink-soft">
              <span>{c.invest}</span>
              <span className="font-display text-2xl text-pine-900 tabular-nums">{inrCompact(monthly)}<span className="text-sm text-ink-faint font-normal">/mo</span></span>
            </div>
            <input type="range" min={2000} max={75000} step={1000} value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} className="w-full mt-3 accent-mint-500 h-2 cursor-pointer" />
            <div className="grid sm:grid-cols-2 gap-5 mt-8">
              <div className="rounded-2xl bg-paper-100 p-6">
                <p className="text-xs uppercase tracking-widest text-ink-faint font-bold">{c.drifting}</p>
                <p className="font-display text-3xl font-semibold mt-2 tabular-nums">{inrCompact(doNothing)}</p>
                <p className="text-xs text-ink-faint mt-1">{c.idle}</p>
              </div>
              <div className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg,#0F3D34,#177a67)' }}>
                <p className="text-xs uppercase tracking-widest text-mint-300 font-bold">{c.withPlan}</p>
                <p className="font-display text-3xl font-semibold mt-2 tabular-nums">{inrCompact(withPW)}</p>
                <p className="text-xs text-white/60 mt-1">{c.planned}</p>
              </div>
            </div>
            <div className="mt-6 text-center">
              <p className="text-sm text-ink-soft">{c.thats}</p>
              <p className="font-display text-4xl font-semibold pw-gradient-text tabular-nums">{inrCompact(withPW - doNothing)} {c.diff}</p>
              <p className="text-[11px] text-ink-faint mt-2 max-w-lg mx-auto leading-relaxed">{c.disc}</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 8 · Pricing */}
      <section id="pricing" className="bg-white text-ink py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <Reveal className="text-center mb-14">
            <h2 className="font-display text-4xl sm:text-5xl">{c.priceH}</h2>
            <p className="text-ink-soft mt-3"><span className="chip bg-mint-100 text-pine-800 mr-2">{c.launch}</span>{c.priceSub}</p>
          </Reveal>
          <Reveal stagger className="grid md:grid-cols-3 gap-6 items-start">
            {c.plans.map((p) => (
              <div key={p.name} className={`p-8 rounded-3xl ${p.hl ? 'text-white shadow-2xl md:scale-[1.03]' : 'card'}`} style={p.hl ? { background: 'linear-gradient(160deg,#0F3D34,#134e43)' } : {}}>
                {p.hl && <span className="chip bg-mint-500 text-pine-950 mb-3">{c.popular}</span>}
                <h3 className="text-lg font-bold">{p.name}</h3>
                <p className={`text-xs ${p.hl ? 'text-white/60' : 'text-ink-faint'}`}>{p.tag}</p>
                <p className="mt-4 flex items-baseline gap-2">
                  {p.was && <span className={`text-lg line-through ${p.hl ? 'text-white/40' : 'text-ink-faint'}`}>{p.was}</span>}
                  <span className="font-display text-4xl font-semibold">{p.price}</span>
                  <span className={`text-sm ${p.hl ? 'text-white/50' : 'text-ink-faint'}`}>{p.per}</span>
                </p>
                <ul className={`mt-6 space-y-2.5 text-sm ${p.hl ? 'text-white/85' : 'text-ink-soft'}`}>
                  {p.feats.map((f) => <li key={f} className="flex gap-2"><span className="text-mint-400 font-bold">✓</span>{f}</li>)}
                </ul>
                <Link href={appHref} className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-bold transition-colors ${p.hl ? 'bg-mint-500 text-pine-950 hover:bg-mint-400' : p.price === '₹0' ? 'bg-paper-100 text-pine-900 hover:bg-paper-200' : 'bg-pine-900 text-white hover:bg-pine-800'}`}>{p.cta}</Link>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 9 · What's your dream? */}
      <section className="pw-voice-bg py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-mint-500/10 blur-3xl pointer-events-none" />
        <Reveal className="relative max-w-3xl mx-auto px-6 text-center">
          <span className="mx-auto block w-16 h-16 rounded-full pw-orb-mini pw-float-y" />
          <h2 className="font-display text-5xl sm:text-6xl mt-8 pw-hero-glow">{c.endH}</h2>
          <p className="mt-4 text-white/65 text-lg">{c.endSub}</p>
          <form onSubmit={planDream} className="mt-9 flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
            <input value={dream} onChange={(e) => setDream(e.target.value)} placeholder={c.endPh} maxLength={300}
              className="flex-1 rounded-full bg-white/10 border border-white/15 px-6 py-4 text-white placeholder:text-white/35 outline-none focus:border-mint-400 transition-colors" />
            <button className="pw-shimmer-cta rounded-full text-pine-950 px-8 py-4 font-bold">{c.endCta}</button>
          </form>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="bg-pine-950 text-white/50 text-xs border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-2 gap-8">
          <div>
            <Link href="/" aria-label="PayWatch home"><LogoMark size={28} /></Link>
            <p className="mt-4 max-w-md leading-relaxed">PayWatch · {c.footer}</p>
          </div>
          <div className="flex gap-12 md:justify-end">
            <div className="space-y-2 flex flex-col">
              <span className="text-white/80 font-semibold mb-1">{c.legal}</span>
              <Link href="/legal/terms" className="hover:text-white">{c.terms}</Link>
              <Link href="/legal/privacy" className="hover:text-white">{c.privacy}</Link>
              <Link href="/legal/disclosures" className="hover:text-white">{c.disclosures}</Link>
            </div>
            <div className="space-y-2 flex flex-col">
              <span className="text-white/80 font-semibold mb-1">{c.contact}</span>
              <a href="mailto:support@paywatch.in" className="hover:text-white">support@paywatch.in</a>
              <a href="mailto:grievance@paywatch.in" className="hover:text-white">{c.grievance}</a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center">© {new Date().getFullYear()} PayWatch</div>
      </footer>
    </main>
  );
}
