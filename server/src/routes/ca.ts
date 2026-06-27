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
import { rateLimit } from '../middleware/rateLimit';

// Brute-force protection for OTP-backed auth and code-based connection.
const caAuthLimit = rateLimit({ windowMs: 60_000, max: 6, keyPrefix: 'caauth' });
const caConnectLimit = rateLimit({ windowMs: 60_000, max: 12, keyPrefix: 'caconnect' });
import { requestLink, maskMobile } from '../services/caLink';
import { loadProfileData } from '../services/profile';
import { computeScore, deductionUsage } from '../services/score';
import { computeNetWorth } from '../services/networth';
import { taxCopilot, compareRegimes, computeHraExemption } from '../services/tax';
import { analyseInsurance } from '../services/insurance';
import { getActiveLink, listMessages, sendMessage, markRead, listDocs, addDoc, getDocFile, getChecklist, setChecklistField } from '../services/caShare';
import { publish } from '../services/realtime';
import { ITR_DOCUMENTS, CA_FILING_STEPS } from '../services/itr';
import { listRecords, getRecordFile } from '../services/monthlyRecords';

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
caRouter.post('/auth/register', caAuthLimit, async (req, res) => {
  const schema = mobileSchema.extend({
    otp: z.string().length(6),
    // Required for a genuine individual CA.
    name: z.string().min(2).max(120),
    icai_number: z.string().min(3).max(40),
    email: z.string().email().max(160),
    city: z.string().min(1).max(100),
    // Optional practice details.
    firm_name: z.string().max(160).optional(),
    frn: z.string().max(40).optional(),
    cop_number: z.string().max(40).optional(),
    office_address: z.string().max(300).optional(),
    website: z.string().max(200).optional(),
    gstin: z.string().max(20).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const d = parsed.data;

  const existing = await one(`SELECT ca_id FROM cas WHERE mobile = $1 AND deleted_at IS NULL`, [d.mobile]);
  if (existing) return res.status(409).json({ error: 'exists', message: 'A CA account already exists for this mobile. Please log in instead.' });

  if (!(await verifyOtp(d.mobile, d.otp))) return res.status(400).json({ error: 'wrong_otp', message: 'Incorrect or expired OTP. Request a new one.' });

  const code = await uniqueCaCode();
  const ca = await one(
    `INSERT INTO cas (mobile, name, icai_number, email, city, firm_name, frn, cop_number, office_address, website, gstin, connect_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ca_id, name, connect_code`,
    [d.mobile, d.name, d.icai_number, d.email, d.city, d.firm_name || null, d.frn || null, d.cop_number || null, d.office_address || null, d.website || null, d.gstin || null, code]
  );
  const { accessToken, refreshToken } = caTokens(ca!.ca_id);
  res.json({ access_token: accessToken, refresh_token: refreshToken, ca: { ca_id: ca!.ca_id, name: ca!.name, connect_code: ca!.connect_code } });
});

// POST /ca/auth/login — existing CA logs in with OTP.
caRouter.post('/auth/login', caAuthLimit, async (req, res) => {
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
caRouter.post('/auth/token/refresh', caAuthLimit, (req, res) => {
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

// ── Clients (CA side) ───────────────────────────────────────────────
// GET /ca/clients — connected + pending clients.
caRouter.get('/clients', requireCa, async (req: AuthedRequest, res) => {
  const rows = await query<any>(
    `SELECT l.link_id, l.status, l.initiated_by, l.created_at,
            u.user_id, u.name AS user_name, u.mobile, u.city
       FROM ca_client_links l JOIN users u ON u.user_id = l.user_id
      WHERE l.ca_id = $1 AND l.status IN ('pending','active') AND u.deleted_at IS NULL
      ORDER BY l.status DESC, l.created_at DESC`,
    [req.caId]
  );
  res.json(rows.map((r) => ({ ...r, mobile: maskMobile(r.mobile), name: r.user_name })));
});

// POST /ca/clients/connect { code } — request a client by their connect code.
caRouter.post('/clients/connect', caConnectLimit, requireCa, async (req: AuthedRequest, res) => {
  const parsed = z.object({ code: z.string().min(3).max(16) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: 'Enter a valid client code.' });
  const u = await one<{ user_id: string }>(`SELECT user_id FROM users WHERE upper(connect_code) = upper($1) AND deleted_at IS NULL`, [parsed.data.code.trim()]);
  if (!u) return res.status(404).json({ error: 'not_found', message: 'No client found with that code. Ask them for the code shown in their app.' });
  const result = await requestLink(req.caId!, u.user_id, 'ca');
  publish(u.user_id);
  res.json(result);
});

// POST /ca/clients/:id/approve — approve a user-initiated request.
caRouter.post('/clients/:id/approve', requireCa, async (req: AuthedRequest, res) => {
  const link = await one<any>(`SELECT * FROM ca_client_links WHERE link_id = $1 AND ca_id = $2`, [req.params.id, req.caId]);
  if (!link) return res.status(404).json({ error: 'not_found' });
  if (link.status !== 'pending' || link.initiated_by !== 'user') return res.status(400).json({ error: 'cannot_approve', message: 'Nothing to approve here.' });
  await query(`UPDATE ca_client_links SET status = 'active', updated_at = now() WHERE link_id = $1`, [link.link_id]);
  publish(link.user_id);
  res.json({ ok: true });
});

// POST /ca/clients/:id/reject · DELETE /ca/clients/:id (disconnect)
async function removeCaLink(req: AuthedRequest, res: any) {
  const r = await query(`DELETE FROM ca_client_links WHERE link_id = $1 AND ca_id = $2 RETURNING link_id`, [req.params.id, req.caId]);
  if (!r.length) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
}
caRouter.post('/clients/:id/reject', requireCa, removeCaLink);
caRouter.delete('/clients/:id', requireCa, removeCaLink);

// Resolve an ACTIVE link's user for the logged-in CA, or null.
async function activeLink(caId: string, linkId: string) {
  return one<any>(`SELECT * FROM ca_client_links WHERE link_id = $1 AND ca_id = $2`, [linkId, caId]);
}

// GET /ca/clients/:id/overview — read-only view of a connected client.
caRouter.get('/clients/:id/overview', requireCa, async (req: AuthedRequest, res) => {
  const link = await activeLink(req.caId!, req.params.id);
  if (!link) return res.status(404).json({ error: 'not_found' });
  if (link.status !== 'active') return res.status(403).json({ error: 'not_connected', message: 'This client hasn’t approved the connection yet.' });
  const user = await one<any>(
    `SELECT name, mobile, city, state, email, age, employment_type, dependents_count, risk_appetite,
            annual_gross_income, monthly_take_home FROM users WHERE user_id = $1 AND deleted_at IS NULL`,
    [link.user_id]
  );
  const p = await loadProfileData(link.user_id);
  if (!p) return res.status(404).json({ error: 'no_profile' });
  const score = computeScore(p);
  const nw = computeNetWorth(p);
  const copilot = taxCopilot(p);
  const cmp = compareRegimes(p);
  const ded = deductionUsage(p);
  const ins = analyseInsurance(p);
  res.json({
    link_id: link.link_id,
    client: {
      name: user?.name || 'Client', mobile: maskMobile(user?.mobile || ''), email: user?.email || '',
      city: user?.city || '', state: user?.state || '', age: user?.age ?? null,
      employment_type: user?.employment_type || '', dependents: user?.dependents_count ?? 0,
      risk_appetite: user?.risk_appetite || '',
    },
    income: { annualGross: Number(user?.annual_gross_income) || 0, monthlyTakeHome: Number(user?.monthly_take_home) || 0, monthlyExpenses: p.monthlyExpenses ?? null },
    score: score.score,
    netWorth: nw.netWorth, totalAssets: nw.totalAssets, totalLiabilities: nw.totalLiabilities,
    assets: nw.assets, liabilities: nw.liabilities, allocation: nw.allocation,
    regimes: {
      recommended: cmp.recommended, savings: cmp.savings, reasoning: cmp.reasoning,
      old: { taxableIncome: cmp.oldRegime.taxableIncome, totalDeductions: cmp.oldRegime.totalDeductions, tax: cmp.oldRegime.tax },
      new: { taxableIncome: cmp.newRegime.taxableIncome, totalDeductions: cmp.newRegime.totalDeductions, tax: cmp.newRegime.tax },
    },
    deductions: ded.items,
    hraExemption: computeHraExemption(p),
    insurance: { term: ins.term, health: ins.health },
    taxPack: copilot.readyPack,
    monthlyRecords: await listRecords(link.user_id),
  });
});

// GET /ca/clients/:id/records/:rid/file — download a client's monthly-record file.
caRouter.get('/clients/:id/records/:rid/file', requireCa, async (req: AuthedRequest, res) => {
  const link = await getActiveLink(req.params.id, { caId: req.caId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  const f = await getRecordFile(link.user_id, req.params.rid);
  if (!f) return res.status(404).json({ error: 'not_found' });
  res.setHeader('Content-Type', f.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${f.fileName.replace(/"/g, '')}"`);
  res.send(f.buffer);
});

// ── Messaging (CA side) ─────────────────────────────────────────────
caRouter.get('/clients/:id/messages', requireCa, async (req: AuthedRequest, res) => {
  const link = await getActiveLink(req.params.id, { caId: req.caId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  const messages = await listMessages(link.link_id);
  await markRead(link.link_id, 'ca');
  res.json(messages);
});
caRouter.post('/clients/:id/messages', requireCa, async (req: AuthedRequest, res) => {
  const parsed = z.object({ body: z.string().min(1).max(2000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const link = await getActiveLink(req.params.id, { caId: req.caId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  const msg = await sendMessage(link.link_id, 'ca', parsed.data.body);
  publish(link.user_id); // notify the client instantly
  res.json(msg);
});

// ── Documents (CA side) ─────────────────────────────────────────────
caRouter.get('/clients/:id/documents', requireCa, async (req: AuthedRequest, res) => {
  const link = await getActiveLink(req.params.id, { caId: req.caId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  res.json(await listDocs(link.link_id));
});
caRouter.post('/clients/:id/documents', requireCa, async (req: AuthedRequest, res) => {
  const parsed = z.object({ file_name: z.string().min(1).max(200), mime_type: z.string().max(100).optional(), data: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: 'Missing file.' });
  const link = await getActiveLink(req.params.id, { caId: req.caId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  try { const d = await addDoc(link.link_id, 'ca', { name: parsed.data.file_name, mimeType: parsed.data.mime_type, dataBase64: parsed.data.data }); publish(link.user_id); res.json(d); }
  catch (e: any) { res.status(e.code === 'not_configured' ? 503 : 400).json({ error: e.code || 'upload_failed', message: e.message }); }
});
// ── ITR checklist (CA side) ─────────────────────────────────────────
caRouter.get('/clients/:id/checklist', requireCa, async (req: AuthedRequest, res) => {
  const link = await getActiveLink(req.params.id, { caId: req.caId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  res.json({ documents: ITR_DOCUMENTS, filingSteps: CA_FILING_STEPS, state: await getChecklist(link.link_id) });
});
caRouter.patch('/clients/:id/checklist', requireCa, async (req: AuthedRequest, res) => {
  const parsed = z.object({ key: z.string().min(1).max(40), received: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const link = await getActiveLink(req.params.id, { caId: req.caId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  const state = await setChecklistField(link.link_id, parsed.data.key, 'received', parsed.data.received);
  publish(link.user_id);
  res.json({ state });
});

caRouter.get('/clients/:id/documents/:docId/file', requireCa, async (req: AuthedRequest, res) => {
  const link = await getActiveLink(req.params.id, { caId: req.caId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  const f = await getDocFile(link.link_id, req.params.docId);
  if (!f) return res.status(404).json({ error: 'not_found' });
  res.setHeader('Content-Type', f.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${f.fileName.replace(/"/g, '')}"`);
  res.send(f.buffer);
});
