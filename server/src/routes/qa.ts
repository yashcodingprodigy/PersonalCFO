import { Router } from 'express';
import { detectReplyLang, stickyLang } from '../services/langDetect';
import { planNavigation } from '../services/assistantActions';
import { z } from 'zod';
import { query, one } from '../db';
import { requireAuth, AuthedRequest } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';
import { loadProfileData } from '../services/profile';
import { answerQuestion, AI_DISCLAIMER, parseGoalIntent } from '../services/cfo-ai';
import { remember } from '../services/rag';
import { GOAL_TYPES } from '../services/goals';
import { PLANS, PlanKey } from '../config';
import { saveDream } from '../services/brain/autopilot';
import { DreamDraft, startDraft, updateDraft, isConfirm, isCancel, missing, draftNote } from '../services/brain/dreamDraft';
import { brainAfford } from '../services/brain';
import { prettyYm, ym } from '../services/brain/dreams';
import { asLang } from '../services/brain/i18n';
import { inrIN } from '../lib/money';
import { planActions, ActionPlan } from '../services/assistantActions';
import { buildVisuals, looksLikeDreamTalk, Visual } from '../services/brain/visuals';
import { runBrain } from '../services/brain';

const fmtRupees = inrIN;

/** "Create a goal of ₹5L for a bike by 2027" → a draft (still confirmed before saving). */
function goalIntentDraft(question: string): DreamDraft | null {
  const g = parseGoalIntent(question).goal;
  if (!g) return null;
  const months = g.target_date ? Math.max(1, Math.round((new Date(g.target_date).getTime() - Date.now()) / (30.44 * 864e5))) : 24;
  const kind: DreamDraft['kind'] = g.goal_type === 'home_purchase' || g.goal_type === 'car_purchase' ? 'purchase'
    : g.goal_type === 'retirement' ? 'growth' : g.goal_type === 'emergency_fund' ? 'safety' : g.goal_type === 'child_education' ? 'family' : 'milestone';
  return { name: g.name, kind, goalType: g.goal_type, amount: g.target_amount, amountFromUser: true, months, monthsFromUser: !!g.target_date, inflation: 0.05, startedAt: new Date().toISOString() };
}

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

// DELETE /qa/conversations/:id — clear one chat (messages go with it: ON DELETE CASCADE).
qaRouter.delete('/conversations/:id', async (req: AuthedRequest, res) => {
  const r = await query(`DELETE FROM conversations WHERE conversation_id = $1 AND user_id = $2 RETURNING conversation_id`, [req.params.id, req.userId]);
  if (!r.length) return res.status(404).json({ error: 'not_found' });
  res.json({ ok: true });
});

