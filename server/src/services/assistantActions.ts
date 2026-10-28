// Assistant actions — lets Ask PayWatch (chat AND voice) DO things in the app:
//   • take you to any page ("show me some health insurance" → marketplace, Health tab)
//   • put a personal guide in the corner of that page (what to do / what to avoid)
//   • change a dream's amount or date ("move my Bali trip to March", "make the laptop 90k")
//   • change settings (language, risk level)
// Deterministic and bilingual (EN / Hindi / Hinglish) so it works with or without an AI key.
// Compliance: guides are general pointers from the user's own inputs — never a product pick.

import { query, one } from '../db';
import { ProfileData } from './score';
import { analyseInsurance } from './insurance';
import { compareRegimes } from './tax';
import { buildInvestmentGuidance } from './investment';
import { inrIN, inrRangeIN } from '../lib/money';
import { parseRupees, parseMonths } from './brain/dreamCapture';

export type AssistantAction =
  | { type: 'navigate'; path: string; label: string }
  | { type: 'guide'; page: string; title: string; intro?: string; doThis: string[]; avoid: string[]; footnote?: string }
  | { type: 'refresh' }
  | { type: 'set_language'; value: 'en' | 'hi' };

export interface ActionPlan { actions: AssistantAction[]; note: string | null; confirm: string | null }

const VERB = /\b(open|go to|goto|take me|show|navigate|bring up|view|see|check out|find|compare|buy|get me|where (is|are|can i))\b|le chalo|le jao|dikhao|dikha do|dikhaa|kholo|khol do|chalo|दिखाओ|दिखा|खोलो|ले चलो|चलो|ले जाओ/i;

const PAGES: { re: RegExp; path: string; en: string; hi: string }[] = [
  { re: /\b(file|filing)\b.*\b(itr|return)\b|\bitr\b/i, path: '/file', en: 'ITR preparation', hi: 'ITR तैयारी' },
  { re: /\btax|regime|80c|80d|deduction|टैक्स/i, path: '/tax', en: 'Tax', hi: 'टैक्स' },
  { re: /\binvest|\bsip\b|mutual fund|portfolio|निवेश/i, path: '/invest', en: 'Invest', hi: 'निवेश' },
  { re: /\b(dreams?|goals?|sapn|सपन)/i, path: '/goals', en: 'Dreams', hi: 'सपने' },
  { re: /net ?worth|assets|सम्पत्ति|संपत्ति/i, path: '/networth', en: 'Net worth', hi: 'कुल संपत्ति' },
  { re: /\balerts?|notifications?/i, path: '/alerts', en: 'Alerts', hi: 'अलर्ट' },
  { re: /\b(actions?|to-?do|next moves?)\b/i, path: '/actions', en: 'Actions', hi: 'कदम' },
  { re: /\b(records?|payslip|salary slip|form ?16|26as|ais)\b/i, path: '/records', en: 'Monthly records', hi: 'मासिक रिकॉर्ड' },
  { re: /\b(statement|spending|expenses|kharch|खर्च)/i, path: '/statement', en: 'Statement scan', hi: 'स्टेटमेंट स्कैन' },
  { re: /\b(vault|documents?)\b/i, path: '/vault', en: 'Document vault', hi: 'डॉक्यूमेंट वॉल्ट' },
  { re: /\b(ca|chartered accountant|accountant)\b/i, path: '/advisor', en: 'Your CA', hi: 'आपका CA' },
  { re: /\b(markets?|news)\b/i, path: '/markets', en: 'Markets & news', hi: 'मार्केट और खबरें' },
  { re: /\b(settings?|profile|my details)\b/i, path: '/settings', en: 'Settings', hi: 'सेटिंग्स' },
  { re: /\b(plans?|subscription|upgrade|pricing)\b/i, path: '/plans', en: 'Plans', hi: 'प्लान' },
  { re: /\breports?\b/i, path: '/reports', en: 'Reports', hi: 'रिपोर्ट' },
  { re: /rent receipts?/i, path: '/rent-receipts', en: 'Rent receipts', hi: 'किराया रसीद' },
  { re: /\b(home|overview|dashboard)\b/i, path: '/dashboard', en: 'Overview', hi: 'ओवरव्यू' },
];
const INSURANCE = /insurance|insure|policy|policies|\bcover\b|mediclaim|bima|बीमा|इंश्योरेंस/i;
const SHOPPING = /\b(buy|compare|plans?|options?|quotes?|relevant|suggest|show|marketplace|good|best|kharid|lena|chahiye|dikhao|dikha|batao)\b|खरीद|दिखा|बताओ/i;
const INS_CAT: [RegExp, string, string, string][] = [
  [/health|mediclaim|hospital|medical|स्वास्थ्य|हेल्थ/i, 'health', 'Health', 'हेल्थ'],
  [/\bterm\b|life insurance|life cover|जीवन/i, 'term', 'Term life', 'टर्म लाइफ'],
  [/\b(car|bike|motor|vehicle|scooter|two-?wheeler)\b|गाड़ी/i, 'motor', 'Motor', 'मोटर'],
  [/travel|trip/i, 'travel', 'Travel', 'ट्रैवल'],
  [/\b(home|house|property)\b/i, 'home', 'Home', 'होम'],
  [/accident/i, 'personal_accident', 'Personal accident', 'दुर्घटना'],
  [/critical|cancer|heart/i, 'critical_illness', 'Critical illness', 'गंभीर बीमारी'],
];

