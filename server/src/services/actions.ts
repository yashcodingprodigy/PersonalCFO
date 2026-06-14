// Rule-based Action Engine — implements SRS §7.3 (ACT-001 … ACT-012).
// Every action carries: what to do, a specific number, expected impact,
// urgency, and difficulty. Vague actions are structurally impossible.

import { ProfileData, totalMonthlyEmi, deductionUsage } from './score';
import { compareRegimes } from './tax';

export interface GeneratedAction {
  rule_id: string;
  title: string;
  body: string;
  impact_text: string;
  impact_score: number;
  dimension: string;
  difficulty: 'easy' | 'medium' | 'hard';
  deadline: string | null;
  category: 'tax' | 'insurance' | 'investment' | 'debt' | 'savings' | 'estate';
  is_seasonal: boolean;
  referral_link: string | null;
  priority?: 'high' | 'medium' | 'low';
}

const inr = (paise: number) => {
  const r = Math.round(paise / 100);
  if (r >= 1e7) return `₹${(r / 1e7).toFixed(2)} Cr`;
  if (r >= 1e5) return `₹${(r / 1e5).toFixed(1)} L`;
  return `₹${r.toLocaleString('en-IN')}`;
};

const sum = (arr: any[], f: string) => (Array.isArray(arr) ? arr : []).reduce((s, x) => s + (Number(x?.[f]) || 0), 0);

function fyEndDeadline(): string {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() + 1 : now.getFullYear();
  return `${year}-03-31`;
}

