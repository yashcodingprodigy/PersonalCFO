// Dreams engine — the heart of the "money brain". Turns every dream into a plan.
//
// Given the user's Money Map and their dreams (stored as goals), it allocates the
// planable surplus in a fixed, explainable waterfall:
//   1. Safety net (emergency fund) — first claim, capped so dreams still move
//   2. Future-you floor — a little long-term investing if none exists yet
//   3. Joy budget — guilt-free spending money (delight is part of the plan)
//   4. Dreams — by the user's priority, then by how soon they are
// …and for every dream that doesn't fully fit, it finds the levers that turn it
// into a "yes" (use spare cash, trim a spend category, push the date, etc.).
//
// Pure functions only (no DB), deterministic given `now`. Amounts in paise.
// Growth rates are conservative planning assumptions by horizon — NOT a product
// recommendation and not a promise of returns (SEBI lane: education only).

import { MoneyMap } from './cashflow';
import { Lang, M } from './i18n';
import { inrIN } from '../../lib/money';

export type DreamKind = 'experience' | 'purchase' | 'family' | 'safety' | 'growth' | 'milestone';
export type DreamStatus = 'achieved' | 'on_track' | 'stretch' | 'needs_tradeoff';

export interface DreamInput {
  id: string;
  name: string;
  kind: DreamKind;
  priority: 1 | 2 | 3;          // 1 = must-have, 2 = important, 3 = nice-to-have
  targetAmount: number;          // today's money
  targetDate: string | null;     // YYYY-MM-DD; null = flexible (~5 years)
  currentAmount: number;
  monthlyContribution: number;   // what the user says they put aside today
  inflation: number;             // annual, e.g. 0.06
  virtual?: boolean;             // created by the brain (safety net / future you)
}

export interface Lever {
  kind: 'use_cash' | 'joy' | 'trim' | 'extend' | 'reduce' | 'lump_sum' | 'free_up' | 'reprioritise';
  label: string;                 // plain-language, ready to show
  amount?: number;               // paise (per month or one-time, see kind)
  months?: number;
}

export interface PlanItem {
  id: string;
  name: string;
  kind: DreamKind;
  priority: number;
  virtual: boolean;
  months: number;                // months until the target date
  targetDate: string;            // YYYY-MM
  adjustedTarget: number;        // inflation-adjusted amount needed at the date
  need: number;                  // monthly needed to hit it on time
  allocated: number;             // monthly the plan sets aside
  currentContribution: number;
  status: DreamStatus;
  projectedDate: string | null;  // when it completes at the allocated pace
  earmarked: number;             // spare cash the brain set aside for it automatically
  saved: number;                 // already put aside (user's savings + earmarked cash)
  levers: Lever[];
}

export interface DreamPlan {
  hasData: boolean;
  free: number;
  items: PlanItem[];
  joyBudget: number;             // monthly guilt-free money (incl. leftover)
  unallocated: number;           // left after everything (already counted in joyBudget)
  overcommitted: number;         // monthly shortfall summed across dreams
  earmarkedTotal: number;        // spare cash auto-assigned to dreams
  summary: string;
}

export interface PlanOptions {
  now?: Date;
  joyPct?: number;               // share of free cash reserved for joy (default 10%)
  spendByCategory?: { category: string; label: string; monthly: number }[];
  _noSwap?: boolean;             // internal: stop recursion when testing a re-prioritisation
  lang?: Lang;                   // 'en' | 'hi' — language for every generated sentence
  autoEarmark?: boolean;         // auto-assign spare cash above the safety net to dreams (autopilot)
}