const DISCLAIM_EN = 'General pointers from the details you gave — not advice. Policies are arranged through our IRDAI-licensed partner, subject to insurer terms.';
const DISCLAIM_HI = 'आपकी दी हुई जानकारी पर आधारित सामान्य सुझाव — सलाह नहीं। पॉलिसी हमारे IRDAI-लाइसेंस्ड पार्टनर के ज़रिए, बीमा कंपनी की शर्तों के अनुसार।';

function insuranceGuide(p: ProfileData, cat: string, hi: boolean): AssistantAction {
  const a = analyseInsurance(p);
  const avoid = hi
    ? ['एंडोमेंट / मनी-बैक / ULIP — बीमा और निवेश को अलग रखें', 'सिर्फ़ टैक्स बचाने के लिए बीमा न खरीदें', 'बहुत छोटा (₹2–3 लाख) हेल्थ कवर — एक बड़ा बिल ही इसे खत्म कर देगा']
    : a.avoid.map((x) => x.split(' — ')[0].replace(/\.$/, ''));
  const common = hi
    ? ['हर कार्ड पर क्लेम सेटलमेंट रेशियो देखें', 'अपनी सेहत की जानकारी ईमानदारी से बताएं', 'आगे बढ़ने से पहले 2–3 विकल्पों की तुलना करें']
    : ['Check the claim settlement ratio shown on each card', 'Disclose health history honestly — hidden facts get claims rejected', 'Compare 2–3 options before you continue'];
  let doThis: string[]; let title: string;
  if (cat === 'term') {
    title = hi ? 'टर्म लाइफ कवर चुनते समय' : 'Choosing term life cover';
    doThis = [
      hi ? `कवर लगभग ${inrRangeIN(a.term.recommended)} रखें (अभी ${inrIN(a.term.current)})` : `Aim for about ${inrRangeIN(a.term.recommended)} of cover (you have ${inrIN(a.term.current)})`,
      hi ? 'सिर्फ़ "प्योर टर्म" प्लान, 60–65 साल की उम्र तक' : 'Pick a pure term plan with cover till age 60–65',
      ...common,
    ];
  } else if (cat === 'motor') {
    title = hi ? 'गाड़ी का बीमा चुनते समय' : 'Choosing motor insurance';
    doThis = hi ? ['थर्ड-पार्टी कवर कानूनन ज़रूरी है', 'नई गाड़ी हो तो ज़ीरो-डेप ऐड-ऑन लें', 'IDV (गाड़ी की कीमत) सही रखें', 'पॉलिसी लैप्स होने से पहले रिन्यू करें']
      : ['Third-party cover is legally required', 'Add zero-depreciation if the vehicle is new', 'Keep the IDV (insured value) realistic — not too low', 'Renew before it lapses'];
  } else {
    title = hi ? 'हेल्थ कवर चुनते समय' : 'Choosing health cover';
    doThis = [
      hi ? `परिवार के लिए लगभग ${inrRangeIN(a.health.recommended)} कवर (अभी ${inrIN(a.health.current)})` : `Aim for about ${inrRangeIN(a.health.recommended)} for your family (you have ${inrIN(a.health.current)})`,
      hi ? 'रूम-रेंट लिमिट और को-पे न हो तो बेहतर' : 'Prefer no room-rent cap and no co-pay',
      hi ? 'माता-पिता के लिए अलग पॉलिसी' : 'Cover parents on a separate policy',
      ...common,
    ];
  }
  return { type: 'guide', page: '/insurance/market', title, doThis: doThis.slice(0, 5), avoid: avoid.slice(0, 3), footnote: hi ? DISCLAIM_HI : DISCLAIM_EN };
}

