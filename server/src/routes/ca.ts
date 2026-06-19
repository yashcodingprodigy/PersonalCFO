// CA (Chartered Accountant) portal — Phase 1: authentication.
// CAs sign up with self-declared details and log in via mobile OTP (same OTP
// pipeline as users). Tokens are tagged role:'ca' so they can't touch user
// routes (and vice-versa). The connection handshake, client dashboard,
// messaging and document sharing build on top of this in later phases.

import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { query, one } from '../db';
import { config } from '../config';
import { verifyOtp } from './auth';
import { requireCa, AuthedRequest } from '../middleware/auth';

export const caRouter = Router();

const mobileSchema = z.object({ mobile: z.string().regex(/^\+91[6-9]\d{9}$/, 'Use +91 followed by a 10-digit Indian mobile number') });

// Short, human-shareable connect code (e.g. "CA-7F3A9K").
function makeConnectCode(prefix: string): string {
  const raw = crypto.randomBytes(6).toString('base64').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6);
  return `${prefix}-${raw.padEnd(6, 'X')}`;
}
async function uniqueCaCode(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const code = makeConnectCode('CA');
    const exists = await one(`SELECT 1 FROM cas WHERE connect_code = $1`, [code]);
    if (!exists) return code;
  }
  return makeConnectCode('CA') + crypto.randomBytes(1).toString('hex').toUpperCase();
}

function caTokens(caId: string) {
  const accessToken = jwt.sign({ sub: caId, role: 'ca' }, config.jwtSecret, { expiresIn: config.accessTokenTtl } as jwt.SignOptions);
  const refreshToken = jwt.sign({ sub: caId, role: 'ca-refresh' }, config.jwtSecret, { expiresIn: `${config.refreshTokenTtlDays}d` } as jwt.SignOptions);
  return { accessToken, refreshToken };
}

// POST /ca/auth/register — first-time CA signup (after OTP). Self-declared.
caRouter.post('/auth/register', async (req, res) => {
  const schema = mobileSchema.extend({
    otp: z.string().length(6),
    name: z.string().min(2).max(120),
    email: z.string().email().max(160).optional(),
    firm_name: z.string().max(160).optional(),
    icai_number: z.string().max(40).optional(),
    city: z.string().max(100).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const d = parsed.data;

  const existing = await one(`SELECT ca_id FROM cas WHERE mobile = $1 AND deleted_at IS NULL`, [d.mobile]);
  if (existing) return res.status(409).json({ error: 'exists', message: 'A CA account already exists for this mobile. Please log in instead.' });

  if (!(await verifyOtp(d.mobile, d.otp))) return res.status(400).json({ error: 'wrong_otp', message: 'Incorrect or expired OTP. Request a new one.' });

  const code = await uniqueCaCode();
  const ca = await one(
    `INSERT INTO cas (mobile, name, email, firm_name, icai_number, city, connect_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ca_id, name, connect_code`,
    [d.mobile, d.name, d.email || null, d.firm_name || null, d.icai_number || null, d.city || null, code]
  );
  const { accessToken, refreshToken } = caTokens(ca!.ca_id);
  res.json({ access_token: accessToken, refresh_token: refreshToken, ca: { ca_id: ca!.ca_id, name: ca!.name, connect_code: ca!.connect_code } });
});

// POST /ca/auth/login — existing CA logs in with OTP.
caRouter.post('/auth/login', async (req, res) => {
  const schema = mobileSchema.extend({ otp: z.string().length(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const { mobile, otp } = parsed.data;

  const ca = await one(`SELECT ca_id, name, connect_code FROM cas WHERE mobile = $1 AND deleted_at IS NULL`, [mobile]);
  if (!ca) return res.status(404).json({ error: 'no_account', message: 'No CA account for this mobile. Please sign up.' });
  if (!(await verifyOtp(mobile, otp))) return res.status(400).json({ error: 'wrong_otp', message: 'Incorrect or expired OTP. Request a new one.' });

  await query(`UPDATE cas SET last_active_at = now() WHERE ca_id = $1`, [ca.ca_id]);
  const { accessToken, refreshToken } = caTokens(ca.ca_id);
  res.json({ access_token: accessToken, refresh_token: refreshToken, ca: { ca_id: ca.ca_id, name: ca.name, connect_code: ca.connect_code } });
});

// POST /ca/auth/token/refresh — stateless refresh (MVP; rotation TODO).
caRouter.post('/auth/token/refresh', (req, res) => {
  const token = req.body?.refresh_token;
  if (!token) return res.status(400).json({ error: 'missing_token' });
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string; role?: string };
    if (payload.role !== 'ca-refresh') return res.status(401).json({ error: 'invalid_refresh' });
    const { accessToken, refreshToken } = caTokens(payload.sub);
    res.json({ access_token: accessToken, refresh_token: refreshToken });
  } catch {
    return res.status(401).json({ error: 'invalid_refresh', message: 'Session expired. Please log in again.' });
  }
});

// GET /ca/me — current CA profile + a quick client count.
caRouter.get('/me', requireCa, async (req: AuthedRequest, res) => {
  const ca = await one(
    `SELECT ca_id, mobile, name, email, firm_name, icai_number, city, connect_code, verified FROM cas WHERE ca_id = $1 AND deleted_at IS NULL`,
    [req.caId]
  );
  if (!ca) return res.status(404).json({ error: 'not_found' });
  const counts = await one(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'active')::int  AS active_clients,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_requests
     FROM ca_client_links WHERE ca_id = $1`,
    [req.caId]
  );
  res.json({ ...ca, ...counts });
});