// ── maths ──────────────────────────────────────────────────────────────
// Conservative planning growth by horizon (annual, nominal).
export function rateFor(months: number): number {
  if (months <= 12) return 0.06;
  if (months <= 36) return 0.07;
  if (months <= 60) return 0.085;
  return 0.10;
}
// Annuity-due factor (contribution at the start of each month) — same
// convention as goals.ts so numbers agree across the app.
function af(months: number, i: number): number {
  if (months <= 0) return 0;
  if (i === 0) return months;
  return ((Math.pow(1 + i, months) - 1) / i) * (1 + i);
}
export function inflate(amount: number, inflation: number, months: number): number {
  return Math.round(amount * Math.pow(1 + inflation, Math.max(0, months) / 12));
}
export function monthlyNeeded(target: number, current: number, months: number, annualRate: number, inflation: number): number {
  const adj = inflate(target, inflation, months);
  if (months <= 0) return Math.max(0, adj - current);
  const i = annualRate / 12;
  const still = Math.max(0, adj - current * Math.pow(1 + i, months));
  return Math.ceil(still / af(months, i));
}
// First month at which `monthly` (+ current, growing) reaches the inflating target.
export function monthsToReach(target: number, current: number, monthly: number, inflation: number, maxMonths = 600): number | null {
  if (current >= target) return 0;
  if (monthly <= 0) return null;
  for (let m = 1; m <= maxMonths; m++) {
    const i = rateFor(m) / 12;
    const value = current * Math.pow(1 + i, m) + monthly * af(m, i);
    if (value >= inflate(target, inflation, m)) return m;
  }
  return null;
}
// What target is reachable in `months` with `monthly` (in today's money).
function reachableTarget(current: number, monthly: number, months: number, inflation: number): number {
  const i = rateFor(months) / 12;
  const fv = current * Math.pow(1 + i, months) + monthly * af(months, i);
  return Math.floor(fv / Math.pow(1 + inflation, months / 12));
}

