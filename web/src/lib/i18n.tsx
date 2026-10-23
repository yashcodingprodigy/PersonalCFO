'use client';

// Hindi + English for the whole app.
//  1. Hand-written dictionary (below) for the core experience — shell, Overview,
//     Dreams, assistant, voice — so it reads naturally and works offline.
//  2. <AutoTranslate/> covers every OTHER screen: it finds remaining English text
//     in the page and swaps in Hindi from our server (/i18n/translate — shared
//     cache + AI). No AI key on the server → everything simply stays English.
// Language is remembered on the device and on the account (users.language), and
// it drives the brain's sentences, Ask PayWatch replies and the voice.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, getTokens, patch } from './api';

export type Lang = 'en' | 'hi';
const KEY = 'paywatch_lang';

const D = {
  // shell & nav
  'nav./dashboard': ['Overview', 'होम'],
  'nav./ask': ['Ask PayWatch', 'PayWatch से पूछें'],
  'nav./alerts': ['Alerts', 'अलर्ट'],
  'nav./actions': ['Actions', 'करने लायक'],
  'nav./goals': ['Dreams', 'सपने'],
  'nav./networth': ['Net worth', 'कुल संपत्ति'],
  'nav./invest': ['Invest', 'निवेश'],
  'nav./markets': ['Markets & news', 'बाज़ार और ख़बरें'],
  'nav./tax': ['Tax', 'टैक्स'],
  'nav./insurance': ['Insurance', 'बीमा'],
  'nav./advisor': ['Your CA', 'आपके CA'],
  'nav./records': ['Monthly records', 'मासिक रिकॉर्ड'],
  'nav./statement': ['Statement scan', 'स्टेटमेंट स्कैन'],
  'nav./vault': ['Document vault', 'दस्तावेज़ तिजोरी'],
  'nav./reports': ['Reports', 'रिपोर्ट'],
  'nav./settings': ['Settings', 'सेटिंग्स'],
  'nav.more': ['More', 'और'],
  'nav.ask_short': ['Ask', 'पूछें'],
  'shell.signout': ['Sign out', 'साइन आउट'],
  'shell.upgrade': ['✦ Upgrade to PayWatch Plus', '✦ PayWatch Plus लें'],
  'shell.plan': ['plan', 'प्लान'],
  'shell.locked': ['Locked for your security', 'आपकी सुरक्षा के लिए लॉक है'],
  'shell.unlock': ['Unlock', 'खोलें'],
  // language
  'lang.title': ['Choose your language', 'अपनी भाषा चुनें'],
  'lang.sub': ['You can change this anytime from the menu.', 'आप इसे कभी भी मेन्यू से बदल सकते हैं।'],
  'lang.switch': ['हिंदी में देखें', 'View in English'],
  // assistant
  'as.howTalk': ['How do you want to talk?', 'कैसे बात करना चाहेंगे?'],
  'as.voice': ['Talk', 'बोलकर'],
  'as.voiceSub': ['Hands-free voice, English or Hindi', 'हाथ खाली, अंग्रेज़ी या हिंदी में'],
  'as.chat': ['Type', 'लिखकर'],
  'as.chatSub': ['Chat right here, on this page', 'इसी पेज पर चैट करें'],
  'as.placeholder': ['Ask about your money, or tell me a dream…', 'पैसों के बारे में पूछिए, या कोई सपना बताइए…'],
  'as.send': ['Send', 'भेजें'],
  'as.thinking': ['Reading your numbers…', 'आपके आँकड़े देख रहा हूँ…'],
  'as.fullpage': ['Open full chat', 'पूरी चैट खोलें'],
  'as.close': ['Close', 'बंद करें'],
  'as.hello': ['Hi! I know your money. Ask me anything — or just tell me something you want.', 'नमस्ते! मुझे आपके पैसों की पूरी जानकारी है। कुछ भी पूछिए — या बस बताइए आपको क्या चाहिए।'],
  'as.s1': ['Can I afford a trip to Goa in March?', 'क्या मैं मार्च में गोवा जा सकता हूँ?'],
  'as.s2': ['I want to buy a bike next year', 'मुझे अगले साल बाइक लेनी है'],
  'as.s3': ['Which tax regime saves me more?', 'कौन-सा टैक्स रिजीम ज़्यादा बचाता है?'],
  'as.s4': ['Am I on the right track?', 'क्या मैं सही रास्ते पर हूँ?'],
  'vo.listening': ['Listening…', 'सुन रहा हूँ…'],
  'vo.thinking': ['Thinking…', 'सोच रहा हूँ…'],
  'vo.speaking': ['Speaking…', 'बोल रहा हूँ…'],
  'vo.tapToTalk': ['Tap to talk', 'बोलने के लिए छुएँ'],
  'vo.tapToStop': ['Tap to stop', 'रोकने के लिए छुएँ'],
  'vo.didntCatch': ['I didn’t catch that — tap and try again.', 'मैं सुन नहीं पाया — छूकर फिर से बोलिए।'],
  'vo.noMic': ['Microphone isn’t available here — use chat instead.', 'यहाँ माइक्रोफ़ोन उपलब्ध नहीं है — चैट का इस्तेमाल करें।'],
  'vo.err.denied': ['Microphone access is blocked. Click the 🔒 / mic icon in the address bar → Allow microphone, then tap the orb.', 'माइक्रोफ़ोन की अनुमति बंद है। एड्रेस बार में 🔒 / माइक आइकन पर क्लिक करें → माइक्रोफ़ोन Allow करें, फिर ऑर्ब छुएँ।'],
  'vo.err.noMic': ['No working microphone found. Check it’s plugged in and not used by another app (Zoom, Meet…).', 'कोई चालू माइक्रोफ़ोन नहीं मिला। देखिए माइक जुड़ा है और कोई दूसरा ऐप (Zoom, Meet…) उसे इस्तेमाल नहीं कर रहा।'],
  'vo.err.unsupported': ['This browser can’t turn speech into text. Open PayWatch in Chrome or Edge — or use chat.', 'यह ब्राउज़र आवाज़ को टेक्स्ट में नहीं बदल पाता। PayWatch को Chrome या Edge में खोलें — या चैट इस्तेमाल करें।'],
  'vo.err.network': ['This browser’s speech service isn’t reachable (Brave, Arc and some others block it). Use Chrome or Edge — or use chat.', 'इस ब्राउज़र की स्पीच सर्विस नहीं मिल रही (Brave, Arc जैसे ब्राउज़र इसे रोकते हैं)। Chrome या Edge इस्तेमाल करें — या चैट करें।'],
  'vo.err.dictation': ['Safari needs Dictation turned on: System Settings → Keyboard → Dictation → On. Then tap the orb.', 'Safari के लिए Dictation चालू करना होगा: System Settings → Keyboard → Dictation → On। फिर ऑर्ब छुएँ।'],
  'vo.err.stt': ['Couldn’t process that recording — tap and try again.', 'रिकॉर्डिंग समझ नहीं पाया — छूकर फिर से कोशिश करें।'],
  'vo.switchChat': ['Switch to chat', 'चैट पर जाएँ'],
  'vo.human': ['Natural voice', 'असली जैसी आवाज़'],
  'vo.device': ['Device voice', 'डिवाइस की आवाज़'],
  // overview
  'ov.hi': ['Hi', 'नमस्ते'],
  'ov.dreamsOnTrack': ['{k} of your {n} dreams are on track.', 'आपके {n} में से {k} सपने ट्रैक पर हैं।'],
  'ov.h.oneOk': ['Your dream is on track.', 'आपका सपना ट्रैक पर है।'],
  'ov.h.allOk': ['All {n} of your dreams are on track.', 'आपके सभी {n} सपने ट्रैक पर हैं।'],
  'ov.h.oneHelp': ['Your dream needs a small push.', 'आपके सपने को थोड़ा सहारा चाहिए।'],
  'ov.h.noneOk': ['Your {n} dreams need a small push.', 'आपके {n} सपनों को थोड़ा सहारा चाहिए।'],
  'ov.noDreams': ['What do you want this year?', 'इस साल आप क्या चाहते हैं?'],
  'ov.brainWorking': ['Your money brain is working on them — quietly, every day.', 'आपका मनी ब्रेन रोज़ चुपचाप इन पर काम कर रहा है।'],
  'ov.brainIdle': ['Say it out loud — a trip, a gadget, your parents’ health cover. I’ll turn it into a plan.', 'बोलकर बताइए — कोई ट्रिप, गैजेट, माता-पिता का हेल्थ कवर। मैं उसका प्लान बना दूँगा।'],
  'ov.tellDream': ['Tell me a dream', 'कोई सपना बताइए'],
  'ov.canIAfford': ['Can I afford it?', 'क्या मैं ले सकता हूँ?'],
  'ov.yourDreams': ['Your dreams', 'आपके सपने'],
  'ov.yourDreamsSub': ['Each one has a plan. The money moves by itself.', 'हर सपने का प्लान है। पैसा अपने-आप सही जगह जाता है।'],
  'ov.addDream': ['Say a new dream', 'नया सपना बताइए'],
  'ov.doneBy': ['Done by', 'पूरा होगा'],
  'ov.ready': ['Ready ✓', 'तैयार ✓'],
  'ov.perMonth': ['/mo', '/महीना'],
  'ov.setAside': ['set aside for you', 'आपके लिए अलग रखा'],
  'ov.flowTitle': ['Where your money goes, every month', 'हर महीने आपका पैसा कहाँ जाता है'],
  'ov.flowSub': ['Planned automatically from your income and spending.', 'आपकी कमाई और खर्च से अपने-आप तय।'],
  'ov.flow.income': ['Take-home', 'कमाई'],
  'ov.flow.life': ['Living costs', 'घर-खर्च'],
  'ov.flow.sip': ['Investing', 'निवेश'],
  'ov.flow.safety': ['Safety net', 'सुरक्षा कवच'],
  'ov.flow.dreams': ['Dreams', 'सपने'],
  'ov.flow.joy': ['Guilt-free', 'बेफ़िक्र खर्च'],
  'ov.away': ['While you were away', 'आपकी ग़ैरमौजूदगी में'],
  'ov.awaySub': ['What your money brain did on its own.', 'आपके मनी ब्रेन ने ख़ुद क्या किया।'],
  'ov.awayEmpty': ['Nothing new — everything is on autopilot.', 'कुछ नया नहीं — सब ऑटोपायलट पर है।'],
  'ov.moves': ['Your next moves', 'आपके अगले कदम'],
  'ov.numbers': ['The numbers behind it', 'इसके पीछे के आँकड़े'],
  'ov.health': ['Money health', 'पैसों की सेहत'],
  'ov.networth': ['Net worth', 'कुल संपत्ति'],
  'ov.seeAll': ['See details', 'विस्तार से देखें'],
  'ov.spare': ['Spare cash', 'अतिरिक्त पैसा'],
  'ov.guiltFree': ['Guilt-free money', 'बेफ़िक्र खर्च'],
  'ov.monthly': ['a month', 'हर महीने'],
  'ov.st.on_track': ['On track', 'ट्रैक पर'],
  'ov.st.achieved': ['Ready', 'तैयार'],
  'ov.st.stretch': ['A stretch', 'थोड़ा मुश्किल'],
  'ov.st.needs_tradeoff': ['Needs a decision', 'फ़ैसला चाहिए'],
  'ov.kicker': ['Your money brain', 'आपका मनी ब्रेन'],
  'ov.future': ['Future you', 'भविष्य के आप'],
  'ov.futureSub': ['What today’s habits turn into.', 'आज की आदतें कल क्या बनेंगी।'],
  'ov.affordPh': ['e.g. iPhone ₹80k by March', 'जैसे iPhone ₹80 हज़ार मार्च तक'],
  'ov.affordGo': ['Check', 'जाँचें'],
  'ov.scroll': ['Scroll to see your plan', 'अपना प्लान देखने के लिए स्क्रॉल करें'],
  'ov.toGo': ['to go', 'बाक़ी'],
  'ov.planned': ['planned', 'तय'],
  'ov.settings.lang': ['App language', 'ऐप की भाषा'],
  'ov.settings.langSub': ['Every screen, answer and voice reply follows this.', 'हर स्क्रीन, जवाब और आवाज़ इसी भाषा में होगी।'],
  // generic
  'g.today': ['Today', 'आज'],
  'g.edit': ['Edit', 'बदलें'],
} as const;
export type TKey = keyof typeof D;

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey, vars?: Record<string, string | number>) => string; chosen: boolean }
const LangCtx = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (k) => D[k]?.[0] || String(k), chosen: true });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [chosen, setChosen] = useState(true);
  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s === 'hi' || s === 'en') { setLangState(s); setChosen(true); } else setChosen(false);
    } catch { /* storage blocked */ }
  }, []);
  useEffect(() => { try { document.documentElement.lang = lang === 'hi' ? 'hi' : 'en'; } catch {} }, [lang]);

  const setLang = useCallback((l: Lang) => {
    const prev = (typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) || 'en';
    try { localStorage.setItem(KEY, l); } catch {}
    setLangState(l); setChosen(true);
    if (getTokens().access) patch('/user/me', { language: l }).catch(() => {});
    // Leaving Hindi: reload so auto-translated text returns to the original English.
    if (prev === 'hi' && l === 'en') setTimeout(() => window.location.reload(), 50);
  }, []);
  const t = useCallback((k: TKey, vars?: Record<string, string | number>) => {
    let s: string = (D[k] || [String(k), String(k)])[lang === 'hi' ? 1 : 0];
    if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, String(b));
    return s;
  }, [lang]);
  return <LangCtx.Provider value={{ lang, setLang, t, chosen }}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);