function taxGuide(p: ProfileData, hi: boolean): AssistantAction | null {
  try {
    const c: any = compareRegimes(p);
    const better = c.recommended === 'old' ? (hi ? 'पुरानी' : 'old') : (hi ? 'नई' : 'new');
    return {
      type: 'guide', page: '/tax', title: hi ? 'आपके टैक्स के लिए' : 'For your tax',
      doThis: hi
        ? [`आपके आंकड़ों में ${better} रिजीम से लगभग ${inrIN(c.savings || 0)} बचते हैं`, 'Records में Form 16 / सैलरी स्लिप डालें — आंकड़े अपने-आप भरेंगे', '“How to reduce your tax” सेक्शन के कदम देखें']
        : [`On your numbers the ${better} regime saves about ${inrIN(c.savings || 0)}`, 'Upload your Form 16 / payslip in Records so figures fill themselves', 'Work through the “How to reduce your tax” steps'],
      avoid: hi ? ['सिर्फ़ 80C के लिए मार्च में जल्दबाज़ी में निवेश', 'प्रूफ़ की आख़िरी तारीख़ चूकना'] : ['Last-minute March investing just for 80C', 'Missing your employer’s proof-submission deadline'],
      footnote: hi ? 'टैक्स की गणना और गाइडेंस — CA की जगह नहीं।' : 'Tax computation & guidance — works alongside your CA.',
    };
  } catch { return null; }
}

function investGuide(p: ProfileData, hi: boolean): AssistantAction | null {
  try {
    const g: any = buildInvestmentGuidance(p);
    const cats: string[] = (g.recommendations || g.categories || []).slice(0, 3).map((r: any) => r.category || r.name || r.title).filter(Boolean);
    return {
      type: 'guide', page: '/invest', title: hi ? 'निवेश शुरू करने से पहले' : 'Before you invest',
      doThis: [
        ...(hi ? ['पहले 6 महीने का इमरजेंसी फंड पूरा करें', 'हर महीने एक तय SIP — बाज़ार गिरने पर भी जारी रखें'] : ['Finish your 6-month safety net first', 'Keep a fixed monthly SIP — and keep it going when markets fall']),
        ...(cats.length ? [hi ? `आपके लिए देखने लायक कैटेगरी: ${cats.join(', ')}` : `Categories that fit your profile: ${cats.join(', ')}`] : []),
      ],
      avoid: hi ? ['टिप्स या "गारंटीड रिटर्न" वाले ऑफ़र', 'एक ही जगह सारा पैसा'] : ['Tips or anything promising “guaranteed returns”', 'Putting everything in one place'],
      footnote: hi ? 'सिर्फ़ शिक्षा — किसी खास फंड/शेयर की सलाह नहीं।' : 'Education only — never a specific fund or stock.',
    };
  } catch { return null; }
}