export function generateActions(p: ProfileData): GeneratedAction[] {
  const out: GeneratedAction[] = [];
  const income = p.user.annual_gross_income || 0;
  const takeHome = p.user.monthly_take_home || 0;
  const monthNow = new Date().getMonth(); // 0-indexed

  const termCover = sum(p.insurance?.term, 'sum_assured');
  const healthCover = sum(p.insurance?.health, 'sum_insured');
  const savings = Number(p.assets?.savings_balance) || 0;
  const expenses = p.monthlyExpenses || 0;
  const emi = totalMonthlyEmi(p.liabilities);
  const ccOutstanding = sum(p.liabilities?.credit_cards, 'outstanding');
  const ccLimit = sum(p.liabilities?.credit_cards, 'limit');

  // ACT-001 — term cover below 25× annual income (only when someone depends
  // on the user's income — no dependents means life cover isn't needed yet).
  if (income > 0 && (p.user.dependents_count || 0) > 0 && termCover < income * 25) {
    const recommended = income * 25;
    const gap = recommended - termCover;
    out.push({
      rule_id: 'ACT-001',
      title: `Increase term cover by ${inr(gap)}`,
      body: `Your current term life cover is ${termCover > 0 ? inr(termCover) : 'zero'}. The standard guideline is 25× annual income — ${inr(recommended)} for you${p.user.dependents_count ? `, especially with ${p.user.dependents_count} dependent${p.user.dependents_count > 1 ? 's' : ''}` : ''}. Get a pure term plan (not endowment or ULIP) for the ${inr(gap)} gap. Compare premiums across at least 3 insurers before buying. Expected premium for a healthy ${p.user.age || 30}-year-old: roughly ₹${Math.round((gap / 1e9) * (p.user.age && p.user.age > 38 ? 1400 : 900)).toLocaleString('en-IN')}–₹${Math.round((gap / 1e9) * (p.user.age && p.user.age > 38 ? 2000 : 1300)).toLocaleString('en-IN')}/year.`,
      impact_text: `Protects your family's full financial needs if the unexpected happens. Term insurance is the cheapest pure protection available.`,
      impact_score: termCover === 0 ? 15 : 8,
      dimension: 'insurance_adequacy',
      difficulty: 'medium',
      deadline: null,
      category: 'insurance',
      is_seasonal: false,
      referral_link: null,
    });
  }

  // ACT-002 — health cover below ₹5L × (dependents + 1)
  const familySize = 1 + (p.user.dependents_count || 0);
  const recommendedHealth = 500000 * 100 * familySize;
  if (income > 0 && healthCover < recommendedHealth && p.user.employment_type !== 'student') {
    const gap = recommendedHealth - healthCover;
    out.push({
      rule_id: 'ACT-002',
      title: `Raise family health cover by ${inr(gap)}`,
      body: `Your health cover is ${healthCover > 0 ? inr(healthCover) : 'zero'} against a recommended minimum of ${inr(recommendedHealth)} for a family of ${familySize}. ${healthCover > 0 ? 'The most cost-effective route is a super top-up policy over your existing base cover rather than a new standalone policy.' : 'Start with a family floater policy.'} A single hospitalisation in a Tier-1 metro can exceed ₹5L.`,
      impact_text: `One serious hospitalisation without cover can erase years of savings. Premium for the gap: typically ₹${Math.round(gap / 100 / 100000 * 800).toLocaleString('en-IN')}–₹${Math.round(gap / 100 / 100000 * 1500).toLocaleString('en-IN')}/year.`,
      impact_score: healthCover === 0 ? 12 : 6,
      dimension: 'insurance_adequacy',
      difficulty: 'medium',
      deadline: null,
      category: 'insurance',
      is_seasonal: false,
      referral_link: null,
    });
  }

  // ACT-003 — emergency fund below 3 months
  if (expenses > 0 && savings / expenses < 3) {
    const target = expenses * 3;
    const gap = target - savings;
    out.push({
      rule_id: 'ACT-003',
      title: `Build emergency fund: add ${inr(gap)}`,
      body: `Your liquid savings of ${inr(savings)} cover ${(savings / expenses).toFixed(1)} months of expenses. Build to at least 3 months (${inr(target)}) before increasing investments. Set up an auto-transfer of ${inr(Math.min(gap / 6, takeHome * 0.15))} on salary day into a separate savings account or liquid mutual fund — money you do not touch.`,
      impact_text: `An emergency fund prevents a job loss or medical event from forcing you into high-interest debt.`,
      impact_score: 10,
      dimension: 'emergency_fund',
      difficulty: 'medium',
      deadline: null,
      category: 'savings',
      is_seasonal: false,
      referral_link: null,
    });
  }

  // ACT-004 — savings rate below 20%
  if (takeHome > 0 && expenses > 0) {
    const rate = (takeHome - expenses) / takeHome;
    if (rate < 0.2) {
      const targetCut = Math.round(expenses - takeHome * 0.8);
      out.push({
        rule_id: 'ACT-004',
        title: 'Lift savings rate to 20%: review top 3 spends',
        body: `You currently save ${Math.round(rate * 100)}% of take-home. To reach the 20% baseline you need to free up ${inr(targetCut)}/month. Open your spend analysis and review your 3 largest discretionary categories — food delivery, shopping and entertainment are the usual candidates. Cancel unused subscriptions first: it is the only spending cut that requires zero ongoing willpower.`,
        impact_text: `Reaching a 20% savings rate adds ${inr(targetCut * 12)} to investable surplus every year.`,
        impact_score: 7,
        dimension: 'savings_rate',
        difficulty: 'medium',
        deadline: null,
        category: 'savings',
        is_seasonal: false,
        referral_link: null,
      });
    }
  }

  // ACT-005 — 80C headroom in Oct–Feb window
  const { items } = deductionUsage(p);
  const c80 = items.find((i) => i.section === '80C');
  const headroom = c80 ? c80.limit - c80.used : 0;
  if (headroom > 1000000 && (monthNow >= 9 || monthNow <= 1)) {
    out.push({
      rule_id: 'ACT-005',
      title: `Use remaining 80C limit: ${inr(headroom)} left`,
      body: `You have ${inr(headroom)} of unused Section 80C limit this financial year (₹1.5L total). Options that qualify: ELSS mutual funds (3-year lock-in, equity growth), PPF (15-year, guaranteed), or 5-year tax-saver FD. If you are in the 30% bracket, using the full headroom saves up to ${inr(Math.round(headroom * 0.312))} in tax. Invest before March 31 — earlier is better than a March rush.`,
      impact_text: `Direct tax saving of up to ${inr(Math.round(headroom * 0.312))} this year (30% bracket + cess).`,
      impact_score: 8,
      dimension: 'tax_efficiency',
      difficulty: 'easy',
      deadline: fyEndDeadline(),
      category: 'tax',
      is_seasonal: true,
      referral_link: null,
    });
  }

  // ACT-006 — NPS 80CCD(1B) unused
  const npsUsed = Number(p.tax_data?.nps_80ccd1b_annual) || 0;
  if (income > 10000000 * 10 && npsUsed < 5000000) {
    out.push({
      rule_id: 'ACT-006',
      title: 'Invest ₹50,000 in NPS Tier-1 for extra deduction',
      body: `Section 80CCD(1B) gives you ₹50,000 of deduction over and above the 80C limit — you have used ${inr(npsUsed)}. Open an NPS Tier-1 account (eNPS portal, fully online) and contribute the remaining ${inr(5000000 - npsUsed)}. Choose Auto mode if you don't want to manage allocation. Note: NPS locks funds until 60, so treat it as retirement money.`,
      impact_text: `Saves up to ${inr(Math.round((5000000 - npsUsed) * 0.312))} in tax for 30% bracket taxpayers.`,
      impact_score: 6,
      dimension: 'tax_efficiency',
      difficulty: 'easy',
      deadline: fyEndDeadline(),
      category: 'tax',
      is_seasonal: true,
      referral_link: null,
    });
  }

  // ACT-007 — credit utilisation above 40%
  if (ccLimit > 0 && ccOutstanding / ccLimit > 0.4) {
    const target = Math.round(ccLimit * 0.3);
    const payDown = ccOutstanding - target;
    out.push({
      rule_id: 'ACT-007',
      title: `Pay down credit card by ${inr(payDown)}`,
      body: `Your credit card utilisation is ${Math.round((ccOutstanding / ccLimit) * 100)}% (${inr(ccOutstanding)} of ${inr(ccLimit)} limit). Pay down ${inr(payDown)} to get below the 30% threshold. Card interest runs 36–42% annually — this is almost certainly your most expensive debt. Pay this before making any new investments.`,
      impact_text: `Saves roughly ${inr(Math.round(payDown * 0.4))} in annual interest and improves your credit score within 1–2 billing cycles.`,
      impact_score: 6,
      dimension: 'debt_health',
      difficulty: 'medium',
      deadline: null,
      category: 'debt',
      is_seasonal: false,
      referral_link: null,
    });
  }

  // ACT-008 — EMI load above 50%
  if (takeHome > 0 && emi / takeHome > 0.5) {
    out.push({
      rule_id: 'ACT-008',
      title: 'EMI load exceeds 50% — restructure debt',
      body: `Your EMIs total ${inr(emi)}/month — ${Math.round((emi / takeHome) * 100)}% of take-home, well above the 40% safe ceiling. Options in order of impact: (1) request a tenure extension on your largest loan to reduce monthly outflow, (2) consolidate any personal loans into a lower-rate secured loan, (3) use any bonus or windfall to prepay the highest-rate loan first. Avoid new credit until the ratio is below 40%.`,
      impact_text: `Bringing EMI load under 40% restores breathing room of ${inr(emi - takeHome * 0.4)}/month and removes default risk.`,
      impact_score: 10,
      dimension: 'debt_health',
      difficulty: 'hard',
      deadline: null,
      category: 'debt',
      is_seasonal: false,
      referral_link: null,
    });
  }

  // ACT-009 — excess idle cash beyond 6 months expenses
  if (expenses > 0 && savings > expenses * 6) {
    const excess = savings - expenses * 6;
    out.push({
      rule_id: 'ACT-009',
      title: `Move ${inr(excess)} of idle cash to work`,
      body: `Your savings account holds ${inr(savings)} — ${(savings / expenses).toFixed(1)} months of expenses. Beyond the 6-month emergency buffer, ${inr(excess)} is earning ~3% while inflation runs ~6%. Move the excess to a liquid or money-market mutual fund (instant redemption, ~6.5–7% returns) or a sweep-in FD. This is a category suggestion, not a specific scheme recommendation — compare options on your own platform.`,
      impact_text: `Roughly ${inr(Math.round(excess * 0.035))}/year of additional return on money you already have.`,
      impact_score: 4,
      dimension: 'investment_diversification',
      difficulty: 'easy',
      deadline: null,
      category: 'investment',
      is_seasonal: false,
      referral_link: null,
    });
  }

  // ACT-010 — EPF nomination missing
  if (p.tax_data?.epf_nomination_done === false || (p.assets?.epf > 0 && p.tax_data?.epf_nomination_done !== true)) {
    out.push({
      rule_id: 'ACT-010',
      title: 'File your EPF e-nomination on the EPFO portal',
      body: `Your EPF balance has no confirmed nomination. Without it, your family faces a slow, document-heavy claims process. Takes 10 minutes: log in to the EPFO Member portal → Manage → E-nomination → add nominee with Aadhaar → e-sign. No physical paperwork needed.`,
      impact_text: `Ensures your EPF transfers to your family without legal friction. Costs nothing.`,
      impact_score: 3,
      dimension: 'insurance_adequacy',
      difficulty: 'easy',
      deadline: null,
      category: 'estate',
      is_seasonal: false,
      referral_link: null,
    });
  }

  // ACT-011 — equity allocation above 85% past age 40
  const a = p.assets || {};
  const equity = (Number(a.mutual_funds?.value) || 0) + (Number(a.stocks) || 0) + (Number(a.us_stocks) || 0);
  const debt = (Number(a.epf) || 0) + (Number(a.ppf) || 0) + (Number(a.fd_total) || 0) + (Number(a.nps) || 0);
  const invested = equity + debt;
  if (invested > 0 && p.user.age && p.user.age > 40 && equity / invested > 0.85) {
    out.push({
      rule_id: 'ACT-011',
      title: 'Rebalance: add a debt component to your portfolio',
      body: `${Math.round((equity / invested) * 100)}% of your invested assets are in equity. At ${p.user.age}, a common guideline is equity ≈ (100 − age)% — around ${100 - p.user.age}% for you. Direct new contributions toward debt instruments (PPF, debt funds, or additional EPF via VPF) rather than selling equity and triggering capital gains tax.`,
      impact_text: `Reduces portfolio drawdown risk in the decade where you have least time to recover from a crash.`,
      impact_score: 5,
      dimension: 'investment_diversification',
      difficulty: 'medium',
      deadline: null,
      category: 'investment',
      is_seasonal: false,
      referral_link: null,
    });
  }

  // ACT-012 — old regime saves more
  if (income > 0) {
    const cmp = compareRegimes(p);
    if (cmp.recommended === 'old' && cmp.savings > 500000) {
      out.push({
        rule_id: 'ACT-012',
        title: `Switch to the Old Tax Regime — save ${inr(cmp.savings)}`,
        body: `Based on your deductions (${inr(cmp.oldRegime.totalDeductions)} total), the old regime results in ${inr(cmp.savings)} less tax than the new regime this FY. Salaried employees can choose the regime each year — inform your employer's payroll team (usually via the investment declaration portal) or select it when filing your ITR.`,
        impact_text: `${inr(cmp.savings)} of tax saved this financial year with a single declaration.`,
        impact_score: 7,
        dimension: 'tax_efficiency',
        difficulty: 'easy',
        deadline: fyEndDeadline(),
        category: 'tax',
        is_seasonal: false,
        referral_link: null,
      });
    }
  }

  // ACT-013 — not investing yet, but has a surplus (esp. students / early earners)
  const a0 = p.assets || {};
  const investedTotal =
    (Number(a0.mutual_funds?.value) || 0) + (Number(a0.stocks) || 0) + (Number(a0.us_stocks) || 0) +
    (Number(a0.ppf) || 0) + (Number(a0.nps) || 0) + (Number(a0.mutual_funds?.monthly_sip) || 0);
  const surplus = takeHome > 0 ? (expenses > 0 ? takeHome - expenses : Math.round(takeHome * 0.1)) : 0;
  if (investedTotal === 0 && takeHome > 0 && surplus > 0) {
    const start = Math.max(50000, Math.min(Math.round(surplus * 0.3), 500000)); // ₹500–₹5,000/month
    out.push({
      rule_id: 'ACT-013',
      title: `Start investing — even ${inr(start)}/month`,
      body: `You're not investing yet, and the biggest advantage you have is time. Because of compounding, a small SIP started now can outgrow a much larger one started ten years later. Start a monthly SIP of about ${inr(start)} into a large-cap index fund (low-cost and beginner-friendly) — do your one-time KYC on any investing app and automate it for the day your money arrives. Tip: if you're tempted by individual stocks, begin with an index fund instead — it spreads your risk across the whole market while you learn how investing works. Your full plan is in the Invest tab.`,
      impact_text: `Starting early matters more than starting big — even a small SIP builds the habit and compounds for decades.`,
      impact_score: 9,
      dimension: 'investment_diversification',
      difficulty: 'easy',
      deadline: null,
      category: 'investment',
      is_seasonal: false,
      referral_link: null,
    });
  }

  // ── Additional profile-aware & educational actions ─────────────────
  const gold = Number(a0.gold) || 0;
  const usStocks = Number(a0.us_stocks) || 0;
  const equityVal = (Number(a0.mutual_funds?.value) || 0) + (Number(a0.stocks) || 0) + usStocks;
  const sipAmt = Number(a0.mutual_funds?.monthly_sip) || 0;
  const npsVal = Number(a0.nps) || 0;
  const monthsCovered = expenses > 0 ? savings / expenses : 0;
  const isStudent = p.user.employment_type === 'student';
  const hasCreditLine = ccLimit > 0 || (p.liabilities?.home_loans || []).length > 0 || (p.liabilities?.personal_loans || []).length > 0 || (p.liabilities?.car_loans || []).length > 0;

  // ACT-014 — step up your SIP each year
  if (sipAmt > 0) {
    const stepUp = Math.round(sipAmt * 0.1);
    out.push({
      rule_id: 'ACT-014', title: `Step up your SIP by ${inr(stepUp)}/month`,
      body: `You invest ${inr(sipAmt)}/month. Increasing your SIP by about 10% each year (a "step-up SIP") as your income rises roughly doubles your final corpus over 20 years versus a flat SIP — and you barely feel it. Most apps let you set an automatic annual step-up once.`,
      impact_text: `A 10% yearly step-up can add tens of lakhs to your long-term corpus with almost no extra effort.`,
      impact_score: 6, dimension: 'investment_diversification', difficulty: 'easy', deadline: null, category: 'investment', is_seasonal: false, referral_link: null,
    });
  }

  // ACT-015 — no gold allocation
  if (investedTotal > 0 && gold === 0) {
    out.push({
      rule_id: 'ACT-015', title: 'Add a small gold allocation (5–10%)',
      body: `You hold no gold. A small slice (5–10% of your portfolio) tends to hold its value — or rise — when stocks fall, smoothing out your overall ride. The cleanest ways are Sovereign Gold Bonds (which also pay 2.5% interest a year and are tax-free if held to maturity) or a gold ETF — not physical jewellery.`,
      impact_text: `Gold cushions your portfolio during market crashes and improves diversification.`,
      impact_score: 4, dimension: 'investment_diversification', difficulty: 'easy', deadline: null, category: 'investment', is_seasonal: false, referral_link: null,
    });
  }

  // ACT-016 — no international exposure
  if (equityVal > 0 && usStocks === 0 && !isStudent) {
    out.push({
      rule_id: 'ACT-016', title: 'Add some international exposure',
      body: `All your equity is in India. Adding 10–15% in an international (often US) index fund spreads your risk across economies, so you're not betting everything on one country. Keep it simple with a global or US index fund rather than picking foreign companies.`,
      impact_text: `Geographic diversification reduces the risk of any single market dragging down your whole portfolio.`,
      impact_score: 4, dimension: 'investment_diversification', difficulty: 'easy', deadline: null, category: 'investment', is_seasonal: false, referral_link: null,
    });
  }

  // ACT-017 — top up emergency fund from 3 to 6 months
  if (expenses > 0 && monthsCovered >= 3 && monthsCovered < 6) {
    const target = expenses * 6; const gap = target - savings;
    out.push({
      rule_id: 'ACT-017', title: `Top up your emergency fund by ${inr(gap)}`,
      body: `You have ${monthsCovered.toFixed(1)} months of expenses set aside — a solid base. Building it to a full 6 months (${inr(target)}) gives you real breathing room for a job change or medical event. Keep it in a liquid fund or sweep-in FD so it earns a bit while staying instantly accessible.`,
      impact_text: `A 6-month buffer means a setback never forces you into high-interest debt or selling investments at a loss.`,
      impact_score: 5, dimension: 'emergency_fund', difficulty: 'medium', deadline: null, category: 'savings', is_seasonal: false, referral_link: null,
    });
  }

  // ACT-018 — start spending tracking (no expense data)
  if (p.monthlyExpenses == null) {
    out.push({
      rule_id: 'ACT-018', title: 'Upload a bank statement to see where your money goes',
      body: `We don't have your spending yet, so your savings rate and emergency-fund scores are locked. Head to the Statement scan tab and upload a CSV/PDF bank statement (it's read on your device, never uploaded) — you'll get a full breakdown of where your money goes and unlock two score dimensions at once.`,
      impact_text: `Seeing your real spending is the first step to improving it — and it unlocks your savings-rate score.`,
      impact_score: 7, dimension: 'savings_rate', difficulty: 'easy', deadline: null, category: 'savings', is_seasonal: false, referral_link: null,
    });
  }

  // ACT-019 — start NPS for retirement (working, 30+, none yet)
  if (income > 0 && !isStudent && (p.user.age || 0) >= 30 && npsVal === 0) {
    out.push({
      rule_id: 'ACT-019', title: 'Open an NPS account for retirement',
      body: `You don't have an NPS yet. The National Pension System is a low-cost, government-backed way to build a retirement corpus, with an extra ₹50,000 tax deduction (80CCD(1B), old regime) on top of 80C. It locks until 60, so treat it as long-term retirement money. Open one online via the eNPS portal.`,
      impact_text: `Builds a dedicated retirement corpus and can save up to ₹15,600/year in tax (30% bracket).`,
      impact_score: 5, dimension: 'investment_diversification', difficulty: 'easy', deadline: null, category: 'investment', is_seasonal: false, referral_link: null,
    });
  }

  // ACT-020 — check your free credit report
  if (hasCreditLine) {
    out.push({
      rule_id: 'ACT-020', title: 'Check your credit report (free, once a year)',
      body: `You have at least one loan or credit card, so your credit score matters for future borrowing. You're entitled to one free credit report a year from each bureau (CIBIL, Experian, Equifax, CRIF). Check it for errors and to see what's helping or hurting your score — a quick 10-minute habit that can save you on future loan rates.`,
      impact_text: `Catching errors early protects your borrowing power and can lower the interest you pay on future loans.`,
      impact_score: 3, dimension: 'debt_health', difficulty: 'easy', deadline: null, category: 'debt', is_seasonal: false, referral_link: null,
    });
  }

  // ACT-021 — set up nominations
  if (investedTotal > 0 || savings > 0) {
    out.push({
      rule_id: 'ACT-021', title: 'Add nominees to your bank, MF and investment accounts',
      body: `Make sure every account — bank, mutual funds, demat, EPF, insurance — has a nominee. Without one, your family faces a slow, document-heavy process to claim your money. It takes a few minutes per account online (banking app, the fund RTA, or EPFO portal). Remember: a nominee is a trustee for your legal heirs, so a will still matters for clear instructions.`,
      impact_text: `Ensures your money reaches your family quickly and without legal friction. Costs nothing.`,
      impact_score: 3, dimension: 'investment_diversification', difficulty: 'easy', deadline: null, category: 'estate', is_seasonal: false, referral_link: null,
    });
  }

  // ── Priority: from impact, bumped by approaching deadlines ──────────
  for (const a of out) {
    let pr: 'high' | 'medium' | 'low' = a.impact_score >= 10 ? 'high' : a.impact_score >= 6 ? 'medium' : 'low';
    if (a.deadline) {
      const days = (new Date(a.deadline).getTime() - Date.now()) / (24 * 3600 * 1000);
      if (days <= 60 && pr !== 'high') pr = pr === 'low' ? 'medium' : 'high';
    }
    a.priority = pr;
  }

  // Sort: priority, then impact descending, then easy first
  const prRank = { high: 0, medium: 1, low: 2 };
  const diffRank = { easy: 0, medium: 1, hard: 2 };
  out.sort((x, y) =>
    prRank[x.priority!] - prRank[y.priority!] ||
    y.impact_score - x.impact_score ||
    diffRank[x.difficulty] - diffRank[y.difficulty]
  );
  return out;
}
