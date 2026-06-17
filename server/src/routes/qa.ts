import { Router } from 'express';
import { z } from 'zod';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { loadProfileData } from '../services/profile';
import { answerQuestion, AI_DISCLAIMER } from '../services/cfo-ai';
import { remember } from '../services/rag';
import { PLANS, PlanKey } from '../config';

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
  const schema = z.object({ content: z.string().min(1).max(2000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid_input', message: parsed.error.issues[0].message });
  const question = parsed.data.content;

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
        message: `You've used all ${limit} questions this month on the Starter plan. Upgrade to CFO for unlimited questions with human review.`,
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

  const answer = await answerQuestion(req.userId!, question, p, history);

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

  res.json({ conversation_id: convId, message: msg, disclaimer: AI_DISCLAIMER });
}

const qaLimit = rateLimit({ windowMs: 60_000, max: 15, keyPrefix: 'qa' });
qaRouter.post('/conversations', qaLimit, (req: AuthedRequest, res) => handleMessage(req, res, null));
qaRouter.post('/conversations/:id/messages', qaLimit, (req: AuthedRequest, res) => handleMessage(req, res, req.params.id));
