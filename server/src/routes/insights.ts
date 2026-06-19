// Net worth, tax, insurance, transactions & spend analytics routes.
import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { query, one, withTransaction } from '../db';

// Content hash of a transaction, used to skip duplicate re-imports.
const txnFingerprint = (userId: string, t: { date: string; description: string; amount: number; direction: string }) =>
  crypto.createHash('sha256').update(`${userId}|${t.date}|${t.amount}|${t.direction}|${t.description.trim().toLowerCase()}`).digest('hex');
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { loadProfileData, recalculateAndStoreScore } from '../services/profile';
import { computeNetWorth, projectMonthsToTarget, growthProjection } from '../services/networth';
import { compareRegimes, taxCalendarEntries, currentFY, taxReductionPlan, taxCopilot, computeHraExemption } from '../services/tax';
import { prepareFiling, FilingInputs } from '../services/taxFiling';
import { analyseInsurance } from '../services/insurance';
import { buildInvestmentGuidance } from '../services/investment';
import { analyzeStatement } from '../services/statement';
import { getMarketData } from '../services/market';
import { deductionUsage } from '../services/score';
import { categorise } from '../adapters/aa';
import { remember } from '../services/rag';

export const insightsRouter = Router();
insightsRouter.use(requireAuth);

// GET /networth
insightsRouter.get('/networth', async (req: AuthedRequest, res) => {
  const p = await loadProfileData(req.userId!);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const nw = computeNetWorth(p);
  const surplus = p.monthlyExpenses != null ? p.user.monthly_take_home - p.monthlyExpenses : 0;
  const monthsTo1Cr = projectMonthsToTarget(nw.netWorth, surplus, 10000000_00);
  res.json({ ...nw, monthly_surplus: surplus, months_to_1cr: monthsTo1Cr, growth: growthProjection(p, nw) });
});

// GET /tax — full tax position
insightsRouter.get('/tax', async (req: AuthedRequest, res) => {
  const p = await loadProfileData(req.userId!);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const comparison = compareRegimes(p);
  const deductions = deductionUsage(p);
  res.json({
    fy: currentFY(),
    comparison,
    deductions,
    reductionPlan: taxReductionPlan(p),
    copilot: taxCopilot(p),
    calendar: taxCalendarEntries(),
    disclaimer: 'Tax calculations are estimates for planning purposes based on FY2025-26 slabs. Verify with your CA or the Income Tax portal before filing.',
  });
});

// GET /insurance — analyser output
insightsRouter.get('/insurance', async (req: AuthedRequest, res) => {
  const p = await loadProfileData(req.userId!);
  if (!p) return res.status(404).json({ error: 'not_found' });
  res.json({
    ...analyseInsurance(p),
    disclaimer: 'Coverage guidance uses standard planning rules (25× income for term cover). We do not recommend specific insurers or policies and earn no commission unless explicitly disclosed.',
  });
});

// GET /market — educational themes + third-party financial news (no advice)
insightsRouter.get('/market', async (_req: AuthedRequest, res) => {
  res.json(await getMarketData());
});

// GET /tax/filing/prefill — best-guess ITR inputs from the user's profile
insightsRouter.get('/tax/filing/prefill', async (req: AuthedRequest, res) => {
  const p = await loadProfileData(req.userId!);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const t = p.tax_data || {};
  const items = deductionUsage(p).items;
  const used = (prefix: string) => items.filter((i) => i.section.startsWith(prefix)).reduce((s, i) => s + i.used, 0);
  const inputs: FilingInputs = {
    grossSalary: p.user.employment_type === 'salaried' ? (p.user.annual_gross_income || 0) : 0,
    interestIncome: 0,
    housePropertyIncome: 0,
    otherIncome: 0,
    businessIncome: p.user.employment_type && p.user.employment_type !== 'salaried' && p.user.employment_type !== 'student' ? (p.user.annual_gross_income || 0) : 0,
    stcgEquity: 0, ltcgEquity: 0, otherCapitalGains: 0,
    ded80C: used('80C'), ded80CCD1B: used('80CCD(1B)'), ded80D: used('80D'),
    ded24b: used('24(b)'), ded80G: Number(t.donations_80g_annual) || 0, ded80TTA: 0,
    ded80E: Number(t.education_loan_interest_annual) || 0, hraExempt: computeHraExemption(p),
    employerNps: Number(t.employer_nps_annual) || 0,
    tdsSalary: 0, tdsOther: 0, advanceTax: 0,
    presumptiveBusiness: false, residentOrdinary: true, foreignAssets: false, isDirector: false, multipleHouseProperties: false,
  };
  res.json({ fy: currentFY(), inputs });
});

