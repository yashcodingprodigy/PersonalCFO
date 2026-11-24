// CA document requests (D-71, Nov 2026).
// The CA asks for documents in the chat ("Form 16, 26AS, capital gains"); instead of the client hunting for files,
// PayWatch fulfils the request from what it already holds — one tap on the request card, or by asking
// Ask PayWatch ("send my CA what he asked for"). Missing items are listed back so the client knows what to upload.
// Every CA message and request also lands in the client's Alerts (and the SSE stream refreshes the open chat).
import { query, one } from '../db';
import { addDoc, sendMessage, setChecklistField, storageConfigured } from './caShare';
import { gatherFiles, sourceFor, buildItrPack } from './caDocs';
import { publish } from './realtime';

export interface CaRequest {
  request_id: string; link_id: string; items: { key: string; label: string }[]; note: string | null;
  status: 'pending' | 'fulfilled' | 'partial'; result: any; created_at: string; fulfilled_at: string | null;
}
// Checklist keys in itr.ts that map 1:1 to request keys (so the shared checklist ticks itself).
const CHECKLIST_KEY: Record<string, string> = { form16: 'form16', form26as_ais: 'form26as_ais', bank_interest: 'bank_interest', capital_gains: 'capital_gains', deduction_proofs: 'deduction_proofs', home_loan: 'home_loan', rent_hra: 'rent_hra', other_income: 'other_income', pan: 'pan', aadhaar: 'aadhaar' };

/** Upserts one Alerts entry per link per day for CA activity (keeps the inbox tidy; re-marks it unread on new activity). */
export async function notifyUserOfCa(userId: string, linkId: string, kind: 'message' | 'request', detail: string) {
  const day = new Date().toISOString().slice(0, 10);
  const isReq = kind === 'request';
  await query(
    `INSERT INTO notifications (user_id, kind, category, severity, title, body, action_label, action_href, dedupe_key)
     VALUES ($1,$2,'tax',$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id, dedupe_key) DO UPDATE SET status = 'unread', body = EXCLUDED.body, title = EXCLUDED.title, created_at = now()`,
    [userId, isReq ? 'ca_request' : 'ca_message', isReq ? 'warning' : 'info',
      isReq ? 'Your CA asked for documents' : 'New message from your CA',
      isReq ? `${detail} PayWatch can send them for you in one tap.` : detail,
      isReq ? 'Send them' : 'Open chat', `/advisor/thread?id=${linkId}`, `ca_${kind}:${linkId}:${day}`],
  ).catch((e) => console.warn('[caRequests] notify failed', e?.message));
  publish(userId);
}

export async function createRequest(linkId: string, keys: string[], note?: string): Promise<CaRequest> {
  const items = [...new Set(keys)].map((k) => sourceFor(k)).filter(Boolean).map((s) => ({ key: s!.key, label: s!.label }));
  if (!items.length) { const e: any = new Error('Pick at least one document.'); e.code = 'invalid_input'; throw e; }
  const row = await one<CaRequest>(
    `INSERT INTO ca_doc_requests (link_id, items, note) VALUES ($1, $2, $3) RETURNING *`,
    [linkId, JSON.stringify(items), note?.slice(0, 500) || null]);
  await sendMessage(linkId, 'ca', `📄 Requested: ${items.map((i) => i.label).join(', ')}${note ? `\n${note}` : ''}`);
  return row!;
}

export async function listRequests(linkId: string): Promise<CaRequest[]> {
  return query<CaRequest>(`SELECT * FROM ca_doc_requests WHERE link_id = $1 ORDER BY created_at DESC LIMIT 50`, [linkId]);
}

export interface FulfilResult { sent: { key: string; label: string; files: number }[]; missing: string[]; status: 'fulfilled' | 'partial' | 'nothing'; message: string }

