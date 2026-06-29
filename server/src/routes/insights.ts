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
import { compareRegimes, taxCalendarEntries, currentFY, taxReductionPlan, taxCopilot } from '../services/tax';
import { prepareFiling, FilingInputs, assembleFilingInputs, fullFiling } from '../services/taxFiling';
import { analyseInsurance } from '../services/insurance';
import { buildInvestmentGuidance } from '../services/investment';
import { analyzeStatement } from '../services/statement';
import { analyzeHoldings } from '../services/holdings';
import { getMarketData } from '../services/market';
import { deductionUsage } from '../services/score';
import { categorise } from '../adapters/aa';
import { remember } from '../services/rag';
import { aiAvailable, analyzeDocumentGeneric } from '../services/docAI';
import {
  listPolicies, createPolicy, attachPolicyFile, getPolicyFile, deletePolicy,
  INSURANCE_CATEGORIES, INSURANCE_FIELD_GUIDE, INSURANCE_TYPE_OPTIONS, CATEGORY_LABEL,
} from '../services/insurancePolicies';
import { CATALOG, CATEGORY_LABEL as MARKET_CAT_LABEL, verifyNote, PlanCategory } from '../services/insuranceCatalog';
import { rankPlans } from '../services/insuranceMarket';

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

// ── Insurance policies — upload, AI-read, manage, expiry tracking ──────
insightsRouter.get('/insurance/policies', async (req: AuthedRequest, res) => {
  res.json(await listPolicies(req.userId!));
});

