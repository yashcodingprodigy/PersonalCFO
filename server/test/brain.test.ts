// Money Brain tests — money map, dreams planner, "can I afford it?", life events,
// next-moves ranking. Pure functions, fixed clock. Run: npx tsx test/brain.test.ts
import assert from 'assert';
import { ProfileData } from '../src/services/score';
import { buildMoneyMap } from '../src/services/brain/cashflow';
import { planDreams, affordCheck, monthlyNeeded, monthsToReach, goalToDream, DreamInput, rateFor } from '../src/services/brain/dreams';
import { detectLifeEvents, Txn } from '../src/services/brain/lifeEvents';
import { buildNextMoves } from '../src/services/brain/nextMoves';
import { generateActions } from '../src/services/actions';
import { parseAffordIntent } from '../src/services/cfo-ai';
import { generateAlerts } from '../src/services/alerts';
import { computeScore } from '../src/services/score';
import { detectDream, parseRupees, parseMonths, catalogLocalName } from '../src/services/brain/dreamCapture';
import { diffBrain, Snapshot } from '../src/services/brain/autopilot';
import { tableGuide } from '../src/services/brain/priceGuide';
import { inrIN, inrRangeIN } from '../src/lib/money';

let passed = 0, failed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
const R = (r: number) => r * 100;               // rupees → paise
const NOW = new Date(2026, 9, 1);               // 1 Oct 2026
function profile(o: any = {}): ProfileData {
  return {
    user: { annual_gross_income: R(12_00_000), monthly_take_home: R(80_000), dependents_count: 0, age: 26, employment_type: 'salaried', ...(o.user || {}) },
    assets: o.assets ?? { savings_balance: R(3_00_000), mutual_funds: { monthly_sip: R(5_000) } },
    liabilities: o.liabilities || {}, insurance: o.insurance || {}, tax_data: o.tax_data || {},
    monthlyExpenses: o.monthlyExpenses === undefined ? R(45_000) : o.monthlyExpenses,
  } as ProfileData;
}
const dream = (o: Partial<DreamInput>): DreamInput => ({
  id: o.id || 'd1', name: o.name || 'Goa trip', kind: o.kind || 'experience', priority: o.priority || 2,
  targetAmount: o.targetAmount ?? R(60_000), targetDate: o.targetDate === undefined ? '2027-04-01' : o.targetDate,
  currentAmount: o.currentAmount ?? 0, monthlyContribution: o.monthlyContribution ?? 0, inflation: o.inflation ?? 0,
});

console.log('\nMONEY MAP');
check('free = take-home − expenses − SIP; safety net = 6× spending', () => {
  const m = buildMoneyMap(profile());
  assert.strictEqual(m.free, R(80_000 - 45_000 - 5_000));
  assert.strictEqual(m.emergencyTarget, R(45_000) * 6);
  assert.strictEqual(m.emergencyGap, R(2_70_000) - R(3_00_000) < 0 ? 0 : R(2_70_000) - R(3_00_000));
  assert.strictEqual(m.excessCash, R(30_000));
});
check('students need a 3-month safety net', () => {
  assert.strictEqual(buildMoneyMap(profile({ user: { employment_type: 'student' } })).emergencyMonths, 3);
});
check('missing income/spending → hasData false', () => {
  assert.strictEqual(buildMoneyMap(profile({ user: { monthly_take_home: 0 } })).hasData, false);
  assert.strictEqual(buildMoneyMap(profile({ monthlyExpenses: null })).hasData, false);
});

