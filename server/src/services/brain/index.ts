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
import { planDreams, goalToDream, affordCheck, DreamInput, DreamPlan, AffordResult, PlanOptions } from './dreams';
import { detectLifeEvents, LifeEvent, Txn } from './lifeEvents';
import { buildNextMoves, Move } from './nextMoves';

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
  return { p, map, dreams, txns, spendByCategory };
}

export async function runBrain(userId: string): Promise<BrainState | null> {
  const inp = await loadInputs(userId);
  if (!inp) return null;
  const { p, map, dreams, txns, spendByCategory } = inp;
  const opts: PlanOptions = { spendByCategory };
  const plan = planDreams(map, dreams, opts);
  const events = detectLifeEvents(txns, map.takeHome);
  const actions = generateActions(p);
  let alerts: ReturnType<typeof generateAlerts> = [];
  try { alerts = generateAlerts(p, await gatherSignals(userId)); } catch { alerts = []; }
  const moves = buildNextMoves({ map, plan, actions, alerts, events });
  return { map, plan, moves, events, phase: phaseInfo(deriveLifePhase(p)), generatedAt: new Date().toISOString() };
}

export async function brainAfford(userId: string, cost: number, months: number | null, label: string): Promise<AffordResult | null> {
  const inp = await loadInputs(userId);
  if (!inp) return null;
  return affordCheck(inp.map, inp.dreams, cost, { months, label, spendByCategory: inp.spendByCategory });
}
