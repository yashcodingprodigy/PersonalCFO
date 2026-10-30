// English + Hindi for the native app.
// 1) Core UI words are hand-translated below (t()).
// 2) Everything else — server-written guidance, plan text, page copy — goes through the
//    same /i18n/translate service the web app uses (shared server cache), batched, and
//    cached on the device, so the whole app reads in Hindi when the user picks it.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getLocales } from 'expo-localization';
import { File, Paths } from 'expo-file-system';
import { api, hasSession, patch } from './api';

export type Lang = 'en' | 'hi';

const D = {
  'tab.home': ['Home', 'होम'], 'tab.dreams': ['Dreams', 'सपने'], 'tab.ask': ['Ask', 'पूछें'], 'tab.alerts': ['Alerts', 'अलर्ट'], 'tab.more': ['More', 'और'],
  'common.save': ['Save', 'सेव करें'], 'common.cancel': ['Cancel', 'रद्द करें'], 'common.remove': ['Remove', 'हटाएँ'], 'common.retry': ['Try again', 'फिर कोशिश करें'],
  'common.loading': ['Loading…', 'लोड हो रहा है…'], 'common.seeAll': ['See all', 'सब देखें'], 'common.done': ['Done', 'हो गया'], 'common.close': ['Close', 'बंद करें'],
  'common.continue': ['Continue', 'आगे बढ़ें'], 'common.upload': ['Upload', 'अपलोड करें'], 'common.open': ['Open', 'खोलें'],
  'home.hi': ['Hi', 'नमस्ते'], 'home.kicker': ['Your money brain', 'आपका मनी ब्रेन'],
  'home.noDreams': ['Tell me a dream — I’ll make it a plan.', 'अपना एक सपना बताइए — मैं उसका प्लान बना दूँगा।'],
  'home.allOk': ['All {n} dreams are on track.', 'आपके सभी {n} सपने सही राह पर हैं।'],
  'home.oneOk': ['Your dream is on track.', 'आपका सपना सही राह पर है।'],
  'home.someOk': ['{k} of {n} dreams on track.', '{n} में से {k} सपने सही राह पर हैं।'],
  'home.noneOk': ['Your {n} dreams need a decision.', 'आपके {n} सपनों पर एक फ़ैसला चाहिए।'],
  'home.oneHelp': ['Your dream needs a decision.', 'आपके सपने पर एक फ़ैसला चाहिए।'],
  'home.working': ['I’m quietly handling tax, insurance and investing so these happen.', 'मैं चुपचाप टैक्स, बीमा और निवेश संभाल रहा हूँ ताकि ये पूरे हों।'],
  'home.idle': ['A trip, a gadget, your parents’ health cover — say it and I’ll plan it.', 'एक ट्रिप, एक गैजेट, माता-पिता का हेल्थ कवर — बताइए, मैं प्लान बना दूँगा।'],
  'home.tellDream': ['Tell me a dream', 'अपना सपना बताइए'], 'home.canIAfford': ['Can I afford…', 'क्या मैं ले सकता हूँ…'],
  'home.guiltFree': ['Guilt-free', 'बेफ़िक्र ख़र्च'], 'home.setAside': ['Set aside', 'अलग रखा'], 'home.safety': ['Safety net', 'सेफ़्टी नेट'],
  'home.yourDreams': ['Your dreams', 'आपके सपने'], 'home.addDream': ['Add a dream', 'सपना जोड़ें'],
  'home.flow': ['Where your money goes', 'आपका पैसा कहाँ जाता है'], 'home.away': ['While you were away', 'आपकी ग़ैरमौजूदगी में'],
  'home.awayEmpty': ['Nothing new yet — I’ll note everything I do for you here.', 'अभी कुछ नया नहीं — जो भी करूँगा, यहाँ लिखूँगा।'],
  'home.moves': ['Your next moves', 'आपके अगले कदम'], 'home.future': ['Future you', 'भविष्य के आप'], 'home.health': ['Money Health Score', 'मनी हेल्थ स्कोर'],
  'home.networth': ['Net worth', 'नेट वर्थ'], 'home.perMonth': ['/mo', '/माह'], 'home.doneBy': ['Done by', 'कब तक'], 'home.planned': ['Planned', 'प्लान में'], 'home.ready': ['Ready', 'तैयार'],
  'st.on_track': ['On track', 'सही राह पर'], 'st.stretch': ['A stretch', 'थोड़ा मुश्किल'], 'st.needs_tradeoff': ['Needs a decision', 'फ़ैसला चाहिए'], 'st.achieved': ['Done 🎉', 'पूरा 🎉'],
  'flow.income': ['Take-home', 'हाथ में आय'], 'flow.life': ['Living costs', 'रोज़ का ख़र्च'], 'flow.sip': ['Investing', 'निवेश'], 'flow.safety': ['Safety net', 'सेफ़्टी नेट'], 'flow.dreams': ['Dreams', 'सपने'], 'flow.joy': ['Guilt-free', 'बेफ़िक्र ख़र्च'],
  'as.howTalk': ['How do you want to talk?', 'कैसे बात करना चाहेंगे?'], 'as.voice': ['Talk', 'बोलकर'], 'as.voiceSub': ['Hands-free, like a call', 'कॉल की तरह, बिना हाथ लगाए'],
  'as.chat': ['Type', 'लिखकर'], 'as.chatSub': ['Chat in text', 'टेक्स्ट में चैट'], 'as.newChat': ['Start a new conversation', 'नई बातचीत शुरू करें'],
  'as.placeholder': ['Ask about your money…', 'अपने पैसों के बारे में पूछिए…'], 'as.title': ['Ask PayWatch', 'PayWatch से पूछें'],
  'vo.tapToTalk': ['Tap to talk', 'बोलने के लिए टैप करें'], 'vo.starting': ['Getting ready…', 'तैयार हो रहा है…'], 'vo.listening': ['Listening…', 'सुन रहा हूँ…'],
  'vo.thinking': ['Thinking…', 'सोच रहा हूँ…'], 'vo.speaking': ['Speaking — tap to interrupt', 'बोल रहा हूँ — रोकने के लिए टैप करें'],
  'vo.didntCatch': ['I didn’t catch that — tap and try again.', 'सुन नहीं पाया — टैप करके फिर बोलिए।'],
  'vo.denied': ['Microphone access is off. Turn it on in Settings → PayWatch → Microphone.', 'माइक्रोफ़ोन बंद है। Settings → PayWatch → Microphone में चालू करें।'],
  'vo.switchChat': ['Switch to chat', 'चैट पर जाएँ'], 'vo.human': ['Natural voice', 'प्राकृतिक आवाज़'], 'vo.device': ['Device voice', 'डिवाइस की आवाज़'],
  'gd.do': ['Do this', 'यह करें'], 'gd.avoid': ['Avoid', 'इनसे बचें'], 'gd.ask': ['Ask a follow-up', 'और पूछें'],
  'set.lang': ['App language', 'ऐप की भाषा'],
  'login.title': ['Sign in to PayWatch', 'PayWatch में साइन इन करें'], 'login.email': ['Email', 'ईमेल'], 'login.sendCode': ['Send code', 'कोड भेजें'],
  'login.code': ['6-digit code', '6 अंकों का कोड'], 'login.verify': ['Verify & continue', 'जाँचें और आगे बढ़ें'], 'login.demo': ['Explore with a demo account', 'डेमो अकाउंट से देखें'],
} as const;
export type TKey = keyof typeof D;