console.log('\nPLANNING MATHS');
check('₹1.2L in 12 months at 6% ≈ ₹9.6–9.75k/month (annuity-due)', () => {
  const m = monthlyNeeded(R(1_20_000), 0, 12, 0.06, 0) / 100;
  assert(m > 9600 && m < 9750, `got ${m}`);
});
check('inflation raises what you need', () => {
  assert(monthlyNeeded(R(10_00_000), 0, 60, 0.085, 0.06) > monthlyNeeded(R(10_00_000), 0, 60, 0.085, 0));
});
check('existing savings reduce the monthly need', () => {
  assert(monthlyNeeded(R(1_00_000), R(50_000), 24, 0.07, 0) < monthlyNeeded(R(1_00_000), 0, 24, 0.07, 0));
});
check('paying the computed need reaches the target on time (round-trip)', () => {
  for (const months of [6, 18, 48, 120]) {
    const need = monthlyNeeded(R(5_00_000), 0, months, rateFor(months), 0.05);
    const m = monthsToReach(R(5_00_000), 0, need, 0.05)!;
    assert(m <= months + 1, `months ${months} → reached at ${m}`);
  }
});
check('zero contribution never reaches', () => assert.strictEqual(monthsToReach(R(1_000), 0, 0, 0), null));

console.log('\nDREAMS PLANNER');
check('affordable dream is on track; joy budget is reserved', () => {
  const plan = planDreams(buildMoneyMap(profile()), [dream({})], { now: NOW });
  const it = plan.items.find((i) => i.id === 'd1')!;
  assert.strictEqual(it.status, 'on_track');
  assert(plan.joyBudget >= Math.round(plan.free * 0.10) - 1);
});
check('safety net comes first (virtual) and is capped at 50% of free cash', () => {
  const p = profile({ assets: { savings_balance: R(20_000) } });
  const map = buildMoneyMap(p);
  const plan = planDreams(map, [dream({})], { now: NOW });
  const safety = plan.items.find((i) => i.id === 'virtual-safety')!;
  assert(safety, 'virtual safety item exists');
  assert.strictEqual(plan.items[0].id, 'virtual-safety');
  assert(safety.allocated <= Math.round(map.free * 0.5));
});
check('no virtual safety when the user already has an emergency-fund dream', () => {
  const plan = planDreams(buildMoneyMap(profile({ assets: { savings_balance: 0 } })), [dream({ id: 'e', kind: 'safety', name: 'Emergency fund', targetAmount: R(2_00_000) })], { now: NOW });
  assert(!plan.items.some((i) => i.id === 'virtual-safety'));
});
check('must-have (priority 1) dreams get funded before nice-to-haves', () => {
  const map = buildMoneyMap(profile({ assets: { savings_balance: R(3_00_000) } }));
  const plan = planDreams(map, [
    dream({ id: 'nice', name: 'New phone', priority: 3, targetAmount: R(2_00_000), targetDate: '2027-04-01' }),
    dream({ id: 'must', name: 'Mom’s health cover', priority: 1, targetAmount: R(2_00_000), targetDate: '2027-10-01' }),
  ], { now: NOW });
  const must = plan.items.find((i) => i.id === 'must')!, nice = plan.items.find((i) => i.id === 'nice')!;
  assert(must.allocated / must.need >= nice.allocated / Math.max(1, nice.need));
});
check('oversized dream → needs_tradeoff with concrete levers', () => {
  const plan = planDreams(buildMoneyMap(profile()), [dream({ name: 'Car', targetAmount: R(15_00_000), targetDate: '2027-10-01' })], {
    now: NOW, spendByCategory: [{ category: 'food_dining', label: 'Food & dining', monthly: R(12_000) }],
  });
  const it = plan.items.find((i) => i.id === 'd1')!;
  assert.strictEqual(it.status, 'needs_tradeoff');
  assert(it.levers.some((l) => l.kind === 'extend'), 'offers a later date');
  assert(it.levers.some((l) => l.kind === 'reduce'), 'offers a smaller target');
  assert(plan.overcommitted > 0);
});
check('spare cash above the safety net is offered as a lever', () => {
  const map = buildMoneyMap(profile({ assets: { savings_balance: R(10_00_000) } }));
  const plan = planDreams(map, [dream({ targetAmount: R(4_00_000), targetDate: '2027-04-01' })], { now: NOW });
  assert(plan.items.find((i) => i.id === 'd1')!.levers.some((l) => l.kind === 'use_cash'));
});
check('dream already saved for → achieved', () => {
  const plan = planDreams(buildMoneyMap(profile()), [dream({ currentAmount: R(70_000) })], { now: NOW });
  assert.strictEqual(plan.items.find((i) => i.id === 'd1')!.status, 'achieved');
});
check('overspending (free ≤ 0) → honest summary + free-up lever', () => {
  const plan = planDreams(buildMoneyMap(profile({ monthlyExpenses: R(90_000) })), [dream({})], { now: NOW });
  assert(/uses all/.test(plan.summary));
  assert(plan.items.find((i) => i.id === 'd1')!.levers.some((l) => l.kind === 'free_up'));
});
check('allocations never exceed free cash', () => {
  const map = buildMoneyMap(profile());
  const plan = planDreams(map, [dream({ id: 'a', targetAmount: R(9_00_000) }), dream({ id: 'b', targetAmount: R(5_00_000) }), dream({ id: 'c', targetAmount: R(3_00_000) })], { now: NOW });
  const total = plan.items.reduce((s, i) => s + i.allocated, 0) + plan.joyBudget;
  assert(total <= map.free, `${total} > ${map.free}`);
});
check('money flows to the next dream once one completes (cascade dates)', () => {
  const map = buildMoneyMap(profile());
  const plan = planDreams(map, [dream({ id: 'car', name: 'Car', priority: 2, targetAmount: R(8_00_000), targetDate: '2028-10-01', inflation: 0.04 }), dream({ id: 'goa', priority: 3, targetAmount: R(1_50_000) })], { now: NOW });
  const goa = plan.items.find((i) => i.id === 'goa')!;
  assert.strictEqual(goa.allocated, 0);
  assert(goa.projectedDate && goa.projectedDate > plan.items.find((i) => i.id === 'car')!.projectedDate!, 'goa completes after car frees up money');
  assert(goa.levers.some((l) => l.kind === 'reprioritise' && /Car moves to/.test(l.label)), 'offers to swap priorities and shows the trade-off');
});
check('pg Date objects and bad dates are handled (no NaN plans)', () => {
  const d = goalToDream({ goal_id: 'z', goal_type: 'custom', name: 'X', target_amount: '6000000', target_date: new Date(2027, 3, 1), current_amount: '0', monthly_contribution: '0', meta: {} });
  assert.strictEqual(d.targetDate, '2027-04-01');
  assert.strictEqual(goalToDream({ goal_id: 'q', goal_type: 'custom', name: 'Y', target_amount: 1, target_date: 'garbage' }).targetDate, null);
  const plan = planDreams(buildMoneyMap(profile()), [d], { now: NOW });
  assert(Number.isFinite(plan.joyBudget) && plan.items.every((i) => Number.isFinite(i.need) && Number.isFinite(i.allocated)));
});
check('goal rows map to dreams (type → kind, meta priority)', () => {
  const d = goalToDream({ goal_id: 'x', goal_type: 'emergency_fund', name: 'EF', target_amount: '100', target_date: null, current_amount: 0, monthly_contribution: 0, meta: {} });
  assert.strictEqual(d.kind, 'safety'); assert.strictEqual(d.priority, 1);
  const c = goalToDream({ goal_id: 'y', goal_type: 'custom', name: 'Seoul', target_amount: 5, meta: { kind: 'experience', priority: 3 } });
  assert.strictEqual(c.kind, 'experience'); assert.strictEqual(c.priority, 3);
});

