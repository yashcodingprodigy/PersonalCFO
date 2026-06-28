// Monthly Records — the recurring documents a user uploads each month so the
// app and their CA get the full money-flow picture. Files are AES-256 encrypted
// at rest; structured data is extracted on the client and confirmed by the user
// before it's stored here. Bank-statement transactions and holdings look-through
// reuse the existing /statements/analyze and /holdings/analyze endpoints.
import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { listRecords, createRecord, attachRecordFile, getRecordFile, deleteRecord } from '../services/monthlyRecords';
import { salaryTaxComparison } from '../services/tax';
import { recalculateAndStoreScore } from '../services/profile';
import { aiAvailable, analyzeDocument, ExpectedDoc } from '../services/docAI';
import { remember } from '../services/rag';

// tax_data fields an upload is allowed to set (paise) — these flow straight into
// the deduction tracker, tax-efficiency score, tax reduction plan and actions.
const TAX_DATA_KEYS = new Set([
  'home_loan_interest_annual', 'home_loan_principal_annual', 'health_premium_self_annual',
  'health_premium_parents_annual', 'nps_80ccd1b_annual', 'donations_80g_annual', 'rent_paid_monthly',
  'elss_annual', 'ppf_annual', 'lic_premium_annual', 'school_fees_annual', 'epf_contribution_annual',
  'basic_salary_annual', 'hra_received_annual',
]);

export const recordsRouter = Router();
recordsRouter.use(requireAuth);

// The recurring document types we track each month, with the file formats we can
// actually read reliably. (The web UI enforces these too — we keep images out of
// the parseable types so a blurry photo can't corrupt the extracted numbers.)
// The full recurring document set, grouped by category. Formats are enforced
// (images are kept out of parseable types so a blurry photo can't corrupt data).
export const RECORD_TYPES = [
  // Income & salary
  { type: 'employment_contract', label: 'Employment contract / offer letter', formats: ['pdf'], cadence: 'once', category: 'Income & salary' },
  { type: 'employment_letter', label: 'Salary structure / breakup letter', formats: ['pdf'], cadence: 'yearly', category: 'Income & salary' },
  { type: 'payslip', label: 'Monthly payslip (incl. reimbursements)', formats: ['pdf'], cadence: 'monthly', category: 'Income & salary' },
  { type: 'form16', label: 'Form 16 (annual TDS certificate)', formats: ['pdf'], cadence: 'yearly', category: 'Income & salary' },
  { type: 'form16a', label: 'Form 16A (TDS on non-salary income)', formats: ['pdf'], cadence: 'quarterly', category: 'Income & salary' },
  // Tax statements
  { type: 'form26as_ais', label: 'Form 26AS / AIS', formats: ['pdf'], cadence: 'quarterly', category: 'Tax statements' },
  // Banking & spending
  { type: 'bank_statement', label: 'Bank statement', formats: ['pdf', 'xlsx', 'xls', 'csv'], cadence: 'monthly', category: 'Banking & spending' },
  { type: 'credit_card_statement', label: 'Credit-card statement', formats: ['pdf', 'xlsx', 'xls', 'csv'], cadence: 'monthly', category: 'Banking & spending' },
  // Investments
  { type: 'demat_holdings', label: 'Demat / mutual-fund holdings report', formats: ['xlsx', 'xls', 'csv'], cadence: 'monthly', category: 'Investments' },
  { type: 'mutual_fund_cas', label: 'Mutual-fund statement (CAS)', formats: ['pdf'], cadence: 'monthly', category: 'Investments' },
  { type: 'capital_gains', label: 'Capital-gains statement', formats: ['xlsx', 'xls', 'csv'], cadence: 'yearly', category: 'Investments' },
  { type: 'dividend_statement', label: 'Dividend income statement', formats: ['pdf'], cadence: 'yearly', category: 'Investments' },
  { type: 'interest_certificate', label: 'Bank / FD interest certificate', formats: ['pdf'], cadence: 'yearly', category: 'Investments' },
  // Loans
  { type: 'home_loan_certificate', label: 'Home-loan interest certificate', formats: ['pdf'], cadence: 'yearly', category: 'Loans' },
  { type: 'other_loan_statement', label: 'Other loan interest certificate (education / personal / car)', formats: ['pdf'], cadence: 'yearly', category: 'Loans' },
  // Deductions & tax-saving proofs
  { type: 'rent_receipts', label: 'Rent receipts + landlord PAN (HRA)', formats: ['pdf'], cadence: 'yearly', category: 'Deductions & tax-saving proofs' },
  { type: 'tax_saving_80c', label: '80C proofs (PPF, ELSS, LIC, tuition…)', formats: ['pdf'], cadence: 'yearly', category: 'Deductions & tax-saving proofs' },
  { type: 'health_insurance_80d', label: 'Health-insurance premium (80D)', formats: ['pdf'], cadence: 'yearly', category: 'Deductions & tax-saving proofs' },
  { type: 'nps_statement', label: 'NPS statement (80CCD)', formats: ['pdf'], cadence: 'yearly', category: 'Deductions & tax-saving proofs' },
  { type: 'donation_80g', label: 'Donation receipts (80G)', formats: ['pdf'], cadence: 'yearly', category: 'Deductions & tax-saving proofs' },
  // Insurance & property
  { type: 'insurance_policy', label: 'Life / health insurance policy', formats: ['pdf'], cadence: 'once', category: 'Insurance & property' },
  { type: 'property_papers', label: 'Property sale / purchase deed', formats: ['pdf'], cadence: 'once', category: 'Insurance & property' },
  // Business & self-employed
  { type: 'gst_returns', label: 'GST return (GSTR-1 / 3B)', formats: ['pdf'], cadence: 'monthly', category: 'Business & self-employed' },
  { type: 'profit_loss', label: 'Profit & loss / balance sheet', formats: ['pdf'], cadence: 'yearly', category: 'Business & self-employed' },
];

