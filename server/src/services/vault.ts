// Encrypted file storage for the user's Document Vault. Same model as the CA
// portal: files are AES-256 encrypted before upload to Supabase Storage and
// decrypted on the server for download. Scoped strictly by user_id.
import crypto from 'crypto';
import { query, one } from '../db';
import { uploadObject, downloadObject, storageConfigured } from '../adapters/storage';
import { encryptBuf, decryptBuf } from './encryption';

export { storageConfigured };

export async function attachVaultFile(userId: string, docId: string, file: { name: string; mimeType?: string; dataBase64: string }) {
  if (!storageConfigured()) { const e: any = new Error('File storage isn’t set up yet (Supabase Storage not configured).'); e.code = 'not_configured'; throw e; }
  const bytes = Buffer.from(file.dataBase64, 'base64');
  if (bytes.length === 0) { const e: any = new Error('Empty file.'); e.code = 'bad_file'; throw e; }
  if (bytes.length > 8 * 1024 * 1024) { const e: any = new Error('File too large (max 8 MB).'); e.code = 'too_large'; throw e; }
  const doc = await one<any>(`SELECT id FROM documents WHERE id = $1 AND user_id = $2`, [docId, userId]);
  if (!doc) { const e: any = new Error('Document not found.'); e.code = 'not_found'; throw e; }
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'document';
  const path = `vault/${userId}/${crypto.randomUUID()}-${safe}`;
  await uploadObject(path, encryptBuf(bytes), 'application/octet-stream');
  await query(
    `UPDATE documents SET storage_path = $3, file_name = $4, mime_type = $5, size_bytes = $6, status = 'have', updated_at = now() WHERE id = $1 AND user_id = $2`,
    [docId, userId, path, safe, file.mimeType || null, bytes.length]
  );
  return { file_name: safe, size_bytes: bytes.length };
}

export async function getVaultFile(userId: string, docId: string): Promise<{ buffer: Buffer; fileName: string; mimeType: string } | null> {
  const d = await one<any>(`SELECT storage_path, file_name, mime_type FROM documents WHERE id = $1 AND user_id = $2`, [docId, userId]);
  if (!d || !d.storage_path) return null;
  const enc = await downloadObject(d.storage_path);
  return { buffer: decryptBuf(enc), fileName: d.file_name || 'document', mimeType: d.mime_type || 'application/octet-stream' };
}