console.log('\nCAN I AFFORD IT?');
check('cash above safety net covers it → yes_now', () => {
  const r = affordCheck(buildMoneyMap(profile()), [], R(20_000), { now: NOW, label: 'a phone' });
  assert.strictEqual(r.verdict, 'yes_now');
});
check('no date given → earliest month that fits without hurting other dreams', () => {
  const r = affordCheck(buildMoneyMap(profile()), [dream({})], R(1_00_000), { now: NOW, label: 'a bike' });
  assert.strictEqual(r.verdict, 'yes_by'); assert(r.date && r.monthly! > 0);
});
check('too big → not_yet with levers', () => {
  const r = affordCheck(buildMoneyMap(profile()), [], R(50_00_000), { now: NOW, label: 'a flat', months: 12 });
  assert.strictEqual(r.verdict, 'not_yet'); assert(r.levers.length > 0);
});
check('flags dreams it would squeeze', () => {
  const map = buildMoneyMap(profile());
  const goa = dream({ id: 'goa', priority: 3, targetAmount: R(1_50_000), targetDate: '2027-04-01' });
  const r = affordCheck(map, [goa], R(2_00_000), { now: NOW, label: 'a laptop', months: 6 });
  assert(r.affects.some((a) => a.name === 'Goa trip') || r.verdict === 'not_yet', JSON.stringify(r));
});
check('no data → need_data', () => {
  assert.strictEqual(affordCheck(buildMoneyMap(profile({ user: { monthly_take_home: 0 } })), [], R(1_000)).verdict, 'need_data');
});