recordsRouter.get('/types', (_req, res) => res.json(RECORD_TYPES));

// GET /records — every record (newest period first), no file bytes.
recordsRouter.get('/', async (req: AuthedRequest, res) => {
  res.json(await listRecords(req.userId!));
});

// GET /records/tax-preview?annualGross=PAISE[&otherDeductions=PAISE]
// Slab-by-slab tax-liability window for an annualised salary (from a payslip).
recordsRouter.get('/tax-preview', async (req: AuthedRequest, res) => {
  const gross = Number(req.query.annualGross);
  const ded = Number(req.query.otherDeductions) || 0;
  if (!Number.isFinite(gross) || gross <= 0 || gross > 1_000_000_000_00) return res.status(400).json({ error: 'invalid_input', message: 'annualGross must be a positive amount in paise.' });
  res.json({
    ...salaryTaxComparison(Math.round(gross), Math.max(0, Math.round(ded))),
    disclaimer: 'Projected from one payslip annualised, using FY2025-26 slabs and the standard deduction only. Actual tax depends on your full-year income and deductions — verify with your CA.',
  });
});

// POST /records/ai-extract — let Claude read & validate an uploaded document.
// The client sends the text it extracted from the file; we never store it.
const AI_TYPES = [
  'employment_contract', 'employment_letter', 'payslip', 'form16', 'form16a', 'form26as_ais',
  'mutual_fund_cas', 'dividend_statement', 'interest_certificate',
  'home_loan_certificate', 'other_loan_statement',
  'rent_receipts', 'tax_saving_80c', 'health_insurance_80d', 'nps_statement', 'donation_80g',
  'insurance_policy', 'property_papers', 'gst_returns', 'profit_loss',
] as const;
recordsRouter.post('/ai-extract', rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'recai' }), async (req: AuthedRequest, res) => {
  if (!aiAvailable()) return res.json({ available: false });
  const parsed = z.object({
    doc_type: z.enum(AI_TYPES),
    text: z.string().min(1).max(60_000),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  try {
    const result = await analyzeDocument(parsed.data.doc_type as ExpectedDoc, parsed.data.text);
    res.json({ available: true, result });
  } catch (e: any) {
    // Soft-fail: client falls back to the deterministic parser.
    res.json({ available: false, error: 'ai_failed', message: String(e?.message || e).slice(0, 200) });
  }
});

const recordSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'period must be YYYY-MM'),
  doc_type: z.string().min(1).max(40),
  label: z.string().min(1).max(160),
  extracted: z.record(z.any()).optional(),
  summary: z.string().max(500).nullable().optional(),
  // Optional salary breakup (annualised paise) from a payslip → improves the
  // HRA / tax engine when the user confirms it.
  applySalary: z.object({ basicAnnual: z.number().int().nonnegative(), hraAnnual: z.number().int().nonnegative() }).optional(),
  // Optional tax_data updates (paise) from the doc — e.g. home-loan interest,
  // 80D premium, NPS, 80G donation, rent. Server whitelists the keys.
  applyTaxData: z.record(z.number().int().nonnegative().max(1_000_000_000_00)).optional(),
});

