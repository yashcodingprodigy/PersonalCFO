// Portfolio look-through engine. Takes parsed holdings (name + value) from a
// broker / CDSL / mutual-fund export and classifies each into asset class,
// equity market-cap and (for direct stocks) sector — then scores how truly
// diversified the portfolio is. Educational only; never names a "buy".
// All values in paise.

export interface HoldingInput { name: string; value: number; units?: number; type?: string }

export interface ClassifiedHolding {
  name: string;
  value: number;
  assetClass: 'equity' | 'debt' | 'gold' | 'international' | 'cash' | 'other';
  cap: 'large' | 'mid' | 'small' | 'diversified' | null;  // for equity
  sector: string | null;                                   // for direct stocks
  kind: 'stock' | 'fund' | 'etf' | 'bond' | 'other';
}

// Compact sector map for common large-cap Indian stocks. Unknowns fall back to
// "Unclassified" — we never pretend to know more than we do.
const STOCK_SECTORS: { re: RegExp; sector: string }[] = [
  { re: /reliance|ongc|ntpc|power grid|coal india|adani (green|power|energy|transmission)|tata power|gail|ioc|bpcl/, sector: 'Energy & Power' },
  { re: /hdfc|icici|kotak|axis|sbi|state bank|bajaj fin|indusind|federal bank|pnb|bank of baroda|idfc|au small/, sector: 'Financials' },
  { re: /tcs|infosys|infy|wipro|hcl|tech mahindra|ltimindtree|mphasis|persistent|coforge/, sector: 'IT' },
  { re: /sun pharma|cipla|dr reddy|divi|lupin|aurobindo|biocon|torrent pharma|apollo hospital|max health/, sector: 'Pharma & Health' },
  { re: /itc|hindustan unilever|hul|nestle|britannia|dabur|marico|godrej cons|tata consumer|varun bever|colgate/, sector: 'FMCG' },
  { re: /maruti|tata motors|mahindra|bajaj auto|hero moto|eicher|tvs motor|ashok leyland|bosch/, sector: 'Auto' },
  { re: /l&t|larsen|siemens|abb|bhel|cummins|thermax|havells|polycab/, sector: 'Capital Goods' },
  { re: /asian paints|ultratech|ambuja|acc|shree cement|jsw steel|tata steel|hindalco|vedanta|grasim|pidilite|berger/, sector: 'Materials' },
  { re: /bharti airtel|jio|vodafone|idea|indus tower/, sector: 'Telecom' },
  { re: /dmart|avenue super|trent|titan|zomato|nykaa|paytm|info edge|naukri|irctc/, sector: 'Consumer & New-age' },
];

