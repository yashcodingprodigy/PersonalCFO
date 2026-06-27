import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { recalculateAndStoreScore, loadProfileData } from '../services/profile';
import { remember } from '../services/rag';
import { ensureUserConnectCode, requestLink } from '../services/caLink';
import { getActiveLink, listMessages, sendMessage, markRead, listDocs, addDoc, getDocFile, getChecklist, setChecklistField } from '../services/caShare';
import { getVaultFile } from '../services/vault';
import { publish } from '../services/realtime';
import { ITR_DOCUMENTS } from '../services/itr';

export const userRouter = Router();
userRouter.use(requireAuth);

// GET /user/me
userRouter.get('/me', async (req: AuthedRequest, res) => {
  const user = await one(
    `SELECT user_id, mobile, name, email, city, state, age, employment_type, annual_gross_income, monthly_take_home,
            dependents_count, risk_appetite, plan, plan_status, onboarding_status, created_at
       FROM users WHERE user_id = $1 AND deleted_at IS NULL`,
    [req.userId]
  );
  if (!user) return res.status(404).json({ error: 'not_found' });
  res.json(user);
});

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(160).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(60).optional(),
  age: z.number().int().min(18).max(100).optional(),
  employment_type: z.enum(['salaried', 'self_employed', 'freelancer', 'business', 'student', 'both']).optional(),
  annual_gross_income: z.number().int().min(0).optional(),
  monthly_take_home: z.number().int().min(0).optional(),
  dependents_count: z.number().int().min(0).max(20).optional(),
  risk_appetite: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  onboarding_status: z.record(z.string()).optional(),
});

// PATCH /user/me
userRouter.patch('/me', async (req: AuthedRequest, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const fields = parsed.data;
  const keys = Object.keys(fields) as (keyof typeof fields)[];
  if (keys.length === 0) return res.status(400).json({ error: 'empty_update' });

  const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map((k) => (k === 'onboarding_status' ? JSON.stringify(fields[k]) : fields[k]));
  await query(`UPDATE users SET ${sets}, last_active_at = now() WHERE user_id = $1`, [req.userId, ...values]);

  if (keys.some((k) => ['annual_gross_income', 'monthly_take_home', 'dependents_count', 'age'].includes(k))) {
    await recalculateAndStoreScore(req.userId!, 'manual_update');
  }
  const user = await one(`SELECT user_id, name, email, city, state, age, employment_type, annual_gross_income, monthly_take_home, dependents_count, risk_appetite, plan, onboarding_status FROM users WHERE user_id = $1`, [req.userId]);
  res.json(user);
});

// POST /user/push-token — register a device for push notifications
userRouter.post('/push-token', async (req: AuthedRequest, res) => {
  const schema = z.object({ token: z.string().min(10).max(400), platform: z.string().max(10).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  await query(
    `INSERT INTO device_tokens (user_id, token, platform) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, token) DO NOTHING`,
    [req.userId, parsed.data.token, parsed.data.platform || null]
  );
  res.json({ ok: true });
});

// GET /profile
userRouter.get('/profile', async (req: AuthedRequest, res) => {
  const profile = await one(`SELECT * FROM profiles WHERE user_id = $1`, [req.userId]);
  res.json(profile || {});
});

// PATCH /profile/:section — assets / liabilities / insurance / tax_data
userRouter.patch('/profile/:section', async (req: AuthedRequest, res) => {
  const section = req.params.section;
  if (!['assets', 'liabilities', 'insurance', 'tax_data'].includes(section)) {
    return res.status(400).json({ error: 'invalid_section' });
  }
  if (typeof req.body !== 'object' || req.body === null || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'invalid_body', message: 'Expected a JSON object' });
  }
  await query(
    `UPDATE profiles SET ${section} = ${section} || $2::jsonb, version = version + 1, updated_at = now() WHERE user_id = $1`,
    [req.userId, JSON.stringify(req.body)]
  );
  const result = await recalculateAndStoreScore(req.userId!, 'manual_update');
  await remember(req.userId!, 'profile_update', `Updated ${section}`, `User updated their ${section.replace('_', ' ')} data on ${new Date().toISOString().slice(0, 10)}.`);
  const profile = await one(`SELECT * FROM profiles WHERE user_id = $1`, [req.userId]);
  res.json({ profile, score: result?.score ?? null });
});

// GET /profile/full — combined view used by dashboard
userRouter.get('/profile/full', async (req: AuthedRequest, res) => {
  const p = await loadProfileData(req.userId!);
  if (!p) return res.status(404).json({ error: 'not_found' });
  res.json(p);
});

// ── CA connection (user side) ───────────────────────────────────────
// GET /user/ca — my connect code + my CA links (pending + connected).
userRouter.get('/ca', async (req: AuthedRequest, res) => {
  const connect_code = await ensureUserConnectCode(req.userId!);
  const links = await query(
    `SELECT l.link_id, l.status, l.initiated_by, l.created_at,
            c.name AS ca_name, c.firm_name, c.city, c.icai_number
       FROM ca_client_links l JOIN cas c ON c.ca_id = l.ca_id
      WHERE l.user_id = $1 AND l.status IN ('pending','active')
      ORDER BY l.created_at DESC`,
    [req.userId]
  );
  res.json({ connect_code, links });
});

