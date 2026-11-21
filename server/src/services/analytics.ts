// Product analytics (D-69, Nov 2026) — the smallest thing that answers the investor-day questions:
// "how many people signed up, how many planned a dream, how many acted on a next move, and how fast?"
// Server-side only (no third-party SDK, no cookies, no PII beyond the user id we already hold), so it is
// DPDP-friendly and cannot be blocked by ad-blockers. Events are fire-and-forget: tracking never breaks a request.
//
//   track(userId, 'dream_added')            → one row per occurrence (counts / activity)
//   trackFirst(userId, 'first_dream')       → at most one row per user (funnel milestones; unique index)
//
// Demo/persona accounts (+91900000000x) are excluded from the funnel query, not from logging.
import { query } from '../db';

export type FunnelEvent = 'signup' | 'first_dream' | 'first_move_done';
export type ActivityEvent = 'login' | 'dream_added' | 'move_done';
export const FUNNEL_EVENTS: FunnelEvent[] = ['signup', 'first_dream', 'first_move_done'];

export function track(userId: string | undefined | null, event: ActivityEvent | FunnelEvent, meta: Record<string, unknown> = {}): void {
  if (!userId) return;
  query(`INSERT INTO product_events (user_id, event, meta) VALUES ($1, $2, $3)`, [userId, event, JSON.stringify(meta)])
    .catch((e) => console.warn('[analytics] track failed', event, e?.message));
}

/** Records a funnel milestone once per user (later calls are no-ops thanks to the partial unique index). */
export function trackFirst(userId: string | undefined | null, event: FunnelEvent, meta: Record<string, unknown> = {}): void {
  if (!userId) return;
  query(
    `INSERT INTO product_events (user_id, event, meta) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [userId, event, JSON.stringify(meta)],
  ).catch((e) => console.warn('[analytics] trackFirst failed', event, e?.message));
}

export interface MilestoneRow { user_id: string; event: string; at: string | Date }
export interface Funnel {
  signups: number;
  firstDream: number;
  firstMoveDone: number;
  dreamRate: number;            // % of signups who planned at least one dream
  moveRate: number;             // % of signups who completed at least one next move
  moveWithin7dRate: number;     // % of signups who completed a move within 7 days of signing up (the one metric)
  medianHoursToFirstDream: number | null;
  medianHoursToFirstMove: number | null;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  const v = s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  return Math.round(v * 10) / 10;
}

/** Pure: turns milestone rows into the funnel. Only users with a `signup` row count (the cohort). */
export function computeFunnel(rows: MilestoneRow[]): Funnel {
  const byUser = new Map<string, Partial<Record<FunnelEvent, number>>>();
  for (const r of rows) {
    if (!FUNNEL_EVENTS.includes(r.event as FunnelEvent)) continue;
    const t = new Date(r.at).getTime();
    if (!Number.isFinite(t)) continue;
    const u = byUser.get(r.user_id) || {};
    const k = r.event as FunnelEvent;
    if (u[k] == null || t < u[k]!) u[k] = t;
    byUser.set(r.user_id, u);
  }
  let signups = 0, firstDream = 0, firstMoveDone = 0, within7 = 0;
  const hDream: number[] = [], hMove: number[] = [];
  for (const u of byUser.values()) {
    if (u.signup == null) continue;
    signups++;
    if (u.first_dream != null) { firstDream++; hDream.push(Math.max(0, (u.first_dream - u.signup) / 3.6e6)); }
    if (u.first_move_done != null) {
      firstMoveDone++;
      const h = Math.max(0, (u.first_move_done - u.signup) / 3.6e6);
      hMove.push(h);
      if (h <= 24 * 7) within7++;
    }
  }
  return {
    signups, firstDream, firstMoveDone,
    dreamRate: pct(firstDream, signups),
    moveRate: pct(firstMoveDone, signups),
    moveWithin7dRate: pct(within7, signups),
    medianHoursToFirstDream: median(hDream),
    medianHoursToFirstMove: median(hMove),
  };
}

/** Reads milestones for real users who signed up in the last `days` days (demo personas excluded). */
export async function loadFunnel(days = 90): Promise<Funnel & { days: number; activeLast7d: number }> {
  const d = Math.max(1, Math.min(3650, Math.floor(days)));
  const rows = await query<MilestoneRow>(
    `SELECT e.user_id, e.event, e.created_at AS at
       FROM product_events e JOIN users u ON u.user_id = e.user_id
      WHERE e.event = ANY($1)
        AND u.deleted_at IS NULL
        AND (u.mobile IS NULL OR u.mobile NOT LIKE '+9190000000%')
        AND e.user_id IN (SELECT user_id FROM product_events WHERE event = 'signup' AND created_at > now() - ($2 || ' days')::interval)`,
    [FUNNEL_EVENTS, String(d)],
  );
  const active = await query<{ n: string }>(
    `SELECT count(DISTINCT e.user_id) AS n FROM product_events e JOIN users u ON u.user_id = e.user_id
      WHERE e.created_at > now() - interval '7 days' AND (u.mobile IS NULL OR u.mobile NOT LIKE '+9190000000%')`,
  );
  return { ...computeFunnel(rows), days: d, activeLast7d: Number(active[0]?.n || 0) };
}