console.log('\nLIFE EVENTS');
const sal = (d: string, a: number): Txn => ({ date: d, amount: R(a), direction: 'credit', category: 'salary', description: 'SALARY ACME' });
check('salary hike ≥10% detected', () => {
  const ev = detectLifeEvents([sal('2026-06-01', 80000), sal('2026-07-01', 80000), sal('2026-08-01', 80000), sal('2026-09-01', 95000)], R(80000));
  assert(ev.some((e) => e.kind === 'salary_hike'));
});
check('steady salary → no hike/drop', () => {
  const ev = detectLifeEvents([sal('2026-07-01', 80000), sal('2026-08-01', 80000), sal('2026-09-01', 81000)], R(80000));
  assert(!ev.some((e) => e.kind === 'salary_hike' || e.kind === 'salary_drop'));
});
check('bonus / large credit detected', () => {
  const ev = detectLifeEvents([sal('2026-08-01', 80000), { date: '2026-09-15', amount: R(1_00_000), direction: 'credit', category: 'unknown', description: 'ANNUAL BONUS' }, sal('2026-09-01', 80000)], R(80000));
  assert(ev.some((e) => e.kind === 'bonus'));
});
check('new EMI detected; recurring EMI is not', () => {
  const emi = (d: string, desc: string): Txn => ({ date: d, amount: R(12000), direction: 'debit', category: 'emi', description: desc });
  assert(detectLifeEvents([emi('2026-08-05', 'HDFC CAR LOAN'), emi('2026-09-05', 'BAJAJ EMI 22')], R(80000)).some((e) => e.kind === 'new_emi'));
  assert(!detectLifeEvents([emi('2026-08-05', 'HDFC CAR LOAN'), emi('2026-09-05', 'HDFC CAR LOAN')], R(80000)).some((e) => e.kind === 'new_emi'));
});
check('big one-off purchase detected', () => {
  const ev = detectLifeEvents([sal('2026-09-01', 80000), { date: '2026-09-20', amount: R(60_000), direction: 'debit', category: 'shopping', description: 'APPLE STORE' }], R(80000));
  assert(ev.some((e) => e.kind === 'big_purchase'));
});
check('no transactions → no events', () => assert.deepStrictEqual(detectLifeEvents([], R(80000)), []));

console.log('\nNEXT MOVES');
check('urgent alert ranks first; list is capped', () => {
  const p = profile({ assets: { savings_balance: R(10_000) } });
  const map = buildMoneyMap(p);
  const plan = planDreams(map, [dream({})], { now: NOW });
  const moves = buildNextMoves({
    map, plan, actions: generateActions(p), events: [], now: NOW, limit: 5,
    alerts: [{ kind: 'advance_tax', category: 'tax', severity: 'urgent', title: 'Advance tax due', body: 'Pay now', dueDate: '2026-10-05', dedupeKey: 'x' }],
  });
  assert.strictEqual(moves[0].source, 'alert');
  assert(moves.length <= 5);
});
check('safety-net move replaces the duplicate emergency-fund action', () => {
  const p = profile({ assets: { savings_balance: R(10_000) } });
  const map = buildMoneyMap(p);
  const plan = planDreams(map, [], { now: NOW });
  const moves = buildNextMoves({ map, plan, actions: generateActions(p), alerts: [], events: [], now: NOW, limit: 20 });
  assert(moves.some((m) => m.id === 'dream:safety'));
  assert(!moves.some((m) => m.id === 'action:ACT-003' || m.id === 'action:ACT-017'));
});
check('every move explains why and links somewhere', () => {
  const p = profile();
  const map = buildMoneyMap(p);
  const plan = planDreams(map, [dream({ name: 'Car', targetAmount: R(15_00_000), targetDate: '2027-10-01' })], { now: NOW });
  for (const m of buildNextMoves({ map, plan, actions: generateActions(p), alerts: [], events: [], now: NOW, limit: 20 })) {
    assert(m.title && m.why && m.href.startsWith('/'), JSON.stringify(m));
  }
});

