// "What does this change mean for ME?" — turns market facts and news into rupee
// estimates on the user's own money. Pure functions (tested). Education only: we
// explain effects on the user's loans, savings, spending and dreams; we never tell
// anyone to buy or sell a security.

import { ProfileData } from './score';
import { MarketFact } from './marketFacts';
import { inrIN } from '../lib/money';
import { RawNews } from '../adapters/news';

export interface DreamLite { name: string; goalType?: string; target: number /* paise */ }
export interface Impact {
  id: string;
  theme: Theme;
  title: string;           // headline in plain words, with the user's number
  detail: string;          // how we got it + what it means
  amount: number | null;   // paise per year (or per month where the title says so)
  direction: 'up' | 'down' | 'info';  // effect on the user's wallet: up = costs more / earns less? see `good`
  good: boolean | null;    // true = good for you, false = bad for you, null = neutral
  href: string; cta: string;
}

export type Theme = 'rates' | 'inflation' | 'tax' | 'markets' | 'insurance' | 'banking' | 'savings' | 'gold' | 'economy' | 'scam' | 'other';
export const THEME_LABEL: Record<Theme, string> = {
  rates: 'Interest rates', inflation: 'Prices & inflation', tax: 'Tax', markets: 'Markets & investing', insurance: 'Insurance',
  banking: 'Banking & UPI', savings: 'Savings schemes', gold: 'Gold', economy: 'Economy & jobs', scam: 'Fraud alert', other: 'Other',
};

const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const sumF = (arr: any, f: string) => (Array.isArray(arr) ? arr : []).reduce((s: number, x: any) => s + n(x?.[f]), 0);

