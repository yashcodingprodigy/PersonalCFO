// Key money facts that move a person's finances — first-party, dated and sourced.
// Facts (a repo rate, an inflation print) are not copyrightable; we cite the official
// source for each. UPDATE THIS FILE when RBI / MoSPI publish a new number (dates below).
// Values are in percent.

export interface MarketFact {
  key: 'repo' | 'cpi' | 'food_cpi' | 'cpi_projection';
  label: string;
  value: number;          // %
  prev: number | null;    // % (previous reading)
  asOf: string;           // ISO date of the reading / decision
  period?: string;        // e.g. "September 2026"
  source: string;         // official publisher
  sourceUrl: string;
  next?: string;          // when the next reading / decision is due
  note?: string;
}

export const MARKET_FACTS: MarketFact[] = [
  {
    key: 'repo', label: 'RBI repo rate', value: 5.5, prev: 5.25, asOf: '2026-10-07',
    source: 'Reserve Bank of India — Monetary Policy Statement', sourceUrl: 'https://www.rbi.org.in',
    next: 'Next policy meeting: 2–4 December 2026',
    note: 'Raised by 0.25%; stance changed to “calibrated tightening”.',
  },
  {
    key: 'cpi', label: 'Retail inflation (CPI)', value: 5.54, prev: 4.83, asOf: '2026-10-12', period: 'September 2026',
    source: 'MoSPI — Consumer Price Index release (provisional)', sourceUrl: 'https://www.mospi.gov.in',
    next: 'October 2026 figure due 12 November 2026', note: 'RBI target: 4% (band 2–6%).',
  },
  {
    key: 'food_cpi', label: 'Food inflation', value: 7.74, prev: 5.97, asOf: '2026-10-12', period: 'September 2026',
    source: 'MoSPI — Consumer Food Price Index (provisional)', sourceUrl: 'https://www.mospi.gov.in',
  },
  {
    key: 'cpi_projection', label: 'RBI inflation projection FY27', value: 5.2, prev: null, asOf: '2026-10-07',
    source: 'Reserve Bank of India — Monetary Policy Statement', sourceUrl: 'https://www.rbi.org.in',
  },
];

export const fact = (k: MarketFact['key']) => MARKET_FACTS.find((f) => f.key === k) || null;
