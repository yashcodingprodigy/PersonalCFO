// Portfolio look-through — analyses INDIVIDUAL holdings (each stock, fund and
// bond) to measure TRUE diversification, beyond the asset-class breakdown in
// the Money Health Score. Education only — never rates or recommends a specific
// security. All values in paise.

export type HoldingType = 'stock' | 'fund' | 'bond' | 'other';
export type Cap = 'large' | 'mid' | 'small' | 'unknown';

export interface Holding {
  id: string;
  type: HoldingType;
  name: string;
  value: number;           // paise
  sector?: string;         // stocks / sectoral funds
  cap?: Cap;               // stocks
  category?: string;       // funds (see FUND_CATEGORIES)
}

export const SECTORS = [
  'Banking & financials', 'IT & technology', 'Energy & oil', 'FMCG & consumer',
  'Healthcare & pharma', 'Automobile', 'Metals & mining', 'Infra & realty',
  'Telecom', 'Industrials', 'Chemicals', 'Other',
];

// Each fund category maps to an equity/debt/gold bucket and an implied cap.
export const FUND_CATEGORIES: { key: string; label: string; bucket: 'equity' | 'debt' | 'gold' | 'hybrid'; cap: Cap; sectoral?: boolean }[] = [
  { key: 'index', label: 'Index fund (Nifty/Sensex)', bucket: 'equity', cap: 'large' },
  { key: 'large_cap', label: 'Large-cap fund', bucket: 'equity', cap: 'large' },
  { key: 'flexi', label: 'Flexi / multi-cap fund', bucket: 'equity', cap: 'large' },
  { key: 'mid_cap', label: 'Mid-cap fund', bucket: 'equity', cap: 'mid' },
  { key: 'small_cap', label: 'Small-cap fund', bucket: 'equity', cap: 'small' },
  { key: 'elss', label: 'ELSS (tax-saver)', bucket: 'equity', cap: 'large' },
  { key: 'sectoral', label: 'Sectoral / thematic fund', bucket: 'equity', cap: 'unknown', sectoral: true },
  { key: 'international', label: 'International fund', bucket: 'equity', cap: 'large' },
  { key: 'hybrid', label: 'Hybrid / balanced fund', bucket: 'hybrid', cap: 'large' },
  { key: 'debt', label: 'Debt / liquid fund', bucket: 'debt', cap: 'unknown' },
  { key: 'gold', label: 'Gold fund / ETF', bucket: 'gold', cap: 'unknown' },
];

export interface PortfolioAnalysis {
  hasHoldings: boolean;
  totalValue: number;
  holdingsCount: number;
  stockCount: number;
  byType: { type: HoldingType; value: number; pct: number }[];
  byBucket: { equity: number; debt: number; gold: number };   // pct
  sectors: { sector: string; value: number; pct: number }[];  // sorted desc
  caps: { large: number; mid: number; small: number; unknown: number }; // pct of equity
  topSectorPct: number;
  largestHolding: { name: string; pct: number } | null;
  level: 'well_diversified' | 'moderate' | 'concentrated' | 'too_few';
  insights: { tone: 'good' | 'warn' | 'bad'; text: string }[];
}

const pctOf = (x: number, total: number) => (total > 0 ? Math.round((x / total) * 100) : 0);