// DELETE /qa/conversations — clear ALL chat history for this user.
qaRouter.delete('/conversations', async (req: AuthedRequest, res) => {
  const r = await query(`DELETE FROM conversations WHERE user_id = $1 RETURNING conversation_id`, [req.userId]);
  res.json({ ok: true, deleted: r.length });
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
  // Answer in the language the user just used (typed or spoken), not just the app setting.
  const appLang = parsed.data.lang || asLang(langRow?.language);
  let lang = detectReplyLang(question, appLang);
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
        message: lang === 'hi'
          ? `आप इस महीने Starter प्लान के सभी ${limit} सवाल पूछ चुके हैं। असीमित सवालों के लिए CFO प्लान लें।`
          : `You've used all ${limit} questions this month on the Starter plan. Upgrade to CFO for unlimited questions.`,
      });
    }
  }

  const p = await loadProfileData(req.userId!);
  if (!p) return res.status(404).json({ error: 'not_found', message: lang === 'hi' ? 'आपकी प्रोफ़ाइल नहीं मिली — कृपया फिर से साइन इन करें।' : 'We couldn’t find your profile — please sign in again.' });

  let convId = conversationId;
  // A conversation that no longer exists (cleared chat, or the demo account was re-seeded) must not break
  // chat/voice with a 404 — just start a fresh conversation. Scoped to this user, so it can't touch anyone else's.
  if (convId) {
    const exists = await one(`SELECT 1 FROM conversations WHERE conversation_id = $1 AND user_id = $2`, [convId, req.userId]).catch(() => null);
    if (!exists) convId = null;
  }
  if (!convId) {
    const conv = await one(
      `INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING conversation_id`,
      [req.userId, question.slice(0, 120)]
    );
    convId = conv!.conversation_id;
  }

  const history = await query(
    `SELECT role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 6`,
    [convId]
  );
  history.reverse();
  // A language the user asked for earlier in this chat ("reply in Hindi") sticks for the rest of it.
  lang = detectReplyLang(question, appLang, stickyLang(history.filter((m: any) => m.role === 'user').map((m: any) => String(m.content))));

  await query(`INSERT INTO messages (conversation_id, role, content) VALUES ($1,'user',$2)`, [convId, question]);

  // ── Dream drafts (D-61): a dream is talked through first, and saved only when the user says yes. ──
  const convRow = await one<{ pending_dream: DreamDraft | null }>(`SELECT pending_dream FROM conversations WHERE conversation_id = $1`, [convId]).catch(() => null);
  let draft: DreamDraft | null = convRow?.pending_dream || null;
  const lastAssistant = [...history].reverse().find((m: any) => m.role === 'assistant')?.content as string | undefined;
  let focusName: string | null = null;   // dream saved by this message (for visuals)
  let dreamAction: string | null = null; // what happened, for the AI to acknowledge
  let draftChanged = false;
  if (draft) {
    if (isCancel(question, lastAssistant)) {
      dreamAction = `The user decided not to add the ${draft.name} dream for now. Acknowledge warmly in one line; don't push.`;
      draft = null; draftChanged = true;
    } else {
      // A different dream mentioned ("actually, a car instead") replaces the draft.
      const other = startDraft(question, lang);
      if (other && other.name.toLowerCase() !== draft.name.toLowerCase() && !isConfirm(question, lastAssistant)) { draft = other; draftChanged = true; }
      else { const u = updateDraft(draft, question); if (u.changed) { draft = u.draft; draftChanged = true; } }
      if (draft && isConfirm(question, lastAssistant)) {
        const saved = await saveDream(req.userId!, { ...draft, estimated: !draft.amountFromUser, capturedText: question }, mode === 'voice' ? 'voice' : 'chat', lang).catch(() => null);
        if (saved) {
          focusName = draft.name;
          dreamAction = `Saved "${draft.name}" (${fmtRupees(saved.amount)}, by ${prettyYm(ym(new Date(), draft.months))}) to the user's dreams after they confirmed. Confirm it in one happy sentence and say the plan has updated.`;
        } else {
          dreamAction = `Could NOT add "${draft.name}": it already exists in their dreams or their plan's dream limit is reached. Tell them kindly in one line (they can edit it on the Dreams page or upgrade).`;
        }
        draft = null; draftChanged = true;
      }
    }
  } else {
    const d = startDraft(question, lang) || goalIntentDraft(question);
    if (d) { draft = d; draftChanged = true; }
  }
  if (draftChanged) await query(`UPDATE conversations SET pending_dream = $2 WHERE conversation_id = $1`, [convId, draft ? JSON.stringify(draft) : null]).catch(() => {});
  const whenText = draft ? prettyYm(ym(new Date(), draft.months)) : '';
  const draftAfford = draft ? await brainAfford(req.userId!, draft.amount, draft.months, draft.name, lang).catch(() => null) : null;
  const dreamNote = draft ? draftNote(draft, draftAfford?.headline || null, fmtRupees, whenText) : null;

  // What should the app DO for this message? (navigate, guide, update a dream, settings)
  const act = await planActions(req.userId!, question, p, lang).catch(() => ({ actions: [], note: null, confirm: null } as ActionPlan));
  const actionNote = [act.note, dreamAction].filter(Boolean).join(' ') || null;
  const answer = await answerQuestion(req.userId!, question, p, history, { lang, voice: mode === 'voice', conversationId: convId, actionNote, dreamNote, draftAfford });
  if (answer.engine === 'rules' && act.actions.some((a) => a.type === 'navigate')) {
    // Without the AI, keep it short and about the action instead of a generic answer.
    const nav = act.actions.find((a) => a.type === 'navigate') as any;
    const hasGuide = act.actions.some((a) => a.type === 'guide');
    answer.content = lang === 'hi'
      ? `ठीक है — ${nav.label} खोल रहा हूँ।${hasGuide ? ' कोने में एक छोटी गाइड भी लगा दी है: क्या करें और क्या न करें।' : ''}`
      : `Sure — opening ${nav.label}.${hasGuide ? ' I’ve pinned a quick guide in the corner: what to do and what to avoid.' : ''}`;
  }
  if (act.confirm) answer.content = `${act.confirm}\n\n${answer.content}`;

  // Without the AI, keep the dream conversation going with simple deterministic lines.
  if (answer.engine === 'rules' && (draft || dreamAction)) {
    const hi = lang === 'hi';
    if (focusName) answer.content = hi ? `✨ हो गया — **${focusName}** आपके सपनों में जुड़ गया। प्लान अपने-आप अपडेट हो गया है।` : `✨ Done — **${focusName}** is in your dreams. Your plan has updated itself.`;
    else if (draft) {
      const need = missing(draft);
      answer.content = need.includes('amount')
        ? (hi ? `बढ़िया सपना! **${draft.name}** पर आप लगभग कितना खर्च करना चाहते हैं? आम तौर पर यह लगभग ${fmtRupees(draft.amount)} होता है।` : `Lovely! Roughly how much do you want to spend on **${draft.name}**? It's typically around ${fmtRupees(draft.amount)}.`)
        : need.includes('when')
          ? (hi ? `और यह लगभग कब तक चाहिए?` : `And roughly when — by which month or year?`)
          : `${draftAfford?.headline || ''}\n\n${hi ? 'क्या इसे आपके सपनों में जोड़ दूँ?' : 'Shall I add it to your dreams?'}`;
    }
  }

  // While a dream is being discussed and has both a budget and a date, offer a one-tap "Add it" card.
  if (draft && missing(draft).length === 0) {
    const hi = lang === 'hi';
    answer.proposedAction = {
      kind: 'add_dream',
      dream: { name: draft.name, amount: draft.amount, amountFromUser: draft.amountFromUser, months: draft.months, monthsFromUser: draft.monthsFromUser, when: whenText },
      summary: hi ? `**${draft.name}** — ${fmtRupees(draft.amount)}, ${whenText} तक — आपके सपनों में जोड़ें?` : `Add **${draft.name}** — ${fmtRupees(draft.amount)} by ${whenText} — to your dreams?`,
      confirmText: hi ? 'हाँ, इसे मेरे सपनों में जोड़ दो' : 'Yes, add it to my dreams',
    };
  }

  // Visual cards for dream talk (plan, cost split, savings path, price tiers, afford verdict).
  // Built from the brain's own numbers — no AI call. Only re-runs the brain if this message just added a dream.
  let visuals: Visual[] = [];
  if (answer.engine !== 'guardrail') {
    try {
      let plan = answer.plan || null;
      if (focusName) plan = (await runBrain(req.userId!, lang))?.plan || plan;
      if (focusName || draft || answer.afford || looksLikeDreamTalk(question, plan)) {
        visuals = buildVisuals({ question: draft ? `${question} ${draft.name}` : question, lang, plan, focusName, afford: answer.afford });
      }
    } catch (e) { console.error('[qa] visuals failed', e); }
  }

  // Human review layer (SRS §12.1): on paid plans, answers containing
  // recommendation-shaped content are flagged for advisor review.
  const needsReview =
    plan !== 'starter' && /should|recommend|better|increase|switch|buy/i.test(question) && answer.engine !== 'guardrail';
  const reviewStatus = plan === 'starter' ? 'ai_only' : needsReview ? 'pending_review' : 'ai_only';

  const msg = await one(
    `INSERT INTO messages (conversation_id, role, content, citations, review_status, engine, visuals)
     VALUES ($1,'assistant',$2,$3,$4,$5,$6) RETURNING *`,
    [convId, answer.content, JSON.stringify(answer.citations), reviewStatus, answer.engine, visuals.length ? JSON.stringify(visuals) : null]
  );

  // Personalisation: the question itself becomes part of the user's
  // private RAG memory — future answers know what they care about.
  await remember(req.userId!, 'question_asked', `Asked: ${question.slice(0, 100)}`, `On ${new Date().toISOString().slice(0, 10)} the user asked: "${question}". Topic relevance for future personalisation.`);

  res.json({ conversation_id: convId, message: msg, disclaimer: AI_DISCLAIMER, proposedAction: answer.proposedAction, actions: act.actions, reply_lang: lang, data_changed: !!focusName });
}