export function monthsBetween(now: Date, isoDate: string | null): number {
  if (!isoDate) return 60;
  const d = new Date(isoDate + (isoDate.length === 10 ? 'T00:00:00' : ''));
  if (isNaN(d.getTime())) return 60;
  return Math.max(0, (d.getFullYear() - now.getFullYear()) * 12 + (d.getMonth() - now.getMonth()));
}
export function ym(now: Date, addMonths: number): string {
  const d = new Date(now.getFullYear(), now.getMonth() + addMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function prettyYm(s: string): string { const [y, m] = s.split('-'); return `${MONTHS[Number(m) - 1]} ${y}`; }
export function inr(paise: number): string {
  return inrIN(paise);
}

// ── goal → dream mapping (dreams live in the existing goals table) ────────
const KIND_BY_TYPE: Record<string, DreamKind> = {
  emergency_fund: 'safety', home_purchase: 'purchase', car_purchase: 'purchase',
  child_education: 'family', retirement: 'growth', debt_free: 'milestone', custom: 'experience',
};
// pg returns DATE columns as JS Date objects (local midnight); API/tests pass strings.
export function toIsoDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
export function goalToDream(g: any): DreamInput {
  const meta = g.meta || {};
  const kind: DreamKind = (meta.kind as DreamKind) || KIND_BY_TYPE[g.goal_type] || 'experience';
  const pr = Number(meta.priority);
  return {
    id: String(g.goal_id ?? g.id),
    name: String(g.name),
    kind,
    priority: (pr === 1 || pr === 2 || pr === 3 ? pr : kind === 'safety' ? 1 : 2) as 1 | 2 | 3,
    targetAmount: Number(g.target_amount) || 0,
    targetDate: toIsoDate(g.target_date),
    currentAmount: Number(g.current_amount) || 0,
    monthlyContribution: Number(g.monthly_contribution) || 0,
    inflation: Number.isFinite(Number(meta.inflation)) ? Number(meta.inflation) : 0,
  };
}

// Cascade projection: when a dream completes, its monthly money flows to the
// next unfinished dream (in plan order). Gives realistic "done by" dates instead
// of assuming a dream is stuck at its starting allocation forever.
function cascade(order: { id: string; target: number; current: number; inflation: number; months: number; alloc: number }[], maxMonths = 480): Map<string, number | null> {
  const st = order.map((o) => ({ ...o, value: o.current, done: o.current >= o.target ? 0 : (null as number | null) }));
  for (let m = 1; m <= maxMonths && st.some((x) => x.done == null); m++) {
    for (const x of st) {
      if (x.done != null) continue;
      const i = rateFor(x.months) / 12;
      x.value = (x.value + x.alloc) * (1 + i);
      if (x.value >= inflate(x.target, x.inflation, m)) {
        x.done = m;
        const next = st.find((y) => y.done == null);
        if (next) next.alloc += x.alloc;
        x.alloc = 0;
      }
    }
  }
  return new Map(st.map((x) => [x.id, x.done]));
}

// ── the planner ─────────────────────────────────────────────────────────
export function planDreams(map: MoneyMap, dreams: DreamInput[], opt: PlanOptions = {}): DreamPlan {
  const now = opt.now || new Date();
  const T = M(opt.lang || 'en');
  const joyPct = opt.joyPct ?? 0.10;
  const free = map.free;
  let remaining = Math.max(0, free);

  // Autopilot earmarking: spare cash above the safety net is quietly assigned to
  // dreams (must-haves first, then soonest) so progress reflects real balances
  // without the user typing "saved so far" anywhere.
  const earmark = new Map<string, number>();
  const realCopy = dreams.map((d) => ({ ...d }));
  if (opt.autoEarmark && map.excessCash > 0) {
    let pool = map.excessCash;
    const order = realCopy.filter((d) => d.kind !== 'safety')
      .map((d) => ({ d, months: Math.max(0, monthsBetween(now, d.targetDate)) }))
      .sort((a, b) => a.d.priority - b.d.priority || a.months - b.months);
    for (const { d, months } of order) {
      if (pool <= 0) break;
      const gapNow = Math.max(0, inflate(d.targetAmount, d.inflation, months) - d.currentAmount);
      const share = Math.min(pool, gapNow);
      if (share > 0) { d.currentAmount += share; earmark.set(d.id, share); pool -= share; }
    }
  }
  const earmarkedTotal = [...earmark.values()].reduce((a, b) => a + b, 0);

  const all: DreamInput[] = [...realCopy];
  const hasSafetyDream = dreams.some((d) => d.kind === 'safety');
  if (!hasSafetyDream && map.emergencyGap > 0 && map.expenses > 0) {
    all.push({
      id: 'virtual-safety', name: T.safetyName, kind: 'safety', priority: 1,
      targetAmount: map.emergencyTarget, targetDate: ym(now, 12) + '-01', currentAmount: Math.min(map.liquid, map.emergencyTarget),
      monthlyContribution: 0, inflation: 0, virtual: true,
    });
  }
  const hasGrowth = dreams.some((d) => d.kind === 'growth');
  const futureFloor = !hasGrowth && map.currentSip <= 0 && free > 0 ? Math.round(free * 0.10) : 0;

  const items: PlanItem[] = [];
  const mk = (d: DreamInput): PlanItem => {
    const months = Math.max(0, monthsBetween(now, d.targetDate));
    const rate = rateFor(months);
    const adjusted = inflate(d.targetAmount, d.inflation, months);
    return {
      id: d.id, name: d.name, kind: d.kind, priority: d.priority, virtual: !!d.virtual,
      months, targetDate: ym(now, months), adjustedTarget: adjusted,
      need: d.currentAmount >= adjusted ? 0 : monthlyNeeded(d.targetAmount, d.currentAmount, months, rate, d.inflation),
      allocated: 0, currentContribution: d.monthlyContribution, status: 'needs_tradeoff', projectedDate: null,
      earmarked: earmark.get(d.id) || 0, saved: d.currentAmount, levers: [],
    };
  };

  // 1. safety first (capped at 50% of free so life doesn't stop)
  for (const d of all.filter((x) => x.kind === 'safety')) {
    const it = mk(d);
    it.allocated = Math.min(it.need, Math.round(Math.max(0, free) * 0.5), remaining);
    remaining -= it.allocated; items.push(it);
  }
  // 2. future-you floor
  if (futureFloor > 0) {
    const amt = Math.min(futureFloor, remaining);
    remaining -= amt;
    items.push({
      id: 'virtual-future', name: T.futureName, kind: 'growth', priority: 2, virtual: true,
      months: 0, targetDate: ym(now, 0), adjustedTarget: 0, need: futureFloor, allocated: amt, currentContribution: 0,
      status: amt >= futureFloor ? 'on_track' : 'stretch', projectedDate: null, earmarked: 0, saved: 0, levers: [],
    });
  }
  // 3. joy budget
  const joyBase = Math.min(Math.round(Math.max(0, free) * joyPct), remaining);
  remaining -= joyBase;
  // 4. dreams by priority, then soonest
  const rest = all.filter((x) => x.kind !== 'safety')
    .map(mk)
    .sort((a, b) => a.priority - b.priority || a.months - b.months || a.need - b.need);
  for (const it of rest) { it.allocated = Math.min(it.need, remaining); remaining -= it.allocated; items.push(it); }

  // statuses, projections, levers
  const spend = (opt.spendByCategory || []).filter((c) => ['food_dining', 'shopping', 'entertainment'].includes(c.category))
    .sort((a, b) => b.monthly - a.monthly);
  let cashLeft = map.excessCash - earmarkedTotal;
  const order = items.filter((x) => x.id !== 'virtual-future').map((x) => {
    const d = all.find((y) => y.id === x.id)!;
    return { id: x.id, target: d.targetAmount, current: d.currentAmount, inflation: d.inflation, months: x.months, alloc: x.allocated };
  });
  const done = cascade(order);
  for (const it of items) {
    if (it.id === 'virtual-future') continue;
    const src = all.find((d) => d.id === it.id)!;
    if (src.currentAmount >= it.adjustedTarget && it.adjustedTarget > 0) { it.status = 'achieved'; it.need = 0; it.projectedDate = ym(now, 0); continue; }
    it.status = it.allocated >= it.need * 0.98 ? 'on_track' : it.allocated >= it.need * 0.7 ? 'stretch' : 'needs_tradeoff';
    const pm = monthsToReach(src.targetAmount, src.currentAmount, it.allocated, src.inflation);
    const cm = done.get(it.id);
    it.projectedDate = cm == null ? null : ym(now, cm);
    const short = it.need - it.allocated;
    if (short <= 0) continue;
    const i = rateFor(it.months) / 12;
    const lump = Math.ceil((short * af(it.months, i)) / Math.pow(1 + i, it.months));
    if (free <= 0) it.levers.push({ kind: 'free_up', label: T.freeUp });
    if (cashLeft >= lump && lump > 0) {
      it.levers.push({ kind: 'use_cash', amount: lump, label: T.useCash(inr(lump)) });
      cashLeft -= lump;
    }
    if (joyBase >= short) it.levers.push({ kind: 'joy', amount: short, label: T.joy(inr(short)) });
    const cat = spend.find((c) => short <= c.monthly * 0.35);
    if (cat) it.levers.push({ kind: 'trim', amount: short, label: T.trim(inr(short), cat.category, cat.label, Math.round((short / cat.monthly) * 100)) });
    if (it.allocated > 0 && pm != null && pm > it.months) it.levers.push({ kind: 'extend', months: pm - it.months, label: T.extend(ym(now, pm), pm - it.months, inr(it.allocated)) });
    if (it.allocated > 0 && it.months > 0) {
      const t = reachableTarget(src.currentAmount, it.allocated, it.months, src.inflation);
      if (t > 0 && t < src.targetAmount) it.levers.push({ kind: 'reduce', amount: t, label: T.reduce(inr(t)) });
    }
    if (lump > 0 && !it.levers.some((l) => l.kind === 'use_cash')) it.levers.push({ kind: 'lump_sum', amount: lump, label: T.lump(inr(lump)) });
    // Re-prioritise: what if this dream went first? Show exactly what moves.
    if (!opt._noSwap && !it.virtual && it.priority > 1 && dreams.length > 1) {
      const swapped = dreams.map((d) => (d.id === it.id ? { ...d, priority: 1 as const } : d));
      const alt = planDreams(map, swapped, { ...opt, _noSwap: true });
      const me = alt.items.find((x) => x.id === it.id);
      if (me && me.allocated > it.allocated && (me.status === 'on_track' || me.status === 'stretch')) {
        const slips = alt.items.filter((x) => !x.virtual && x.id !== it.id).map((x) => {
          const was = items.find((y) => y.id === x.id);
          return { name: x.name, before: was?.projectedDate ?? null, after: x.projectedDate };
        }).filter((x) => x.after !== x.before);
        const tail = slips.length ? ' — ' + slips.map((x) => T.slip(x.name, x.after)).join(', ') : '';
        it.levers.push({ kind: 'reprioritise', label: T.reprioritise(it.name, tail) });
      }
    }
  }

  const overcommitted = items.reduce((s, it) => s + Math.max(0, it.need - it.allocated), 0);
  const unallocated = Math.max(0, remaining);
  const joyBudget = joyBase + unallocated;
  const realDreams = items.filter((i) => !i.virtual);
  const onTrack = realDreams.filter((i) => i.status === 'on_track' || i.status === 'achieved').length;
  const summary = !map.hasData ? T.sumNoData
    : free <= 0 ? T.sumOverspend(inr(map.takeHome))
      : realDreams.length === 0 ? T.sumNoDreams(inr(free))
        : T.sum(onTrack, realDreams.length, inr(joyBudget));

  return { hasData: map.hasData, free, items, joyBudget, unallocated, overcommitted, earmarkedTotal, summary };
}

// ── “Can I afford it?” ──────────────────────────────────────────────────
export interface AffordResult {
  verdict: 'yes_now' | 'yes_by' | 'stretch' | 'not_yet' | 'need_data';
  headline: string;
  monthly: number | null;
  date: string | null;           // YYYY-MM
  cashToday: number;
  affects: { name: string; from: DreamStatus; to: DreamStatus; newDate: string | null }[];
  levers: Lever[];
}

export function affordCheck(map: MoneyMap, dreams: DreamInput[], cost: number, opt: PlanOptions & { months?: number | null; label?: string } = {}): AffordResult {
  const now = opt.now || new Date();
  const T = M(opt.lang || 'en');
  const label = !opt.label || opt.label === 'this' ? T.thisThing : opt.label;
  if (!map.hasData) return { verdict: 'need_data', headline: T.affNeedData, monthly: null, date: null, cashToday: 0, affects: [], levers: [] };
  if (cost <= 0) return { verdict: 'yes_now', headline: T.affFree, monthly: 0, date: ym(now, 0), cashToday: map.excessCash, affects: [], levers: [] };

  const before = planDreams(map, dreams, opt);
  const freeCash = map.excessCash - before.earmarkedTotal;
  if (freeCash >= cost) {
    return { verdict: 'yes_now', headline: T.affYesNow(label, inr(freeCash)), monthly: 0, date: ym(now, 0), cashToday: freeCash, affects: [], levers: [] };
  }
  if (map.excessCash >= cost) {
    // Affordable today only by dipping into money the autopilot set aside for dreams.
    const names = before.items.filter((i) => i.earmarked > 0).map((i) => i.name);
    return { verdict: 'stretch', headline: T.affUsesEarmark(label, names.join(', ')), monthly: 0, date: ym(now, 0), cashToday: map.excessCash, affects: [], levers: [] };
  }

  const statusOf = (p: DreamPlan) => new Map(p.items.filter((i) => !i.virtual).map((i) => [i.id, i.status]));
  const beforeS = statusOf(before);
  const order: Record<DreamStatus, number> = { achieved: 0, on_track: 1, stretch: 2, needs_tradeoff: 3 };
  const tryMonths = (m: number) => {
    const probe: DreamInput = { id: 'afford-probe', name: label, kind: 'purchase', priority: 2, targetAmount: cost, targetDate: ym(now, m) + '-01', currentAmount: 0, monthlyContribution: 0, inflation: 0 };
    const plan = planDreams(map, [...dreams, probe], opt);
    const item = plan.items.find((i) => i.id === 'afford-probe')!;
    const after = statusOf(plan);
    const affects = [...beforeS.entries()]
      .filter(([id, s]) => order[after.get(id) ?? s] > order[s])
      .map(([id, s]) => { const x = plan.items.find((i) => i.id === id)!; return { name: x.name, from: s, to: after.get(id)!, newDate: x.projectedDate }; });
    return { item, affects };
  };
  const slipText = (affects: AffordResult['affects']) => affects.map((a) => T.slipShort(a.name, a.newDate)).join(', ');

  if (opt.months != null && opt.months > 0) {
    const { item, affects } = tryMonths(opt.months);
    const date = item.targetDate;
    if (item.status === 'on_track' && affects.length === 0)
      return { verdict: 'yes_by', headline: T.affYesBy(date, inr(item.need)), monthly: item.need, date, cashToday: map.excessCash, affects, levers: [] };
    if (item.status === 'on_track' || item.status === 'stretch')
      return { verdict: 'stretch', headline: T.affStretch(date, inr(item.need), slipText(affects)), monthly: item.need, date, cashToday: map.excessCash, affects, levers: item.levers };
    return { verdict: 'not_yet', headline: T.affNotBy(date), monthly: item.need, date, cashToday: map.excessCash, affects, levers: item.levers };
  }

  // No date given: find the earliest month that fits without hurting other dreams.
  for (let m = 1; m <= 120; m++) {
    const { item, affects } = tryMonths(m);
    if (item.status === 'on_track' && affects.length === 0)
      return { verdict: 'yes_by', headline: T.affYesBy(item.targetDate, inr(item.need)), monthly: item.need, date: item.targetDate, cashToday: map.excessCash, affects: [], levers: [] };
  }
  // Nothing fits cleanly: earliest date it fits if other dreams give way a little.
  for (let m = 1; m <= 120; m++) {
    const { item, affects } = tryMonths(m);
    if (item.status === 'on_track')
      return { verdict: 'stretch', headline: T.affStretch(item.targetDate, inr(item.need), slipText(affects)), monthly: item.need, date: item.targetDate, cashToday: map.excessCash, affects, levers: [] };
  }
  const { item, affects } = tryMonths(24);
  return { verdict: 'not_yet', headline: T.affNotYet(label), monthly: item.need, date: null, cashToday: map.excessCash, affects, levers: item.levers };
}