// POST /user/ca/connect { code } — request to connect to a CA by their code.
userRouter.post('/ca/connect', rateLimit({ windowMs: 60_000, max: 12, keyPrefix: 'userconnect' }), async (req: AuthedRequest, res) => {
  const parsed = z.object({ code: z.string().min(3).max(16) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: 'Enter a valid CA code.' });
  const ca = await one<{ ca_id: string }>(`SELECT ca_id FROM cas WHERE upper(connect_code) = upper($1) AND deleted_at IS NULL`, [parsed.data.code.trim()]);
  if (!ca) return res.status(404).json({ error: 'not_found', message: 'No CA found with that code. Double-check it with your CA.' });
  const result = await requestLink(ca.ca_id, req.userId!, 'user');
  publish(ca.ca_id);
  res.json(result);
});

// POST /user/ca/links/:id/approve — approve a CA-initiated request.
userRouter.post('/ca/links/:id/approve', async (req: AuthedRequest, res) => {
  const link = await one<any>(`SELECT * FROM ca_client_links WHERE link_id = $1 AND user_id = $2`, [req.params.id, req.userId]);
  if (!link) return res.status(404).json({ error: 'not_found' });
  if (link.status !== 'pending' || link.initiated_by !== 'ca') return res.status(400).json({ error: 'cannot_approve', message: 'Nothing to approve here.' });
  await query(`UPDATE ca_client_links SET status = 'active', updated_at = now() WHERE link_id = $1`, [link.link_id]);
  publish(link.ca_id);
  res.json({ ok: true });
});

// POST /user/ca/links/:id/reject  ·  DELETE /user/ca/links/:id (revoke)
async function removeUserLink(req: AuthedRequest, res: any) {
  const r = await query(`DELETE FROM ca_client_links WHERE link_id = $1 AND user_id = $2 RETURNING link_id`, [req.params.id, req.userId]);
  if (!r.length) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
}
userRouter.post('/ca/links/:id/reject', removeUserLink);
userRouter.delete('/ca/links/:id', removeUserLink);

// ── Messaging + documents with a connected CA (user side) ───────────
userRouter.get('/ca/links/:id/messages', async (req: AuthedRequest, res) => {
  const link = await getActiveLink(req.params.id, { userId: req.userId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  const messages = await listMessages(link.link_id);
  await markRead(link.link_id, 'user');
  res.json(messages);
});
userRouter.post('/ca/links/:id/messages', async (req: AuthedRequest, res) => {
  const parsed = z.object({ body: z.string().min(1).max(2000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const link = await getActiveLink(req.params.id, { userId: req.userId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  const msg = await sendMessage(link.link_id, 'user', parsed.data.body);
  publish(link.ca_id);
  res.json(msg);
});
userRouter.get('/ca/links/:id/documents', async (req: AuthedRequest, res) => {
  const link = await getActiveLink(req.params.id, { userId: req.userId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  res.json(await listDocs(link.link_id));
});
userRouter.post('/ca/links/:id/documents', async (req: AuthedRequest, res) => {
  const parsed = z.object({ file_name: z.string().min(1).max(200), mime_type: z.string().max(100).optional(), data: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: 'Missing file.' });
  const link = await getActiveLink(req.params.id, { userId: req.userId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  try { const d = await addDoc(link.link_id, 'user', { name: parsed.data.file_name, mimeType: parsed.data.mime_type, dataBase64: parsed.data.data }); publish(link.ca_id); res.json(d); }
  catch (e: any) { res.status(e.code === 'not_configured' ? 503 : 400).json({ error: e.code || 'upload_failed', message: e.message }); }
});
userRouter.get('/ca/links/:id/checklist', async (req: AuthedRequest, res) => {
  const link = await getActiveLink(req.params.id, { userId: req.userId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  res.json({ documents: ITR_DOCUMENTS, state: await getChecklist(link.link_id) });
});
userRouter.patch('/ca/links/:id/checklist', async (req: AuthedRequest, res) => {
  const parsed = z.object({ key: z.string().min(1).max(40), sent: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const link = await getActiveLink(req.params.id, { userId: req.userId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  const state = await setChecklistField(link.link_id, parsed.data.key, 'sent', parsed.data.sent);
  publish(link.ca_id);
  res.json({ state });
});

// POST /ca/links/:id/documents/from-vault { vault_id } — share a vault file to the CA.
userRouter.post('/ca/links/:id/documents/from-vault', async (req: AuthedRequest, res) => {
  const parsed = z.object({ vault_id: z.string().uuid(), checklist_key: z.string().max(40).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const link = await getActiveLink(req.params.id, { userId: req.userId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  const f = await getVaultFile(req.userId!, parsed.data.vault_id);
  if (!f) return res.status(404).json({ error: 'no_file', message: 'That vault item has no file attached.' });
  try {
    const d = await addDoc(link.link_id, 'user', { name: f.fileName, mimeType: f.mimeType, dataBase64: f.buffer.toString('base64') });
    if (parsed.data.checklist_key) await setChecklistField(link.link_id, parsed.data.checklist_key, 'sent', true);
    publish(link.ca_id);
    res.json(d);
  } catch (e: any) { res.status(e.code === 'not_configured' ? 503 : 400).json({ error: e.code || 'failed', message: e.message }); }
});

userRouter.get('/ca/links/:id/documents/:docId/file', async (req: AuthedRequest, res) => {
  const link = await getActiveLink(req.params.id, { userId: req.userId });
  if (!link) return res.status(404).json({ error: 'not_found' });
  const f = await getDocFile(link.link_id, req.params.docId);
  if (!f) return res.status(404).json({ error: 'not_found' });
  res.setHeader('Content-Type', f.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${f.fileName.replace(/"/g, '')}"`);
  res.send(f.buffer);
});