/** Sync the device language from the account the first time we see the user. */
export function useSyncLangFromUser(userLang?: string | null) {
  const { setLang, chosen } = useLang();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !userLang) return;
    done.current = true;
    try {
      const local = localStorage.getItem(KEY);
      if (!local && (userLang === 'hi' || userLang === 'en')) setLang(userLang);
    } catch {}
  }, [userLang, setLang, chosen]);
}

/** First-run language chooser (shows once per device). */
export function LanguageChooser() {
  const { chosen, setLang, t } = useLang();
  if (chosen) return null;
  return (
    <div className="fixed inset-0 z-[90] bg-pine-950/80 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 text-center shadow-lift pw-fade-up">
        <p className="font-display text-2xl">Choose your language</p>
        <p className="font-display text-2xl text-pine-700 mt-1">अपनी भाषा चुनें</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={() => setLang('en')} className="rounded-2xl border-2 border-paper-200 hover:border-pine-700 py-5 transition-colors">
            <span className="block text-2xl font-display">Aa</span><span className="block text-sm font-bold mt-1">English</span>
          </button>
          <button onClick={() => setLang('hi')} className="rounded-2xl border-2 border-paper-200 hover:border-pine-700 py-5 transition-colors">
            <span className="block text-2xl font-display">अ</span><span className="block text-sm font-bold mt-1">हिंदी</span>
          </button>
        </div>
        <p className="text-xs text-ink-faint mt-4">{t('lang.sub')}</p>
      </div>
    </div>
  );
}

