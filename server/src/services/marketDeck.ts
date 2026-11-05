// "Money Wrapped" deck for the Markets page (D-59): one pamphlet per fact / news item / personal impact.
// Front = what happened; back = what it means for this user (rupee impacts from marketImpact, or the
// personal "why it matters"). Built once on the server so web and mobile show the same deck.

export interface PamphletImpact { title: string; detail: string; good: boolean | null; href: string; cta: string }
export interface Pamphlet {
  id: string; kind: 'fact' | 'news'; theme: string; themeLabel: string; forYou: boolean;
  kicker: string; published?: string | null; big?: string; delta?: { text: string; up: boolean } | null;
  headline: string; source: string; link?: string; noTranslate?: boolean;
  backTitle: string; backBody: string; impacts: PamphletImpact[];
}

const FACT_THEME: Record<string, string> = { repo: 'rates', cpi: 'inflation', food_cpi: 'inflation', cpi_projection: 'inflation' };
// Which personal impacts sit on the back of which fact card.
const FACT_IMPACTS: Record<string, (id: string) => boolean> = {
  repo: (id) => id.startsWith('rate-'),
  cpi: (id) => id === 'infl-savings',
  food_cpi: (id) => id === 'infl-spend',
  cpi_projection: (id) => id === 'infl-dreams',
};
const FACT_HEADLINE: Record<string, (f: any, up: boolean | null) => string> = {
  repo: (_f, up) => up == null ? 'RBI held its key lending rate.' : up ? 'RBI raised its key lending rate.' : 'RBI cut its key lending rate.',
  cpi: (f, up) => `Prices rose ${f.value}% in a year${up ? ' — faster than before.' : '.'}`,
  food_cpi: (f, up) => `Food got ${f.value}% costlier in a year${up ? ' — and it’s speeding up.' : '.'}`,
  cpi_projection: (f) => `RBI expects prices to rise about ${f.value}% this year.`,
};
const FACT_BACK: Record<string, string> = {
  repo: 'Banks usually pass this on: floating-rate loans can get dearer, and new FDs may pay a little more.',
  cpi: 'Money sitting idle loses this much value in a year. Savings need to grow faster than this to stay ahead.',
  food_cpi: 'Your kitchen and eating-out budget feels this first.',
  cpi_projection: 'Plan your dreams assuming prices rise about this much each year — PayWatch already does.',
};

export function buildDeck(m: any): Pamphlet[] {
  const impacts: any[] = m.impacts || [];
  const toImp = (i: any) => ({ title: i.title, detail: i.detail, good: i.good ?? null, href: i.href, cta: i.cta });
  const used = new Set<string>();
  const facts: Pamphlet[] = (m.facts || []).map((f: any) => {
    const d = f.prev != null ? +(f.value - f.prev).toFixed(2) : null;
    const mine = impacts.filter((i) => FACT_IMPACTS[f.key]?.(i.id));
    mine.forEach((i) => used.add(i.id));
    const theme = FACT_THEME[f.key] || 'economy';
    return {
      id: `fact-${f.key}`, kind: 'fact', theme, themeLabel: m.themeLabels?.[theme] || theme, forYou: mine.length > 0,
      kicker: f.label, big: `${f.value}%`, delta: d ? { text: `${Math.abs(d)} pts`, up: d > 0 } : null,
      headline: (FACT_HEADLINE[f.key] || (() => f.label))(f, d == null || d === 0 ? null : d > 0),
      source: f.source, link: f.sourceUrl,
      backTitle: mine.length ? (mine.length > 1 ? `${mine.length} ways this touches your money` : mine[0].title) : 'What this means',
      backBody: FACT_BACK[f.key] || f.note || '',
      impacts: mine.length === 1 ? [{ ...toImp(mine[0]), title: 'Your numbers' }] : mine.map(toImp),
    } as Pamphlet;
  });
  const news: Pamphlet[] = (m.news || []).map((n: any, k: number) => {
    const rel = impacts.find((i) => i.theme === n.theme);
    return {
      id: `news-${k}`, kind: 'news', theme: n.theme, themeLabel: n.themeLabel, forYou: !!n.forYou,
      kicker: n.source.split(',')[0], published: n.published || null,
      headline: n.title, source: n.source, link: n.link,
      backTitle: n.forYou ? 'Why this matters to you' : 'Good to know',
      backBody: n.whyItMatters,
      impacts: rel ? [toImp(rel)] : [],
    } as Pamphlet;
  });
  // Impacts not attached to any fact still deserve a card.
  const loose: Pamphlet[] = impacts.filter((i) => !used.has(i.id) && !(m.news || []).some((n: any) => n.theme === i.theme)).map((i) => ({
    id: `imp-${i.id}`, kind: 'fact', theme: i.theme, themeLabel: m.themeLabels?.[i.theme] || i.theme, forYou: true,
    kicker: 'Your money', headline: i.title, source: 'PayWatch, from your numbers',
    backTitle: 'Here’s the maths', backBody: '', impacts: [toImp(i)],
  }));
  // For-you first: facts that touch you, then for-you news, then the rest.
  const rank = (p: Pamphlet) => (p.forYou ? 0 : 1) * 10 + (p.kind === 'fact' ? 0 : 1);
  return [...facts, ...loose, ...news].sort((a, b) => rank(a) - rank(b));
}

