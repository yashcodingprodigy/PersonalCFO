import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { createSubscription, planAmount, gstBreakup } from '../adapters/billing';
import { PLANS, PlanKey } from '../config';

export const billingRouter = Router();
billingRouter.use(requireAuth);

// GET /billing/plans
billingRouter.get('/plans', (_req, res) => {
  res.json(
    (Object.keys(PLANS) as PlanKey[]).map((key) => ({
      key,
      name: PLANS[key].name,
      monthly_price: PLANS[key].monthly,
      annual_price: PLANS[key].monthly * 10,
      gst_note: 'Prices inclusive of 18% GST. GST invoice issued for every charge.',
    }))
  );
});

// GET /billing/subscription
billingRouter.get('/subscription', async (req: AuthedRequest, res) => {
  const sub = await one(
    `SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [req.userId]
  );
  const invoices = await query(
    `SELECT invoice_number, description, base_amount, gst_amount, total_amount, created_at
       FROM invoices WHERE user_id = $1 ORDER BY created_at DESC LIMIT 24`,
    [req.userId]
  );
  res.json({ subscription: sub, invoices });
});

// POST /billing/subscribe
billingRouter.post('/subscribe', async (req: AuthedRequest, res) => {
  const schema = z.object({
    plan: z.enum(['starter', 'cfo', 'family']),
    cycle: z.enum(['monthly', 'annual']).default('monthly'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const { plan, cycle } = parsed.data;

  const created = await createSubscription(plan, cycle);
  const amount = planAmount(plan, cycle);
  const { base, gst, total } = gstBreakup(amount);

  const periodEnd = new Date();
  if (cycle === 'annual') periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  await query(`UPDATE subscriptions SET status = 'replaced' WHERE user_id = $1 AND status = 'active'`, [req.userId]);
  const sub = await one(
    `INSERT INTO subscriptions (user_id, plan, billing_cycle, status, provider, provider_sub_id, amount, current_period_end)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.userId, plan, cycle, created.status === 'active' ? 'active' : 'pending', process.env.BILLING_PROVIDER || 'sandbox', created.providerSubId, amount, periodEnd]
  );

  // Sequential GST invoice
  const seq = await one(`SELECT COUNT(*)::int AS c FROM invoices`);
  const fy = new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const invoiceNumber = `PCFO/${fy}-${String(fy + 1).slice(2)}/${String(seq!.c + 1).padStart(5, '0')}`;
  await query(
    `INSERT INTO invoices (user_id, invoice_number, description, base_amount, gst_amount, total_amount)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [req.userId, invoiceNumber, `Personal CFO ${PLANS[plan].name} plan — ${cycle}`, base, gst, total]
  );

  await query(`UPDATE users SET plan = $2, plan_status = 'active', subscription_id = $3 WHERE user_id = $1`, [req.userId, plan, created.providerSubId]);
  await query(`INSERT INTO audit_log (user_id, event, meta) VALUES ($1, 'subscription_created', $2)`, [req.userId, JSON.stringify({ plan, cycle })]);

  res.json({ subscription: sub, checkout_url: created.shortUrl || null, invoice_number: invoiceNumber });
});

// POST /billing/cancel — access continues till period end (SRS §15.2)
billingRouter.post('/cancel', async (req: AuthedRequest, res) => {
  await query(`UPDATE subscriptions SET status = 'cancelled' WHERE user_id = $1 AND status = 'active'`, [req.userId]);
  await query(`UPDATE users SET plan_status = 'cancelled' WHERE user_id = $1`, [req.userId]);
  await query(`INSERT INTO audit_log (user_id, event) VALUES ($1, 'subscription_cancelled')`, [req.userId]);
  res.json({
    ok: true,
    message: 'Subscription cancelled. Your access continues until the end of the paid period, and your data is retained for 90 days in case you return.',
  });
});