// POST /tax/filing/compute — full ITR computation from (edited) inputs
insightsRouter.post('/tax/filing/compute', rateLimit({ windowMs: 60_000, max: 60, keyPrefix: 'filing' }), async (req: AuthedRequest, res) => {
  const num = z.number().int().min(0).max(1_000_000_000_00);
  const schema = z.object({
    grossSalary: num, interestIncome: num, housePropertyIncome: z.number().int(), otherIncome: num, businessIncome: num,
    stcgEquity: num, ltcgEquity: num, otherCapitalGains: num,
    ded80C: num, ded80CCD1B: num, ded80D: num, ded24b: num, ded80G: num, ded80TTA: num, ded80E: num, hraExempt: num,
    employerNps: num, tdsSalary: num, tdsOther: num, advanceTax: num,
    presumptiveBusiness: z.boolean().optional(), residentOrdinary: z.boolean().optional(),
    foreignAssets: z.boolean().optional(), isDirector: z.boolean().optional(), multipleHouseProperties: z.boolean().optional(),
    totalIncomeOver50L: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  res.json(prepareFiling(parsed.data as FilingInputs, currentFY()));
});

// GET /invest — personalised, SEBI-compliant investment guidance
insightsRouter.get('/invest', async (req: AuthedRequest, res) => {
  const p = await loadProfileData(req.userId!);
  if (!p) return res.status(404).json({ error: 'not_found' });
  res.json(buildInvestmentGuidance(p));
});

// POST /invest/started — user records they've acted on a recommendation:
// hide it from the plan and add the monthly amount into their SIP data.
insightsRouter.post('/invest/started', async (req: AuthedRequest, res) => {
  const schema = z.object({ category: z.string().min(1).max(160), monthlyAmount: z.number().int().nonnegative().max(100000000_00).optional(), undo: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const prof = await one(`SELECT assets FROM profiles WHERE user_id = $1`, [req.userId]);
  const assets: any = prof?.assets || {};
  const started: string[] = Array.isArray(assets.invest_started) ? assets.invest_started : [];
  const mf = assets.mutual_funds || {};
  if (parsed.data.undo) {
    assets.invest_started = started.filter((c) => c !== parsed.data.category);
    if (parsed.data.monthlyAmount) mf.monthly_sip = Math.max(0, (Number(mf.monthly_sip) || 0) - parsed.data.monthlyAmount);
  } else {
    if (!started.includes(parsed.data.category)) started.push(parsed.data.category);
    assets.invest_started = started;
    if (parsed.data.monthlyAmount) mf.monthly_sip = (Number(mf.monthly_sip) || 0) + parsed.data.monthlyAmount;
  }
  assets.mutual_funds = mf;
  await query(`UPDATE profiles SET assets = $2::jsonb, version = version + 1, updated_at = now() WHERE user_id = $1`, [req.userId, JSON.stringify(assets)]);
  await recalculateAndStoreScore(req.userId!, 'invest_started');
  res.json({ ok: true });
});

// POST /statements/analyze — analyse client-parsed statement transactions.
// Optionally persist them so the Money Score (which derives expenses from
// transactions) updates too.
insightsRouter.post('/statements/analyze', rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'stmt' }), async (req: AuthedRequest, res) => {
  const txnSchema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().min(1).max(300),
    amount: z.number().int().positive(),
    direction: z.enum(['debit', 'credit']),
  });
  const schema = z.object({
    transactions: z.array(txnSchema).min(1).max(5000),
    persist: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });

  const p = await loadProfileData(req.userId!);
  const report = analyzeStatement(parsed.data.transactions, p);

  let imported = 0;
  let duplicates = 0;
  if (parsed.data.persist) {
    // Atomic import: either every (non-duplicate) row lands, or none do.
    const counts = await withTransaction(async (q) => {
      let ins = 0, dup = 0;
      for (const t of parsed.data.transactions) {
        const fp = txnFingerprint(req.userId!, t);
        // ON CONFLICT DO NOTHING against the partial unique index → re-uploading
        // the same statement silently skips rows already stored.
        const inserted = await q(
          `INSERT INTO transactions (user_id, txn_date, description, amount, direction, category, source, fingerprint)
           VALUES ($1,$2,$3,$4,$5,$6,'statement',$7)
           ON CONFLICT (user_id, fingerprint) WHERE fingerprint IS NOT NULL DO NOTHING
           RETURNING txn_id`,
          [req.userId, t.date, t.description, t.amount, t.direction, categorise(t.description), fp]
        );
        if (inserted.length > 0) ins++; else dup++;
      }
      return { ins, dup };
    });
    imported = counts.ins; duplicates = counts.dup;
    if (imported > 0) {
      await recalculateAndStoreScore(req.userId!, 'statement_import');
      await remember(req.userId!, 'statement_upload', 'Uploaded a bank statement', `User imported ${imported} new transactions from a bank statement on ${new Date().toISOString().slice(0, 10)}.`);
    }
  }

  res.json({ report, imported, duplicates });
});

