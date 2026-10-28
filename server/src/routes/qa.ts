import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { loadProfileData } from '../services/profile';
import { answerQuestion, AI_DISCLAIMER, parseGoalIntent } from '../services/cfo-ai';
import { remember } from '../services/rag';
import { GOAL_TYPES } from '../services/goals';
import { PLANS, PlanKey } from '../config';
import { captureDream } from '../services/brain/autopilot';
import { asLang } from '../services/brain/i18n';
import { inrIN } from '../lib/money';
import { planActions, ActionPlan } from '../services/assistantActions';

const fmtRupees = inrIN;

export const qaRouter = Router();
qaRouter.use(requireAuth);

qaRouter.get('/disclaimer', (_req, res) => res.json({ disclaimer: AI_DISCLAIMER }));

// GET /qa/conversations
qaRouter.get('/conversations', async (req: AuthedRequest, res) => {
  const rows = await query(
    `SELECT c.conversation_id, c.title, c.created_at,
            (SELECT content FROM messages m WHERE m.conversation_id = c.conversation_id ORDER BY created_at DESC LIMIT 1) AS last_message
       FROM conversations c WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.userId]
  );
  res.json(rows);
});

// GET /qa/conversations/:id
qaRouter.get('/conversations/:id', async (req: AuthedRequest, res) => {
  const conv = await one(`SELECT * FROM conversations WHERE conversation_id = $1 AND user_id = $2`, [req.params.id, req.userId]);
  if (!conv) return res.status(404).json({ error: 'not_found' });
  const messages = await query(`SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at`, [req.params.id]);
  res.json({ ...conv, messages });
});

// POST /qa/conversations — start conversation with first message
// POST /qa/conversations/:id/messages — continue
async function handleMessage(req: AuthedRequest, res: any, conversationId: string | null) {
  const schema = z.object({ content: z.string().min(1).max(2000), lang: z.enum(['en', 'hi']).optional(), mode: z.enum(['chat', 'voice']).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const question = parsed.data.content;
  const langRow = await one(`SELECT language FROM users WHERE user_id = $1`, [req.userId]);
  const lang = parsed.data.lang || asLang(langRow?.language);
  const mode = parsed.data.mode || 'chat';

  // Plan limits: Starter = 5 questions/month (SRS §12.3)
  const user = await one(`SELECT plan FROM users WHERE user_id = $1`, [req.userId]);
  const plan = (user?.plan || 'starter') as PlanKey;
  const limit = PLANS[plan].qaLimit;
  if (limit !== Infinity) {
    const used = await one(
      `SELECT COUNT(*)::int AS c FROM messages m JOIN conversations c ON c.conversation_id = m.conversation_id
        WHERE c.user_id = $1 AND m.role = 'user' AND m.created_at > date_trunc('month', now())`,
      [req.userId]
    );
    if (used!.c >= limit) {
      return res.status(403).json({
        error: 'plan_limit',
        message: `You've used all ${limit} questions this month on the Starter plan. Upgrade to CFO for unlimited questions.`,
      });
    }
  }

  const p = await loadProfileData(req.userId!);
  if (!p) return res.status(404).json({ error: 'not_found' });

  let convId = conversationId;
  if (!convId) {
    const conv = await one(
      `INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING conversation_id`,
      [req.userId, question.slice(0, 120)]
    );
    convId = conv!.conversation_id;
  } else {
    const conv = await one(`SELECT 1 FROM conversations WHERE conversation_id = $1 AND user_id = $2`, [convId, req.userId]);
    if (!conv) return res.status(404).json({ error: 'not_found' });
  }

  const history = await query(
    `SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 6`,
    [convId]
  );
  history.reverse();

  await query(`INSERT INTO messages (conversation_id, role, content) VALUES ($1,'user',$2)`, [convId, question]);

  // What should the app DO for this message? (navigate, guide, update a dream, settings)
  const act = await planActions(req.userId!, question, p, lang).catch(() => ({ actions: [], note: null, confirm: null } as ActionPlan));
  const answer = await answerQuestion(req.userId!, question, p, history, { lang, voice: mode === 'voice', conversationId: convId, actionNote: act.note });
  if (answer.engine === 'rules' && act.actions.some((a) => a.type === 'navigate')) {
    // Without the AI, keep it short and about the action instead of a generic answer.
    const nav = act.actions.find((a) => a.type === 'navigate') as any;
    const hasGuide = act.actions.some((a) => a.type === 'guide');
    answer.content = lang === 'hi'
      ? `ठीक है — ${nav.label} खोल रहा हूँ।${hasGuide ? ' कोने में एक छोटी गाइड भी लगा दी है: क्या करें और क्या न करें।' : ''}`
      : `Sure — opening ${nav.label}.${hasGuide ? ' I’ve pinned a quick guide in the corner: what to do and what to avoid.' : ''}`;
  }
  if (act.confirm) answer.content = `${act.confirm}\n\n${answer.content}`;

  // Goal creation from chat: if the user asked to create a goal and gave an
  // amount, add it directly (respecting their plan's goal limit) and confirm.
  if (answer.engine !== 'guardrail') {
    const gi = parseGoalIntent(question);
    if (gi.goal) {
      const g = gi.goal;
      const goalLimit = PLANS[plan].goalLimit;
      const gcount = await one(`SELECT COUNT(*)::int AS c FROM goals WHERE user_id = $1`, [req.userId]);
      if (gcount!.c >= goalLimit) {
        answer.content = `Heads up — your ${plan} plan allows ${goalLimit} goals, so I couldn't add this one. You can upgrade for unlimited goals.\n\n` + answer.content;
      } else {
        const defaultMeta = GOAL_TYPES.find((t) => t.type === g.goal_type)?.defaultMeta || {};
        await query(
          `INSERT INTO goals (user_id, goal_type, name, target_amount, target_date, current_amount, monthly_contribution, meta)
           VALUES ($1,$2,$3,$4,$5,0,$6,$7)`,
          [req.userId, g.goal_type, g.name, g.target_amount, g.target_date, g.monthly_contribution, JSON.stringify({ ...defaultMeta, source: 'chat' })]
        );
        import('../services/brain/autopilot').then((m) => m.scheduleBrainTick(req.userId!, 'dream_added', 300)).catch(() => {});
        answer.content = (lang === 'hi'
          ? `✅ हो गया — मैंने **${g.name}** (${fmtRupees(g.target_amount)}${g.target_date ? `, ${g.target_date} तक` : ''}) आपके सपनों में जोड़ दिया। प्लान अपने-आप अपडेट हो गया है।\n\n`
          : `✅ Done — I've added **${g.name}** of ${fmtRupees(g.target_amount)}${g.target_date ? ` by ${g.target_date}` : ''} to your dreams. Your plan has updated itself.\n\n`) + answer.content;
      }
    } else {
      // No price given? The brain hears the dream anyway, estimates a sensible
      // cost, and plans it automatically (marked "estimated — edit anytime").
      const cap = await captureDream(req.userId!, question, mode === 'voice' ? 'voice' : 'chat').catch(() => null);
      if (cap) answer.content = `${cap.message}\n\n${answer.content}`;
    }
  }

  // Human review layer (SRS §12.1): on paid plans, answers containing
  // recommendation-shaped content are flagged for advisor review.
  const needsReview =
    plan !== 'starter' && /should|recommend|better|increase|switch|buy/i.test(question) && answer.engine !== 'guardrail';
  const reviewStatus = plan === 'starter' ? 'ai_only' : needsReview ? 'pending_review' : 'ai_only';

  const msg = await one(
    `INSERT INTO messages (conversation_id, role, content, citations, review_status, engine)
     VALUES ($1,'assistant',$2,$3,$4,$5) RETURNING *`,
    [convId, answer.content, JSON.stringify(answer.citations), reviewStatus, answer.engine]
  );

  // Personalisation: the question itself becomes part of the user's
  // private RAG memory — future answers know what they care about.
  await remember(req.userId!, 'question_asked', `Asked: ${question.slice(0, 100)}`, `On ${new Date().toISOString().slice(0, 10)} the user asked: "${question}". Topic relevance for future personalisation.`);

  res.json({ conversation_id: convId, message: msg, disclaimer: AI_DISCLAIMER, proposedAction: answer.proposedAction, actions: act.actions });
}

const qaLimit = rateLimit({ windowMs: 60_000, max: 15, keyPrefix: 'qa' });
qaRouter.post('/conversations', qaLimit, (req: AuthedRequest, res) => handleMessage(req, res, null));
qaRouter.post('/conversations/:id/messages', qaLimit, (req: AuthedRequest, res) => handleMessage(req, res, req.params.id));
