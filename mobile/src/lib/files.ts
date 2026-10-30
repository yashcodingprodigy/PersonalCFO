// Picking files on the phone and sending them to the server. Files are read only after the
// user picks them (system picker — no storage permission needed on Android or iOS).
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { ask, API_URL, getAccessToken, loadTokens } from './api';

export interface Picked { name: string; uri: string; mime: string; size: number; base64: string }
export const MAX_BYTES = 8 * 1024 * 1024;

export const TYPES = {
  pdf: ['application/pdf'],
  sheet: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'],
  any: ['application/pdf', 'image/*', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

/** Opens the system file picker. Returns null if cancelled; throws a friendly error if too large. */
export async function pickFile(types: string[] = TYPES.any): Promise<Picked | null> {
  const r = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  const f = new File(a.uri);
  const size = a.size ?? f.size ?? 0;
  if (size > MAX_BYTES) throw new Error('That file is larger than 8 MB. Please pick a smaller one.');
  const base64 = await f.base64();
  return { name: a.name || 'file', uri: a.uri, mime: a.mimeType || guessMime(a.name), size, base64 };
}
export function guessMime(name = '') {
  const n = name.toLowerCase();
  if (n.endsWith('.pdf')) return 'application/pdf';
  if (n.endsWith('.csv')) return 'text/csv';
  if (n.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (n.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (n.endsWith('.png')) return 'image/png';
  if (/\.jpe?g$/.test(n)) return 'image/jpeg';
  return 'application/octet-stream';
}

/** Server-side parsing for the app (statement → transactions, holdings, PDF → text). */
export const parseOnServer = <T = any>(p: Picked, kind: 'statement' | 'holdings' | 'capital_gains' | 'text', docType?: string) =>
  ask<T>('/files/parse', { name: p.name, base64: p.base64, kind, docType }, 60000);

/** Download a protected file from the API and open the share sheet (view / save / send). */
export async function openProtectedFile(path: string, filename: string) {
  await loadTokens();
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${getAccessToken() || ''}` } });
  if (!res.ok) throw new Error('Could not open this file.');
  const ct = res.headers.get('content-type') || '';
  let bytes: Uint8Array;
  let name = filename;
  if (ct.includes('application/json')) {
    // Some endpoints answer { url } (signed link) or { data: base64, filename }.
    const j: any = await res.json();
    if (j.url) { const r2 = await fetch(j.url); bytes = new Uint8Array(await r2.arrayBuffer()); }
    else if (j.data || j.base64) bytes = Uint8Array.from(String(atobSafe(j.data || j.base64)), (c: string) => c.charCodeAt(0));
    else throw new Error('Could not open this file.');
    if (j.filename || j.name) name = j.filename || j.name;
  } else bytes = new Uint8Array(await res.arrayBuffer());
  const out = new File(Paths.cache, name.replace(/[^\w.\- ]/g, '_') || 'document');
  out.create({ overwrite: true });
  out.write(bytes);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(out.uri, { dialogTitle: name });
}
function atobSafe(b64: string) {
  const g: any = globalThis as any;
  if (typeof g.atob === 'function') return g.atob(b64);
  throw new Error('Decoder unavailable');
}

/** Share text (reports, computations) as a file. */
export async function shareText(filename: string, text: string) {
  const out = new File(Paths.cache, filename);
  out.create({ overwrite: true });
  out.write(text);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(out.uri, { dialogTitle: filename, mimeType: 'text/plain' });
}