// POST /records — create a record's metadata + confirmed extracted data.
recordsRouter.post('/', rateLimit({ windowMs: 60_000, max: 60, keyPrefix: 'rec' }), async (req: AuthedRequest, res) => {
  const parsed = recordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const d = parsed.data;
  const row = await createRecord(req.userId!, { period: d.period, doc_type: d.doc_type, label: d.label, extracted: d.extracted, summary: d.summary });

  // Fold confirmed figures from the doc into tax_data so the deduction tracker,
  // tax-efficiency score, tax reduction plan and Actions all get more accurate.
  const updates: Record<string, number> = {};
  if (d.applySalary?.basicAnnual) updates.basic_salary_annual = d.applySalary.basicAnnual;
  if (d.applySalary?.hraAnnual) updates.hra_received_annual = d.applySalary.hraAnnual;
  for (const [k, v] of Object.entries(d.applyTaxData || {})) {
    if (TAX_DATA_KEYS.has(k) && v > 0) updates[k] = v;
  }
  if (Object.keys(updates).length > 0) {
    const prof = await one<any>(`SELECT tax_data FROM profiles WHERE user_id = $1`, [req.userId]);
    const t: any = { ...(prof?.tax_data || {}), ...updates };
    await query(
      `INSERT INTO profiles (user_id, tax_data) VALUES ($1, $2::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET tax_data = $2::jsonb, version = profiles.version + 1, updated_at = now()`,
      [req.userId, JSON.stringify(t)]
    );
  }
  // Always recalc the score + remember the upload so guidance + Ask PayWatch
  // reflect the user's latest documents.
  await recalculateAndStoreScore(req.userId!, 'record_upload');
  await remember(req.userId!, 'record_upload', `Uploaded ${d.label}`,
    `On ${new Date().toISOString().slice(0, 10)} the user uploaded their ${d.label} for ${d.period}.${d.summary ? ' ' + d.summary : ''}`
  ).catch(() => {});

  res.status(201).json(row);
});

// POST /records/:id/file — attach the encrypted source file (path ends in /file
// → covered by the larger 12 MB body limit).
recordsRouter.post('/:id/file', async (req: AuthedRequest, res) => {
  const parsed = z.object({ file_name: z.string().min(1).max(200), mime_type: z.string().max(100).optional(), data: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: 'Missing file.' });
  try {
    const r = await attachRecordFile(req.userId!, req.params.id, { name: parsed.data.file_name, mimeType: parsed.data.mime_type, dataBase64: parsed.data.data });
    res.json(r);
  } catch (e: any) {
    res.status(e.code === 'not_configured' ? 503 : e.code === 'not_found' ? 404 : 400).json({ error: e.code || 'upload_failed', message: e.message });
  }
});

// GET /records/:id/file — download (decrypted) the source file.
recordsRouter.get('/:id/file', async (req: AuthedRequest, res) => {
  const f = await getRecordFile(req.userId!, req.params.id);
  if (!f) return res.status(404).json({ error: 'not_found' });
  res.setHeader('Content-Type', f.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${f.fileName.replace(/"/g, '')}"`);
  res.send(f.buffer);
});

recordsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  await deleteRecord(req.userId!, req.params.id);
  res.json({ ok: true });
});
