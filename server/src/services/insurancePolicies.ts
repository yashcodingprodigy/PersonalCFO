// Insurance policy store. The policy PDF is AES-256 encrypted in Supabase
// Storage (same model as the vault / monthly records); the user-confirmed
// AI-read fields live in dedicated columns + `extracted`. Active policies are
// synced into profiles.insurance so the cover analysis and Money Score update,
// and their expiry/renewal/maturity dates drive proactive alerts.
import crypto from 'crypto';
import { query, one } from '../db';
import { uploadObject, downloadObject, storageConfigured } from '../adapters/storage';
import { encryptBuf, decryptBuf } from './encryption';

export { storageConfigured };

export const INSURANCE_CATEGORIES = [
  'term_life', 'health', 'motor', 'personal_accident', 'critical_illness', 'home', 'travel', 'life_endowment', 'other',
] as const;
export type InsuranceCategory = typeof INSURANCE_CATEGORIES[number];

export const CATEGORY_LABEL: Record<string, string> = {
  term_life: 'Term life insurance', health: 'Health insurance', motor: 'Motor (car/bike) insurance',
  personal_accident: 'Personal accident cover', critical_illness: 'Critical illness cover',
  home: 'Home / property insurance', travel: 'Travel insurance', life_endowment: 'Endowment / ULIP / money-back', other: 'Other insurance',
};

// Field list + type options for the AI reader.
export const INSURANCE_FIELD_GUIDE =
  'insurer, planName, policyNumber, category, holderName, nominee, sumAssured, premium, ' +
  'premiumFrequency, issueDate, startDate, expiryDate, maturityDate, renewalDate';
export const INSURANCE_TYPE_OPTIONS = [...INSURANCE_CATEGORIES] as string[];

const PUBLIC_COLS = `policy_id, category, insurer, plan_name, policy_number, holder_name, nominee,
  sum_assured, premium, premium_frequency,
  to_char(issue_date,'YYYY-MM-DD') AS issue_date,
  to_char(start_date,'YYYY-MM-DD') AS start_date,
  to_char(expiry_date,'YYYY-MM-DD') AS expiry_date,
  to_char(maturity_date,'YYYY-MM-DD') AS maturity_date,
  to_char(renewal_date,'YYYY-MM-DD') AS renewal_date,
  status, file_name, mime_type, size_bytes, (storage_path IS NOT NULL) AS has_file, extracted, created_at`;

export interface PolicyInput {
  category: string; insurer?: string | null; plan_name?: string | null; policy_number?: string | null;
  holder_name?: string | null; nominee?: string | null;
  sum_assured?: number | null; premium?: number | null; premium_frequency?: string | null;
  issue_date?: string | null; start_date?: string | null; expiry_date?: string | null;
  maturity_date?: string | null; renewal_date?: string | null; extracted?: any;
}

