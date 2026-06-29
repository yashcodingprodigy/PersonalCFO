// Monthly financial records — payslips, bank statements, demat/holdings and
// capital-gains files a user uploads each month. The raw file is AES-256
// encrypted before it goes to Supabase Storage (same model as the vault and the
// CA portal); `extracted` stores the user-confirmed structured data parsed from
// it on the client. Everything is scoped strictly by user_id.
import crypto from 'crypto';
import { query, one } from '../db';
import { uploadObject, downloadObject, storageConfigured } from '../adapters/storage';
import { encryptBuf, decryptBuf } from './encryption';

export { storageConfigured };

export interface RecordRow {
  record_id: string;
  period: string;
  doc_type: string;
  label: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  extracted: any;
  summary: string | null;
  has_file: boolean;
  created_at: string;
}

const PUBLIC_COLS = `record_id, period, doc_type, label, file_name, mime_type, size_bytes,
  extracted, summary, contribution, (storage_path IS NOT NULL) AS has_file, created_at`;

// Friendly names for the figures a record changed → shown in the delete warning.
const TAXDATA_FRIENDLY: Record<string, string> = {
  salary_gross: 'gross salary', tds_salary: 'salary TDS', tds_other: 'other TDS',
  basic_salary_annual: 'salary breakup', hra_received_annual: 'salary breakup',
  interest_income: 'interest income', dividend_income: 'dividend income',
  stcg_equity: 'capital gains', ltcg_equity: 'capital gains', stcl: 'capital gains', ltcl: 'capital gains',
  stcg_other: 'capital gains', ltcg_other: 'capital gains', other_capital_gains: 'capital gains',
  home_loan_interest_annual: 'home-loan interest (24b)', home_loan_principal_annual: 'home-loan principal (80C)',
  health_premium_self_annual: '80D health deduction', nps_80ccd1b_annual: 'NPS deduction (80CCD-1B)',
  donations_80g_annual: '80G donation', rent_paid_monthly: 'HRA rent', employer_nps_annual: 'employer NPS',
  education_loan_interest_annual: '80E education-loan', other_income: 'other income',
  business_income: 'business income', house_property_income: 'house property',
};

// Human list of what removing a record will change (from its stored contribution).
export function affectsFromContribution(c: any): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of Object.keys(c?.taxData || {})) {
    const f = TAXDATA_FRIENDLY[k] || 'tax data';
    if (!seen.has(f)) { seen.add(f); out.push(f); }
  }
  const fps = c?.txnFingerprints || [];
  if (fps.length) out.push(`${fps.length} imported transaction${fps.length === 1 ? '' : 's'}`);
  return out;
}

export async function listRecords(userId: string): Promise<(RecordRow & { affects: string[] })[]> {
  const rows = await query<any>(
    `SELECT ${PUBLIC_COLS} FROM monthly_records WHERE user_id = $1 ORDER BY period DESC, created_at DESC`,
    [userId]
  );
  return rows.map((r) => ({ ...r, affects: affectsFromContribution(r.contribution) }));
}

export async function createRecord(
  userId: string,
  d: { period: string; doc_type: string; label: string; extracted?: any; summary?: string | null; contribution?: any }
): Promise<RecordRow> {
  return one<RecordRow>(
    `INSERT INTO monthly_records (user_id, period, doc_type, label, extracted, summary, contribution)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb)
     RETURNING ${PUBLIC_COLS}`,
    [userId, d.period, d.doc_type, d.label, JSON.stringify(d.extracted || {}), d.summary || null, JSON.stringify(d.contribution || {})]
  ) as Promise<RecordRow>;
}

// Fetch a record's contribution (for reversal on delete).
export async function getRecordContribution(userId: string, recordId: string): Promise<any | null> {
  const r = await one<any>(`SELECT contribution FROM monthly_records WHERE record_id = $1 AND user_id = $2`, [recordId, userId]);
  return r ? (r.contribution || {}) : null;
}

export async function attachRecordFile(
  userId: string,
  recordId: string,
  file: { name: string; mimeType?: string; dataBase64: string }
) {
  if (!storageConfigured()) { const e: any = new Error('File storage isn’t set up yet (Supabase Storage not configured).'); e.code = 'not_configured'; throw e; }
  const bytes = Buffer.from(file.dataBase64, 'base64');
  if (bytes.length === 0) { const e: any = new Error('Empty file.'); e.code = 'bad_file'; throw e; }
  if (bytes.length > 8 * 1024 * 1024) { const e: any = new Error('File too large (max 8 MB).'); e.code = 'too_large'; throw e; }
  const rec = await one<any>(`SELECT record_id FROM monthly_records WHERE record_id = $1 AND user_id = $2`, [recordId, userId]);
  if (!rec) { const e: any = new Error('Record not found.'); e.code = 'not_found'; throw e; }
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'document';
  const path = `records/${userId}/${crypto.randomUUID()}-${safe}`;
  await uploadObject(path, encryptBuf(bytes), 'application/octet-stream');
  await query(
    `UPDATE monthly_records SET storage_path = $3, file_name = $4, mime_type = $5, size_bytes = $6, updated_at = now()
     WHERE record_id = $1 AND user_id = $2`,
    [recordId, userId, path, safe, file.mimeType || null, bytes.length]
  );
  return { file_name: safe, size_bytes: bytes.length };
}

export async function getRecordFile(userId: string, recordId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string } | null> {
  const d = await one<any>(`SELECT storage_path, file_name, mime_type FROM monthly_records WHERE record_id = $1 AND user_id = $2`, [recordId, userId]);
  if (!d || !d.storage_path) return null;
  const enc = await downloadObject(d.storage_path);
  return { buffer: decryptBuf(enc), fileName: d.file_name || 'document', mimeType: d.mime_type || 'application/octet-stream' };
}

export async function deleteRecord(userId: string, recordId: string) {
  await query(`DELETE FROM monthly_records WHERE record_id = $1 AND user_id = $2`, [recordId, userId]);
}

// ── CA-side read access (an active link's CA can view a client's records) ──
// Returns metadata + extracted data only (no file bytes); file download for the
// CA goes through getRecordFileForCa which checks the link separately.
export async function listRecordsForUserId(userId: string): Promise<RecordRow[]> {
  return listRecords(userId);
}
export async function getRecordFileByUser(userId: string, recordId: string) {
  return getRecordFile(userId, recordId);
}