export function classifyHolding(h: HoldingInput): ClassifiedHolding {
  const n = h.name.toLowerCase();
  const t = (h.type || '').toLowerCase();
  const isFund = /fund|mutual|mf\b|scheme|plan/.test(n) || /mutual|fund|mf/.test(t);
  const isEtf = /\betf\b|bees/.test(n) || /etf/.test(t);
  const isBond = /\bbond\b|g-?sec|gsec|ncd|debenture|t-?bill|treasury/.test(n) || /bond|debt/.test(t);

  // Gold first (applies across kinds)
  if (/gold|silver|sgb|sovereign gold/.test(n)) return { name: h.name, value: h.value, assetClass: 'gold', cap: null, sector: null, kind: isEtf ? 'etf' : isFund ? 'fund' : 'other' };
  // International
  if (/nasdaq|s&p\s?500|us equity|us \b|global|international|greater china|emerging market|hang seng|fang/.test(n)) return { name: h.name, value: h.value, assetClass: 'international', cap: 'diversified', sector: null, kind: isEtf ? 'etf' : 'fund' };

  if (isFund || isEtf) {
    // Debt funds
    if (/liquid|overnight|money market|ultra short|low duration|short duration|corporate bond|banking & psu|gilt|\bdebt\b|\bbond\b|income|credit risk|dynamic bond/.test(n))
      return { name: h.name, value: h.value, assetClass: 'debt', cap: null, sector: null, kind: isEtf ? 'etf' : 'fund' };
    // Equity by cap
    let cap: ClassifiedHolding['cap'] = 'diversified';
    if (/small\s?cap/.test(n)) cap = 'small';
    else if (/mid\s?cap/.test(n)) cap = 'mid';
    else if (/large\s?cap|nifty\s?50|sensex|top\s?100|bluechip|nifty next|index/.test(n)) cap = 'large';
    else if (/flexi|multi\s?cap|large\s?&?\s?mid|elss|tax\s?saver|value|focused|contra|dividend yield|equity/.test(n)) cap = 'diversified';
    return { name: h.name, value: h.value, assetClass: 'equity', cap, sector: null, kind: isEtf ? 'etf' : 'fund' };
  }

  if (isBond) return { name: h.name, value: h.value, assetClass: 'debt', cap: null, sector: null, kind: 'bond' };

  // Direct stock — look up sector; cap defaults to "large" if known, else null.
  const known = STOCK_SECTORS.find((s) => s.re.test(n));
  return { name: h.name, value: h.value, assetClass: 'equity', cap: known ? 'large' : null, sector: known ? known.sector : 'Unclassified', kind: 'stock' };
}

export interface HoldingsAnalysis {
  total: number;
  count: number;
  holdings: ClassifiedHolding[];
  byAssetClass: { label: string; key: string; value: number; pct: number }[];
  equityByCap: { label: string; value: number; pct: number }[];
  bySector: { sector: string; value: number; pct: number }[];   // direct stocks only
  topHoldings: { name: string; value: number; pct: number }[];
  directStockValue: number;
  flags: { severity: 'high' | 'medium' | 'low'; message: string }[];
  score: number;        // 0–100 diversification score
  grade: 'A' | 'B' | 'C' | 'D';
  summary: string;
}

const CLASS_LABEL: Record<string, string> = { equity: 'Indian equity', debt: 'Debt', gold: 'Gold', international: 'International equity', cash: 'Cash', other: 'Other' };

