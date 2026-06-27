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

export const recordsRouter = Router();
recordsRouter.use(requireAuth);

// The recurring document types we track each month, with the file formats we can
// actually read reliably. (The web UI enforces these too — we keep images out of
// the parseable types so a blurry photo can't corrupt the extracted numbers.)
export const RECORD_TYPES = [
  { type: 'employment_contract', label: 'Employment contract / offer letter', formats: ['pdf'], cadence: 'once' },
  { type: 'employment_letter', label: 'Salary structure / breakup letter', formats: ['pdf'], cadence: 'once' },
  { type: 'payslip', label: 'Monthly payslip (incl. reimbursements)', formats: ['pdf'], cadence: 'monthly' },
  { type: 'form16', label: 'Form 16 (annual TDS certificate)', formats: ['pdf'], cadence: 'yearly' },
  { type: 'bank_statement', label: 'Bank statement', formats: ['pdf', 'xlsx', 'xls', 'csv'], cadence: 'monthly' },
  { type: 'demat_holdings', label: 'Demat / mutual-fund holdings report', formats: ['xlsx', 'xls', 'csv'], cadence: 'monthly' },
  { type: 'capital_gains', label: 'Capital-gains statement', formats: ['xlsx', 'xls', 'csv'], cadence: 'monthly' },
  { type: 'form26as_ais', label: 'Form 26AS / AIS', formats: ['pdf'], cadence: 'quarterly' },
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

const recordSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/, 'period must be YYYY-MM'),
  doc_type: z.string().min(1).max(40),
  label: z.string().min(1).max(160),
  extracted: z.record(z.any()).optional(),
  summary: z.string().max(500).nullable().optional(),
  // Optional salary breakup (annualised paise) from a payslip → improves the
  // HRA / tax engine when the user confirms it.
  applySalary: z.object({ basicAnnual: z.number().int().nonnegative(), hraAnnual: z.number().int().nonnegative() }).optional(),
});

// POST /records — create a record's metadata + confirmed extracted data.
recordsRouter.post('/', rateLimit({ windowMs: 60_000, max: 60, keyPrefix: 'rec' }), async (req: AuthedRequest, res) => {
  const parsed = recordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const d = parsed.data;
  const row = await createRecord(req.userId!, { period: d.period, doc_type: d.doc_type, label: d.label, extracted: d.extracted, summary: d.summary });

  // Payslip → optionally fold the confirmed salary breakup into tax_data so the
  // HRA exemption + regime comparison get more accurate.
  if (d.applySalary && (d.applySalary.basicAnnual > 0 || d.applySalary.hraAnnual > 0)) {
    const prof = await one<any>(`SELECT tax_data FROM profiles WHERE user_id = $1`, [req.userId]);
    const t: any = prof?.tax_data || {};
    if (d.applySalary.basicAnnual > 0) t.basic_salary_annual = d.applySalary.basicAnnual;
    if (d.applySalary.hraAnnual > 0) t.hra_received_annual = d.applySalary.hraAnnual;
    await query(`UPDATE profiles SET tax_data = $2::jsonb, version = version + 1, updated_at = now() WHERE user_id = $1`, [req.userId, JSON.stringify(t)]);
    await recalculateAndStoreScore(req.userId!, 'payslip_upload');
  }

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
