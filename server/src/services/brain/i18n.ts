// Bilingual text for everything the money brain says (English + Hindi).
// Deterministic templates — no AI needed — so Hindi works even with no API key.
// Keep wording simple and warm; numbers always come from the engine.

export type Lang = 'en' | 'hi';
export const asLang = (v: any): Lang => (v === 'hi' ? 'hi' : 'en');

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_HI = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
export function monthLabel(ym: string, lang: Lang): string {
  const [y, m] = ym.split('-');
  return `${(lang === 'hi' ? MONTHS_HI : MONTHS_EN)[Number(m) - 1]} ${y}`;
}

const CAT_HI: Record<string, string> = { food_dining: 'खाने-पीने', shopping: 'शॉपिंग', entertainment: 'मनोरंजन' };

export function M(lang: Lang) {
  const hi = lang === 'hi';
  const d = (ym: string) => monthLabel(ym, lang);
  return {
    thisThing: hi ? 'यह' : 'this',
    safetyName: hi ? 'सुरक्षा कवच (इमरजेंसी फंड)' : 'Safety net (emergency fund)',
    futureName: hi ? 'भविष्य के आप (लंबी अवधि का निवेश)' : 'Future you (long-term investing)',
    perMonth: hi ? '/महीना' : '/month',

    // levers
    freeUp: hi ? 'अभी आपका पूरा वेतन खर्च में जा रहा है — हर महीने थोड़ा भी बचाना पहला कदम है।'
      : 'Your spending uses all of your take-home right now — freeing up even a little each month is the first step.',
    useCash: (x: string) => hi ? `सुरक्षा कवच के ऊपर पड़े पैसों में से ${x} इसमें लगाइए — कमी आज ही पूरी हो जाएगी।`
      : `Move ${x} of the spare cash above your safety net into this — it closes the gap today.`,
    joy: (x: string) => hi ? `अपने खुशी-बजट से हर महीने ${x} इसमें लगाइए।` : `Use ${x} a month from your joy budget for this.`,
    trim: (x: string, cat: string, catLabel: string, pct: number) => hi
      ? `${CAT_HI[cat] || catLabel} पर हर महीने ${x} कम खर्च कीजिए (लगभग ${pct}% कम)।`
      : `Spend ${x} less a month on ${catLabel.toLowerCase()} (about ${pct}% less).`,
    extend: (ym: string, n: number, alloc: string) => hi ? `इसे ${d(ym)} तक बढ़ाइए (${n} महीने बाद), ${alloc}/महीना पर।`
      : `Push it to ${d(ym)} (${n} month${n === 1 ? '' : 's'} later) at ${alloc}/month.`,
    reduce: (x: string) => hi ? `या तारीख वही रखकर ${x} का लक्ष्य रखिए।` : `Or aim for ${x} instead and keep the date.`,
    lump: (x: string) => hi ? `एक बार ${x} (बोनस या गिफ़्ट) से कमी पूरी हो जाएगी।` : `A one-time ${x} (a bonus, a gift) would close the gap.`,
    slip: (name: string, ym: string | null) => hi ? (ym ? `${name} ${d(ym)} तक खिसकता है` : `${name} अभी रुक जाएगा`)
      : (ym ? `${name} moves to ${d(ym)}` : `${name} pauses for now`),
    reprioritise: (name: string, tail: string) => hi ? `${name} को पहले रखिए: यह फिट हो जाता है${tail}।` : `Make ${name} a priority: it fits${tail}.`,

    // plan summary
    sumNoData: hi ? 'अपनी मासिक कमाई और खर्च जोड़िए, ताकि मैं आपके सपनों का प्लान बना सकूँ।' : 'Add your take-home pay and monthly spending so I can plan your dreams.',
    sumOverspend: (th: string) => hi ? `अभी आपका पूरा ${th} वेतन खर्च में जा रहा है। पहले थोड़ी जगह बनाते हैं — फिर आपके सपने आगे बढ़ेंगे।`
      : `Right now your spending uses all of your ${th} take-home. Let’s free up some room first — then your dreams can start moving.`,
    sumNoDreams: (free: string) => hi ? `हर महीने लगभग ${free} आपके प्लान के लिए हैं। मुझे कोई सपना बताइए — कोई ट्रिप, गैजेट, माता-पिता का हेल्थ कवर — मैं उसका प्लान बना दूँगा।`
      : `You have about ${free} a month to plan with. Tell me a dream — a trip, a gadget, your parents’ health cover — and I’ll make it a plan.`,
    sum: (k: number, n: number, joy: string) => hi ? `${n} में से ${k} सपने ट्रैक पर हैं। हर महीने ${joy} बिना किसी चिंता के आपके हैं।`
      : `${k} of ${n} dream${n === 1 ? '' : 's'} on track. ${joy} a month is yours to enjoy, guilt-free.`,

    // affordability
    affNeedData: hi ? 'पहले अपनी मासिक कमाई और खर्च जोड़िए, फिर मैं तुरंत बता दूँगा।' : 'Add your take-home pay and monthly spending first, and I’ll answer in seconds.',
    affFree: hi ? 'यह तो मुफ़्त है — मज़े कीजिए!' : 'That’s free — enjoy!',
    affYesNow: (label: string, cash: string) => hi ? `हाँ — आप ${label} आज ही ले सकते हैं। आपके सुरक्षा कवच के ऊपर ${cash} हैं, इसलिए इमरजेंसी फंड को हाथ नहीं लगेगा।`
      : `Yes — you can pay for ${label} today. You have ${cash} above your safety net, so your emergency fund stays untouched.`,
    affUsesEarmark: (label: string, names: string) => hi ? `आप ${label} आज ले सकते हैं — पर इसमें ${names} के लिए अलग रखे पैसे लगेंगे, इसलिए ${names} में थोड़ा ज़्यादा समय लगेगा।`
      : `You can pay for ${label} today — but it uses money set aside for ${names}, so ${names} will take a little longer.`,
    affYesBy: (ym: string, m: string) => hi ? `हाँ — ${d(ym)} तक, हर महीने ${m} अलग रखकर, बिना बाकी सपनों को छुए।`
      : `Yes — by ${d(ym)}, putting aside ${m} a month, without touching your other dreams.`,
    affStretch: (ym: string, m: string, slip: string) => hi ? `${d(ym)} तक ${m}/महीना पर संभव है — लेकिन ${slip || 'आपका प्लान थोड़ा तंग होगा'}।`
      : `Possible by ${d(ym)} at ${m} a month — but ${slip || 'it squeezes your plan'}.`,
    affNotBy: (ym: string) => hi ? `मौजूदा आँकड़ों पर ${d(ym)} तक नहीं — इसे "हाँ" बनाने के तरीके ये रहे।` : `Not by ${d(ym)} on your current numbers — here’s how to make it a yes.`,
    affNotYet: (label: string) => hi ? `अभी आपके मौजूदा आँकड़ों पर नहीं — ${label} को "हाँ" बनाने के तरीके ये रहे।` : `Not yet on your current numbers — here’s how to make ${label} a yes.`,
    slipShort: (name: string, ym: string | null) => hi ? (ym ? `${name} ${d(ym)} तक खिसकता है` : `${name} रुक जाएगा`) : (ym ? `${name} moves to ${d(ym)}` : `${name} pauses`),
    waysToMakeIt: hi ? 'इसे संभव बनाने के तरीके:' : 'Ways to make it work:',

    // next moves
    safetyTitle: (x: string) => hi ? `अपना सुरक्षा कवच बनाइए — ${x}/महीना` : `Build your safety net — ${x}/month`,
    safetyWhy: (t: string, n: number) => hi ? `${t} का इमरजेंसी फंड (लगभग ${n} महीने का खर्च) होने से अचानक आया कोई बिल आपके सपनों को नहीं छू पाएगा।`
      : `An emergency fund of ${t} (about ${n} months of spending) means a surprise bill never touches your dreams.`,
    safetyImpact: (n: number) => hi ? `${n} महीने का सहारा` : `Covers ${n} months of life`,
    seePlan: hi ? 'मेरा प्लान देखें' : 'See my plan',
    dreamStretchTitle: (n: string) => hi ? `${n} थोड़ा मुश्किल है — ये रहा हल` : `${n} is a stretch — here’s the fix`,
    dreamYesTitle: (n: string) => hi ? `${n} को "हाँ" बनाइए` : `Make ${n} a yes`,
    dreamNeedWhy: (need: string, alloc: string) => hi ? `इसे हर महीने ${need} चाहिए; प्लान ${alloc} अलग रख पा रहा है।` : `It needs ${need}/month; the plan can set aside ${alloc}.`,
    gap: (x: string) => hi ? `${x}/महीना की कमी` : `${x}/month gap`,
    chooseFix: hi ? 'हल चुनें' : 'Choose a fix',
    replan: hi ? 'सपनों का प्लान दोबारा देखें' : 'Re-plan my dreams',
    idleTitle: (x: string) => hi ? `${x} आपके सुरक्षा कवच के ऊपर बेकार पड़े हैं` : `${x} is sitting idle above your safety net`,
    idleWhy: (dream: string | null) => hi ? (dream ? `इन्हें ${dream} की ओर लगाइए, वह जल्दी पूरा होगा।` : 'इन्हें कोई काम दीजिए — मुझे कोई सपना बताइए, मैं इन्हें लगा दूँगा।')
      : (dream ? `Point it at ${dream} and it gets there sooner.` : 'Give it a job — tell me a dream and I’ll put it to work.'),
    putToWork: hi ? 'काम पर लगाएँ' : 'Put it to work',
    protects: (dream: string) => hi ? ` — ताकि ${dream} पर कोई आँच न आए` : ` — so nothing derails ${dream}`,
    takeALook: hi ? 'देखें' : 'Take a look',
    doThis: hi ? 'यह करें' : 'Do this',

    // life events
    evHikeTitle: (x: string) => hi ? `आपकी सैलरी लगभग ${x} महीना बढ़ गई है` : `Your salary went up by about ${x} a month`,
    evHikeDetail: (p: number) => hi ? `आपकी सामान्य सैलरी से ${p}% ज़्यादा।` : `${p}% more than your usual credit.`,
    evHikeTip: (half: string) => hi ? `बढ़ोतरी का आधा (${half}/महीना) अपने सपनों के लिए तय कर दीजिए, इससे पहले कि खर्च उसे निगल जाए — बाकी आधे का मज़ा लीजिए।`
      : `Lock in half of the raise (${half}/month) for your dreams before lifestyle quietly eats it — enjoy the other half.`,
    evDropTitle: (x: string) => hi ? `इस महीने सैलरी ${x} कम आई` : `Your salary credit was ${x} lower this month`,
    evDropDetail: (p: number) => hi ? `सामान्य से ${p}% कम।` : `${p}% below your usual.`,
    evDropTip: hi ? 'अगर ऐसा चलता रहा, तो मैं आपके सपनों का प्लान नए आँकड़े के हिसाब से बदल दूँगा — सुरक्षा कवच सबसे पहले।'
      : 'If this continues, I’ll re-plan your dreams around the new number so nothing bounces — your safety net comes first.',
    evBonusTitle: (x: string) => hi ? `आपके खाते में ${x} आए हैं` : `${x} landed in your account`,
    evBonusTip: hi ? 'ऐसी एकमुश्त रकम कोई सपना जल्दी पूरा कर सकती है। देखें कौन-सा सपना सबसे पहले पूरा होगा?'
      : 'A lump sum like this can finish a dream early. Want me to show which dream it completes first?',
    evEmiTitle: (x: string) => hi ? `${x} की नई EMI शुरू हुई है` : `A new EMI of ${x} started`,
    evEmiTip: hi ? 'मैंने इसे आपके मासिक खर्च में जोड़ लिया है। लोन की जानकारी जोड़ेंगे तो मैं ब्याज और प्री-पेमेंट भी देख लूँगा।'
      : 'I’ve counted it in your monthly commitments. If it’s a loan, adding its details lets me check the interest and plan prepayment.',
    evBuyTitle: (x: string) => hi ? `इस महीने ${x} का बड़ा खर्च हुआ` : `A big spend of ${x} this month`,
    evBuyTip: hi ? 'कोई बात नहीं — मैंने इस महीने का प्लान बदल दिया है। अगर यह किसी सपने के लिए था, तो बता दीजिए, मैं उसे पूरा मार्क कर दूँगा।'
      : 'No judgement — I’ve adjusted this month’s plan. If it was for a dream, tell me and I’ll mark it as done.',

    // autopilot activity
    actFirstPlan: (n: number, joy: string) => hi ? `मैंने आपका प्लान बना दिया — ${n} सपने, और हर महीने ${joy} बिना चिंता के खर्च के लिए` : `I built your plan — ${n} dream${n === 1 ? '' : 's'}, and ${joy} a month guilt-free`,
    actOnTrack: (n: string) => hi ? `${n} अब ट्रैक पर है` : `${n} is now on track`,
    actWorse: (n: string) => hi ? `${n} को एक फ़ैसले की ज़रूरत है` : `${n} needs a decision`,
    actWorseBody: hi ? 'आपके आँकड़े बदले हैं — "हाँ" बनाने के तरीके देखें।' : 'Your numbers changed — see the options that keep it a yes.',
    actAchieved: (n: string) => hi ? `🎉 ${n} के लिए पूरा पैसा तैयार है — जब चाहें` : `🎉 ${n} is fully funded — ready when you are`,
    actSooner: (n: string, ym: string) => hi ? `${n} अब जल्दी — ${d(ym)} तक` : `${n} moved earlier — ${d(ym)}`,
    actLater: (n: string, ym: string) => hi ? `${n} अब ${d(ym)} तक खिसका` : `${n} moved to ${d(ym)}`,
    actFree: (a: string, b: string) => hi ? `आपका मासिक बचत-पैसा ${a} से ${b} हुआ — प्लान अपने-आप अपडेट हो गया` : `Your monthly free money changed from ${a} to ${b} — plan updated automatically`,
    actEarmark: (x: string, n: string) => hi ? `मैंने आपके अतिरिक्त पैसों में से ${x} ${n} के लिए अलग रख दिए` : `I set aside ${x} of your spare cash for ${n}`,
    actCaptured: (n: string, x: string) => hi ? `आपकी बात से नया सपना जोड़ा: ${n} (~${x})` : `Added a new dream from what you said: ${n} (~${x})`,
  };
}
