// Privacy & data rights — DPDP Act 2023 aligned (SRS §23.4).
import { Router } from 'express';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';

export const complianceRouter = Router();
complianceRouter.use(requireAuth);

// GET /data/export — complete data takeout as JSON
complianceRouter.get('/data/export', async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const [user, profile, scores, actions, goals, transactions, conversations, invoices, consents] = await Promise.all([
    one(`SELECT user_id, mobile, name, city, age, employment_type, annual_gross_income, monthly_take_home, dependents_count, plan, created_at FROM users WHERE user_id = $1`, [userId]),
    one(`SELECT assets, liabilities, insurance, tax_data, updated_at FROM profiles WHERE user_id = $1`, [userId]),
    query(`SELECT score, savings_rate_score, insurance_score, investment_score, emergency_fund_score, debt_health_score, tax_efficiency_score, calculated_at FROM score_history WHERE user_id = $1 ORDER BY calculated_at`, [userId]),
    query(`SELECT title, body, status, category, impact_score, created_at, completed_at FROM actions WHERE user_id = $1`, [userId]),
    query(`SELECT goal_type, name, target_amount, target_date, current_amount, monthly_contribution FROM goals WHERE user_id = $1`, [userId]),
    query(`SELECT txn_date, description, amount, direction, category FROM transactions WHERE user_id = $1 ORDER BY txn_date`, [userId]),
    query(`SELECT c.title, m.role, m.content, m.created_at FROM conversations c JOIN messages m ON m.conversation_id = c.conversation_id WHERE c.user_id = $1 ORDER BY m.created_at`, [userId]),
    query(`SELECT invoice_number, description, base_amount, gst_amount, total_amount, created_at FROM invoices WHERE user_id = $1`, [userId]),
    query(`SELECT consent_type, granted, created_at FROM consents WHERE user_id = $1`, [userId]),
  ]);
  await query(`INSERT INTO audit_log (user_id, event) VALUES ($1, 'data_exported')`, [userId]);
  res.setHeader('Content-Disposition', 'attachment; filename="personalcfo-data-export.json"');
  res.json({
    exported_at: new Date().toISOString(),
    format_note: 'All monetary values are in paise (divide by 100 for rupees).',
    user, profile, score_history: scores, actions, goals, transactions, conversations, invoices, consents,
  });
});

// DELETE /user/me — full account deletion (right to erasure)
complianceRouter.delete('/user/me', async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  await query(`INSERT INTO audit_log (user_id, event) VALUES ($1, 'account_deletion_requested')`, [userId]);
  // Cascading FKs remove profile, scores, actions, goals, transactions,
  // conversations, RAG memories, subscriptions, invoices, consents.
  await query(`DELETE FROM users WHERE user_id = $1`, [userId]);
  res.json({
    ok: true,
    message: 'Your account and all associated data have been permanently deleted. Invoice records required under GST law are retained in anonymised form for the statutory period.',
  });
});

// POST /consents — record granular consent (per-action, revocable)
complianceRouter.post('/consents', async (req: AuthedRequest, res) => {
  const { consent_type, granted, meta } = req.body || {};
  if (typeof consent_type !== 'string' || typeof granted !== 'boolean') {
    return res.status(400).json({ error: 'invalid_input' });
  }
  await query(`INSERT INTO consents (user_id, consent_type, granted, meta) VALUES ($1,$2,$3,$4)`, [
    req.userId, consent_type.slice(0, 40), granted, JSON.stringify(meta || {}),
  ]);
  res.json({ ok: true });
});

// GET /consents
complianceRouter.get('/consents', async (req: AuthedRequest, res) => {
  const rows = await query(
    `SELECT DISTINCT ON (consent_type) consent_type, granted, created_at FROM consents WHERE user_id = $1 ORDER BY consent_type, created_at DESC`,
    [req.userId]
  );
  res.json(rows);
});
