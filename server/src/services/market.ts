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

// Decode the handful of HTML entities that show up in RSS titles.
function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .trim();
}

// Fetch recent India markets/investing news from Google News RSS (keyless).
// Framed as third-party news, not advice. Fails soft (returns []).
export async function fetchMarketNews(): Promise<{ news: NewsItem[]; error: boolean }> {
  const url = 'https://news.google.com/rss/search?q=' +
    encodeURIComponent('when:7d (india stock market OR mutual fund OR investing OR personal finance OR sensex OR nifty)') +
    '&hl=en-IN&gl=IN&ceid=IN:en';
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'PayWatch/1.0' } });
    clearTimeout(t);
    if (!res.ok) return { news: [], error: true };
    const xml = await res.text();
    const items = xml.split('<item>').slice(1, 13);
    const news: NewsItem[] = items.map((block) => {
      const title = decode((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
      const link = decode((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '');
      const source = decode((block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || 'News');
      const published = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || null;
      // Google titles are "Headline - Source"; trim the trailing source.
      const cleanTitle = title.replace(new RegExp(`\\s*-\\s*${source}\\s*$`), '');
      return { title: cleanTitle, link, source, published };
    }).filter((n) => n.title && n.link);
    return { news, error: false };
  } catch {
    return { news: [], error: true };
  }
}

export async function getMarketData(): Promise<MarketData> {
  const { news, error } = await fetchMarketNews();
  return {
    themes: trendingThemes(),
    basics: marketBasics(),
    news,
    newsError: error,
    disclaimer:
      'This page is for education and information only — not investment advice. PayWatch is not a SEBI-registered Investment Adviser and does not recommend specific stocks, funds or companies. Themes are general categories; news is third-party content shown for awareness. Always do your own research or consult a SEBI-registered adviser before investing.',
  };
}
