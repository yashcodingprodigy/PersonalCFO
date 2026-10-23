// Next Moves — the brain's single, ranked answer to "what should I do now?".
// Merges every engine (rule-based actions, the dreams plan, proactive alerts,
// detected life events) into one de-duplicated list, ranked by money impact ×
// urgency × how much it protects the user's dreams. Each move explains WHY in
// plain language and links to where it gets done. Pure function.

import { GeneratedAction } from '../actions';
import { Alert } from '../alerts';
import { DreamPlan, inr } from './dreams';
import { LifeEvent } from './lifeEvents';
import { MoneyMap } from './cashflow';
import { Lang, M } from './i18n';

export interface Move {
  id: string;
  source: 'alert' | 'event' | 'dream' | 'action';
  title: string;
  why: string;
  impact: string | null;
  category: string;
  urgency: 'now' | 'soon' | 'anytime';
  deadline: string | null;
  href: string;
  cta: string;
  score: number;
}

const HREF: Record<string, string> = { tax: '/tax', insurance: '/insurance', investment: '/invest', debt: '/actions', savings: '/goals', estate: '/actions' };

function urgencyFrom(deadline: string | null | undefined, now: Date): { u: Move['urgency']; boost: number } {
  if (!deadline) return { u: 'anytime', boost: 0 };
  const days = Math.round((new Date(deadline).getTime() - now.getTime()) / 86400000);
  if (days <= 7) return { u: 'now', boost: 40 };
  if (days <= 30) return { u: 'soon', boost: 25 };
  if (days <= 90) return { u: 'soon', boost: 10 };
  return { u: 'anytime', boost: 0 };
}

export function buildNextMoves(args: {
  map: MoneyMap; plan: DreamPlan; actions: GeneratedAction[]; alerts: Alert[]; events: LifeEvent[]; now?: Date; limit?: number; lang?: Lang;
}): Move[] {
  const now = args.now || new Date();
  const T = M(args.lang || 'en');
  const moves: Move[] = [];
  const realDreams = args.plan.items.filter((i) => !i.virtual);
  const topDream = realDreams.slice().sort((a, b) => a.priority - b.priority || a.months - b.months)[0];
  const dreamPhrase = topDream ? T.protects(topDream.name) : '';

  // 1. Time-sensitive alerts
  for (const a of args.alerts) {
    if (a.severity !== 'urgent' && a.severity !== 'warning') continue;
    const { u, boost } = urgencyFrom(a.dueDate, now);
    moves.push({
      id: `alert:${a.dedupeKey}`, source: 'alert', title: a.title, why: a.body, impact: null,
      category: a.category, urgency: a.severity === 'urgent' ? 'now' : u, deadline: a.dueDate || null,
      href: a.actionHref || '/alerts', cta: a.actionLabel || T.takeALook,
      score: (a.severity === 'urgent' ? 90 : 60) + boost,
    });
  }

  // 2. Fresh life events
  for (const e of args.events) {
    moves.push({
      id: `event:${e.kind}:${e.month}`, source: 'event', title: e.title, why: e.suggestion, impact: null,
      category: 'life', urgency: 'soon', deadline: null, href: '/goals', cta: T.replan, score: 70,
    });
  }

  // 3. Dreams that need a decision (and the safety net)
  for (const it of args.plan.items) {
    if (it.status === 'on_track' || it.status === 'achieved' || it.id === 'virtual-future') continue;
    const best = it.levers[0];
    const short = Math.max(0, it.need - it.allocated);
    if (it.id === 'virtual-safety') {
      moves.push({
        id: 'dream:safety', source: 'dream', title: T.safetyTitle(inr(it.allocated || it.need)),
        why: T.safetyWhy(inr(it.adjustedTarget), args.map.emergencyMonths),
        impact: T.safetyImpact(args.map.emergencyMonths), category: 'savings', urgency: 'soon', deadline: null,
        href: '/goals', cta: T.seePlan, score: 62,
      });
      continue;
    }
    moves.push({
      id: `dream:${it.id}`, source: 'dream',
      title: it.status === 'stretch' ? T.dreamStretchTitle(it.name) : T.dreamYesTitle(it.name),
      why: best ? best.label : T.dreamNeedWhy(inr(it.need), inr(it.allocated)),
      impact: short > 0 ? T.gap(inr(short)) : null, category: 'dream', urgency: it.months <= 6 ? 'soon' : 'anytime',
      deadline: null, href: '/goals', cta: T.chooseFix,
      score: (it.priority === 1 ? 58 : it.priority === 2 ? 48 : 34) + (it.months <= 6 ? 8 : 0),
    });
  }

  // 4. Rule-based actions (skip ones a dream move already covers)
  const hasSafetyMove = moves.some((m) => m.id === 'dream:safety');
  for (const a of args.actions) {
    if (hasSafetyMove && a.dimension === 'emergency_fund') continue;
    const { u, boost } = urgencyFrom(a.deadline, now);
    const protects = a.category === 'insurance' && topDream;
    moves.push({
      id: `action:${a.rule_id}`, source: 'action', title: a.title,
      why: protects ? `${a.impact_text}${dreamPhrase}.` : a.impact_text,
      impact: null, category: a.category, urgency: u, deadline: a.deadline,
      href: HREF[a.category] || '/actions', cta: T.doThis,
      score: Math.min(60, a.impact_score * 3) + (a.priority === 'high' ? 15 : a.priority === 'medium' ? 5 : 0) + boost + (protects ? 10 : 0),
    });
  }

  // 5. Idle cash that could be working for a dream
  const idle = args.map.excessCash - args.plan.earmarkedTotal;
  const leverUsesCash = args.plan.items.some((i) => i.levers.some((l) => l.kind === 'use_cash'));
  if (idle > 0 && args.map.takeHome > 0 && idle >= args.map.takeHome && !leverUsesCash) {
    moves.push({
      id: 'cash:idle', source: 'dream', title: T.idleTitle(inr(args.map.excessCash - args.plan.earmarkedTotal)),
      why: T.idleWhy(topDream ? topDream.name : null),
      impact: null, category: 'savings', urgency: 'anytime', deadline: null, href: '/goals', cta: T.putToWork, score: 40,
    });
  }

  // de-dupe by id, rank, trim
  const seen = new Set<string>();
  return moves
    .filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
    .sort((a, b) => b.score - a.score)
    .slice(0, args.limit ?? 7);
}
