// Shared messaging + document logic for an active CA <-> client link.
import crypto from 'crypto';
import { query, one } from '../db';
import { uploadObject, signedUrl, storageConfigured } from '../adapters/storage';

export { storageConfigured };

// Returns the link only if it's active and owned by the given party.
export async function getActiveLink(linkId: string, party: { caId?: string; userId?: string }) {
  const col = party.caId ? 'ca_id' : 'user_id';
  const val = party.caId || party.userId;
  const link = await one<any>(`SELECT * FROM ca_client_links WHERE link_id = $1 AND ${col} = $2`, [linkId, val]);
  return link && link.status === 'active' ? link : null;
}

// ── Messaging ───────────────────────────────────────────────────────
export async function listMessages(linkId: string) {
  return query(`SELECT message_id, sender, body, read_at, created_at FROM ca_messages WHERE link_id = $1 ORDER BY created_at`, [linkId]);
}
export async function sendMessage(linkId: string, sender: 'ca' | 'user', body: string) {
  return one(`INSERT INTO ca_messages (link_id, sender, body) VALUES ($1,$2,$3) RETURNING message_id, sender, body, created_at`, [linkId, sender, body]);
}
export async function markRead(linkId: string, reader: 'ca' | 'user') {
  const other = reader === 'ca' ? 'user' : 'ca';
  await query(`UPDATE ca_messages SET read_at = now() WHERE link_id = $1 AND sender = $2 AND read_at IS NULL`, [linkId, other]);
}

// ── Documents ───────────────────────────────────────────────────────
export async function listDocs(linkId: string) {
  return query(`SELECT document_id, uploaded_by, file_name, mime_type, size_bytes, created_at FROM ca_documents WHERE link_id = $1 ORDER BY created_at DESC`, [linkId]);
}
export async function addDoc(linkId: string, uploadedBy: 'ca' | 'user', file: { name: string; mimeType?: string; dataBase64: string }) {
  if (!storageConfigured()) { const e: any = new Error('Document sharing isn’t set up yet (Supabase Storage not configured).'); e.code = 'not_configured'; throw e; }
  const bytes = Buffer.from(file.dataBase64, 'base64');
  if (bytes.length === 0) { const e: any = new Error('Empty file.'); e.code = 'bad_file'; throw e; }
  if (bytes.length > 8 * 1024 * 1024) { const e: any = new Error('File too large (max 8 MB).'); e.code = 'too_large'; throw e; }
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'document';
  const path = `${linkId}/${crypto.randomUUID()}-${safe}`;
  await uploadObject(path, bytes, file.mimeType || 'application/octet-stream');
  return one(
    `INSERT INTO ca_documents (link_id, uploaded_by, file_name, mime_type, size_bytes, storage_path)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING document_id, file_name, size_bytes`,
    [linkId, uploadedBy, safe, file.mimeType || null, bytes.length, path]
  );
}
export async function docDownloadUrl(linkId: string, docId: string): Promise<string | null> {
  const d = await one<any>(`SELECT storage_path FROM ca_documents WHERE document_id = $1 AND link_id = $2`, [docId, linkId]);
  if (!d) return null;
  return signedUrl(d.storage_path);
}
