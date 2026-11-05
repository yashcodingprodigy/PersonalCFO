// Money news from sources we are allowed to use commercially.
//
//  • PIB (Press Information Bureau, Govt of India) — ON by default. PIB's copyright policy
//    allows reproduction free of charge without prior approval, provided it is accurate,
//    not misleading, and the source is prominently acknowledged. We show headline + link
//    + "Source: PIB, Government of India". https://pib.gov.in/Content/102_2_Copyright-Policy.aspx
//  • NewsData.io — ON only when NEWSDATA_API_KEY is set (use a PAID plan; the paid plans
//    are licensed for commercial use). We show headline, publisher and link only.
//  • RBI / SEBI press releases — OFF unless RBI_FEED_PERMITTED=1 / SEBI_FEED_PERMITTED=1.
//    RBI's terms require written permission to link to internal pages; SEBI's website
//    policy requires emailing them for permission before reproducing. Flip the flag only
//    after you have that permission in writing.
//
// Google News RSS was removed: its terms don't clearly allow commercial apps.

export interface RawNews { title: string; link: string; source: string; published: string | null; provider: 'pib' | 'newsdata' | 'rbi' | 'sebi'; lang: 'en' | 'hi' }
export interface NewsSource { id: RawNews['provider']; name: string; enabled: boolean; license: string; url: string }

const env = (k: string) => (process.env[k] || '').trim();

export function newsSources(): NewsSource[] {
  return [
    { id: 'pib', name: 'Press Information Bureau (PIB), Govt of India', enabled: true, license: 'Government content — free reproduction with acknowledgement (PIB copyright policy)', url: 'https://pib.gov.in' },
    { id: 'newsdata', name: 'NewsData.io (licensed news API)', enabled: !!env('NEWSDATA_API_KEY'), license: 'Commercial licence via paid NewsData.io plan', url: 'https://newsdata.io' },
    { id: 'rbi', name: 'Reserve Bank of India — press releases', enabled: env('RBI_FEED_PERMITTED') === '1', license: 'Shown only with RBI’s written permission', url: 'https://www.rbi.org.in' },
    { id: 'sebi', name: 'SEBI — press releases', enabled: env('SEBI_FEED_PERMITTED') === '1', license: 'Shown only with SEBI’s permission', url: 'https://www.sebi.gov.in' },
  ];
}

function decode(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** Minimal RSS 2.0 reader (title / link / pubDate). Exported for tests. */
export function parseRss(xml: string, provider: RawNews['provider'], source: string, lang: 'en' | 'hi', max = 40): RawNews[] {
  return xml.split(/<item[\s>]/).slice(1, max + 1).map((block) => {
    const title = decode((block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
    const link = decode((block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '');
    const published = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim() || null;
    return { title, link, source, published, provider, lang };
  }).filter((n) => n.title && /^https?:\/\//.test(n.link));
}

async function getText(url: string, ms = 7000): Promise<string | null> {
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'PayWatch/1.0 (+https://paywatch.in)' } });
    clearTimeout(t);
    return res.ok ? await res.text() : null;
  } catch { return null; }
}

// 15-minute cache per source+language, so we never hammer anyone's servers.
const cache = new Map<string, { at: number; items: RawNews[] }>();
async function cached(key: string, fn: () => Promise<RawNews[] | null>): Promise<RawNews[] | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 15 * 60e3) return hit.items;
  const items = await fn();
  if (items) cache.set(key, { at: Date.now(), items });
  return items ?? hit?.items ?? null;
}

const pib = (lang: 'en' | 'hi') => cached(`pib:${lang}`, async () => {
  const xml = await getText(`https://pib.gov.in/RssMain.aspx?ModId=6&Lang=${lang === 'hi' ? 2 : 1}&Regid=3`);
  return xml ? parseRss(xml, 'pib', 'PIB, Govt of India', lang) : null;
});

const newsdata = () => cached('newsdata', async () => {
  const key = env('NEWSDATA_API_KEY'); if (!key) return [];
  const q = encodeURIComponent('inflation OR "repo rate" OR "income tax" OR "mutual fund" OR sensex OR nifty OR "personal finance" OR GST OR insurance');
  const body = await getText(`https://newsdata.io/api/1/latest?apikey=${encodeURIComponent(key)}&country=in&language=en&category=business&q=${q}`);
  if (!body) return null;
  try {
    const j: any = JSON.parse(body);
    return (j.results || []).slice(0, 30).map((r: any) => ({
      title: String(r.title || '').trim(), link: String(r.link || ''), source: String(r.source_name || r.source_id || 'News'),
      published: r.pubDate || null, provider: 'newsdata' as const, lang: 'en' as const,
    })).filter((n: RawNews) => n.title && /^https?:\/\//.test(n.link));
  } catch { return null; }
});

const sebi = () => cached('sebi', async () => {
  const xml = await getText('https://www.sebi.gov.in/sebirss.xml');
  return xml ? parseRss(xml, 'sebi', 'SEBI', 'en').filter((n) => /press-releases|circulars/.test(n.link)) : null;
});
const rbi = () => cached('rbi', async () => {
  const xml = await getText('https://www.rbi.org.in/pressreleases_rss.xml');
  return xml ? parseRss(xml, 'rbi', 'RBI', 'en') : null;
});

/** All enabled sources, in the user's language where the source offers it. */
export async function fetchNews(lang: 'en' | 'hi'): Promise<{ items: RawNews[]; failed: string[] }> {
  const on = new Set(newsSources().filter((s) => s.enabled).map((s) => s.id));
  const jobs: [string, Promise<RawNews[] | null>][] = [['pib', pib(lang)]];
  if (on.has('newsdata')) jobs.push(['newsdata', newsdata()]);
  if (on.has('rbi')) jobs.push(['rbi', rbi()]);
  if (on.has('sebi')) jobs.push(['sebi', sebi()]);
  const res = await Promise.all(jobs.map(([, p]) => p));
  const failed = jobs.filter((_, i) => res[i] === null).map(([id]) => id);
  const items = res.flatMap((r) => r || []);
  return { items, failed };
}
