// Autopilot — makes the money brain an always-on OS instead of a page.
//
// • brainTick(user): re-thinks the user's whole plan whenever ANY data changes
//   (it's hooked into recalculateAndStoreScore, which every upload/edit already
//   calls, plus goal changes, dream capture, onboarding and the daily cron).
// • It diffs the new plan against the last snapshot and writes what changed to a
//   "while you were away" activity feed — and important changes to Alerts.
// • captureDream(): a dream heard anywhere (chat, voice, onboarding) becomes a
//   planned dream automatically — price estimated if not said.
// Debounced per user so a burst of uploads produces one tick.

import { query, one } from '../../db';
import { runBrain, BrainState } from './index';
import { Lang, M, asLang } from './i18n';
import { detectDream, DetectedDream } from './dreamCapture';
import { inr, ym } from './dreams';
import { buildMoneyMap } from './cashflow';
import { loadProfileData } from '../profile';

export interface Snapshot {
  v: 1;
  free: number;
  excessCash: number;
  dreams: { id: string; name: string; status: string; projectedDate: string | null; earmarked: number }[];
  events: string[];
}
export interface Activity {
  kind: string;
  title: string;
  body?: string;
  notify?: { severity: 'urgent' | 'warning' | 'info' | 'good'; dedupe: string };
}

export function snapshotOf(s: BrainState): Snapshot {
  return {
    v: 1, free: s.map.free, excessCash: s.map.excessCash,
    dreams: s.plan.items.filter((i) => !i.virtual).map((i) => ({ id: i.id, name: i.name, status: i.status, projectedDate: i.projectedDate, earmarked: i.earmarked })),
    events: s.events.map((e) => `${e.kind}:${e.month}`),
  };
}

const RANK: Record<string, number> = { achieved: 0, on_track: 1, stretch: 2, needs_tradeoff: 3 };

// Pure: what changed between two snapshots, in the user's language.
export function diffBrain(prev: Snapshot | null, cur: Snapshot, lang: Lang, joyBudget: number, events: BrainState['events'] = []): Activity[] {
  const T = M(lang);
  const out: Activity[] = [];
  if (!prev) {
    if (cur.dreams.length) out.push({ kind: 'plan_built', title: T.actFirstPlan(cur.dreams.length, inr(joyBudget)) });
    return out;
  }
  const before = new Map(prev.dreams.map((d) => [d.id, d]));
  for (const d of cur.dreams) {
    const p = before.get(d.id);
    if (!p) {
      // A brand-new dream: say what the autopilot already did for it.
      if (d.earmarked >= 100000) out.push({ kind: 'earmark', title: T.actEarmark(inr(d.earmarked), d.name) });
      if (d.status === 'achieved') out.push({ kind: 'dream_done', title: T.actAchieved(d.name), notify: { severity: 'good', dedupe: `brain_done_${d.id}` } });
      continue;
    }
    if (d.status !== p.status) {
      if (d.status === 'achieved') out.push({ kind: 'dream_done', title: T.actAchieved(d.name), notify: { severity: 'good', dedupe: `brain_done_${d.id}` } });
      else if (RANK[d.status] < RANK[p.status]) out.push({ kind: 'dream_better', title: T.actOnTrack(d.name) });
      else out.push({ kind: 'dream_worse', title: T.actWorse(d.name), body: T.actWorseBody, notify: { severity: 'warning', dedupe: `brain_worse_${d.id}_${d.status}_${(d.projectedDate || 'x')}` } });
    } else if (d.projectedDate && p.projectedDate && d.projectedDate !== p.projectedDate) {
      out.push({ kind: d.projectedDate < p.projectedDate ? 'dream_sooner' : 'dream_later', title: d.projectedDate < p.projectedDate ? T.actSooner(d.name, d.projectedDate) : T.actLater(d.name, d.projectedDate) });
    }
    if (d.earmarked > 0 && d.earmarked - (p.earmarked || 0) >= 100000) {
      out.push({ kind: 'earmark', title: T.actEarmark(inr(d.earmarked - (p.earmarked || 0)), d.name) });
    }
  }
  if (prev.free !== 0 && Math.abs(cur.free - prev.free) / Math.max(1, Math.abs(prev.free)) >= 0.1) {
    out.push({ kind: 'free_changed', title: T.actFree(inr(prev.free), inr(cur.free)) });
  }
  const seen = new Set(prev.events);
  for (const e of events) {
    const key = `${e.kind}:${e.month}`;
    if (seen.has(key)) continue;
    out.push({ kind: `event_${e.kind}`, title: e.title, body: e.suggestion, notify: { severity: e.kind === 'salary_drop' ? 'warning' : 'info', dedupe: `brain_event_${key}` } });
  }
  return out;
}

async function userLang(userId: string): Promise<Lang> {
  try { const r = await one<{ language: string }>(`SELECT language FROM users WHERE user_id = $1`, [userId]); return asLang(r?.language); } catch { return 'en'; }
}