/** Sends every requested document PayWatch holds to the CA thread; reports what is missing. */
export async function fulfilRequest(userId: string, linkId: string, requestId: string, userName = ''): Promise<FulfilResult> {
  const req = await one<CaRequest>(`SELECT * FROM ca_doc_requests WHERE request_id = $1 AND link_id = $2`, [requestId, linkId]);
  if (!req) { const e: any = new Error('Request not found.'); e.code = 'not_found'; throw e; }
  if (!storageConfigured()) { const e: any = new Error('Document sharing isn’t set up yet (storage not configured).'); e.code = 'not_configured'; throw e; }
  const sent: FulfilResult['sent'] = [], missing: string[] = [];
  for (const it of req.items) {
    const files = await gatherFiles(userId, it.key, { userName });
    let ok = 0;
    for (const f of files) {
      try { await addDoc(linkId, 'user', { name: f.name, mimeType: f.mimeType, dataBase64: f.buffer.toString('base64') }); ok++; }
      catch (e: any) { console.warn('[caRequests] addDoc failed', it.key, e?.message); }
    }
    if (ok) { sent.push({ key: it.key, label: it.label, files: ok }); if (CHECKLIST_KEY[it.key]) await setChecklistField(linkId, CHECKLIST_KEY[it.key], 'sent', true); }
    else missing.push(it.label);
  }
  const status: FulfilResult['status'] = sent.length && !missing.length ? 'fulfilled' : sent.length ? 'partial' : 'nothing';
  const message = status === 'nothing'
    ? `I couldn't find these in PayWatch yet: ${missing.join(', ')}. I'll upload them shortly.`
    : `✅ Sent via PayWatch: ${sent.map((s) => `${s.label}${s.files > 1 ? ` (${s.files} files)` : ''}`).join(', ')}.${missing.length ? `\nStill to come: ${missing.join(', ')}.` : ''}`;
  await sendMessage(linkId, 'user', message);
  if (status !== 'nothing') await query(`UPDATE ca_doc_requests SET status = $3, result = $4, fulfilled_at = now() WHERE request_id = $1 AND link_id = $2`, [requestId, linkId, status, JSON.stringify({ sent, missing })]);
  const link = await one<any>(`SELECT ca_id FROM ca_client_links WHERE link_id = $1`, [linkId]);
  if (link) publish(link.ca_id);
  return { sent, missing, status, message };
}

/** Fulfils every pending request across the user's active CA links (used by Ask PayWatch). */
export async function fulfilAllPending(userId: string, userName = ''): Promise<{ links: number; sent: string[]; missing: string[]; none: boolean }> {
  const rows = await query<{ request_id: string; link_id: string }>(
    `SELECT r.request_id, r.link_id FROM ca_doc_requests r JOIN ca_client_links l ON l.link_id = r.link_id
      WHERE l.user_id = $1 AND l.status = 'active' AND r.status IN ('pending','partial') ORDER BY r.created_at`, [userId]);
  const sent = new Set<string>(), missing = new Set<string>(), links = new Set<string>();
  for (const r of rows) {
    try {
      const res = await fulfilRequest(userId, r.link_id, r.request_id, userName);
      links.add(r.link_id); res.sent.forEach((s) => sent.add(s.label)); res.missing.forEach((m) => missing.add(m));
    } catch (e: any) { console.warn('[caRequests] fulfilAll failed', e?.message); }
  }
  return { links: links.size, sent: [...sent], missing: [...missing].filter((m) => !sent.has(m)), none: rows.length === 0 };
}

/** Builds the ITR pack and shares it into a CA thread (one tap from the Tax page / File page / Ask PayWatch). */
export async function sendItrPackToCa(userId: string, linkId: string, userName = '') {
  const pack = await buildItrPack(userId, userName);
  if (pack.zip.length > 8 * 1024 * 1024) { const e: any = new Error('Your pack is larger than 8 MB — download it and share it directly.'); e.code = 'too_large'; throw e; }
  const doc = await addDoc(linkId, 'user', { name: pack.fileName, mimeType: 'application/zip', dataBase64: pack.zip.toString('base64') });
  await sendMessage(linkId, 'user', `📦 My ITR document pack for FY ${pack.fy} is attached (${pack.included.length} sections).${pack.missing.length ? `\nNot in PayWatch yet: ${pack.missing.join(', ')}.` : ''}`);
  for (const it of pack.included) if (CHECKLIST_KEY[it.key]) await setChecklistField(linkId, CHECKLIST_KEY[it.key], 'sent', true);
  const link = await one<any>(`SELECT ca_id FROM ca_client_links WHERE link_id = $1`, [linkId]);
  if (link) publish(link.ca_id);
  return { doc, included: pack.included, missing: pack.missing, fy: pack.fy };
}