console.log('\nONE TRUTH — engines agree');
check('safety net covered ⇔ no emergency action/alert; score agrees (savings + liquid funds + FDs)', () => {
  const sig: any = { goals: [], spendSpikePct: null, spendSpikeCategory: null, newSubscriptions: [], docExpiries: [], insuranceExpiries: [], scoreDelta: null, hasNominationDoc: true };
  for (const [sav, liq, fd] of [[R(4_00_000), R(2_00_000), 0], [R(1_00_000), 0, R(5_00_000)], [R(50_000), R(50_000), 0], [0, 0, 0]]) {
    const p = profile({ assets: { savings_balance: sav, liquid_funds: liq, fd_total: fd }, monthlyExpenses: R(80_000) });
    const map = buildMoneyMap(p);
    const acts = generateActions(p).filter((a) => a.dimension === 'emergency_fund');
    const alerts = generateAlerts(p, sig).filter((a) => a.kind === 'emergency_fund');
    const months = map.liquid / map.expenses;
    if (map.emergencyGap === 0) { assert.strictEqual(acts.length, 0, 'no emergency action when covered'); assert.strictEqual(alerts.length, 0); }
    if (months < 3) assert(acts.length > 0 && alerts.length > 0, 'thin buffer flagged everywhere');
    const es = computeScore(p).dimensions.emergency_fund;
    assert.strictEqual(es.score, Math.round(Math.min(100, (months / 6) * 100)));
  }
});

