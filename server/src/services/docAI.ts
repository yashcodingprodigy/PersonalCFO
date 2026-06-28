// AI document reader + validator. Instead of relying only on fixed regex
// parsers, we send the text extracted from an uploaded document to Claude, which
// (a) identifies what the document actually is, (b) checks it matches the type
// the user said they're uploading — so a random/incorrect PDF gets flagged — and
// (c) pulls out the structured fields regardless of the employer's layout.
//
// The Anthropic key is server-held; the client never sees it. When no key is
// configured the route reports `available:false` and the client falls back to
// the deterministic parsers (so the app still works in sandbox mode).
import { config } from '../config';

export type ExpectedDoc =
  | 'employment_contract' | 'employment_letter' | 'payslip' | 'form16'
  | 'bank_statement' | 'demat_holdings' | 'capital_gains' | 'form26as_ais';

export interface AIDocResult {
  documentType: string;      // what Claude thinks it actually is
  matchesExpected: boolean;  // does it match the type the user picked?
  confidence: number;        // 0..1
  reason: string;            // short human explanation
  summary: string;           // one-line summary of the document
  fields: Record<string, any>; // extracted values (amounts in WHOLE RUPEES)
}

export const aiAvailable = () => !!config.anthropicApiKey;

// What we expect each document to contain — guides Claude's extraction so the
// field names line up with what the app already uses.
const FIELD_GUIDE: Record<ExpectedDoc, string> = {
  payslip: 'period, employerName, grossMonthly, basicMonthly, hraMonthly, allowancesMonthly, reimbursementsMonthly, netMonthly, tdsMonthly',
  form16: 'assessmentYear, employerName, grossSalaryAnnual, standardDeduction, chapter6ADeductions, taxableIncome, taxOnIncome, taxPayable, tds',
  employment_letter: 'employerName, role, ctcAnnual, basicAnnual, hraAnnual, allowancesAnnual',
  employment_contract: 'employerName, role, joiningDate, ctcAnnual, noticePeriod, probationMonths',
  bank_statement: 'bankName, accountLast4, periodFrom, periodTo, openingBalance, closingBalance, transactionCount',
  demat_holdings: 'brokerOrDepository, asOfDate, holdingsCount, totalValue',
  capital_gains: 'brokerName, financialYear, shortTermGain, longTermGain, tradeCount',
  form26as_ais: 'pan, assessmentYear, totalTdsReported, totalIncomeReported',
};

const LABEL: Record<ExpectedDoc, string> = {
  payslip: 'monthly salary payslip',
  form16: 'Form 16 (TDS certificate)',
  employment_letter: 'salary structure / breakup letter',
  employment_contract: 'employment contract / offer letter',
  bank_statement: 'bank account statement',
  demat_holdings: 'demat / mutual-fund holdings report',
  capital_gains: 'capital-gains statement',
  form26as_ais: 'Form 26AS or AIS',
};

function extractJson(s: string): any {
  // Claude may wrap JSON in prose or fences — grab the first balanced object.
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) throw new Error('No JSON in AI response');
  return JSON.parse(s.slice(start, end + 1));
}

export async function analyzeDocument(expected: ExpectedDoc, text: string): Promise<AIDocResult> {
  const clipped = text.slice(0, 24000); // keep token use bounded
  const system =
    `You are a meticulous Indian financial-document analyst inside the PayWatch app. ` +
    `You are given the raw text extracted from a document a user uploaded. ` +
    `The user says it is a "${LABEL[expected]}". Your job: identify what the document really is, ` +
    `decide whether it matches that expected type, and extract the key fields.\n\n` +
    `Respond with ONE JSON object only — no prose, no markdown fences — with exactly these keys:\n` +
    `{\n` +
    `  "documentType": one of ["payslip","form16","employment_letter","employment_contract","bank_statement","demat_holdings","capital_gains","form26as_ais","other"],\n` +
    `  "matchesExpected": boolean (true only if the document genuinely is a ${LABEL[expected]}),\n` +
    `  "confidence": number 0..1,\n` +
    `  "reason": short string (why it does or doesn't match; if it doesn't, say what it looks like instead),\n` +
    `  "summary": short one-line description of the document,\n` +
    `  "fields": object with as many of these as you can read: ${FIELD_GUIDE[expected]}\n` +
    `}\n\n` +
    `Rules: All money amounts in "fields" must be plain WHOLE RUPEES as numbers (no ₹, no commas, e.g. 138965). ` +
    `Annualise nothing yourself — report monthly figures for a payslip and annual figures for Form 16/letters as they appear. ` +
    `If a field isn't present, omit it. If the text is empty, gibberish, or clearly a different kind of document ` +
    `(an ID card, an invoice, a random article, a photo with no readable text), set matchesExpected=false and explain. ` +
    `Never invent numbers that aren't in the text.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': config.anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: 900,
      system,
      messages: [{ role: 'user', content: `Document text:\n"""\n${clipped}\n"""` }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  const raw = data.content?.[0]?.text || '';
  const parsed = extractJson(raw);

  // Normalise / clamp so the client can trust the shape.
  return {
    documentType: String(parsed.documentType || 'other'),
    matchesExpected: parsed.matchesExpected === true,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    reason: String(parsed.reason || '').slice(0, 400),
    summary: String(parsed.summary || '').slice(0, 200),
    fields: parsed.fields && typeof parsed.fields === 'object' ? parsed.fields : {},
  };
}