export function analyzeHoldings(rows: HoldingInput[]): HoldingsAnalysis {
  const holdings = rows.filter((r) => r.value > 0).map(classifyHolding);
  const total = holdings.reduce((s, h) => s + h.value, 0);
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);

  const sumBy = <K extends string>(f: (h: ClassifiedHolding) => K | null) => {
    const m = new Map<K, number>();
    for (const h of holdings) { const k = f(h); if (k) m.set(k, (m.get(k) || 0) + h.value); }
    return m;
  };

  const classMap = sumBy((h) => h.assetClass);
  const byAssetClass = [...classMap.entries()].map(([key, value]) => ({ key, label: CLASS_LABEL[key] || key, value, pct: pct(value) })).sort((a, b) => b.value - a.value);

  const equity = holdings.filter((h) => h.assetClass === 'equity');
  const equityTotal = equity.reduce((s, h) => s + h.value, 0);
  const capMap = sumBy((h) => (h.assetClass === 'equity' ? (h.cap || 'unknown') : null));
  const capLabel: Record<string, string> = { large: 'Large-cap', mid: 'Mid-cap', small: 'Small-cap', diversified: 'Diversified / flexi', unknown: 'Unclassified stocks' };
  const equityByCap = [...capMap.entries()].map(([k, value]) => ({ label: capLabel[k] || k, value, pct: equityTotal > 0 ? Math.round((value / equityTotal) * 1000) / 10 : 0 })).sort((a, b) => b.value - a.value);

  const stocks = holdings.filter((h) => h.kind === 'stock');
  const directStockValue = stocks.reduce((s, h) => s + h.value, 0);
  const sectorMap = new Map<string, number>();
  for (const s of stocks) sectorMap.set(s.sector || 'Unclassified', (sectorMap.get(s.sector || 'Unclassified') || 0) + s.value);
  const bySector = [...sectorMap.entries()].map(([sector, value]) => ({ sector, value, pct: directStockValue > 0 ? Math.round((value / directStockValue) * 1000) / 10 : 0 })).sort((a, b) => b.value - a.value);

  const topHoldings = [...holdings].sort((a, b) => b.value - a.value).slice(0, 5).map((h) => ({ name: h.name, value: h.value, pct: pct(h.value) }));

  // ── Scoring ──────────────────────────────────────────────────────
  const flags: HoldingsAnalysis['flags'] = [];
  let score = 100;
  const topPct = topHoldings[0]?.pct || 0;
  if (topPct > 30) { score -= 20; flags.push({ severity: 'high', message: `Your single biggest holding is ${topPct}% of the portfolio — concentration risk. A common guideline is keeping any one holding under ~10–15%.` }); }
  else if (topPct > 20) { score -= 10; flags.push({ severity: 'medium', message: `Your top holding is ${topPct}% — a bit heavy. Spreading it out reduces single-name risk.` }); }

  const equityPct = pct(equityTotal + (classMap.get('international') || 0));
  const debtPct = pct(classMap.get('debt') || 0);
  const goldPct = pct(classMap.get('gold') || 0);
  if (debtPct < 5 && total > 0) { score -= 12; flags.push({ severity: 'medium', message: `Almost everything is in equity (${equityPct}%) with little debt cushion. Some debt smooths the ride in a market fall.` }); }
  if (goldPct === 0) { score -= 5; flags.push({ severity: 'low', message: 'No gold. A small slice (5–10%) often holds up when equities fall.' }); }
  if ((classMap.get('international') || 0) === 0 && equityTotal > 0) { score -= 5; flags.push({ severity: 'low', message: 'All your equity is Indian. A little international exposure adds geographic diversification.' }); }

  const topSector = bySector[0];
  if (topSector && topSector.pct > 50 && directStockValue > total * 0.15) { score -= 12; flags.push({ severity: 'high', message: `${topSector.pct}% of your direct stocks are in ${topSector.sector} — that's a big sector bet. Spreading across sectors lowers the risk one industry drags you down.` }); }

  const unclassifiedStock = (sectorMap.get('Unclassified') || 0);
  if (unclassifiedStock > total * 0.3) { score -= 6; flags.push({ severity: 'low', message: "We couldn't classify some of your stocks by sector — check those holdings yourself to be sure they aren't all in one industry." }); }

  const largeIndexFunds = holdings.filter((h) => h.kind === 'fund' && h.assetClass === 'equity' && h.cap === 'large');
  if (largeIndexFunds.length >= 3) { score -= 8; flags.push({ severity: 'medium', message: `You hold ${largeIndexFunds.length} large-cap / index funds — these largely overlap (same top companies), so the diversification benefit is smaller than it looks. One or two is usually enough.` }); }

  if (holdings.length < 3 && total > 0) { score -= 10; flags.push({ severity: 'medium', message: `Only ${holdings.length} holding${holdings.length === 1 ? '' : 's'} — a handful of funds across asset classes would spread your risk much wider.` }); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade: HoldingsAnalysis['grade'] = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 50 ? 'C' : 'D';
  const summary =
    flags.length === 0
      ? `Looks well spread — ${holdings.length} holdings across ${byAssetClass.length} asset class${byAssetClass.length === 1 ? '' : 'es'}, with no single one dominating.`
      : `${holdings.length} holdings worth analysing. Biggest things to look at: ${flags.slice(0, 2).map((f) => f.message.split('.')[0].toLowerCase()).join('; ')}.`;

  return { total, count: holdings.length, holdings, byAssetClass, equityByCap, bySector, topHoldings, directStockValue, flags, score, grade, summary };
}
