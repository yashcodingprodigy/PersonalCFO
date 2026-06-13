// Investment Guidance engine — educational, SEBI-compliant.
//
// IMPORTANT COMPLIANCE NOTE:
// This module NEVER names a specific stock, mutual-fund scheme, AMC or product.
// It recommends only *asset classes* and *fund categories* (e.g. "large-cap
// index fund", "ELSS", "liquid fund") mapped to the user's profile — the same
// way a financial-education book would. This is information & organisation,
// not investment advice under the SEBI (Investment Advisers) Regulations 2013.
// All monetary values are in paise.

import { ProfileData } from './score';

const sum = (arr: any[], f: string) => (Array.isArray(arr) ? arr : []).reduce((s, x) => s + (Number(x?.[f]) || 0), 0);
const n = (x: any) => Number(x) || 0;
const inr = (paise: number) => {
  const r = Math.round(paise / 100);
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(2)} Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(1)} L`;
  return `₹${r.toLocaleString('en-IN')}`;
};

export type Risk = 'conservative' | 'moderate' | 'aggressive';

export interface FundRecommendation {
  category: string;          // e.g. "Large-cap index fund"
  bucket: 'equity' | 'debt' | 'gold';
  allocationPct: number;     // % of the whole new-investment portfolio
  monthlyAmount: number;     // paise per month
  whatItIs: string;          // beginner explanation
  whyForYou: string;         // personalised reason
  liquidity: string;
  taxNote: string;
  lockIn: string;
}

export interface ModelPortfolio {
  key: Risk;
  name: string;
  tagline: string;
  matchesYou: boolean;
  mix: { label: string; pct: number }[];
}

export interface InvestmentGuidance {
  hasIncome: boolean;
  riskProfile: Risk;
  riskReason: string;
  riskWasExplicit: boolean;

  emergencyFirst: boolean;
  emergencyMessage: string | null;
  highCostDebtFirst: boolean;
  debtMessage: string | null;

  monthlyInvestable: number;       // paise
  investableExplanation: string;

  targetAllocation: { equity: number; debt: number; gold: number };
  currentAllocation: { equity: number; debt: number; gold: number; cash: number; realEstate: number };
  allocationGap: string[];

  recommendations: FundRecommendation[];
  modelPortfolios: ModelPortfolio[];
  rebalanceNotes: string[];
  startSteps: string[];
  disclaimer: string;
}

// Derive a risk profile when the user hasn't picked one.
function deriveRisk(p: ProfileData): { risk: Risk; reason: string } {
  const age = p.user.age || 32;
  const deps = p.user.dependents_count || 0;
  const stableJob = p.user.employment_type === 'salaried';
  let pts = 0;
  if (age < 30) pts += 2; else if (age < 40) pts += 1; else if (age >= 50) pts -= 1;
  if (deps === 0) pts += 1; else if (deps >= 3) pts -= 1;
  if (stableJob) pts += 1;
  const risk: Risk = pts >= 3 ? 'aggressive' : pts >= 1 ? 'moderate' : 'conservative';
  const reason =
    `We estimated this from your profile — age ${age}, ${deps} dependent${deps === 1 ? '' : 's'}, ` +
    `${stableJob ? 'a steady salaried income' : 'a variable income'}. ` +
    `Younger savers with fewer dependents can usually take more ups and downs for higher long-term growth. You can change this anytime in Settings.`;
  return { risk, reason };
}

// Target equity weight as a function of age and risk appetite.
function targetEquityPct(age: number, risk: Risk): number {
  const base = 100 - age; // classic rule of thumb
  const adj = risk === 'aggressive' ? 15 : risk === 'moderate' ? 0 : -15;
  return Math.max(20, Math.min(90, Math.round(base + adj)));
}

export function buildInvestmentGuidance(p: ProfileData): InvestmentGuidance {
  const disclaimer =
    'This is financial education, not investment advice. We never recommend specific stocks, funds or companies — only general asset classes and fund categories. ' +
    'Returns are not guaranteed and markets can fall. Read the scheme documents and consider consulting a SEBI-registered investment adviser before investing.';

  const income = p.user.annual_gross_income || 0;
  if (!income && !p.user.monthly_take_home) {
    return {
      hasIncome: false, riskProfile: 'moderate', riskReason: '', riskWasExplicit: false,
      emergencyFirst: false, emergencyMessage: null, highCostDebtFirst: false, debtMessage: null,
      monthlyInvestable: 0, investableExplanation: 'Add your income and expenses to unlock a personalised plan.',
      targetAllocation: { equity: 0, debt: 0, gold: 0 },
      currentAllocation: { equity: 0, debt: 0, gold: 0, cash: 0, realEstate: 0 },
      allocationGap: [], recommendations: [], modelPortfolios: [], rebalanceNotes: [], startSteps: [], disclaimer,
    };
  }

  const age = p.user.age || 32;
  const riskWasExplicit = !!p.user.risk_appetite;
  const { risk, reason } = riskWasExplicit
    ? { risk: p.user.risk_appetite as Risk, reason: 'Based on the risk comfort you told us. You can change this anytime in Settings.' }
    : deriveRisk(p);

  // ── Guardrails first: emergency fund + high-cost debt ──────────────
  const a = p.assets || {};
  const liquid = n(a.savings_balance) + n(a.liquid_funds);
  const expenses = p.monthlyExpenses || 0;
  const months = expenses > 0 ? liquid / expenses : 0;
  const emergencyFirst = expenses > 0 && months < 3;
  const emergencyMessage = emergencyFirst
    ? `Before investing for growth, build a safety net of 3 months' expenses (about ${inr(expenses * 3)}). You currently have roughly ${months.toFixed(1)} month${months === 1 ? '' : 's'} (${inr(liquid)}). Keep this in a savings account or liquid fund — money you can reach in a day. Once it's in place, redirect that money into the plan below.`
    : null;

  const ccOutstanding = sum(p.liabilities?.credit_cards, 'outstanding');
  const highCostDebtFirst = ccOutstanding > 0;
  const debtMessage = highCostDebtFirst
    ? `You have ${inr(ccOutstanding)} of credit-card balance. Card interest (36–42% a year) is higher than any investment can reliably earn, so clearing it is effectively a guaranteed "return". Prioritise this before adding new investments.`
    : null;

  // ── Investable surplus ─────────────────────────────────────────────
  const takeHome = p.user.monthly_take_home || 0;
  const existingSip = n(a.mutual_funds?.monthly_sip);
  const rawSurplus = takeHome - expenses;
  // Suggest investing ~70% of free surplus (leave a buffer); never negative.
  const monthlyInvestable = Math.max(0, Math.round(rawSurplus * 0.7));
  const investableExplanation =
    rawSurplus <= 0
      ? 'Your expenses currently use up your take-home pay, so there is no surplus to invest yet. The fastest win is freeing up money in the Actions tab.'
      : `From your ${inr(takeHome)} take-home minus ~${inr(expenses)} expenses, you have about ${inr(rawSurplus)} free each month. We suggest investing around ${inr(monthlyInvestable)} (keeping a buffer)${existingSip > 0 ? `. You already invest ${inr(existingSip)}/month via SIP — count this towards the plan.` : '.'}`;

  // ── Target allocation ──────────────────────────────────────────────
  const equityPct = targetEquityPct(age, risk);
  const goldPct = risk === 'conservative' ? 10 : risk === 'moderate' ? 7 : 5;
  const debtPct = Math.max(0, 100 - equityPct - goldPct);
  const targetAllocation = { equity: equityPct, debt: debtPct, gold: goldPct };

  // ── Current allocation (from existing assets) ──────────────────────
  const curEquity = n(a.mutual_funds?.value) + n(a.stocks) + n(a.us_stocks);
  const curDebt = n(a.epf) + n(a.ppf) + n(a.fd_total) + n(a.nps);
  const curGold = n(a.gold);
  const curCash = n(a.savings_balance) + n(a.liquid_funds);
  const curRe = n(a.property);
  const curTotalFin = curEquity + curDebt + curGold + curCash; // exclude property for tradable allocation
  const pctOf = (x: number) => (curTotalFin > 0 ? Math.round((x / curTotalFin) * 100) : 0);
  const currentAllocation = {
    equity: pctOf(curEquity), debt: pctOf(curDebt), gold: pctOf(curGold),
    cash: pctOf(curCash), realEstate: curRe,
  };

  const allocationGap: string[] = [];
  if (curTotalFin > 0) {
    if (currentAllocation.equity > equityPct + 15) allocationGap.push(`You hold more equity (${currentAllocation.equity}%) than your target (${equityPct}%). Direct new money to debt/gold rather than selling — selling can trigger capital-gains tax.`);
    if (currentAllocation.equity < equityPct - 15) allocationGap.push(`You're light on equity (${currentAllocation.equity}% vs a ${equityPct}% target). Over long horizons equity is what beats inflation — your plan below tilts new money here.`);
    if (currentAllocation.gold === 0) allocationGap.push('You hold no gold. A small slice (5–10%) cushions the portfolio when stocks fall.');
    if (currentAllocation.cash > 40) allocationGap.push(`${currentAllocation.cash}% of your money is sitting idle in cash beyond your emergency fund — inflation slowly erodes it. The plan puts it to work.`);
  } else {
    allocationGap.push('You have no investments tracked yet — this plan is your starting blueprint.');
  }

  // ── Build category recommendations from the target allocation ──────
  const oldRegimeLikely = !!(p.tax_data && (p.tax_data.elss_annual || p.tax_data.ppf_annual || p.tax_data.home_loan_interest_annual));
  const wants80C = age < 58; // tax-saving still useful for most working users
  const recs: FundRecommendation[] = [];
  const amt = (pct: number) => Math.round((pct / 100) * monthlyInvestable);

  // Equity bucket split
  const eqCore = Math.round(equityPct * (risk === 'conservative' ? 0.6 : risk === 'moderate' ? 0.5 : 0.4));
  const eqGrowth = Math.round(equityPct * (risk === 'aggressive' ? 0.35 : 0.25));
  const eqIntl = Math.max(0, equityPct - eqCore - eqGrowth - (wants80C ? 8 : 0));
  const eqElss = wants80C ? Math.max(0, equityPct - eqCore - eqGrowth - eqIntl) : 0;

  recs.push({
    category: 'Large-cap index fund (Nifty 50 / Sensex)', bucket: 'equity', allocationPct: eqCore, monthlyAmount: amt(eqCore),
    whatItIs: 'A fund that simply copies India\'s biggest 50 companies. Low cost, no fund-manager guesswork — it just tracks the market.',
    whyForYou: 'This is the steady core of any equity portfolio — broad, cheap and hard to get wrong for a beginner.',
    liquidity: 'Sell anytime (money in 2–3 days)', taxNote: 'Gains over ₹1.25L/year taxed at 12.5% if held >1 year (LTCG).', lockIn: 'None',
  });
  if (eqGrowth > 0) recs.push({
    category: risk === 'conservative' ? 'Large-and-midcap / flexi-cap fund' : 'Flexi-cap or mid-cap fund', bucket: 'equity', allocationPct: eqGrowth, monthlyAmount: amt(eqGrowth),
    whatItIs: 'An actively managed fund that can invest across company sizes to chase higher growth — more ups and downs than an index fund.',
    whyForYou: `Your ${risk} profile can handle some extra swings for the chance of higher long-term returns.`,
    liquidity: 'Sell anytime', taxNote: 'Same equity LTCG/STCG rules as above.', lockIn: 'None',
  });
  if (eqIntl > 0) recs.push({
    category: 'International / US index fund', bucket: 'equity', allocationPct: eqIntl, monthlyAmount: amt(eqIntl),
    whatItIs: 'A fund that invests in global (often US) companies, giving you exposure beyond India.',
    whyForYou: 'Spreads your risk across economies so you are not betting everything on one country.',
    liquidity: 'Sell anytime', taxNote: 'Taxed as per your income slab if held <2 years; 12.5% LTCG beyond.', lockIn: 'None',
  });
  if (eqElss > 0) recs.push({
    category: 'ELSS (tax-saving equity fund)', bucket: 'equity', allocationPct: eqElss, monthlyAmount: amt(eqElss),
    whatItIs: 'An equity fund that also cuts your tax — investments qualify under Section 80C (old regime).',
    whyForYou: `${oldRegimeLikely ? 'You appear to use old-regime deductions, so' : 'If you choose the old tax regime,'} ELSS does double duty: growth plus up to ₹46,800/year tax saved in the 30% bracket.`,
    liquidity: 'Locked for 3 years (shortest of all 80C options)', taxNote: 'Counts under the ₹1.5L 80C limit; equity LTCG rules after.', lockIn: '3 years',
  });

  // Debt bucket split
  const ppfPct = Math.round(debtPct * 0.5);
  const debtFundPct = Math.max(0, debtPct - ppfPct);
  if (ppfPct > 0) recs.push({
    category: 'PPF / EPF (VPF) — government-backed', bucket: 'debt', allocationPct: ppfPct, monthlyAmount: amt(ppfPct),
    whatItIs: 'Public Provident Fund: a government scheme giving tax-free, guaranteed returns. Topping up EPF via VPF works similarly.',
    whyForYou: 'The safe, predictable anchor of your portfolio — and it saves tax under 80C too.',
    liquidity: 'PPF locks for 15 years (partial withdrawals from year 7)', taxNote: 'Interest is fully tax-free; deposits count under 80C.', lockIn: '15 years (PPF)',
  });
  if (debtFundPct > 0) recs.push({
    category: 'Short-duration / corporate-bond debt fund', bucket: 'debt', allocationPct: debtFundPct, monthlyAmount: amt(debtFundPct),
    whatItIs: 'A fund that lends to companies/government for steady, low-volatility returns — calmer than stocks.',
    whyForYou: 'Balances out the equity swings and is easier to access than PPF when you need the money.',
    liquidity: 'Sell anytime (1–2 days)', taxNote: 'Gains taxed at your income slab (post-2023 rule).', lockIn: 'None',
  });

  // Gold bucket
  if (goldPct > 0) recs.push({
    category: 'Sovereign Gold Bond (SGB) / Gold ETF', bucket: 'gold', allocationPct: goldPct, monthlyAmount: amt(goldPct),
    whatItIs: 'A paper way to own gold without storage worries. SGBs even pay 2.5% interest a year on top of the gold price.',
    whyForYou: 'Gold tends to hold up when stocks fall, so a small slice steadies the whole portfolio.',
    liquidity: 'ETFs sell anytime; SGBs best held to maturity', taxNote: 'SGB gains are tax-free if held to maturity (8 years).', lockIn: 'SGB: 8 years (tradable on exchange)',
  });

  // ── Model portfolios (category-level only) ─────────────────────────
  const modelPortfolios: ModelPortfolio[] = [
    {
      key: 'conservative', name: 'Safe Start', tagline: 'Steady and low-stress', matchesYou: risk === 'conservative',
      mix: [
        { label: 'Large-cap index fund', pct: 30 },
        { label: 'PPF / debt funds', pct: 50 },
        { label: 'Gold (SGB/ETF)', pct: 10 },
        { label: 'Liquid fund (buffer)', pct: 10 },
      ],
    },
    {
      key: 'moderate', name: 'Balanced Builder', tagline: 'Growth with guardrails', matchesYou: risk === 'moderate',
      mix: [
        { label: 'Large-cap index fund', pct: 35 },
        { label: 'Flexi-cap / ELSS', pct: 25 },
        { label: 'International index', pct: 10 },
        { label: 'PPF / debt funds', pct: 23 },
        { label: 'Gold (SGB/ETF)', pct: 7 },
      ],
    },
    {
      key: 'aggressive', name: 'Growth Engine', tagline: 'Maximise long-term growth', matchesYou: risk === 'aggressive',
      mix: [
        { label: 'Large-cap index fund', pct: 35 },
        { label: 'Flexi-cap / mid-cap', pct: 30 },
        { label: 'International index', pct: 15 },
        { label: 'Debt funds', pct: 15 },
        { label: 'Gold (SGB/ETF)', pct: 5 },
      ],
    },
  ];

  const rebalanceNotes = [
    'Check your mix once a year. If one bucket has drifted more than ~5–10% off target, steer new money toward the lagging bucket instead of selling (selling can mean tax).',
    'Increase your SIP amount whenever your salary rises — even a 10% step-up each year dramatically grows the final corpus.',
    'Stay invested through market falls. Most beginners lose money by selling in panic, not by picking the "wrong" fund.',
  ];

  const startSteps = [
    'Complete your KYC once (PAN + Aadhaar) on any SEBI-registered platform — it works everywhere after that.',
    'Always choose the “Direct” plan version of a fund (lower fees than “Regular”) and set up an auto-SIP on salary day.',
    'Start with the index fund even if the amount is small — consistency matters far more than the starting size.',
  ];
  if (p.user.employment_type === 'student') {
    startSteps.unshift('You don’t need much to begin — a ₹500 SIP started now beats a ₹5,000 SIP started ten years later, thanks to compounding. Begin small and raise it as your income grows.');
    startSteps.push('Curious about individual stocks? Start with an index fund first — it spreads your risk across the whole market while you learn how the market actually behaves.');
  }

  return {
    hasIncome: true, riskProfile: risk, riskReason: reason, riskWasExplicit,
    emergencyFirst, emergencyMessage, highCostDebtFirst, debtMessage,
    monthlyInvestable, investableExplanation,
    targetAllocation, currentAllocation, allocationGap,
    recommendations: recs, modelPortfolios, rebalanceNotes, startSteps, disclaimer,
  };
}
