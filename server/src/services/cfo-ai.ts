// Ask Your CFO — SRS §12. RAG-grounded Q&A with strict compliance
// guardrails. Generation runs on the Claude API when a key is present;
// otherwise a deterministic financial answer engine (rule-based, grounded
// in the same profile + RAG context) answers, so the product works fully
// in sandbox mode.

import { config } from '../config';
import { ProfileData, computeScore } from './score';
import { compareRegimes } from './tax';
import { analyseInsurance } from './insurance';
import { computeNetWorth } from './networth';
import { retrieve, RetrievedDoc } from './rag';

export const AI_DISCLAIMER =
  'This is educational information based on your financial data and standard planning principles — not SEBI-registered investment advice. For personalised investment recommendations, consult a SEBI Registered Investment Adviser.';

// ── Guardrails ──────────────────────────────────────────────────────
const BLOCKED_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /which (stock|share|scrip)s? (should|do) i buy|best stocks? to buy|recommend .*(stock|share)\b/i, reason: 'specific stock recommendations' },
  { re: /which (mutual fund|mf|scheme) should i (buy|invest)|best (mutual )?funds? to (buy|invest)|name .*fund/i, reason: 'specific scheme recommendations' },
  { re: /(crypto|bitcoin|ethereum|altcoin).*(buy|invest|should)/i, reason: 'crypto recommendations' },
  { re: /guaranteed returns?|sure[- ]?shot|double my money/i, reason: 'guaranteed-return claims' },
];

export function checkGuardrails(question: string): string | null {
  for (const b of BLOCKED_PATTERNS) {
    if (b.re.test(question)) return b.reason;
  }
  return null;
}

const GUARDRAIL_RESPONSE = (reason: string) =>
  `I can't help with ${reason} — recommending specific securities or schemes requires a SEBI Registered Investment Adviser licence, and guaranteed returns don't exist in market-linked products.\n\nWhat I can do: explain the *categories* that fit your situation (e.g. large-cap index funds vs ELSS vs debt funds), show how a choice affects your Money Health Score, and give you the questions to ask before you pick a product on your own platform.\n\nWould you like a category-level breakdown for your situation?`;

// ── Context builder ─────────────────────────────────────────────────
const inr = (paise: number) => {
  const r = Math.round(paise / 100);
  if (Math.abs(r) >= 1e7) return `₹${(r / 1e7).toFixed(2)} Cr`;
  if (Math.abs(r) >= 1e5) return `₹${(r / 1e5).toFixed(1)} L`;
  return `₹${r.toLocaleString('en-IN')}`;
};

export function buildUserContext(p: ProfileData): string {
  const score = computeScore(p);
  const nw = computeNetWorth(p);
  const dims = Object.entries(score.dimensions)
    .filter(([, d]) => d.available)
    .sort((a, b) => a[1].score - b[1].score)
    .slice(0, 3)
    .map(([k, d]) => `${k.replace(/_/g, ' ')}: ${d.score}/100`);
  return [
    `Income: ${inr(p.user.annual_gross_income)} gross/yr, ${inr(p.user.monthly_take_home)} take-home/mo`,
    `Age: ${p.user.age ?? 'unknown'} · Dependents: ${p.user.dependents_count}`,
    `Net worth: ${inr(nw.netWorth)} (assets ${inr(nw.totalAssets)}, liabilities ${inr(nw.totalLiabilities)})`,
    `Money Health Score: ${score.score}/100`,
    `Weakest dimensions: ${dims.join(' · ') || 'n/a'}`,
    p.monthlyExpenses ? `Monthly expenses: ${inr(p.monthlyExpenses)}` : '',
  ].filter(Boolean).join('\n');
}

export interface CfoAnswer {
  content: string;
  citations: { tag: string; title: string }[];
  engine: 'claude' | 'rules' | 'guardrail';
}

