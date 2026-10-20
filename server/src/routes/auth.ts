import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { z } from 'zod';
import { query, one } from '../db';
import { config } from '../config';
import { sendOtpSms } from '../adapters/sms';
import { sendEmail } from '../adapters/email';
import { rateLimit } from '../middleware/rateLimit';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { PERSONAS } from '../db/personas.data';
import { upsertPersona } from '../db/personaSeed';

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

// Shared OTP verification (used by both user and CA login). Consumes the OTP
// on success; increments the attempt counter on a wrong code.
export async function verifyOtp(mobile: string, otp: string): Promise<boolean> {
  const row = await one(
    `SELECT * FROM otp_codes WHERE mobile = $1 AND consumed = false AND expires_at > now() ORDER BY created_at DESC LIMIT 1`,
    [mobile]
  );
  if (!row || row.attempts >= 3) return false;
  const ok = await bcrypt.compare(otp, row.code_hash);
  if (!ok) { await query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id]); return false; }
  await query(`UPDATE otp_codes SET consumed = true WHERE id = $1`, [row.id]);
  return true;
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
  await sendOtpSms(mobile, otp);

  // The OTP is never returned to the client. With SMS_PROVIDER=dev it is
  // written to the server logs (visible in Railway logs); with msg91 it is
  // delivered as a real SMS.
  res.json({ sent: true, expires_in_minutes: 10 });
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

// ── Email-OTP login ──────────────────────────────────────────────────────
// Real SMS OTP needs TRAI DLT registration (needs an incorporated company), so
// email is the primary real-user login until then. Codes are sent via the
// email adapter (Resend in production). Only OTP-proven (email_verified)
// emails can log in — an email typed into Settings never grants access.
const emailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(160) });

function otpEmailHtml(code: string) {
  return `<!doctype html><html><body style="margin:0;background:#F7F5F0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:28px;">
    <div style="font-size:20px;font-weight:800;color:#0B2F2A;">Pay<span style="font-style:italic;color:#2FBC9B">Watch</span></div>
    <div style="background:#fff;border-radius:14px;padding:24px;margin-top:16px;">
      <div style="color:#48544F;font-size:14px;">Your login code is</div>
      <div style="font-size:34px;font-weight:800;letter-spacing:8px;color:#1A2421;margin:10px 0;">${code}</div>
      <div style="color:#7C8782;font-size:13px;">It expires in 10 minutes. If you didn't request this, you can ignore this email — your account is safe.</div>
    </div>
    <div style="color:#7C8782;font-size:11px;text-align:center;margin-top:16px;">PayWatch never asks for this code over phone or chat.</div>
  </div></body></html>`;
}

// POST /auth/email/send
authRouter.post('/email/send', rateLimit({ windowMs: 60_000, max: 5, keyPrefix: 'eotp' }), async (req, res) => {
  const parsed = emailSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_email', message: 'Enter a valid email address.' });
  const { email } = parsed.data;

  const locked = await one(
    `SELECT 1 FROM otp_codes WHERE email = $1 AND attempts >= 3 AND created_at > now() - INTERVAL '15 minutes' LIMIT 1`, [email]);
  if (locked) return res.status(429).json({ error: 'locked', message: 'Too many attempts. Try again in 15 minutes.' });
  // Per-inbox throttle so nobody can flood someone else's email.
  const sent = await one<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM otp_codes WHERE email = $1 AND created_at > now() - INTERVAL '1 hour'`, [email]);
  if ((sent?.c ?? 0) >= 5) return res.status(429).json({ error: 'too_many', message: 'Too many codes requested. Try again in an hour.' });

  const otp = config.isDev ? '424242' : crypto.randomInt(100000, 999999).toString();
  const hash = await bcrypt.hash(otp, 8);
  await query(`INSERT INTO otp_codes (email, code_hash, expires_at) VALUES ($1,$2, now() + INTERVAL '10 minutes')`, [email, hash]);
  const ok = await sendEmail(email, `${otp} is your PayWatch login code`, otpEmailHtml(otp));
  if (config.emailProvider !== 'resend') console.log(`[email:dev] OTP for ${email}: ${otp}`);
  if (!ok) return res.status(502).json({ error: 'email_failed', message: 'We couldn’t send the email. Please try again in a minute.' });
  res.json({ sent: true, expires_in_minutes: 10 });
});

// POST /auth/email/verify
authRouter.post('/email/verify', rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'eotpv' }), async (req, res) => {
  const parsed = emailSchema.extend({ otp: z.string().length(6) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: 'Enter the 6-digit code.' });
  const { email, otp } = parsed.data;

  const row = await one(
    `SELECT * FROM otp_codes WHERE email = $1 AND consumed = false AND expires_at > now() ORDER BY created_at DESC LIMIT 1`, [email]);
  if (!row) return res.status(400).json({ error: 'otp_expired', message: 'Code expired or not found. Request a new one.' });
  if (row.attempts >= 3) return res.status(429).json({ error: 'locked', message: 'Too many attempts. Request a new code in 15 minutes.' });
  if (!(await bcrypt.compare(otp, row.code_hash))) {
    await query(`UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1`, [row.id]);
    return res.status(400).json({ error: 'wrong_otp', message: `Incorrect code. ${2 - row.attempts} attempts remaining.` });
  }
  await query(`UPDATE otp_codes SET consumed = true WHERE id = $1`, [row.id]);

  let user = await one(
    `SELECT user_id, name, onboarding_status, plan FROM users WHERE lower(email) = $1 AND email_verified AND deleted_at IS NULL`, [email]);
  let isNew = false;
  if (!user) {
    isNew = true;
    user = await one(
      `INSERT INTO users (email, email_verified) VALUES ($1, true) RETURNING user_id, name, onboarding_status, plan`, [email]);
    await query(`INSERT INTO profiles (user_id) VALUES ($1)`, [user!.user_id]);
    await query(`INSERT INTO audit_log (user_id, event, meta) VALUES ($1, 'user_registered', '{"via":"email"}')`, [user!.user_id]);
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

// POST /auth/demo — one-tap login into the demo persona (fake data only).
// The persona is re-seeded on every demo login, so each visitor starts from a
// clean, fully-onboarded CFO-plan account and nobody's edits leak to the next.
authRouter.post('/demo', rateLimit({ windowMs: 60_000, max: 10, keyPrefix: 'demo' }), async (_req, res) => {
  if (!config.demoLoginEnabled) return res.status(404).json({ error: 'demo_disabled', message: 'Demo login is not available.' });
  const persona = PERSONAS.find((p) => p.mobile === config.demoMobile);
  if (!persona) return res.status(500).json({ error: 'demo_misconfigured', message: 'Demo account is not configured.' });

  // Show the full product in the demo: CFO plan, active.
  const { userId } = await upsertPersona({ ...persona, plan: 'cfo', plan_status: 'active' });
  await query(`UPDATE users SET last_active_at = now() WHERE user_id = $1`, [userId]);
  await query(`INSERT INTO audit_log (user_id, event) VALUES ($1, 'demo_login')`, [userId]);

  const user = await one(`SELECT user_id, name, onboarding_status, plan FROM users WHERE user_id = $1`, [userId]);
  const { accessToken, refreshToken } = issueTokens(userId);
  await storeRefresh(userId, refreshToken);
  res.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    is_new_user: false,
    is_demo: true,
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