interface Ctx { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey, v?: Record<string, string | number>) => string }
const LangCtx = createContext<Ctx>({ lang: 'en', setLang: () => {}, t: (k) => D[k][0] });
export const useLang = () => useContext(LangCtx);

const K_LANG = 'paywatch_lang';
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => (getLocales()[0]?.languageCode === 'hi' ? 'hi' : 'en'));
  useEffect(() => { SecureStore.getItemAsync(K_LANG).then((v) => { if (v === 'en' || v === 'hi') setLangState(v); }).catch(() => {}); loadDisk(); }, []);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    SecureStore.setItemAsync(K_LANG, l).catch(() => {});
    if (hasSession()) patch('/user/me', { language: l }).catch(() => {});
  }, []);
  const t = useCallback((k: TKey, v?: Record<string, string | number>) => {
    let s: string = (D[k] ? D[k][lang === 'hi' ? 1 : 0] : String(k));
    if (v) for (const [a, b] of Object.entries(v)) s = s.split(`{${a}}`).join(String(b));
    return s;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

// ── automatic translation of dynamic text ───────────────────────────
const tr = new Map<string, string>();
const pending = new Set<string>();
let version = 0;
const subs = new Set<() => void>();
const bump = () => { version++; subs.forEach((s) => s()); };
let timer: ReturnType<typeof setTimeout> | null = null;
let diskTimer: ReturnType<typeof setTimeout> | null = null;
const diskFile = () => new File(Paths.document, 'paywatch_tr_hi.json');

async function loadDisk() {
  try {
    const f = diskFile();
    if (!f.exists) return;
    const obj = JSON.parse(await f.text());
    for (const [k, v] of Object.entries(obj)) if (typeof v === 'string') tr.set(k, v);
    bump();
  } catch {}
}
function saveDisk() {
  if (diskTimer) clearTimeout(diskTimer);
  diskTimer = setTimeout(() => {
    try {
      const entries = [...tr.entries()].slice(-4000);
      const f = diskFile();
      if (!f.exists) f.create();
      f.write(JSON.stringify(Object.fromEntries(entries)));
    } catch {}
  }, 1500);
}
const HAS_DEVANAGARI = /[ऀ-ॿ]/;
const needsTr = (s: string) => /[A-Za-z]{2,}/.test(s) && !HAS_DEVANAGARI.test(s) && s.length <= 800;

async function flush() {
  timer = null;
  const batch = [...pending].slice(0, 100);
  batch.forEach((b) => pending.delete(b));
  if (!batch.length || !hasSession()) return;
  try {
    const r = await api<{ texts: string[] }>('/i18n/translate', { method: 'POST', body: { lang: 'hi', texts: batch }, timeoutMs: 45000 });
    batch.forEach((src, i) => { const out = r.texts?.[i]; if (out && HAS_DEVANAGARI.test(out)) tr.set(src, out); });
    saveDisk(); bump();
  } catch {
    // retry once later
    setTimeout(() => { batch.forEach((b) => { if (!tr.has(b)) pending.add(b); }); schedule(); }, 4000);
  }
  if (pending.size) schedule();
}
function schedule() { if (!timer) timer = setTimeout(flush, 90); }

export function translateLater(s: string) {
  if (!needsTr(s) || tr.has(s) || pending.has(s)) return;
  pending.add(s); schedule();
}
function useTrVersion() {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, () => version, () => version);
}
/** Returns the Hindi version of an English string when Hindi is on (original until it arrives). */
export function useTr(s: string | undefined | null): string {
  const { lang } = useLang();
  useTrVersion();
  if (!s) return s ?? '';
  if (lang !== 'hi' || !needsTr(s)) return s;
  const hit = tr.get(s);
  if (hit) return hit;
  translateLater(s);
  return s;
}