export function analyzePortfolio(holdingsRaw: any): PortfolioAnalysis {
  const holdings: Holding[] = Array.isArray(holdingsRaw) ? holdingsRaw.filter((h) => Number(h?.value) > 0) : [];
  const total = holdings.reduce((s, h) => s + Number(h.value), 0);

  if (holdings.length === 0 || total === 0) {
    return {
      hasHoldings: false, totalValue: 0, holdingsCount: 0, stockCount: 0,
      byType: [], byBucket: { equity: 0, debt: 0, gold: 0 }, sectors: [],
      caps: { large: 0, mid: 0, small: 0, unknown: 0 }, topSectorPct: 0, largestHolding: null,
      level: 'too_few', insights: [],
    };
  }

  // By type
  const typeMap = new Map<HoldingType, number>();
  for (const h of holdings) typeMap.set(h.type, (typeMap.get(h.type) || 0) + Number(h.value));
  const byType = Array.from(typeMap.entries()).map(([type, value]) => ({ type, value, pct: pctOf(value, total) }));

  // Bucket (equity/debt/gold) + cap split for equity + sectors
  let equity = 0, debt = 0, gold = 0;
  const sectorMap = new Map<string, number>();
  const capMap = { large: 0, mid: 0, small: 0, unknown: 0 };
  const addSector = (s: string | undefined, v: number) => { const k = s && SECTORS.includes(s) ? s : 'Other'; sectorMap.set(k, (sectorMap.get(k) || 0) + v); };

  for (const h of holdings) {
    const v = Number(h.value);
    if (h.type === 'stock') {
      equity += v;
      capMap[(h.cap as Cap) in capMap ? (h.cap as Cap) : 'unknown'] += v;
      addSector(h.sector, v);
    } else if (h.type === 'fund') {
      const cat = FUND_CATEGORIES.find((c) => c.key === h.category);
      if (cat?.bucket === 'debt') debt += v;
      else if (cat?.bucket === 'gold') gold += v;
      else if (cat?.bucket === 'hybrid') { equity += v * 0.65; debt += v * 0.35; capMap.large += v * 0.65; }
      else { equity += v; capMap[(cat?.cap as Cap) || 'unknown'] += v; if (cat?.sectoral) addSector(h.sector, v); }
    } else if (h.type === 'bond') {
      debt += v;
    } else {
      // 'other' → treat as equity-ish unknown
      equity += v; capMap.unknown += v;
    }
  }

  const equityTotal = equity || 1;
  const caps = {
    large: pctOf(capMap.large, equityTotal), mid: pctOf(capMap.mid, equityTotal),
    small: pctOf(capMap.small, equityTotal), unknown: pctOf(capMap.unknown, equityTotal),
  };
  const sectors = Array.from(sectorMap.entries())
    .map(([sector, value]) => ({ sector, value, pct: pctOf(value, total) }))
    .sort((a, b) => b.value - a.value);
  const topSectorPct = sectors[0]?.pct || 0;

  const largest = [...holdings].sort((a, b) => Number(b.value) - Number(a.value))[0];
  const largestHolding = largest ? { name: largest.name, pct: pctOf(Number(largest.value), total) } : null;
  const stockCount = holdings.filter((h) => h.type === 'stock').length;

  // Insights
  const insights: PortfolioAnalysis['insights'] = [];
  if (holdings.length < 3) insights.push({ tone: 'warn', text: `You have only ${holdings.length} holding${holdings.length === 1 ? '' : 's'}. A single setback hits your whole portfolio — spreading across more holdings and asset types reduces that risk.` });
  if (largestHolding && largestHolding.pct > 20) insights.push({ tone: 'bad', text: `${largestHolding.name} is ${largestHolding.pct}% of your portfolio. Concentration above ~20% in one holding is risky — if it falls, so does most of your wealth.` });
  if (topSectorPct > 35 && sectors[0]) insights.push({ tone: 'bad', text: `${sectors[0].sector} makes up ${topSectorPct}% of your portfolio — heavily concentrated in one sector. A sector-wide downturn would hit hard.` });
  if (stockCount > 0 && stockCount < 8 && caps.large + caps.mid + caps.small > 0) insights.push({ tone: 'warn', text: `You hold ${stockCount} individual stock${stockCount === 1 ? '' : 's'}. Picking few stocks is high-risk; a broad index fund spreads you across the whole market instantly.` });
  if (caps.small > 40) insights.push({ tone: 'warn', text: `${caps.small}% of your equity is small-cap — high growth potential but very volatile. Make sure your horizon is long (7+ years).` });
  if (caps.large === 0 && equity > 0) insights.push({ tone: 'warn', text: 'You hold no large-cap equity. Large-caps are the stable core most portfolios are built around.' });
  if (gold === 0) insights.push({ tone: 'warn', text: 'No gold in your portfolio. A small slice (5–10%) cushions losses when equities fall.' });
  if (debt === 0 && equity > 0) insights.push({ tone: 'warn', text: 'You hold no debt (FDs/PPF/debt funds/bonds). Some debt smooths the ride and is money you can lean on in a downturn.' });
  if (insights.length === 0) insights.push({ tone: 'good', text: 'Nicely spread — no single holding or sector dominates, and you hold a mix of asset types. Keep rebalancing once a year.' });
  else if (largestHolding && largestHolding.pct <= 15 && topSectorPct <= 30) insights.unshift({ tone: 'good', text: 'No single holding dominates your portfolio — a healthy sign.' });

  // Level
  let level: PortfolioAnalysis['level'];
  if (holdings.length < 3) level = 'too_few';
  else if ((largestHolding && largestHolding.pct > 25) || topSectorPct > 40) level = 'concentrated';
  else if ((largestHolding && largestHolding.pct > 15) || topSectorPct > 30 || insights.filter((i) => i.tone !== 'good').length >= 3) level = 'moderate';
  else level = 'well_diversified';

  return {
    hasHoldings: true, totalValue: total, holdingsCount: holdings.length, stockCount,
    byType, byBucket: { equity: pctOf(equity, total), debt: pctOf(debt, total), gold: pctOf(gold, total) },
    sectors, caps, topSectorPct, largestHolding, level, insights,
  };
}