// GET /transactions
insightsRouter.get('/transactions', async (req: AuthedRequest, res) => {
  const rows = await query(
    `SELECT txn_id, txn_date, description, amount, direction, category, source
       FROM transactions WHERE user_id = $1 ORDER BY txn_date DESC LIMIT 500`,
    [req.userId]
  );
  res.json(rows);
});

// POST /transactions — manual entry or CSV-imported rows
insightsRouter.post('/transactions', rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'txn' }), async (req: AuthedRequest, res) => {
  const rowSchema = z.object({
    txn_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().min(1).max(300),
    amount: z.number().int().positive(),
    direction: z.enum(['debit', 'credit']),
    category: z.string().max(30).optional(),
  });
  const schema = z.object({ transactions: z.array(rowSchema).min(1).max(1000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });

  for (const t of parsed.data.transactions) {
    await query(
      `INSERT INTO transactions (user_id, txn_date, description, amount, direction, category, source)
       VALUES ($1,$2,$3,$4,$5,$6,'manual')`,
      [req.userId, t.txn_date, t.description, t.amount, t.direction, t.category || categorise(t.description)]
    );
  }
  await recalculateAndStoreScore(req.userId!, 'manual_update');
  res.json({ imported: parsed.data.transactions.length });
});

// PATCH /transactions/:id — category correction (feeds personal model)
insightsRouter.patch('/transactions/:id', async (req: AuthedRequest, res) => {
  const schema = z.object({ category: z.string().min(1).max(30) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input' });
  const rows = await query(
    `UPDATE transactions SET category = $3 WHERE txn_id = $1 AND user_id = $2 RETURNING description, category`,
    [req.params.id, req.userId, parsed.data.category]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'not_found' });
  await remember(req.userId!, 'category_correction', `Categorisation: ${rows[0].description}`, `Transactions like "${rows[0].description}" should be categorised as ${parsed.data.category}.`);
  res.json(rows[0]);
});

// GET /spend/summary — monthly category totals, 3 months
insightsRouter.get('/spend/summary', async (req: AuthedRequest, res) => {
  const rows = await query(
    `SELECT to_char(date_trunc('month', txn_date), 'YYYY-MM') AS month, category, SUM(amount)::bigint AS total
       FROM transactions
      WHERE user_id = $1 AND direction = 'debit' AND txn_date >= CURRENT_DATE - INTERVAL '3 months'
      GROUP BY 1, 2 ORDER BY 1 DESC, total DESC`,
    [req.userId]
  );
  const subs = await query(
    `SELECT description, COUNT(DISTINCT date_trunc('month', txn_date))::int AS months, AVG(amount)::bigint AS avg_amount
       FROM transactions
      WHERE user_id = $1 AND direction = 'debit' AND category IN ('entertainment','utilities')
      GROUP BY description HAVING COUNT(DISTINCT date_trunc('month', txn_date)) >= 2`,
    [req.userId]
  );
  res.json({ by_category: rows, recurring: subs });
});