// ── Claude generation ───────────────────────────────────────────────
async function askClaude(question: string, userContext: string, docs: RetrievedDoc[], history: { role: string; content: string }[]): Promise<string> {
  const kb = docs.map((d, i) => `[${i + 1}] (${d.source_tag}) ${d.title}: ${d.content}`).join('\n\n');
  const system = `You are PayWatch — the user's friendly personal-finance assistant and always-on CFO, inside the PayWatch app. You sound like a sharp, warm finance-savvy friend, not a textbook. You are talking to an everyday Indian, often a beginner. If asked who you are, you are "PayWatch".

THE USER'S FINANCIAL PROFILE (weave these exact numbers naturally into your answer):
${userContext}

KNOWLEDGE BASE (use these facts; do NOT paste them verbatim):
${kb || '(no relevant documents retrieved)'}

HOW TO WRITE (this is a chat — sound like one):
- Open with one warm, direct sentence that answers the question or sets up the answer. No "Great question!" filler.
- Keep it tight: usually 100–180 words. Short paragraphs (1–3 sentences each).
- Use a short bullet list ("- ") only when listing 2+ options or steps; otherwise write in plain sentences.
- Use **bold** sparingly for the one or two key numbers or the bottom line.
- Plain, beginner-friendly English. Explain any jargon in a few words the first time.
- Do NOT put source tags like [IT Act] or [Standard rule] in the text — the app shows sources separately below your message.
- End with a brief, concrete next step or a follow-up question, like a real advisor would.

COMPLIANCE — never break (legal requirements):
1. NEVER name a specific stock, mutual fund scheme, or crypto asset. Talk in categories only (e.g. "a large-cap index fund", "a liquid fund").
2. NEVER promise or imply guaranteed returns on market-linked products.
3. Ground every number in the user's actual profile above; use Indian formats (₹, lakh, crore).
4. For sizing guidance (like insurance cover), give a rounded range, not a falsely precise figure.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: 1024,
      system,
      messages: [...history.slice(-6), { role: 'user', content: question }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  return data.content?.[0]?.text || 'I could not generate a response. Please try again.';
}

// ── Deterministic fallback engine ───────────────────────────────────
function rulesAnswer(question: string, p: ProfileData, docs: RetrievedDoc[]): string {
  const q = question.toLowerCase();
  const score = computeScore(p);
  const parts: string[] = [];

  if (/regime|old.*new|new.*old/.test(q) && /tax/.test(q)) {
    const cmp = compareRegimes(p);
    parts.push(`**Regime comparison for your income (${inr(p.user.annual_gross_income)} gross):**\n\n· Old regime tax: ${inr(cmp.oldRegime.tax)} (deductions: ${inr(cmp.oldRegime.totalDeductions)})\n· New regime tax: ${inr(cmp.newRegime.tax)}\n\n${cmp.reasoning} [IT Act FY2025-26]`);
  } else if (/prepay|pre-pay|prepayment/.test(q) && /loan|home/.test(q)) {
    const homeLoans = p.liabilities?.home_loans || [];
    const outstanding = homeLoans.reduce((s: number, l: any) => s + (Number(l.outstanding) || 0), 0);
    const rate = homeLoans[0]?.rate || 8.5;
    parts.push(`**Prepay vs invest — your numbers:**\n\nYour home loan outstanding is ${inr(outstanding)} at ~${rate}% interest. After the 24(b) tax deduction (30% bracket), your effective loan cost is roughly ${(rate * 0.7).toFixed(1)}%. [IT Act FY2025-26]\n\nLong-run equity index returns have averaged 11–12% (not guaranteed). The standard framework [Standard planning rule]:\n\n· Effective loan cost < expected return → investing the surplus usually wins mathematically\n· But prepayment is a guaranteed, risk-free "return" at your loan rate\n\nA common balanced approach is splitting surplus 50:50 between prepayment and equity index investing until your EMI-to-income ratio is comfortable, then tilting toward investing. Your emergency fund (${score.dimensions.emergency_fund.explanation.toLowerCase()}) should be funded before either.`);
  } else if (/80c|elss|tax sav/.test(q)) {
    parts.push(`**Your Section 80C position:** the limit is ₹1.5L per FY. ${score.dimensions.tax_efficiency.explanation} [IT Act FY2025-26]\n\nWhat qualifies: EPF (automatic from salary), PPF, ELSS funds (3-yr lock-in), 5-yr tax-saver FDs, home loan principal, children's school tuition fees. If your EPF already fills the limit, additional ELSS gives no extra deduction — check your EPF contribution first.`);
  } else if (/term|life insurance|life cover/.test(q)) {
    const ins = analyseInsurance(p);
    parts.push(`**Your term cover analysis:** you have ${inr(ins.term.current)} against a recommended ${inr(ins.term.recommended)} (25× income, adjusted for liabilities) — a gap of ${inr(ins.term.gap)}. [Standard planning rule]\n\n${ins.term.notes[0] || ''}${ins.term.premiumEstimateAnnual ? `\n\nEstimated premium for the gap: ${inr(ins.term.premiumEstimateAnnual.low)}–${inr(ins.term.premiumEstimateAnnual.high)}/year at your age.` : ''}`);
  } else if (/health insurance|health cover|mediclaim|top.?up/.test(q)) {
    const ins = analyseInsurance(p);
    parts.push(`**Your health cover analysis:** current cover ${inr(ins.health.current)} vs recommended ${inr(ins.health.recommended)} for your family size. [IRDAI guideline]\n\n${ins.health.notes.join('\n\n') || 'A super top-up policy over a base policy is usually the most premium-efficient way to raise cover.'}`);
  } else if (/emergency fund|emergency/.test(q)) {
    parts.push(`**Emergency fund:** ${score.dimensions.emergency_fund.explanation} [Standard planning rule]\n\nKeep it in instantly-accessible instruments: savings account + liquid mutual funds. It is insurance against forced debt, not an investment — return is secondary to access.`);
  } else if (/net ?worth/.test(q)) {
    const nw = computeNetWorth(p);
    parts.push(`**Your net worth:** ${inr(nw.netWorth)} — assets of ${inr(nw.totalAssets)} minus liabilities of ${inr(nw.totalLiabilities)}. ${Math.round(nw.liquidityRatio * 100)}% of your assets are liquid. [Your profile]`);
  } else if (/score|mhs|health score/.test(q)) {
    const weakest = Object.entries(score.dimensions).filter(([, d]) => d.available).sort((a, b) => a[1].score - b[1].score)[0];
    parts.push(`**Your Money Health Score is ${score.score}/100.** Your weakest dimension is ${weakest?.[0].replace(/_/g, ' ')} (${weakest?.[1].score}/100): ${weakest?.[1].explanation} [Your profile]\n\nCheck your Actions list — it is sorted by exactly how many points each step adds.`);
  } else {
    // General: answer from retrieved KB docs (exclude personal memories)
    const kbDocs = docs.filter((d) => d.scope === 'global');
    if (kbDocs.length > 0) {
      parts.push(kbDocs.slice(0, 2).map((d) => `**${d.title}** [${d.source_tag}]\n\n${d.content}`).join('\n\n---\n\n'));
    } else {
      parts.push(`I can answer questions about your taxes (regime choice, 80C, HRA), insurance gaps, emergency fund, net worth, debt strategy, and goals — all grounded in your actual numbers.\n\nTry: "Should I prepay my home loan or invest?", "Which tax regime saves me more?", or "Is my term cover enough?"`);
    }
  }
  // Clean up for the chat renderer: drop inline source tags (shown as chips
  // below) and normalise "·" bullets to markdown "-".
  return parts
    .join('\n\n')
    .replace(/\s*\[(IT Act[^\]]*|IRDAI[^\]]*|Standard planning rule|Your profile|SEBI[^\]]*|RBI[^\]]*|AMFI[^\]]*|PFRDA[^\]]*|EPFO[^\]]*|DPDP[^\]]*)\]/g, '')
    .replace(/(^|\n)·\s/g, '$1- ');
}

// ── Main entry ──────────────────────────────────────────────────────
export async function answerQuestion(
  userId: string,
  question: string,
  p: ProfileData,
  history: { role: string; content: string }[]
): Promise<CfoAnswer> {
  const blocked = checkGuardrails(question);
  if (blocked) {
    return { content: GUARDRAIL_RESPONSE(blocked), citations: [{ tag: 'SEBI IA Regulations 2013', title: 'Investment advice licensing' }], engine: 'guardrail' };
  }

  const docs = await retrieve(userId, question, 6);
  const userContext = buildUserContext(p);

  let content: string;
  let engine: 'claude' | 'rules';
  if (config.anthropicApiKey) {
    try {
      content = await askClaude(question, userContext, docs, history);
      engine = 'claude';
    } catch (e) {
      console.error('[cfo-ai] Claude API failed, using rules engine:', e);
      content = rulesAnswer(question, p, docs);
      engine = 'rules';
    }
  } else {
    content = rulesAnswer(question, p, docs);
    engine = 'rules';
  }

  const citations = docs.slice(0, 4).map((d) => ({ tag: d.source_tag, title: d.title }));
  return { content, citations, engine };
}
