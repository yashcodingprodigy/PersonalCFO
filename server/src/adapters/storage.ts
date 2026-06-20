// Supabase Storage adapter for CA <-> client document sharing.
// Files live in a private bucket; we hand out short-lived signed URLs for
// download. Activates when SUPABASE_URL + SUPABASE_SERVICE_KEY are set.
import { config } from '../config';

export const storageConfigured = () => !!(config.supabaseUrl && config.supabaseServiceKey);

// Supabase REST wants the key in BOTH the apikey header and as a Bearer token.
// This works for the new sb_secret_… keys and the legacy service_role JWT.
const authHeaders = () => ({ apikey: config.supabaseServiceKey, Authorization: `Bearer ${config.supabaseServiceKey}` });

export async function uploadObject(path: string, bytes: Buffer, contentType: string): Promise<void> {
  const res = await fetch(`${config.supabaseUrl}/storage/v1/object/${config.supabaseBucket}/${encodeURI(path)}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': contentType, 'x-upsert': 'true' },
    body: bytes as any,
  });
  if (!res.ok) throw new Error(`storage upload failed (${res.status}): ${await res.text()}`);
}

export async function signedUrl(path: string, expiresIn = 300): Promise<string> {
  const res = await fetch(`${config.supabaseUrl}/storage/v1/object/sign/${config.supabaseBucket}/${encodeURI(path)}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn }),
  });
  if (!res.ok) throw new Error(`storage sign failed (${res.status})`);
  const data: any = await res.json();
  return `${config.supabaseUrl}/storage/v1${data.signedURL}`;
}

export async function deleteObject(path: string): Promise<void> {
  await fetch(`${config.supabaseUrl}/storage/v1/object/${config.supabaseBucket}/${encodeURI(path)}`, {
    method: 'DELETE', headers: authHeaders(),
  });
}