console.log('\nAUTOPILOT — capture, earmark, diff, Hindi');
check('hears dreams in English, Hinglish and Hindi — estimates price when not said', () => {
  const a = detectDream('I really want to go to Bali next year', 'en', NOW)!;
  assert.strictEqual(a.name, 'Bali trip'); assert.strictEqual(a.kind, 'experience'); assert(a.estimated); assert.strictEqual(a.months, 12);
  const b = detectDream('mujhe 80k ka laptop lena hai 6 mahine me', 'en', NOW)!;
  assert.strictEqual(b.name, 'Laptop'); assert.strictEqual(b.amount, R(80_000)); assert(!b.estimated); assert.strictEqual(b.months, 6);
  const c = detectDream('मुझे अपने माता-पिता का हेल्थ इंश्योरेंस लेना है', 'hi', NOW)!;
  assert.strictEqual(c.kind, 'family'); assert.strictEqual(c.name, 'माता-पिता का हेल्थ कवर');
  const d = detectDream('my dream is to open my own cafe in 3 years', 'en', NOW)!;
  assert.strictEqual(d.kind, 'milestone'); assert.strictEqual(d.months, 36);
});
check('ignores questions and non-dreams', () => {
  assert.strictEqual(detectDream('what is my tax this year?', 'en', NOW), null);
  assert.strictEqual(detectDream('I want to understand my score', 'en', NOW), null);
});
check('amount & horizon parsing (₹, k, lakh, crore, Hindi units; years are not amounts)', () => {
  assert.strictEqual(parseRupees('₹1.5 lakh'), R(1_50_000)); assert.strictEqual(parseRupees('2 cr flat'), R(2_00_00_000));
  assert.strictEqual(parseRupees('50 हज़ार'), R(50_000)); assert.strictEqual(parseRupees('trip by 2027'), 0);
  assert.strictEqual(parseMonths('agle saal', NOW), 12); assert.strictEqual(parseMonths('in 2 years', NOW), 24);
});
check('earmarking: spare cash is auto-assigned to dreams (must-have first) and never double-counted', () => {
  const map = buildMoneyMap(profile({ assets: { savings_balance: R(4_00_000) } }));   // excess = 4L − 2.7L = 1.3L
  const plan = planDreams(map, [dream({ id: 'nice', priority: 3, targetAmount: R(1_00_000) }), dream({ id: 'must', priority: 1, targetAmount: R(1_00_000) })], { now: NOW, autoEarmark: true });
  const must = plan.items.find((i) => i.id === 'must')!, nice = plan.items.find((i) => i.id === 'nice')!;
  assert.strictEqual(must.earmarked, R(1_00_000)); assert.strictEqual(must.status, 'achieved');
  assert.strictEqual(nice.earmarked, R(30_000));
  assert.strictEqual(plan.earmarkedTotal, map.excessCash);
  assert(!plan.items.some((i) => i.levers.some((l) => l.kind === 'use_cash')), 'no spare cash left to offer twice');
});
check('afford: money earmarked for a dream is not "free" today', () => {
  const map = buildMoneyMap(profile({ assets: { savings_balance: R(4_00_000) } }));
  const r = affordCheck(map, [dream({ id: 'goa', name: 'Goa trip', priority: 1, targetAmount: R(1_00_000) })], R(80_000), { now: NOW, autoEarmark: true, label: 'a laptop' });
  assert.strictEqual(r.verdict, 'stretch'); assert(/Goa trip/.test(r.headline));
  assert.strictEqual(affordCheck(map, [], R(80_000), { now: NOW, autoEarmark: true }).verdict, 'yes_now');
});
check('diff: first plan, status change, date move, new life event → activity (+ alerts for the important ones)', () => {
  const base: Snapshot = { v: 1, free: R(30_000), excessCash: 0, events: [], dreams: [{ id: 'g', name: 'Goa trip', status: 'on_track', projectedDate: '2027-04', earmarked: 0 }] };
  assert.strictEqual(diffBrain(null, base, 'en', R(3_000))[0].kind, 'plan_built');
  const worse = { ...base, dreams: [{ ...base.dreams[0], status: 'needs_tradeoff', projectedDate: '2027-09' }] };
  const a = diffBrain(base, worse, 'en', 0);
  assert(a.some((x) => x.kind === 'dream_worse' && x.notify?.severity === 'warning'));
  const later = { ...base, dreams: [{ ...base.dreams[0], projectedDate: '2027-06' }] };
  assert(diffBrain(base, later, 'en', 0).some((x) => x.kind === 'dream_later'));
  const ev = diffBrain(base, { ...base, events: ['bonus:2026-09'] }, 'en', 0, [{ kind: 'bonus', month: '2026-09', amount: 1, title: 'Bonus', detail: '', suggestion: 'x' }]);
  assert(ev.some((x) => x.kind === 'event_bonus' && x.notify));
  assert.strictEqual(diffBrain(base, base, 'en', 0).length, 0, 'no change → no noise');
});
check('activity feed is written in both languages, item-for-item (EN dream name in EN, HI in HI)', () => {
  const base: Snapshot = { v: 1, free: R(30_000), excessCash: 0, events: [], dreams: [{ id: 'h', name: 'House in South Bombay', status: 'on_track', projectedDate: '2060-01', earmarked: 0 }] };
  const moved = { ...base, dreams: [{ ...base.dreams[0], projectedDate: '2066-07', earmarked: R(1_20_000) }] };
  const en = diffBrain(base, moved, 'en', 0);
  const hiSnap = { ...moved, dreams: moved.dreams.map((d) => ({ ...d, name: 'दक्षिण मुंबई में घर' })) };
  const hi = diffBrain(base, hiSnap, 'hi', 0);
  assert.strictEqual(en.length, hi.length); en.forEach((a, i) => assert.strictEqual(a.kind, hi[i].kind));
  assert(en.every((a) => !/[ऀ-ॿ]/.test(a.title)), 'English feed has no Hindi');
  assert(hi.every((a) => /[ऀ-ॿ]/.test(a.title)), 'Hindi feed is Hindi');
});
check('Hindi: plan, levers, afford and moves speak Hindi with the same numbers', () => {
  const map = buildMoneyMap(profile());
  const en = planDreams(map, [dream({ name: 'Car', targetAmount: R(15_00_000), targetDate: '2027-10-01' })], { now: NOW, lang: 'en' });
  const hi = planDreams(map, [dream({ name: 'Car', targetAmount: R(15_00_000), targetDate: '2027-10-01' })], { now: NOW, lang: 'hi' });
  assert(/[ऀ-ॿ]/.test(hi.summary)); assert(/[ऀ-ॿ]/.test(hi.items.find((i) => i.id === 'd1')!.levers[0].label));
  assert.deepStrictEqual(hi.items.map((i) => [i.need, i.allocated, i.projectedDate]), en.items.map((i) => [i.need, i.allocated, i.projectedDate]));
  assert(/[ऀ-ॿ]/.test(affordCheck(map, [], R(20_000), { now: NOW, lang: 'hi' }).headline));
  const moves = buildNextMoves({ map, plan: hi, actions: [], alerts: [], events: [], now: NOW, lang: 'hi' });
  assert(moves.every((m) => m.source !== 'dream' || /[ऀ-ॿ]/.test(m.title)));
});