export async function listPolicies(userId: string) {
  return query(`SELECT ${PUBLIC_COLS} FROM insurance_policies WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
}

export async function createPolicy(userId: string, d: PolicyInput) {
  const row = await one<any>(
    `INSERT INTO insurance_policies
       (user_id, category, insurer, plan_name, policy_number, holder_name, nominee,
        sum_assured, premium, premium_frequency, issue_date, start_date, expiry_date, maturity_date, renewal_date, extracted)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
     RETURNING ${PUBLIC_COLS}`,
    [userId, d.category, d.insurer || null, d.plan_name || null, d.policy_number || null, d.holder_name || null, d.nominee || null,
     d.sum_assured ?? null, d.premium ?? null, d.premium_frequency || null,
     d.issue_date || null, d.start_date || null, d.expiry_date || null, d.maturity_date || null, d.renewal_date || null,
     JSON.stringify(d.extracted || {})]
  );
  await syncProfileInsurance(userId);
  return row;
}

export async function attachPolicyFile(userId: string, policyId: string, file: { name: string; mimeType?: string; dataBase64: string }) {
  if (!storageConfigured()) { const e: any = new Error('File storage isn’t set up yet (Supabase Storage not configured).'); e.code = 'not_configured'; throw e; }
  const bytes = Buffer.from(file.dataBase64, 'base64');
  if (bytes.length === 0) { const e: any = new Error('Empty file.'); e.code = 'bad_file'; throw e; }
  if (bytes.length > 8 * 1024 * 1024) { const e: any = new Error('File too large (max 8 MB).'); e.code = 'too_large'; throw e; }
  const pol = await one<any>(`SELECT policy_id FROM insurance_policies WHERE policy_id = $1 AND user_id = $2`, [policyId, userId]);
  if (!pol) { const e: any = new Error('Policy not found.'); e.code = 'not_found'; throw e; }
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'policy';
  const path = `insurance/${userId}/${crypto.randomUUID()}-${safe}`;
  await uploadObject(path, encryptBuf(bytes), 'application/octet-stream');
  await query(
    `UPDATE insurance_policies SET storage_path = $3, file_name = $4, mime_type = $5, size_bytes = $6, updated_at = now()
     WHERE policy_id = $1 AND user_id = $2`,
    [policyId, userId, path, safe, file.mimeType || null, bytes.length]
  );
  return { file_name: safe, size_bytes: bytes.length };
}

export async function getPolicyFile(userId: string, policyId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string } | null> {
  const d = await one<any>(`SELECT storage_path, file_name, mime_type FROM insurance_policies WHERE policy_id = $1 AND user_id = $2`, [policyId, userId]);
  if (!d || !d.storage_path) return null;
  const enc = await downloadObject(d.storage_path);
  return { buffer: decryptBuf(enc), fileName: d.file_name || 'policy', mimeType: d.mime_type || 'application/octet-stream' };
}

export async function deletePolicy(userId: string, policyId: string) {
  await query(`DELETE FROM insurance_policies WHERE policy_id = $1 AND user_id = $2`, [policyId, userId]);
  await syncProfileInsurance(userId);
}

// ── In-app insurance applications (corporate-agent journey, intent capture) ──
const APP_COLS = `application_id, plan_id, category, insurer, plan_name, cover, premium_indicative,
  applicant, status, created_at`;

export async function listApplications(userId: string) {
  return query(`SELECT ${APP_COLS} FROM insurance_applications WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
}

export async function createApplication(userId: string, d: {
  plan_id?: string | null; category: string; insurer?: string | null; plan_name?: string | null;
  cover?: number | null; premium_indicative?: number | null; applicant?: any;
}) {
  return one(
    `INSERT INTO insurance_applications (user_id, plan_id, category, insurer, plan_name, cover, premium_indicative, applicant)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING ${APP_COLS}`,
    [userId, d.plan_id || null, d.category, d.insurer || null, d.plan_name || null,
     d.cover ?? null, d.premium_indicative ?? null, JSON.stringify(d.applicant || {})]
  );
}

export async function withdrawApplication(userId: string, applicationId: string) {
  await query(`DELETE FROM insurance_applications WHERE application_id = $1 AND user_id = $2`, [applicationId, userId]);
}

// Roll active policies up into profiles.insurance.term / .health so the existing
// cover analysis (analyseInsurance) and the Money Score reflect what the user
// actually holds. Other keys in the insurance JSON are preserved.
export async function syncProfileInsurance(userId: string) {
  const policies = await query<any>(
    `SELECT category, sum_assured FROM insurance_policies WHERE user_id = $1 AND status = 'active'`, [userId]
  );
  const term = policies.filter((p) => p.category === 'term_life' || p.category === 'life_endowment')
    .map((p) => ({ sum_assured: Number(p.sum_assured) || 0 }));
  const health = policies.filter((p) => p.category === 'health')
    .map((p) => ({ sum_insured: Number(p.sum_assured) || 0 }));
  const prof = await one<any>(`SELECT insurance FROM profiles WHERE user_id = $1`, [userId]);
  const ins: any = prof?.insurance || {};
  ins.term = term;
  ins.health = health;
  ins.policies_synced = true;
  await query(
    `INSERT INTO profiles (user_id, insurance) VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET insurance = $2::jsonb, version = profiles.version + 1, updated_at = now()`,
    [userId, JSON.stringify(ins)]
  );
}