// ── Auto-translate everything not in the dictionary ────────────────────────
// Walks every visible text node (pages, overlays, modals, toasts), batches the
// English ones to /i18n/translate, and swaps in Hindi. Only real Hindi results are
// cached on the device, so a failed attempt is retried later instead of sticking.
const CACHE_KEY = 'paywatch_tr_hi_v2';
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SELECT', 'SVG', 'CANVAS', 'NOSCRIPT']);
const hasLatin = (s: string) => /[A-Za-z]{2,}/.test(s);
const isDevanagari = (s: string) => /[ऀ-ॿ]/.test(s);

export function AutoTranslate() {
  const { lang } = useLang();
  const [state, setState] = useState<'idle' | 'working' | 'off'>('idle');
  useEffect(() => {
    if (lang !== 'hi') { setState('idle'); return; }
    try { localStorage.removeItem('paywatch_tr_hi_v1'); } catch {}
    let cache: Record<string, string> = {};
    try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch {}
    let stopped = false, timer: any = null, busy = false, fails = 0;
    const pending = new Set<string>();
    const tried = new Map<string, number>(); // string → attempts this session

    const eligible = (n: Text) => {
      const s = (n.nodeValue || '').trim();
      if (!s || s.length < 2 || !hasLatin(s) || isDevanagari(s)) return false;
      let el = n.parentElement;
      while (el) { if (SKIP_TAGS.has(el.tagName) || el.hasAttribute('data-no-translate') || el.isContentEditable) return false; el = el.parentElement; }
      return true;
    };
    const want = (s: string) => { if ((tried.get(s) || 0) < 3) pending.add(s); };
    const apply = () => {
      const root = document.body; if (!root) return;
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = w.nextNode())) {
        const tn = n as Text;
        if (!eligible(tn)) continue;
        const s = tn.nodeValue!.trim();
        if (cache[s]) tn.nodeValue = tn.nodeValue!.replace(s, cache[s]); else want(s);
      }
      root.querySelectorAll<HTMLElement>('[placeholder],[title],[aria-label]').forEach((el) => {
        if (el.closest('[data-no-translate]')) return;
        for (const a of ['placeholder', 'title', 'aria-label']) {
          const v = el.getAttribute(a); if (!v || !hasLatin(v) || isDevanagari(v)) continue;
          if (cache[v]) el.setAttribute(a, cache[v]); else want(v);
        }
      });
    };
    const flush = async () => {
      if (stopped || busy || !pending.size) { if (!pending.size && !busy) setState((x) => (x === 'off' ? x : 'idle')); return; }
      busy = true; setState('working');
      const batch = Array.from(pending).slice(0, 60); batch.forEach((s) => { pending.delete(s); tried.set(s, (tried.get(s) || 0) + 1); });
      try {
        const r = await api<{ texts: string[]; available: boolean }>('/i18n/translate', { method: 'POST', body: JSON.stringify({ texts: batch, lang: 'hi' }) });
        if (!r.available) { stopped = true; setState('off'); setTimeout(() => setState('idle'), 7000); return; }
        fails = 0;
        batch.forEach((s, i) => { const d = r.texts[i]; if (d && d !== s && isDevanagari(d)) cache[s] = d; });
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
        apply();
      } catch {
        fails++; batch.forEach((s) => pending.add(s));
      } finally {
        busy = false;
        if (!stopped && pending.size) timer = setTimeout(flush, fails ? Math.min(30000, 1000 * 2 ** fails) : 150);
        else if (!stopped) setState('idle');
      }
    };
    const run = () => { if (stopped) return; apply(); clearTimeout(timer); timer = setTimeout(flush, 120); };
    run();
    const mo = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(run, 250); });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => { stopped = true; mo.disconnect(); clearTimeout(timer); };
  }, [lang]);

  if (lang !== 'hi' || state === 'idle') return null;
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[90] pointer-events-none pw-fade-in" data-no-translate>
      <span className="inline-flex items-center gap-2 rounded-full bg-pine-950/90 text-white text-[11px] font-semibold px-3 py-1.5 shadow-lift">
        {state === 'working' ? <><span className="pw-typing"><i /><i /><i /></span>हिंदी में बदल रहे हैं…</> : 'पूरा हिंदी अनुवाद अभी उपलब्ध नहीं — कुछ हिस्से अंग्रेज़ी में दिखेंगे'}
      </span>
    </div>
  );
}
