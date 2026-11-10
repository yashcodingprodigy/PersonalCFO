// Dream drafts (D-61) — in chat/voice a dream is TALKED THROUGH before it is saved.
// The assistant notices a dream, keeps a draft on the conversation, asks for what's missing
// (when, how much), checks affordability, and only saves it when the user clearly says yes.
// Pure helpers here; persistence is in routes/qa.ts (conversations.pending_dream).

import { detectDream, parseRupees, parseMonths } from './dreamCapture';
import { DreamKind } from './dreams';
import { Lang } from './i18n';

export interface DreamDraft {
  name: string;
  names?: { en: string; hi: string };
  kind: DreamKind;
  goalType: string;
  amount: number;                  // paise
  amountFromUser: boolean;         // false = PayWatch's typical estimate
  months: number;                  // horizon used for planning
  monthsFromUser: boolean;         // false = default horizon
  inflation: number;
  startedAt: string;
}

const YEAR = /\b20\d{2}\b/g;

/** A new draft from a message that mentions a dream ("I want to plan my wedding"). */
export function startDraft(text: string, lang: Lang = 'en', now = new Date()): DreamDraft | null {
  const d = detectDream(text, lang, now);
  if (!d) return null;
  return {
    name: d.name, names: d.names, kind: d.kind, goalType: d.goalType,
    amount: d.amount, amountFromUser: !d.estimated,
    months: d.months, monthsFromUser: parseMonths(text, now) != null,
    inflation: d.inflation, startedAt: now.toISOString(),
  };
}

/** Fold new details from the user's latest message into the draft ("around 15 lakh, in 2 years"). */
export function updateDraft(d: DreamDraft, text: string, now = new Date()): { draft: DreamDraft; changed: boolean } {
  const next = { ...d };
  let changed = false;
  // Years like "2028" are dates, never amounts.
  const amount = parseRupees(text.replace(YEAR, ' '));
  if (amount > 0 && amount !== d.amount) { next.amount = amount; next.amountFromUser = true; changed = true; }
  const months = parseMonths(text, now);
  if (months != null && months !== d.months) { next.months = months; next.monthsFromUser = true; changed = true; }
  return { draft: next, changed };
}

/** What we still need to ask about. */
export function missing(d: DreamDraft): ('amount' | 'when')[] {
  const m: ('amount' | 'when')[] = [];
  if (!d.amountFromUser) m.push('amount');
  if (!d.monthsFromUser) m.push('when');
  return m;
}

const EXPLICIT_ADD = /\b(add|save|create|set ?up|lock|confirm)\b.{0,25}\b(it|this|that|dream|goal|plan)\b|\b(add|save) (it|this)\b|\bgo ahead\b|\b(jod|jodo|jod do|add kar|add karo|save kar|bana do|banao)\b|जोड़|शामिल कर|सेव कर|बना दो/i;
const BARE_YES = /^\s*(yes|yep|yeah|yup|sure|ok|okay|okk|done|perfect|sounds good|looks good|haan|ha|han|haa|theek hai|thik hai|bilkul|chalo|हाँ|हां|ठीक है|बिल्कुल)\b[\s!.👍🙂😊]*$/i;
const EXPLICIT_NO = /\b(don'?t add|do not add|cancel|not now|leave it|skip it|forget it|never ?mind|rehne do|mat (add )?karo|nahi chahiye|abhi nahi)\b|रहने दो|मत जोड़ो|अभी नहीं/i;
const BARE_NO = /^\s*(no|nope|nah|nahi|nahin|नहीं)\b[\s!.]*$/i;
/** Did our last reply ask whether to add the dream? (so a bare "yes"/"no" refers to that) */
export function askedToAdd(lastAssistant: string | undefined): boolean {
  return /add (it|this|that)( to your dreams)?\?|shall i add|should i add|want me to add|add .{0,30} to your dreams\?|सपनों में जोड़ूँ|जोड़ दूँ|जोड़ दें\?/i.test(lastAssistant || '');
}
export function isConfirm(text: string, lastAssistant?: string): boolean {
  if (EXPLICIT_NO.test(text)) return false;
  return EXPLICIT_ADD.test(text) || (BARE_YES.test(text) && askedToAdd(lastAssistant));
}
export function isCancel(text: string, lastAssistant?: string): boolean {
  return EXPLICIT_NO.test(text) || (BARE_NO.test(text) && askedToAdd(lastAssistant));
}

/** Context for the AI so it runs the conversation (never claims it saved anything). */
export function draftNote(d: DreamDraft, affordHeadline: string | null, inr: (p: number) => string, whenText: string): string {
  const need = missing(d);
  return [
    `DREAM BEING DISCUSSED (NOT SAVED YET): ${d.name}.`,
    `Budget: ${inr(d.amount)} ${d.amountFromUser ? '(the user said this)' : '(PayWatch typical estimate — the user has NOT given a number)'}.`,
    `Timing: ${d.monthsFromUser ? `by ${whenText} (the user said this)` : `not given yet (we'd assume ~${whenText})`}.`,
    affordHeadline ? `Affordability from the PayWatch brain (true numbers — use them, never contradict): ${affordHeadline}` : '',
    need.length
      ? `YOUR JOB NOW: talk it through like a friend. Ask ONLY for what's missing (${need.map((x) => (x === 'amount' ? 'how much they want to spend' : 'roughly when')).join(' and ')}) — one short question. You can mention the typical cost range to help them pick.`
      : `YOUR JOB NOW: say plainly whether it's comfortable, a stretch or not yet (from the affordability line), suggest one adjustment if needed, then ask: "Shall I add it to your dreams?"`,
    'NEVER say you added, saved or created it — the app adds it only after the user clearly says yes.',
  ].filter(Boolean).join(' ');
}
