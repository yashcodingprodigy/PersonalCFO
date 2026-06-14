// Document vault — organisational metadata + expiry reminders (no file hosting).
import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

// The standard slots PayWatch tracks for every user.
export const DOC_SLOTS = [
  { slot: 'pan', label: 'PAN card' },
  { slot: 'aadhaar', label: 'Aadhaar' },
  { slot: 'form16', label: 'Form 16 (this year)' },
  { slot: 'bank_statement', label: 'Bank statements' },
  { slot: 'investment_proofs', label: '80C / 80D investment proofs' },
  { slot: 'capital_gains', label: 'Capital-gains statement' },
  { slot: 'insurance_policy', label: 'Insurance policies' },
  { slot: 'nomination', label: 'Nominations updated (bank/MF/EPF)' },
  { slot: 'rent_receipts', label: 'Rent receipts + landlord PAN' },
  { slot: 'loan_certificate', label: 'Loan interest certificates' },
];

documentsRouter.get('/slots', (_req, res) => res.json(DOC_SLOTS));

// GET /documents — user's tracked docs merged with the standard slot list
documentsRouter.get('/', async (req: AuthedRequest, res) => {
  const rows = await query(`SELECT * FROM documents WHERE user_id=$1 ORDER BY created_at`, [req.userId]);
  res.json(rows);
});

const docSchema = z.object({
  slot: z.string().max(40),
  label: z.string().min(1).max(140),
  status: z.enum(['have', 'missing']).default('missing'),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

// POST /documents — add or upsert a slot entry
documentsRouter.post('/', async (req: AuthedRequest, res) => {
  const parsed = docSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const d = parsed.data;
  const row = await one(
    `INSERT INTO documents (user_id, slot, label, status, expiry_date, note)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.userId, d.slot, d.label, d.status, d.expiry_date || null, d.note || null]
  );
  res.status(201).json(row);
});

// PATCH /documents/:id
documentsRouter.patch('/:id', async (req: AuthedRequest, res) => {
  const parsed = docSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const existing = await one(`SELECT * FROM documents WHERE id=$1 AND user_id=$2`, [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'not_found' });
  const d = { ...existing, ...parsed.data };
  const row = await one(
    `UPDATE documents SET label=$3, status=$4, expiry_date=$5, note=$6, updated_at=now()
     WHERE id=$1 AND user_id=$2 RETURNING *`,
    [req.params.id, req.userId, d.label, d.status, d.expiry_date || null, d.note || null]
  );
  res.json(row);
});

documentsRouter.delete('/:id', async (req: AuthedRequest, res) => {
  await query(`DELETE FROM documents WHERE id=$1 AND user_id=$2`, [req.params.id, req.userId]);
  res.json({ ok: true });
});
