import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { query, one } from '../db';
import { config } from '../config';
import { sendOtpSms } from '../adapters/sms';
import { rateLimit } from '../middleware/rateLimit';
import { requireAuth, AuthedRequest } from '../middleware/auth';

export const authRouter = Router();

const mobileSchema = z.object({
  mobile: z.string().regex(/^\+91[6-9]\d{9}$/, 'Use +91 followed by a 10-digit Indian mobile number'),
});

function issueTokens(userId: string) {
  const accessToken = jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: config.accessTokenTtl } as jwt.SignOptions);
  const refreshToken = crypto.randomBytes(48).toString('hex');
  return { accessToken, refreshToken };
}

async function storeRefresh(userId: string, refreshToken: string) {
  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expires = new Date(Date.now() + config.refreshTokenTtlDays * 24 * 3600 * 1000);
  await query(`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1,$2,$3)`, [userId, hash, expires]);
}

// POST /auth/otp/send — 100 req/min/IP per SRS §23.3 (tighter here: 5/min)
authRouter.post('/otp/send', rateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'otp' }), async (req, res) => {
  const parsed = mobileSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_mobile', message: parsed.error.issues[0].message });
  const { mobile } = parsed.data;

  // Lockout: 3 failed attempts on latest OTP → 15 min lock
  const recent = await one(
    `SELECT * FROM otp_codes WHERE mobile = $1 AND attempts >= 3 AND created_at > now() - INTERVAL '15 minutes' ORDER BY created_at DESC LIMIT 1`,
    [mobile]
  );
  if (recent) return res.status(429).json({ error: 'locked', message: 'Too many attempts. Try again in 15 minutes.' });

  const otp = config.isDev ? '424242' : crypto.randomInt(100000, 999999).toString();
  const hash = await bcrypt.hash(otp, 8);
  await query(`INSERT INTO otp_codes (mobile, code_hash, expires_at) VALUES ($1,$2, now() + INTERVAL '10 minutes')`, [mobile, hash]);
  const sms = await sendOtpSms(mobile, otp);

  res.json({
    sent: sms.delivered,
    expires_in_minutes: 10,
    ...(sms.devOtp ? { dev_otp: sms.devOtp, note: 'dev mode — OTP returned in response; configure SMS_PROVIDER=msg91 for production' } : {}),
  });
});

// POST /auth/otp/verify
authRouter.post('/otp/verify', rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'otpv' }), async (req, res) => {
  const schema = mobileSchema.extend({ otp: z.string().length(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const { mobile, otp } = parsed.data;

  const row = await one(
    `SELECT * FROM otp_codes WHERE mobile = $1 AND consumed = false AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
    [mobile]
  );
  if (!row) return res.status(400).json({ error: 'otp_expired', message: 'OTP expired or not found. Request a new one.' });
  if (row.attempts >= 3) return res.status(429).json({ error: 'locked', message: 'Too many attempts. Request a new OTP in 15 minutes.' });

  const ok = await bcrypt.compare(otp, row.code_hash);
  if (!ok) {
    await query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
    return res.status(400).json({ error: 'wrong_otp', message: `Incorrect OTP. ${2 - row.attempts} attempts remaining.` });
  }
  await query(`UPDATE otp_codes SET consumed = true WHERE id = $1`, [row.id]);

  let user = await one(`SELECT user_id, name, onboarding_status, plan FROM users WHERE mobile = $1 AND deleted_at IS NULL`, [mobile]);
  let isNew = false;
  if (!user) {
    isNew = true;
    user = await one(
      `INSERT INTO users (mobile) VALUES ($1) RETURNING user_id, name, onboarding_status, plan`,
      [mobile]
    );
    await query(`INSERT INTO profiles (user_id) VALUES ($1)`, [user!.user_id]);
    await query(`INSERT INTO audit_log (user_id, event) VALUES ($1, 'user_registered')`, [user!.user_id]);
  }
  await query(`UPDATE users SET last_active_at = now() WHERE user_id = $1`, [user!.user_id]);

  const { accessToken, refreshToken } = issueTokens(user!.user_id);
  await storeRefresh(user!.user_id, refreshToken);
  res.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    is_new_user: isNew,
    user: { user_id: user!.user_id, name: user!.name, onboarding_status: user!.onboarding_status, plan: user!.plan },
  });
});

// POST /auth/token/refresh — rotation: old token invalidated on use
authRouter.post('/token/refresh', async (req, res) => {
  const token = req.body?.refresh_token;
  if (!token) return res.status(400).json({ error: 'missing_token' });
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const row = await one(
    `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked = false AND expires_at > now()`,
    [hash]
  );
  if (!row) return res.status(401).json({ error: 'invalid_refresh', message: 'Session expired. Please log in again.' });
  await query(`UPDATE refresh_tokens SET revoked = true WHERE id = $1`, [row.id]);
  const { accessToken, refreshToken } = issueTokens(row.user_id);
  await storeRefresh(row.user_id, refreshToken);
  res.json({ access_token: accessToken, refresh_token: refreshToken });
});

// DELETE /auth/logout
authRouter.delete('/logout', requireAuth, async (req: AuthedRequest, res) => {
  await query(`UPDATE refresh_tokens SET revoked = true WHERE user_id = $1`, [req.userId]);
  res.json({ ok: true });
});
