// Funnel maths (D-69): signup → first dream → first next move, with the 7-day "acts in week 1" metric.
import assert from 'assert';
import { computeFunnel } from '../src/services/analytics';
import { startDraft } from '../src/services/brain/dreamDraft';

let passed = 0, failed = 0;
const check = (n: string, f: () => void) => { try { f(); passed++; console.log(`  ✓ ${n}`); } catch (e: any) { failed++; console.log(`  ✗ ${n}\n      ${e.message}`); } };
const H = 3.6e6, t0 = Date.parse('2026-11-20T10:00:00Z');
const at = (h: number) => new Date(t0 + h * H).toISOString();

console.log('\nANALYTICS FUNNEL');
check('counts each milestone once per user and computes rates', () => {
  const f = computeFunnel([
    { user_id: 'a', event: 'signup', at: at(0) }, { user_id: 'a', event: 'first_dream', at: at(1) }, { user_id: 'a', event: 'first_move_done', at: at(30) },
    { user_id: 'b', event: 'signup', at: at(0) }, { user_id: 'b', event: 'first_dream', at: at(5) },
    { user_id: 'c', event: 'signup', at: at(0) }, { user_id: 'c', event: 'first_move_done', at: at(24 * 9) },
    { user_id: 'd', event: 'signup', at: at(0) },
  ]);
  assert.strictEqual(f.signups, 4);
  assert.strictEqual(f.firstDream, 2);
  assert.strictEqual(f.firstMoveDone, 2);
  assert.strictEqual(f.dreamRate, 50);
  assert.strictEqual(f.moveRate, 50);
  assert.strictEqual(f.moveWithin7dRate, 25, 'c acted on day 9 — outside week 1');
  assert.strictEqual(f.medianHoursToFirstDream, 3);
});
check('users without a signup row are outside the cohort; duplicates keep the earliest time', () => {
  const f = computeFunnel([
    { user_id: 'x', event: 'first_dream', at: at(1) },
    { user_id: 'y', event: 'signup', at: at(0) }, { user_id: 'y', event: 'first_dream', at: at(10) }, { user_id: 'y', event: 'first_dream', at: at(2) },
    { user_id: 'y', event: 'login', at: at(3) },
  ]);
  assert.strictEqual(f.signups, 1);
  assert.strictEqual(f.medianHoursToFirstDream, 2);
});
check('empty input is safe', () => {
  const f = computeFunnel([]);
  assert.strictEqual(f.signups, 0); assert.strictEqual(f.moveRate, 0); assert.strictEqual(f.medianHoursToFirstMove, null);
});

console.log('\nNEW DREAM QUICK-PICKS');
check("children's education is captured as its own dream (not a course)", () => {
  const d = startDraft("I want to save for my children's education", 'en', new Date('2026-11-20'))!;
  assert(d, 'draft expected');
  assert.strictEqual(d.goalType, 'child_education');
  const h = startDraft('मैं बच्चों की पढ़ाई के लिए बचत करना चाहता हूँ', 'hi', new Date('2026-11-20'))!;
  assert.strictEqual(h.goalType, 'child_education');
});
check('retirement still maps to the retirement goal type', () => {
  const d = startDraft('I want to plan my retirement', 'en', new Date('2026-11-20'))!;
  assert.strictEqual(d.goalType, 'retirement');
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