// POST /qa/intent — instant preview of what the assistant will do (navigation), so the app can
// move and show a skeleton while the full answer is still being written. No AI, no writes.
qaRouter.post('/intent', rateLimit({ windowMs: 60_000, max: 40, keyPrefix: 'qaintent' }), async (req: AuthedRequest, res) => {
  const content = String(req.body?.content || '').slice(0, 2000);
  if (!content.trim()) return res.json({ actions: [] });
  const langRow = await one(`SELECT language FROM users WHERE user_id = $1`, [req.userId]);
  const lang = detectReplyLang(content, req.body?.lang === 'hi' || req.body?.lang === 'en' ? req.body.lang : asLang(langRow?.language));
  const p = await loadProfileData(req.userId!);
  if (!p) return res.json({ actions: [], reply_lang: lang });
  res.json({ ...planNavigation(content, p, lang), reply_lang: lang });
});

const qaLimit = rateLimit({ windowMs: 60_000, max: 15, keyPrefix: 'qa' });
// Async errors go to the JSON error handler (never an unhandled rejection / bare 502).
qaRouter.post('/conversations', qaLimit, (req: AuthedRequest, res, next) => { handleMessage(req, res, null).catch(next); });
qaRouter.post('/conversations/:id/messages', qaLimit, (req: AuthedRequest, res, next) => { handleMessage(req, res, req.params.id).catch(next); });