// AI read of an insurance policy PDF's text (validates type + extracts fields).
insightsRouter.post('/insurance/ai-extract', rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'insai' }), async (req: AuthedRequest, res) => {
  if (!aiAvailable()) return res.json({ available: false });
  const parsed = z.object({ category: z.string().max(30).optional(), text: z.string().min(1).max(60_000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const label = parsed.data.category && CATEGORY_LABEL[parsed.data.category]
    ? `${CATEGORY_LABEL[parsed.data.category]} policy document` : 'insurance policy document';
  try {
    const result = await analyzeDocumentGeneric(label, INSURANCE_FIELD_GUIDE, INSURANCE_TYPE_OPTIONS, parsed.data.text);
    res.json({ available: true, result });
  } catch (e: any) {
    res.json({ available: false, error: 'ai_failed', message: String(e?.message || e).slice(0, 200) });
  }
});

const policySchema = z.object({
  category: z.enum([...INSURANCE_CATEGORIES] as [string, ...string[]]),
  insurer: z.string().max(160).nullable().optional(),
  plan_name: z.string().max(200).nullable().optional(),
  policy_number: z.string().max(80).nullable().optional(),
  holder_name: z.string().max(160).nullable().optional(),
  nominee: z.string().max(160).nullable().optional(),
  sum_assured: z.number().int().nonnegative().max(100_000_000_00).nullable().optional(),
  premium: z.number().int().nonnegative().max(100_000_000_00).nullable().optional(),
  premium_frequency: z.string().max(12).nullable().optional(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  maturity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  renewal_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  extracted: z.record(z.any()).optional(),
});

insightsRouter.post('/insurance/policies', rateLimit({ windowMs: 60_000, max: 40, keyPrefix: 'inspol' }), async (req: AuthedRequest, res) => {
  const parsed = policySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const row = await createPolicy(req.userId!, parsed.data as any);
  await recalculateAndStoreScore(req.userId!, 'insurance_upload');
  await remember(req.userId!, 'insurance_upload', `Added ${CATEGORY_LABEL[parsed.data.category] || 'insurance'}`,
    `User uploaded a ${CATEGORY_LABEL[parsed.data.category] || parsed.data.category}${parsed.data.insurer ? ' from ' + parsed.data.insurer : ''}${parsed.data.sum_assured ? ', cover ₹' + Math.round(parsed.data.sum_assured / 100).toLocaleString('en-IN') : ''}${parsed.data.expiry_date ? ', renews ' + parsed.data.expiry_date : ''}.`
  ).catch(() => {});
  res.status(201).json(row);
});

insightsRouter.post('/insurance/policies/:id/file', async (req: AuthedRequest, res) => {
  const parsed = z.object({ file_name: z.string().min(1).max(200), mime_type: z.string().max(100).optional(), data: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: 'Missing file.' });
  try {
    const r = await attachPolicyFile(req.userId!, req.params.id, { name: parsed.data.file_name, mimeType: parsed.data.mime_type, dataBase64: parsed.data.data });
    res.json(r);
  } catch (e: any) {
    res.status(e.code === 'not_configured' ? 503 : e.code === 'not_found' ? 404 : 400).json({ error: e.code || 'upload_failed', message: e.message });
  }
});

insightsRouter.get('/insurance/policies/:id/file', async (req: AuthedRequest, res) => {
  const f = await getPolicyFile(req.userId!, req.params.id);
  if (!f) return res.status(404).json({ error: 'not_found' });
  res.setHeader('Content-Type', f.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${f.fileName.replace(/"/g, '')}"`);
  res.send(f.buffer);
});

insightsRouter.delete('/insurance/policies/:id', async (req: AuthedRequest, res) => {
  await deletePolicy(req.userId!, req.params.id);
  await recalculateAndStoreScore(req.userId!, 'insurance_remove');
  res.json({ ok: true });
});

// ── Insurance marketplace (educational compare + guided buy hand-off) ──
// Per-category cover defaults from the user's profile / needs analysis.
function defaultCover(category: PlanCategory, p: any, ins: any): number {
  switch (category) {
    case 'term_life': return ins.term.recommended || 10000000_00;
    case 'health': return ins.health.recommended || 1000000_00;
    case 'personal_accident': return Math.min(Math.max((p.user.annual_gross_income || 0) * 10, 5000000_00), 20000000_00);
    case 'critical_illness': return 1500000_00;
    case 'motor': return Number(p.assets?.vehicle) || 600000_00;
    case 'home': return Number(p.assets?.property) || 4000000_00;
    case 'travel': return 5000000_00;
    default: return 1000000_00;
  }
}

// Landing: categories with the user's recommended cover, current cover & gap.
insightsRouter.get('/insurance/market/categories', async (req: AuthedRequest, res) => {
  const p = await loadProfileData(req.userId!);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const ins = analyseInsurance(p);
  const cats = (Object.keys(MARKET_CAT_LABEL) as PlanCategory[]).map((category) => ({
    category, label: MARKET_CAT_LABEL[category],
    planCount: CATALOG.filter((c) => c.category === category).length,
    recommendedCover: defaultCover(category, p, ins),
    currentCover: category === 'term_life' ? ins.term.current : category === 'health' ? ins.health.current : null,
    gap: category === 'term_life' ? ins.term.gap : category === 'health' ? ins.health.gap : null,
  }));
  res.json({ categories: cats, verifyNote });
});

// Ranked plans for a category, with indicative premiums for this user.
insightsRouter.get('/insurance/market/plans', async (req: AuthedRequest, res) => {
  const p = await loadProfileData(req.userId!);
  if (!p) return res.status(404).json({ error: 'not_found' });
  const category = String(req.query.category || 'term_life') as PlanCategory;
  if (!MARKET_CAT_LABEL[category]) return res.status(400).json({ error: 'invalid_category' });
  const ins = analyseInsurance(p);
  const age = Math.min(80, Math.max(18, Number(req.query.age) || p.user.age || 32));
  const familySize = Math.min(8, Math.max(1, Number(req.query.family) || 1 + (p.user.dependents_count || 0)));
  const smoker = req.query.smoker === '1' || req.query.smoker === 'true';
  const recommendedCover = defaultCover(category, p, ins);
  const cover = Math.max(0, Number(req.query.cover) || recommendedCover);
  const ctx = { age, cover, familySize, smoker };
  res.json({ category, label: MARKET_CAT_LABEL[category], cover, recommendedCover, ctx, plans: rankPlans(category, ctx), verifyNote });
});

// GET /market — educational themes + third-party financial news (no advice)
insightsRouter.get('/market', async (_req: AuthedRequest, res) => {
  res.json(await getMarketData());
});

// GET /tax/filing/prefill — ITR inputs assembled from the user's full data
// (profile + everything uploads have folded into tax_data).
insightsRouter.get('/tax/filing/prefill', async (req: AuthedRequest, res) => {
  const p = await loadProfileData(req.userId!);
  if (!p) return res.status(404).json({ error: 'not_found' });
  res.json({ fy: currentFY(), inputs: assembleFilingInputs(p) });
});

// GET /tax/full — the complete computed return from the user's whole picture:
// every income head, both regimes, ITR form, TDS reconciliation, refund/payable.
// CA-usable. This powers the comprehensive breakdown on the tax page.
insightsRouter.get('/tax/full', async (req: AuthedRequest, res) => {
  const p = await loadProfileData(req.userId!);
  if (!p) return res.status(404).json({ error: 'not_found' });
  res.json(fullFiling(p));
});

// POST /tax/filing/compute — full ITR computation from (edited) inputs
insightsRouter.post('/tax/filing/compute', rateLimit({ windowMs: 60_000, max: 60, keyPrefix: 'filing' }), async (req: AuthedRequest, res) => {
  const num = z.number().int().min(0).max(1_000_000_000_00);
  const opt = num.optional();
  const schema = z.object({
    grossSalary: num, interestIncome: num, housePropertyIncome: z.number().int(), otherIncome: num, businessIncome: num,
    depreciation: opt,
    stcgEquity: num, ltcgEquity: num, otherCapitalGains: num, stcgOther: opt, ltcgOther: opt,
    stcl: opt, ltcl: opt, broughtFwdSTCL: opt, broughtFwdLTCL: opt, broughtFwdHPLoss: opt, broughtFwdBusinessLoss: opt,
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
  let fingerprints: string[] = [];
  if (parsed.data.persist) {
    // Atomic import: either every (non-duplicate) row lands, or none do.
    const counts = await withTransaction(async (q) => {
      let ins = 0, dup = 0; const fps: string[] = [];
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
        if (inserted.length > 0) { ins++; fps.push(fp); } else dup++;
      }
      return { ins, dup, fps };
    });
    imported = counts.ins; duplicates = counts.dup; fingerprints = counts.fps;
    if (imported > 0) {
      await recalculateAndStoreScore(req.userId!, 'statement_import');
      await remember(req.userId!, 'statement_upload', 'Uploaded a bank statement', `User imported ${imported} new transactions from a bank statement on ${new Date().toISOString().slice(0, 10)}.`);
    }
  }

  // fingerprints let a Monthly-Records bank-statement deletion remove exactly the
  // rows it imported (reverse-tracking).
  res.json({ report, imported, duplicates, fingerprints });
});

// POST /holdings/analyze — portfolio look-through from an uploaded holdings file.
insightsRouter.post('/holdings/analyze', rateLimit({ windowMs: 60_000, max: 20, keyPrefix: 'hold' }), async (req: AuthedRequest, res) => {
  const schema = z.object({
    holdings: z.array(z.object({
      name: z.string().min(1).max(200),
      value: z.number().int().nonnegative(),
      units: z.number().optional(),
      type: z.string().max(60).optional(),
    })).min(1).max(2000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  res.json(analyzeHoldings(parsed.data.holdings));
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
