// Shared logic for the CA <-> user connection handshake.
import crypto from 'crypto';
import { query, one } from '../db';

export function makeConnectCode(prefix: string): string {
  const raw = crypto.randomBytes(6).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
  return `${prefix}-${raw.padEnd(6, 'X')}`;
}

// Every user gets a shareable connect code, generated lazily on first need.
export async function ensureUserConnectCode(userId: string): Promise<string> {
  const u = await one<{ connect_code: string | null }>(`SELECT connect_code FROM users WHERE user_id = $1`, [userId]);
  if (u?.connect_code) return u.connect_code;
  for (let i = 0; i < 6; i++) {
    const code = makeConnectCode('PW');
    const ex = await one(`SELECT 1 FROM users WHERE connect_code = $1`, [code]);
    if (!ex) { await query(`UPDATE users SET connect_code = $2 WHERE user_id = $1`, [userId, code]); return code; }
  }
  const fallback = makeConnectCode('PW') + crypto.randomBytes(1).toString('hex').toUpperCase();
  await query(`UPDATE users SET connect_code = $2 WHERE user_id = $1`, [userId, fallback]);
  return fallback;
}

export interface LinkResult { status: 'active' | 'pending'; linkId: string; message: string }

// Create a pending link, or auto-activate if the other side already requested.
export async function requestLink(caId: string, userId: string, initiatedBy: 'ca' | 'user'): Promise<LinkResult> {
  const existing = await one<any>(`SELECT * FROM ca_client_links WHERE ca_id = $1 AND user_id = $2`, [caId, userId]);
  if (existing) {
    if (existing.status === 'active') return { status: 'active', linkId: existing.link_id, message: 'You are already connected.' };
    if (existing.status === 'pending') {
      if (existing.initiated_by === initiatedBy) return { status: 'pending', linkId: existing.link_id, message: 'Request already sent — waiting for them to approve.' };
      await query(`UPDATE ca_client_links SET status = 'active', updated_at = now() WHERE link_id = $1`, [existing.link_id]);
      return { status: 'active', linkId: existing.link_id, message: 'Connected — they had already sent you a request.' };
    }
    await query(`UPDATE ca_client_links SET status = 'pending', initiated_by = $2, updated_at = now() WHERE link_id = $1`, [existing.link_id, initiatedBy]);
    return { status: 'pending', linkId: existing.link_id, message: 'Request sent — waiting for them to approve.' };
  }
  const row = await one<{ link_id: string }>(
    `INSERT INTO ca_client_links (ca_id, user_id, status, initiated_by) VALUES ($1,$2,'pending',$3) RETURNING link_id`,
    [caId, userId, initiatedBy]
  );
  return { status: 'pending', linkId: row!.link_id, message: 'Request sent — waiting for them to approve.' };
}

export const maskMobile = (m: string) => (m && m.length >= 4 ? `${m.slice(0, 3)}••••${m.slice(-3)}` : m);
