// Account Aggregator routes — consent flow + data refresh (SRS §16).
import { Router } from 'express';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { initiateConsent, fetchConsentedData, categorise } from '../adapters/aa';
import { recalculateAndStoreScore } from '../services/profile';

export const aaRouter = Router();
aaRouter.use(requireAuth);

// POST /aa/initiate
aaRouter.post('/initiate', async (req: AuthedRequest, res) => {
  const user = await one(`SELECT mobile FROM users WHERE user_id = $1`, [req.userId]);
  const session = await initiateConsent(req.userId!, user!.mobile);
  await query(`UPDATE users SET aa_consent_handle = $2 WHERE user_id = $1`, [req.userId, session.consentHandle]);
  await query(
    `INSERT INTO consents (user_id, consent_type, granted, meta) VALUES ($1, 'aa_data_fetch', true, $2)`,
    [req.userId, JSON.stringify({ handle: session.consentHandle, scope: 'VIEW: transactions, balance, holdings', duration_months: 12 })]
  );
  res.json({
    consent_handle: session.consentHandle,
    redirect_url: session.redirectUrl,
    status: session.status,
    note: 'Consent is granular, time-bound (12 months) and revocable at any time. Data flows via the RBI-regulated AA framework — we never see or store your bank credentials.',
  });
});

// POST /aa/refresh — fetch consented data, import transactions
aaRouter.post('/refresh', async (req: AuthedRequest, res) => {
  const consent = await one(
    `SELECT * FROM consents WHERE user_id = $1 AND consent_type = 'aa_data_fetch' AND granted = true ORDER BY created_at DESC LIMIT 1`,
    [req.userId]
  );
  if (!consent) return res.status(400).json({ error: 'no_consent', message: 'Connect your accounts first — consent is required before any data fetch.' });

  const user = await one(`SELECT monthly_take_home FROM users WHERE user_id = $1`, [req.userId]);
  const data = await fetchConsentedData(consent.meta?.handle || 'mock', Number(user?.monthly_take_home) || 0);

  // Replace previously AA-imported transactions to avoid duplicates
  await query(`DELETE FROM transactions WHERE user_id = $1 AND source = 'aa'`, [req.userId]);
  for (const t of data.transactions) {
    await query(
      `INSERT INTO transactions (user_id, txn_date, description, amount, direction, category, source) VALUES ($1,$2,$3,$4,$5,$6,'aa')`,
      [req.userId, t.date, t.description, t.amount, t.direction, categorise(t.description)]
    );
  }
  // Update savings balance from account data
  if (data.accounts.length > 0) {
    const totalBalance = data.accounts.reduce((s, a) => s + a.balance, 0);
    await query(
      `UPDATE profiles SET assets = assets || jsonb_build_object('savings_balance', $2::bigint), version = version + 1, updated_at = now() WHERE user_id = $1`,
      [req.userId, totalBalance]
    );
  }
  const result = await recalculateAndStoreScore(req.userId!, 'aa_refresh');
  res.json({ accounts: data.accounts, transactions_imported: data.transactions.length, score: result?.score ?? null });
});

// GET /aa/status
aaRouter.get('/status', async (req: AuthedRequest, res) => {
  const consent = await one(
    `SELECT granted, created_at, meta FROM consents WHERE user_id = $1 AND consent_type = 'aa_data_fetch' ORDER BY created_at DESC LIMIT 1`,
    [req.userId]
  );
  const txns = await one(`SELECT COUNT(*)::int AS c FROM transactions WHERE user_id = $1 AND source = 'aa'`, [req.userId]);
  res.json({ linked: !!consent?.granted, consent, aa_transactions: txns!.c });
});

// DELETE /aa/consent — revoke: data deleted within 24h (here: immediately)
aaRouter.delete('/consent', async (req: AuthedRequest, res) => {
  await query(`INSERT INTO consents (user_id, consent_type, granted) VALUES ($1, 'aa_data_fetch', false)`, [req.userId]);
  await query(`DELETE FROM transactions WHERE user_id = $1 AND source = 'aa'`, [req.userId]);
  await query(`INSERT INTO audit_log (user_id, event) VALUES ($1, 'aa_consent_revoked')`, [req.userId]);
  res.json({ ok: true, message: 'Consent revoked and all AA-sourced data deleted.' });
});
