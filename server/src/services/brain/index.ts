// The Money Brain — one call that thinks across the user's whole financial life:
// money map → dreams plan → life events → ranked next moves. This is the single
// source the dashboard, Dreams page, alerts and Ask PayWatch read from, so every
// surface tells the same story with the same numbers.

import { query } from '../../db';
import { loadProfileData } from '../profile';
import { generateActions } from '../actions';
import { generateAlerts } from '../alerts';
import { gatherSignals } from '../monitor';
import { deriveLifePhase, phaseInfo } from '../lifestage';
import { buildMoneyMap, MoneyMap } from './cashflow';
import { catalogLocalName } from './dreamCapture';
import { planDreams, goalToDream, affordCheck, DreamInput, DreamPlan, AffordResult, PlanOptions } from './dreams';
import { detectLifeEvents, LifeEvent, Txn } from './lifeEvents';
import { buildNextMoves, Move } from './nextMoves';
import { Lang, asLang } from './i18n';
import { translateTexts } from '../translate';

const CATEGORY_LABELS: Record<string, string> = {
  food_dining: 'Food & dining', shopping: 'Shopping', entertainment: 'Entertainment',
};

export interface BrainState {
  map: MoneyMap;
  plan: DreamPlan;
  moves: Move[];
  events: LifeEvent[];
  phase: { phase: string; label: string; focus: string };
  generatedAt: string;
}

async function loadInputs(userId: string) {
  const p = await loadProfileData(userId);
  if (!p) return null;
  const goals = await query(`SELECT * FROM goals WHERE user_id = $1 ORDER BY created_at`, [userId]);
  const langRow = await query<{ language: string }>(`SELECT language FROM users WHERE user_id = $1`, [userId]).catch(() => []);
  const userLangPref: Lang = asLang(langRow[0]?.language);
  const txRows = await query(
    `SELECT to_char(txn_date,'YYYY-MM-DD') AS date, amount, direction, category, description
       FROM transactions WHERE user_id = $1 AND txn_date >= (CURRENT_DATE - INTERVAL '6 months')
      ORDER BY txn_date`,
    [userId]
  );
  const txns: Txn[] = txRows.map((t) => ({ date: t.date, amount: Number(t.amount), direction: t.direction, category: t.category, description: t.description }));
  // Average monthly discretionary spend by category (last 3 months) — for "trim" levers.
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 3);
  const recent = txns.filter((t) => t.direction === 'debit' && new Date(t.date) >= cutoff);
  const monthsSeen = Math.max(1, new Set(recent.map((t) => t.date.slice(0, 7))).size);
  const byCat = new Map<string, number>();
  for (const t of recent) if (CATEGORY_LABELS[t.category]) byCat.set(t.category, (byCat.get(t.category) || 0) + t.amount);
  const spendByCategory = [...byCat.entries()].map(([category, total]) => ({ category, label: CATEGORY_LABELS[category], monthly: Math.round(total / monthsSeen) }));
  const map = buildMoneyMap(p);
  const dreams: DreamInput[] = goals.map(goalToDream);
  return { p, map, dreams, goals, txns, spendByCategory, userLangPref };
}

/**
 * Show every dream in the user's current language: stored bilingual names first (dreams captured
 * from chat/voice), then the catalogue, then AI translation (cached) for names the user typed.
 */
export async function localizeDreams(dreams: DreamInput[], goals: any[], lang: Lang): Promise<void> {
  const metaById = new Map(goals.map((g: any) => [String(g.goal_id), g.meta || {}]));
  const wrongScript = (n: string) => (lang === 'hi' ? /[A-Za-z]{2,}/.test(n) && !/[\u0900-\u097F]/.test(n) : /[\u0900-\u097F]/.test(n));
  const pending: DreamInput[] = [];
  for (const d of dreams) {
    const names = metaById.get(String(d.id))?.names;
    if (names?.[lang]) { d.name = names[lang]; continue; }
    if (!wrongScript(d.name)) continue;
    const c = catalogLocalName(d.name, lang);
    if (c) d.name = c; else pending.push(d);
  }
  if (!pending.length) return;
  const tr = await translateTexts(pending.map((d) => d.name), lang).catch(() => pending.map((d) => d.name));
  pending.forEach((d, i) => { if (tr[i]) d.name = tr[i]; });
}

export async function runBrain(userId: string, langOverride?: Lang): Promise<BrainState | null> {
  const inp = await loadInputs(userId);
  if (!inp) return null;
  const { p, map, dreams, txns, spendByCategory } = inp;
  const lang = langOverride || inp.userLangPref;
  await localizeDreams(dreams, inp.goals, lang);
  // Autopilot on: spare cash above the safety net is auto-assigned to dreams.
  const opts: PlanOptions = { spendByCategory, lang, autoEarmark: true };
  const plan = planDreams(map, dreams, opts);
  const events = detectLifeEvents(txns, map.takeHome, lang);
  const actions = generateActions(p);
  let alerts: ReturnType<typeof generateAlerts> = [];
  try { alerts = generateAlerts(p, await gatherSignals(userId)); } catch { alerts = []; }
  const moves = buildNextMoves({ map, plan, actions, alerts, events, lang });
  let phase = phaseInfo(deriveLifePhase(p)) as { phase: string; label: string; focus: string };
  // Rule-engine text (actions/alerts) is English at source → translate for Hindi users (cached; no key = English).
  if (lang === 'hi') {
    const idx: [number, 'title' | 'why' | 'cta'][] = [];
    const texts: string[] = [];
    moves.forEach((m, i) => { if (m.source === 'alert' || m.source === 'action') (['title', 'why', 'cta'] as const).forEach((k) => { idx.push([i, k]); texts.push(m[k]); }); });
    texts.push(phase.label, phase.focus);
    const tr = await translateTexts(texts, 'hi');
    idx.forEach(([i, k], j) => { (moves[i] as any)[k] = tr[j]; });
    phase = { ...phase, label: tr[texts.length - 2], focus: tr[texts.length - 1] };
  }
  return { map, plan, moves, events, phase, generatedAt: new Date().toISOString() };
}

export async function brainAfford(userId: string, cost: number, months: number | null, label: string, langOverride?: Lang): Promise<AffordResult | null> {
  const inp = await loadInputs(userId);
  if (!inp) return null;
  await localizeDreams(inp.dreams, inp.goals, langOverride || inp.userLangPref);
  return affordCheck(inp.map, inp.dreams, cost, { months, label, spendByCategory: inp.spendByCategory, lang: langOverride || inp.userLangPref, autoEarmark: true });
}
