// Markets & Learn service.
//
// COMPLIANCE: PayWatch is an education/organisation tool, NOT a SEBI-registered
// adviser. This module therefore NEVER lists "top stocks to buy", names a
// security alongside recent price/performance, or implies future prices. It
// surfaces (a) general investment *themes/categories* as education, and
// (b) third-party financial *news* as information (with source links). Both are
// clearly framed as education/news, not advice.

export interface MarketTheme {
  theme: string;
  whatItIs: string;
  whoItSuits: string;
  risk: 'Low' | 'Medium' | 'High';
}

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  published: string | null;
}

export interface MarketData {
  themes: MarketTheme[];
  basics: string[];
  news: NewsItem[];
  newsError: boolean;
  disclaimer: string;
}

// Educational, category-level themes — never specific schemes or companies.
export function trendingThemes(): MarketTheme[] {
  return [
    { theme: 'Large-cap index funds', whatItIs: 'Funds that simply track India\'s biggest companies (Nifty 50 / Sensex). Low cost, no manager guesswork.', whoItSuits: 'Almost everyone — the steady core of a beginner portfolio.', risk: 'Medium' },
    { theme: 'Flexi-cap / multi-cap funds', whatItIs: 'Actively managed funds that invest across company sizes to chase growth.', whoItSuits: 'Those comfortable with more ups and downs for potentially higher returns.', risk: 'High' },
    { theme: 'International / US index funds', whatItIs: 'Funds that invest in global (often US) companies, giving exposure beyond India.', whoItSuits: 'Anyone wanting to spread risk across economies.', risk: 'High' },
    { theme: 'ELSS (tax-saving funds)', whatItIs: 'Equity funds that also cut your tax under Section 80C (3-year lock-in, old regime).', whoItSuits: 'Old-regime taxpayers wanting growth plus a tax break.', risk: 'High' },
    { theme: 'Gold (Sovereign Gold Bonds / ETFs)', whatItIs: 'Paper gold without storage worries; SGBs even pay ~2.5% interest a year.', whoItSuits: 'Everyone, as a small 5–10% cushion against market falls.', risk: 'Medium' },
    { theme: 'Debt & liquid funds', whatItIs: 'Funds that lend to companies/government for steady, low-volatility returns.', whoItSuits: 'Parking an emergency fund or money you need within a few years.', risk: 'Low' },
    { theme: 'REITs (real-estate trusts)', whatItIs: 'Listed trusts that let you own a slice of commercial property and earn rent, without buying a building.', whoItSuits: 'Those wanting real-estate exposure with far less money and more liquidity.', risk: 'Medium' },
    { theme: 'Small-cap funds', whatItIs: 'Funds investing in smaller companies — high growth potential but big swings.', whoItSuits: 'Experienced, long-horizon investors only, as a small satellite holding.', risk: 'High' },
  ];
}

export function marketBasics(): string[] {
  return [
    'Markets move every day — that\'s normal. What matters is staying invested for years, not reacting to a red or green day.',
    '“Past performance” is not a promise of future returns. A fund or theme that did well last year can lag the next.',
    'Cheaper is usually better: prefer low-cost index funds and the “Direct” plan version to keep more of your returns.',
    'Time in the market beats timing the market — a steady monthly SIP usually beats trying to buy the “bottom”.',
    'Before any individual stock, get comfortable with a broad index fund — it spreads your risk while you learn.',
  ];
}

// ── The personal Markets page ──────────────────────────────────────
import { query } from '../db';
import { loadProfileData } from './profile';
import { MARKET_FACTS, MarketFact } from './marketFacts';
import { fetchNews, newsSources, NewsSource } from '../adapters/news';
import { buildImpacts, personaliseNews, Impact, NewsCard, THEME_LABEL } from './marketImpact';

export interface MarketPage {
  facts: MarketFact[];
  impacts: Impact[];
  news: NewsCard[];
  newsError: boolean;
  sources: NewsSource[];
  themeLabels: typeof THEME_LABEL;
  themes: MarketTheme[];
  basics: string[];
  disclaimer: string;
  generatedAt: string;
}

export async function getMarketPage(userId: string, lang: 'en' | 'hi'): Promise<MarketPage> {
  const [p, goals, feed] = await Promise.all([
    loadProfileData(userId),
    query<any>(`SELECT name, goal_type, target_amount, current_amount FROM goals WHERE user_id = $1`, [userId]).catch(() => [] as any[]),
    fetchNews(lang),
  ]);
  const dreams = (goals || []).filter((g: any) => Number(g.current_amount) < Number(g.target_amount))
    .map((g: any) => ({ name: String(g.name), goalType: g.goal_type, target: Math.max(0, Number(g.target_amount) - Number(g.current_amount)) }));
  const profile = p || ({ user: { annual_gross_income: 0, monthly_take_home: 0, dependents_count: 0, age: null }, assets: {}, liabilities: {}, insurance: {}, tax_data: {}, monthlyExpenses: null } as any);
  return {
    facts: MARKET_FACTS,
    impacts: buildImpacts(profile, MARKET_FACTS, dreams),
    news: personaliseNews(feed.items, profile),
    newsError: feed.items.length === 0 && feed.failed.length > 0,
    sources: newsSources(),
    themeLabels: THEME_LABEL,
    themes: trendingThemes(),
    basics: marketBasics(),
    disclaimer:
      'Education and information only — not investment advice. PayWatch is not a SEBI-registered Investment Adviser and never recommends specific stocks, funds or companies. Rupee effects are estimates from the details you gave us and simple assumptions shown on each card. Rates and inflation figures are from the official sources listed; news headlines link to their original publisher.',
    generatedAt: new Date().toISOString(),
  };
}
