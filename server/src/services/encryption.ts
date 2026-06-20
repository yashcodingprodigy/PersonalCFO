// Application-layer encryption at rest (AES-256-GCM) for sensitive CA-portal
// data: message bodies and document files are encrypted before they're stored
// in Postgres / Supabase Storage. The key is server-held (`ENCRYPTION_KEY`),
// so this protects against a DB/storage breach — it is NOT end-to-end (the
// server can decrypt to show the CA a client's docs). If no key is set, data
// is stored as-is (dev), and a version prefix marks which rows are encrypted.
import crypto from 'crypto';
import { config } from '../config';

function key(): Buffer | null {
  if (!config.encryptionKey) return null;
  // Accept a 64-char hex or base64 key; otherwise derive 32 bytes via SHA-256.
  let k: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(config.encryptionKey)) k = Buffer.from(config.encryptionKey, 'hex');
  else k = crypto.createHash('sha256').update(config.encryptionKey).digest();
  return k;
}

export const encryptionEnabled = () => !!key();

// Binary: returns [magic 'EPW1'][iv 12][tag 16][ciphertext]; passthrough if no key.
export function encryptBuf(plain: Buffer): Buffer {
  const k = key();
  if (!k) return plain;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', k, iv);
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([Buffer.from('EPW1'), iv, c.getAuthTag(), ct]);
}
export function decryptBuf(data: Buffer): Buffer {
  if (data.length < 32 || data.subarray(0, 4).toString('latin1') !== 'EPW1') return data; // not encrypted
  const k = key();
  if (!k) throw new Error('Data is encrypted but ENCRYPTION_KEY is not set.');
  const iv = data.subarray(4, 16), tag = data.subarray(16, 32), ct = data.subarray(32);
  const d = crypto.createDecipheriv('aes-256-gcm', k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]);
}

// Text: stored as "enc:v1:<base64>" when a key is set; plaintext otherwise.
export function encryptText(s: string): string {
  if (!key()) return s;
  return 'enc:v1:' + encryptBuf(Buffer.from(s, 'utf8')).toString('base64');
}
export function decryptText(s: string): string {
  if (typeof s !== 'string' || !s.startsWith('enc:v1:')) return s;
  return decryptBuf(Buffer.from(s.slice(7), 'base64')).toString('utf8');
}