export async function brainTick(userId: string, reason: string): Promise<Activity[]> {
  const lang = await userLang(userId);
  const state = await runBrain(userId, lang);
  if (!state) return [];
  const cur = snapshotOf(state);
  const prevRow = await one<{ state: Snapshot }>(`SELECT state FROM brain_snapshots WHERE user_id = $1`, [userId]);
  const acts = diffBrain(prevRow?.state ?? null, cur, lang, state.plan.joyBudget, state.events);
  for (const a of acts) {
    await query(`INSERT INTO brain_activity (user_id, kind, title, body, meta) VALUES ($1,$2,$3,$4,$5)`, [userId, a.kind, a.title, a.body || null, JSON.stringify({ reason })]);
    if (a.notify) {
      await query(
        `INSERT INTO notifications (user_id, kind, category, severity, title, body, action_label, action_href, dedupe_key)
         VALUES ($1,$2,'goal',$3,$4,$5,$6,'/goals',$7) ON CONFLICT (user_id, dedupe_key) DO NOTHING`,
        [userId, `brain_${a.kind}`.slice(0, 40), a.notify.severity, a.title.slice(0, 180), a.body || a.title, M(lang).seePlan, a.notify.dedupe.slice(0, 140)]
      );
    }
  }
  await query(
    `INSERT INTO brain_snapshots (user_id, state, updated_at) VALUES ($1,$2,now())
     ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
    [userId, JSON.stringify(cur)]
  );
  return acts;
}

// Debounced trigger — safe to call from any write path (never throws).
const timers = new Map<string, NodeJS.Timeout>();
export function scheduleBrainTick(userId: string, reason: string, delayMs = 1500): void {
  const t = timers.get(userId);
  if (t) clearTimeout(t);
  timers.set(userId, setTimeout(() => {
    timers.delete(userId);
    brainTick(userId, reason).catch((e) => console.error('[brain] tick failed', e?.message || e));
  }, delayMs));
}

// A dream heard anywhere → a planned dream. Returns null if the text isn't a dream.
export async function captureDream(userId: string, text: string, source: string): Promise<{ goalId: string; dream: DetectedDream; message: string } | null> {
  const lang = await userLang(userId);
  const d = detectDream(text, lang);
  if (!d) return null;
  const T = M(lang);
  // Don't duplicate a dream the user already has.
  const dup = await one(`SELECT goal_id FROM goals WHERE user_id = $1 AND lower(name) = lower($2)`, [userId, d.name]);
  if (dup) return null;
  // Respect the plan's dream limit (Starter has a cap).
  const lim = await one<{ plan: string; c: number }>(`SELECT u.plan, (SELECT COUNT(*)::int FROM goals g WHERE g.user_id = u.user_id) AS c FROM users u WHERE u.user_id = $1`, [userId]);
  const { PLANS } = await import('../../config');
  const cap = (PLANS as any)[lim?.plan || 'starter']?.goalLimit ?? Infinity;
  if (lim && lim.c >= cap) return null;
  let amount = d.amount;
  if (d.kind === 'safety' && amount <= 0) {
    const p = await loadProfileData(userId);
    amount = p ? buildMoneyMap(p).emergencyTarget : 0;
    if (amount <= 0) amount = 30000000; // ₹3L sensible default until spending is known
  }
  const target = ym(new Date(), d.months) + '-01';
  const row = await one<{ goal_id: string }>(
    `INSERT INTO goals (user_id, goal_type, name, target_amount, target_date, current_amount, monthly_contribution, meta)
     VALUES ($1,$2,$3,$4,$5,0,0,$6) RETURNING goal_id`,
    [userId, d.goalType, d.name.slice(0, 100), amount, target, JSON.stringify({ kind: d.kind, priority: d.kind === 'safety' ? 1 : 2, inflation: d.inflation, source, estimated: d.estimated, captured_text: text.slice(0, 200) })]
  );
  const title = T.actCaptured(d.name, inr(amount));
  await query(`INSERT INTO brain_activity (user_id, kind, title, meta) VALUES ($1,'dream_captured',$2,$3)`, [userId, title, JSON.stringify({ source, estimated: d.estimated })]);
  scheduleBrainTick(userId, 'dream_captured', 300);
  const est = d.estimated ? (lang === 'hi' ? ' (अनुमानित — कभी भी बदलें)' : ' (estimated — edit anytime)') : '';
  const message = lang === 'hi'
    ? `✨ मैंने **${d.name}** को आपके सपनों में जोड़ दिया — ${inr(amount)}${est}। आपका प्लान अपने-आप अपडेट हो गया है।`
    : `✨ Added **${d.name}** to your dreams — ${inr(amount)}${est}. Your plan has updated itself.`;
  return { goalId: row!.goal_id, dream: { ...d, amount }, message };
}

export async function recentActivity(userId: string, limit = 12) {
  return query(`SELECT id, kind, title, body, created_at FROM brain_activity WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`, [userId, limit]);
}