console.log('\nASK PAYWATCH — AFFORD INTENT');
check('parses amount, horizon and item', () => {
  assert.deepStrictEqual(parseAffordIntent('Can I afford a ₹15L car next year?'), { amount: R(15_00_000), months: 12, label: 'a car' });
  assert.deepStrictEqual(parseAffordIntent('can i afford the 2 lakh course'), { amount: R(2_00_000), months: null, label: 'a course' });
  assert.strictEqual(parseAffordIntent('can i buy an iphone for 80000')!.label, 'an iphone');
  assert.strictEqual(parseAffordIntent('can i afford a 1.5 cr flat in 5 years')!.months, 60);
});
check('ignores non-affordability and amount-less questions', () => {
  assert.strictEqual(parseAffordIntent('what is my score'), null);
  assert.strictEqual(parseAffordIntent('Can I afford it?'), null);
});

console.log('\nDREAM NAMES — one dream, both languages');
check('captured dreams carry both names (Hindi capture → English name too)', () => {
  const d = detectDream('mujhe agle saal bali jana hai', 'hi')!;
  assert.deepStrictEqual(d.names, { en: 'Bali trip', hi: 'बाली ट्रिप' });
  assert.strictEqual(d.name, 'बाली ट्रिप');
});
check('older mixed names switch language without AI ("Bali विदेश यात्रा" → "Bali trip")', () => {
  assert.strictEqual(catalogLocalName('Bali विदेश यात्रा', 'en'), 'Bali trip');
  assert.strictEqual(catalogLocalName('Laptop', 'hi'), 'लैपटॉप');
});
check('free-typed names are left for translation (no wrong guess)', () => {
  assert.strictEqual(catalogLocalName('House in South Bombay', 'hi'), null);
});

console.log('\nPRICE GUIDE + INDIAN COMMAS');
check('South Bombay home is priced far above a tier-2 city', () => {
  const sobo = tableGuide('house in south bombay')!, t2 = tableGuide('2bhk flat in jaipur')!;
  assert.strictEqual(sobo.location, 'South Mumbai');
  assert(sobo.typical > 5 * t2.typical, `${sobo.typical} vs ${t2.typical}`);
  assert(sobo.options.some((o) => /Down payment/.test(o.label)));
});
check('trip guide scales with people and distance', () => {
  const solo = tableGuide('bali trip')!, fam = tableGuide('bali trip with family')!, goa = tableGuide('goa trip')!;
  assert.strictEqual(fam.typical, solo.typical * 4);
  assert(goa.typical < solo.typical);
});
check('unknown text → no guess', () => { assert.strictEqual(tableGuide('be happier'), null); });
check('Indian digit grouping', () => {
  assert.strictEqual(inrIN(12000000), '₹1,20,000');
  assert.strictEqual(inrIN(1250000000), '₹1,25,00,000');
  assert.strictEqual(inrRangeIN(185000000), '₹18,00,000–₹19,00,000');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
