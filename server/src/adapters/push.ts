import jwt from 'jsonwebtoken';
import { config } from '../config';

// Push adapter — Firebase Cloud Messaging HTTP v1.
//
// Token capture (web/native → /user/push-token) and the cron hook are fully
// wired. Delivery activates the moment you set FIREBASE_SERVICE_ACCOUNT to your
// Firebase service-account JSON (a single env var). We mint the OAuth token
// ourselves with `jsonwebtoken` (RS256) — no firebase-admin dependency needed.
// In dev (no service account) it logs to the server console (Railway logs).

let cached: { token: string; exp: number } | null = null;

async function accessToken(sa: any): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp - 60 > now) return cached.token;
  try {
    const assertion = jwt.sign(
      { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
      sa.private_key,
      { algorithm: 'RS256' }
    );
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${assertion}`,
    });
    if (!res.ok) { console.warn('[push] token mint failed', res.status); return null; }
    const data: any = await res.json();
    cached = { token: data.access_token, exp: now + (data.expires_in || 3600) };
    return data.access_token;
  } catch (e) {
    console.warn('[push] token error', e);
    return null;
  }
}

export async function sendPush(tokens: string[], title: string, body: string): Promise<number> {
  if (tokens.length === 0) return 0;
  if (!config.firebaseServiceAccount) {
    console.log(`[push:dev] → ${tokens.length} device(s): ${title} — ${body}`);
    return tokens.length;
  }
  let sa: any;
  try { sa = JSON.parse(config.firebaseServiceAccount); } catch { console.warn('[push] FIREBASE_SERVICE_ACCOUNT is not valid JSON'); return 0; }
  const token = await accessToken(sa);
  if (!token) return 0;

  let sent = 0;
  for (const t of tokens) {
    try {
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { token: t, notification: { title, body } } }),
      });
      if (r.ok) sent++;
    } catch { /* skip dead tokens */ }
  }
  return sent;
}
