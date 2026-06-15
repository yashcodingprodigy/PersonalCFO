// Scheduled monitor — meant to be hit by a Railway cron (or any scheduler).
// Protected by a shared secret header so it can run unauthenticated.
// Regenerates alerts for every active user and emails a digest to those who
// added an email, sending each alert at most once.
import { Router } from 'express';
import { query, one } from '../db';
import { config } from '../config';
import { regenerateAlerts } from '../services/monitor';
import { loadProfileData } from '../services/profile';
import { buildInvestmentGuidance } from '../services/investment';
import { sendEmail, renderDigestEmail } from '../adapters/email';

export const cronRouter = Router();

function authorised(req: any): boolean {
  if (!config.cronSecret) return false; // disabled until a secret is set
  return req.get('x-cron-key') === config.cronSecret;
}

// POST /cron/run
cronRouter.post('/run', async (req, res) => {
  if (!authorised(req)) return res.status(401).json({ error: 'unauthorised' });

  const users = await query(`SELECT user_id, name, email FROM users WHERE deleted_at IS NULL`);
  let alertsCreated = 0, emailsSent = 0;

  for (const u of users) {
    try {
      alertsCreated += await regenerateAlerts(u.user_id);

      if (u.email) {
        const pending = await query(
          `SELECT id, title, body, severity FROM notifications
            WHERE user_id=$1 AND status='unread' AND emailed_at IS NULL AND severity IN ('urgent','warning')
            ORDER BY CASE severity WHEN 'urgent' THEN 0 ELSE 1 END, created_at DESC LIMIT 8`,
          [u.user_id]
        );
        if (pending.length > 0) {
          const p = await loadProfileData(u.user_id);
          const guidance = p ? buildInvestmentGuidance(p) : null;
          const scoreRow = await one(`SELECT score FROM score_history WHERE user_id=$1 ORDER BY calculated_at DESC LIMIT 1`, [u.user_id]);
          const monthAgo = await one(`SELECT score FROM score_history WHERE user_id=$1 AND calculated_at < now() - INTERVAL '25 days' ORDER BY calculated_at DESC LIMIT 1`, [u.user_id]);
          const topAction = await one(`SELECT title FROM actions WHERE user_id=$1 AND status IN ('pending','in_progress') ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, impact_score DESC LIMIT 1`, [u.user_id]);

          const html = renderDigestEmail({
            name: u.name || 'there',
            month: new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
            score: scoreRow?.score ?? null,
            scoreDelta: scoreRow && monthAgo ? scoreRow.score - monthAgo.score : null,
            investThisMonth: guidance?.hasIncome ? guidance.monthlyInvestable : 0,
            topAction: topAction?.title || null,
            alerts: pending.map((a) => ({ title: a.title, body: a.body, severity: a.severity })),
          });
          const ok = await sendEmail(u.email, `PayWatch · ${pending.length} thing${pending.length > 1 ? 's' : ''} need your attention`, html);
          if (ok) {
            emailsSent++;
            await query(`UPDATE notifications SET emailed_at=now() WHERE id = ANY($1::uuid[])`, [pending.map((a) => a.id)]);
          }
        }
      }
    } catch (e) {
      console.error(`[cron] user ${u.user_id} failed`, e);
    }
  }

  res.json({ ok: true, users: users.length, alertsCreated, emailsSent });
});