/** Monthly EMI in paise. annualRatePct e.g. 8.5; months > 0. */
export function emi(principal: number, annualRatePct: number, months: number): number {
  const r = annualRatePct / 1200;
  if (principal <= 0 || months <= 0) return 0;
  if (r === 0) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

function profileFlags(p: ProfileData) {
  const a = p.assets || {}, l = p.liabilities || {};
  const equity = n(a.mutual_funds?.value) + n(a.stocks) + n(a.us_stocks);
  const sip = n(a.mutual_funds?.monthly_sip);
  const fd = n(a.fd_total), savings = n(a.savings_balance), liquid = n(a.liquid_funds);
  const homeLoans = Array.isArray(l.home_loans) ? l.home_loans : [];
  const fixedLoans = sumF(l.personal_loans, 'outstanding') + sumF(l.car_loans, 'outstanding') + sumF(l.education_loans, 'outstanding');
  const cards = sumF(l.credit_cards, 'outstanding');
  const ins = p.insurance || {};
  const hasInsurance = (Array.isArray(ins.term) && ins.term.length > 0) || (Array.isArray(ins.health) && ins.health.length > 0);
  const gross = n(p.user?.annual_gross_income);
  return {
    equity, sip, fd, savings, liquid, homeLoans, fixedLoans, cards, hasInsurance, gross,
    gold: n(a.gold), schemes: n(a.ppf) + n(a.epf) + n(a.nps), student: p.user?.employment_type === 'student',
    expenses: n(p.monthlyExpenses), takeHome: n(p.user?.monthly_take_home),
  };
}

/** Personal impacts of the latest rate & inflation facts. */
export function buildImpacts(p: ProfileData, facts: MarketFact[], dreams: DreamLite[] = []): Impact[] {
  const F = profileFlags(p);
  const out: Impact[] = [];
  const repo = facts.find((f) => f.key === 'repo');
  const cpi = facts.find((f) => f.key === 'cpi');
  const food = facts.find((f) => f.key === 'food_cpi');

  // ── Interest rates ────────────────────────────────────────────────
  if (repo && repo.prev != null && repo.value !== repo.prev) {
    const delta = repo.value - repo.prev;               // e.g. +0.25
    const up = delta > 0;
    const pct = `${Math.abs(delta).toFixed(2)}%`;
    if (F.homeLoans.length) {
      let change = 0, out0 = 0;
      for (const hl of F.homeLoans) {
        const P = n(hl.outstanding); if (P <= 0) continue;
        const rate = n(hl.rate) || 8.5;
        const months = n(hl.remaining_months) || n(hl.tenure_months) || 180;
        change += emi(P, rate + delta, months) - emi(P, rate, months); out0 += P;
      }
      if (out0 > 0) out.push({
        id: 'rate-home-emi', theme: 'rates', amount: Math.round(change),
        title: `${up ? 'Your home-loan EMI may rise' : 'Your home-loan EMI may fall'} by about ${inrIN(Math.abs(change))} a month`,
        detail: `RBI ${up ? 'raised' : 'cut'} the repo rate by ${pct}. Most home loans are linked to it, so banks usually pass this on within a few months — on your ${inrIN(out0)} outstanding (assuming ~15 years left, unless you told us). Banks often ${up ? 'extend the tenure instead of raising the EMI — ask yours which they did.' : 'reduce the tenure instead; you can ask for a lower EMI.'}`,
        direction: up ? 'up' : 'down', good: !up, href: '/networth', cta: 'See my loans',
      });
    } else {
      const home = dreams.find((d) => d.goalType === 'home_purchase' || /home|house|flat|ghar|घर/i.test(d.name));
      const car = dreams.find((d) => d.goalType === 'car_purchase');
      const tgt = home || car;
      if (tgt && tgt.target > 0) {
        const loan = tgt.target * (home ? 4 : 0.8);       // home dream is usually the down payment (~20%)
        const months = home ? 240 : 60, rate = home ? 8.5 : 9.5;
        const change = emi(loan, rate + delta, months) - emi(loan, rate, months);
        out.push({
          id: 'rate-dream-loan', theme: 'rates', amount: Math.round(change),
          title: `A loan for “${tgt.name}” would cost about ${inrIN(Math.abs(change))} a month ${up ? 'more' : 'less'}`,
          detail: `If you borrow around ${inrIN(loan)} over ${months / 12} years, a ${pct} ${up ? 'rise' : 'fall'} in rates changes the EMI by roughly this much. ${up ? 'Saving a bigger down payment cuts the impact.' : 'Lower rates make the loan cheaper.'}`,
          direction: up ? 'up' : 'down', good: !up, href: '/goals', cta: 'See this dream',
        });
      }
    }
    if (F.fixedLoans > 0) out.push({
      id: 'rate-fixed', theme: 'rates', amount: 0,
      title: 'Your personal, car or education loans probably won’t change',
      detail: `Those are usually fixed-rate, so this ${pct} move doesn’t touch your ${inrIN(F.fixedLoans)} outstanding. Check your loan letter to be sure.`,
      direction: 'info', good: null, href: '/networth', cta: 'See my loans',
    });
    const parked = F.fd + F.liquid;
    if (parked > 0) {
      const extra = parked * (delta / 100);
      out.push({
        id: 'rate-fd', theme: 'rates', amount: Math.round(Math.abs(extra)),
        title: `${up ? 'FD and debt-fund returns tend to rise' : 'FD and debt-fund returns tend to fall'} — about ${inrIN(Math.abs(extra))} a year on your ${inrIN(parked)}`,
        detail: `${up ? 'Banks usually lift deposit rates after a hike, but only for new or renewed FDs.' : 'New FDs usually pay a little less after a cut; existing FDs keep their rate until maturity.'} This assumes rates move by the same ${pct}.`,
        direction: up ? 'down' : 'up', good: up, href: '/invest', cta: 'See my investments',
      });
    }
    if (F.cards > 0) out.push({
      id: 'rate-card', theme: 'rates', amount: null,
      title: `Clear your ${inrIN(F.cards)} credit-card balance first`,
      detail: 'Card interest is 36–42% a year whatever RBI does — paying it off is the best “return” available to you.',
      direction: 'info', good: null, href: '/actions', cta: 'See my action plan',
    });
  }

  // ── Inflation ─────────────────────────────────────────────────────
  if (cpi) {
    const infl = cpi.value;
    if (F.savings > 0) {
      const savingsRate = 3;                                 // typical savings-account interest
      const loss = F.savings * Math.max(0, infl - savingsRate) / 100;
      if (loss > 0) out.push({
        id: 'infl-savings', theme: 'inflation', amount: Math.round(loss),
        title: `Idle cash is losing about ${inrIN(loss)} a year in buying power`,
        detail: `Prices are rising ${infl}% a year while a savings account pays ~${savingsRate}%. Your ${inrIN(F.savings)} in savings buys a little less each month. Keep your safety net there — but money you won’t need for a while can work harder.`,
        direction: 'down', good: false, href: '/invest', cta: 'Put idle money to work',
      });
    }
    if (F.expenses > 0) {
      const more = F.expenses * infl / 100;
      out.push({
        id: 'infl-spend', theme: 'inflation', amount: Math.round(more),
        title: `The same lifestyle could cost about ${inrIN(more)} more a month next year`,
        detail: `If your ${inrIN(F.expenses)} monthly spending rises with ${infl}% inflation${food ? ` (food is up ${food.value}%)` : ''}. Worth checking that your income grows at least this fast.`,
        direction: 'up', good: false, href: '/statement', cta: 'See where my money goes',
      });
    }
    const dreamTotal = dreams.reduce((s, d) => s + Math.max(0, d.target), 0);
    if (dreamTotal > 0) {
      const more = dreamTotal * infl / 100;
      out.push({
        id: 'infl-dreams', theme: 'inflation', amount: Math.round(more),
        title: `Your dreams get about ${inrIN(more)} costlier for every year they wait`,
        detail: `At ${infl}% inflation, the ${inrIN(dreamTotal)} your dreams cost today grows each year. Your plan already builds this in — starting sooner is the cheapest fix.`,
        direction: 'up', good: false, href: '/goals', cta: 'See my dreams',
      });
    }
  }

  // ── Investing (education, never a tip) ───────────────────────────
  if (F.equity > 0 || F.sip > 0) out.push({
    id: 'mkt-steady', theme: 'markets', amount: null,
    title: F.sip > 0 ? `Rate and inflation news can make markets jumpy — your ${inrIN(F.sip)} SIP keeps buying through it` : 'Rate and inflation news can make markets jumpy for a while',
    detail: 'Short-term swings after policy news are normal. A long-term plan matters more than any one week. This is general education, not advice on any security.',
    direction: 'info', good: null, href: '/invest', cta: 'See my investing plan',
  });
  return out;
}

// ── News: themes + "why it matters to you" ─────────────────────────
const RULES: [Theme, RegExp][] = [
  ['scam', /\b(fraud|scam|fake|phishing|cyber ?crime|digital arrest|impersonat)|धोखाधड़ी|फर्जी|ठगी|साइबर/i],
  ['rates', /\b(repo|interest rate|monetary policy|mpc|policy rate|lending rate|emi)\b|रेपो|ब्याज दर|मौद्रिक नीति/i],
  ['inflation', /\b(inflation|cpi|wpi|consumer price|price rise|retail prices)\b|महंगाई|मुद्रास्फीति|उपभोक्ता मूल्य/i],
  ['tax', /\b(income[- ]tax|gst|cbdt|itr|tds|tax|advance tax|customs duty)\b|आयकर|जीएसटी|कराधान|कर विभाग/i],
  ['insurance', /\b(insurance|irdai|policyholder|ayushman|pmjjby|pmsby)\b|बीमा|आयुष्मान/i],
  ['savings', /\b(ppf|epfo|epf|nps|pension|small savings|sukanya|atal pension|post office|provident fund)\b|पेंशन|भविष्य निधि|ईपीएफओ|सुकन्या|बचत योजना/i],
  ['markets', /\b(sebi|sensex|nifty|stock market|shares?|mutual funds?|ipo|equity|demat|investors?)\b|शेयर|म्यूचुअल|सेबी|निवेशक/i],
  ['gold', /\b(gold|sovereign gold bond|sgb)\b|सोना|स्वर्ण/i],
  ['banking', /\b(bank|banks|upi|deposit|loan|credit card|rbi|npci|digital payment)\b|बैंक|यूपीआई|ऋण|जमा/i],
  ['economy', /\b(gdp|economy|growth|jobs|employment|salary|wages|exports?|budget|fiscal)\b|अर्थव्यवस्था|जीडीपी|रोजगार|बजट/i],
];
export function classifyNews(title: string): Theme {
  for (const [t, re] of RULES) if (re.test(title)) return t;
  return 'other';
}

export interface NewsCard extends RawNews { theme: Theme; themeLabel: string; forYou: boolean; whyItMatters: string }

export function personaliseNews(items: RawNews[], p: ProfileData): NewsCard[] {
  const F = profileFlags(p);
  const seen = new Set<string>();
  const cards: NewsCard[] = [];
  for (const it of items) {
    const key = it.title.toLowerCase().replace(/\W+/g, ' ').trim().slice(0, 80);
    if (seen.has(key)) continue; seen.add(key);
    const theme = classifyNews(it.title);
    if (theme === 'other' && it.provider === 'pib') continue;      // PIB covers everything; keep only money news
    let forYou = false, why = '';
    switch (theme) {
      case 'rates':
        forYou = F.homeLoans.length > 0 || F.fd + F.liquid > 0;
        why = F.homeLoans.length ? 'Rate changes flow into your home-loan EMI within a few months.' : F.fd > 0 ? `Affects what new FDs pay on money like your ${inrIN(F.fd)} in FDs.` : 'Rate changes move loan EMIs and FD returns.';
        break;
      case 'inflation':
        forYou = true;
        why = F.expenses > 0 ? `Rising prices push up your ${inrIN(F.expenses)} monthly spending and your dream costs.` : 'Rising prices shrink what your savings can buy.';
        break;
      case 'tax':
        forYou = F.gross > 0 && !F.student;
        why = forYou ? 'Tax rule changes can change your refund or payable — your Tax page recalculates automatically.' : 'Useful to know as your income grows.';
        break;
      case 'insurance':
        forYou = F.hasInsurance || n(p.user?.dependents_count) > 0;
        why = F.hasInsurance ? 'May affect your policies, claims or renewals.' : 'Relevant to the cover you may need.';
        break;
      case 'savings':
        forYou = F.schemes > 0;
        why = F.schemes > 0 ? 'Touches schemes you hold (PPF / EPF / NPS) — rates or rules may change your returns.' : 'Government savings schemes — safe options worth knowing.';
        break;
      case 'markets':
        forYou = F.equity > 0 || F.sip > 0;
        why = forYou ? 'You invest in markets — read for context, but don’t react to one headline.' : 'Context on markets — not a reason to buy or sell anything.';
        break;
      case 'gold':
        forYou = F.gold > 0;
        why = F.gold > 0 ? `You hold about ${inrIN(F.gold)} in gold.` : 'Gold is a common cushion in a portfolio.';
        break;
      case 'banking':
        forYou = true;
        why = 'Changes to banking, UPI or deposits affect everyday money.';
        break;
      case 'scam':
        forYou = true;
        why = 'Stay safe: never share OTPs, PINs or screen access — banks and the government never ask for them.';
        break;
      case 'economy':
        forYou = !F.student && F.takeHome > 0;
        why = 'The bigger picture behind jobs, salaries and prices.';
        break;
      default:
        why = 'For general awareness.';
    }
    cards.push({ ...it, theme, themeLabel: THEME_LABEL[theme], forYou, whyItMatters: why });
  }
  // For-you first, then newest (items without dates keep feed order)
  return cards.sort((a, b) => Number(b.forYou) - Number(a.forYou)).slice(0, 40);
}