/** Work out what the app should DO for this message (before the answer is written). */
export async function planActions(userId: string, question: string, p: ProfileData, lang: 'en' | 'hi'): Promise<ActionPlan> {
  const q = question.trim();
  const hi = lang === 'hi';
  const actions: AssistantAction[] = [];
  const notes: string[] = [];
  let confirm: string | null = null;

  // 1) Language switch
  const toHi = /\b(talk|speak|reply|answer|baat)\b.*\b(hindi)\b|switch to hindi|hindi (mein|me|में)|हिंदी में/i.test(q);
  const toEn = /\b(talk|speak|reply|answer|baat)\b.*\benglish\b|switch to english|english (mein|me|में)|अंग्रेज़ी में|इंग्लिश में/i.test(q);
  if (toHi || toEn) {
    const v = toHi ? 'hi' : 'en';
    await query(`UPDATE users SET language = $2 WHERE user_id = $1`, [userId, v]).catch(() => {});
    actions.push({ type: 'set_language', value: v });
    notes.push(v === 'hi' ? 'Switched the app language to Hindi.' : 'Switched the app language to English.');
  }

  // 2) Risk level
  const risk = q.match(/\brisk\b.*\b(aggressive|moderate|balanced|conservative|cautious|safe)\b/i)?.[1]?.toLowerCase();
  if (risk && /\b(set|change|make|switch|update|keep)\b|kar do|karo/i.test(q)) {
    const v = risk === 'balanced' ? 'moderate' : risk === 'cautious' || risk === 'safe' ? 'conservative' : risk;
    await query(`UPDATE users SET risk_appetite = $2 WHERE user_id = $1`, [userId, v]).catch(() => {});
    actions.push({ type: 'refresh' });
    notes.push(`Set the user's risk level to ${v}.`);
  }

  // 3) Update an existing dream (amount / date)
  if (/\b(change|update|increase|reduce|raise|lower|make (it|the)|move|shift|postpone|prepone|push|pull)\b|badha|kam kar|बदल|बढ़ा|घटा/i.test(q)) {
    const goals = await query<any>(`SELECT goal_id, name, target_amount, target_date FROM goals WHERE user_id = $1`, [userId]).catch(() => [] as any[]);
    const lower = q.toLowerCase();
    const g = goals.find((x: any) => String(x.name).toLowerCase().split(/[^a-z0-9ऀ-ॿ]+/).some((w: string) => w.length >= 4 && lower.includes(w)));
    if (g) {
      const amt = parseRupees(q);
      const months = parseMonths(q, new Date());
      const sets: string[] = []; const vals: any[] = [g.goal_id];
      if (amt > 0) { vals.push(amt); sets.push(`target_amount = $${vals.length}`); }
      if (months != null) {
        const d = new Date(); d.setMonth(d.getMonth() + months); d.setDate(1);
        vals.push(d.toISOString().slice(0, 10)); sets.push(`target_date = $${vals.length}`);
      }
      if (sets.length) {
        await query(`UPDATE goals SET ${sets.join(', ')} WHERE goal_id = $1`, vals);
        import('./brain/autopilot').then((m) => m.scheduleBrainTick(userId, 'dream_updated', 300)).catch(() => {});
        actions.push({ type: 'refresh' });
        const what = [amt > 0 ? inrIN(amt) : '', months != null ? (hi ? `${months} महीने में` : `in ${months} months`) : ''].filter(Boolean).join(hi ? ', ' : ', ');
        confirm = hi ? `✅ **${g.name}** अपडेट कर दिया — ${what}। प्लान अपने-आप बदल गया है।` : `✅ Updated **${g.name}** — ${what}. Your plan has re-planned itself.`;
        notes.push(`Updated the dream "${g.name}" (${what}).`);
      }
    }
  }

  // 4) Navigation (+ a guide for pages where one helps)
  if (VERB.test(q) || /\b(take|le)\b/i.test(q)) {
    if (INSURANCE.test(q) && SHOPPING.test(q)) {
      const a = analyseInsurance(p);
      const found = INS_CAT.find(([re]) => re.test(q));
      const cat = found ? found[1] : a.health.gap > 0 ? 'health' : a.term.gap > 0 ? 'term' : 'health';
      const catName = found ? found[hi ? 3 : 2] : (INS_CAT.find((c) => c[1] === cat)![hi ? 3 : 2]);
      actions.push({ type: 'navigate', path: `/insurance/market?category=${cat}`, label: hi ? `बीमा मार्केटप्लेस — ${catName}` : `Insurance marketplace — ${catName}` });
      actions.push(insuranceGuide(p, cat, hi));
      notes.push(`Opened the insurance marketplace on the ${catName} options and pinned a short what-to-do / what-to-avoid guide in the corner.`);
    } else if (INSURANCE.test(q)) {
      actions.push({ type: 'navigate', path: '/insurance', label: hi ? 'बीमा' : 'Insurance' });
      notes.push('Opened the Insurance page.');
    } else {
      const page = PAGES.find((x) => x.re.test(q));
      if (page) {
        actions.push({ type: 'navigate', path: page.path, label: hi ? page.hi : page.en });
        const guide = page.path === '/tax' ? taxGuide(p, hi) : page.path === '/invest' ? investGuide(p, hi) : null;
        if (guide) actions.push(guide);
        notes.push(`Opened the ${page.en} page${guide ? ' and pinned a short guide in the corner' : ''}.`);
      }
    }
  }

  return { actions, note: notes.length ? notes.join(' ') : null, confirm };
}
