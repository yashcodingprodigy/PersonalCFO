// Dream drafts (D-61): talk it through first, save only on a clear yes.
import assert from 'assert';
import { startDraft, updateDraft, missing, isConfirm, isCancel, askedToAdd } from '../src/services/brain/dreamDraft';

let passed = 0, failed = 0;
const check = (n: string, f: () => void) => { try { f(); passed++; console.log(`  ✓ ${n}`); } catch (e: any) { failed++; console.log(`  ✗ ${n}\n      ${e.message}`); } };
const now = new Date('2026-11-10');
const R = (r: number) => r * 100;

console.log('\nDREAM DRAFTS');
check('a dream mention starts a draft with budget and timing still to ask', () => {
  const d = startDraft('I want to plan my wedding', 'en', now)!;
  assert(d && /wedding/i.test(d.name));
  assert.deepStrictEqual(missing(d), ['amount', 'when']);
});
check('follow-up details fill the draft; years are never read as money', () => {
  const d = startDraft('I want to plan my wedding', 'en', now)!;
  const a = updateDraft(d, 'around 15 lakh', now).draft;
  assert.strictEqual(a.amount, R(1500000)); assert(a.amountFromUser);
  const b = updateDraft(a, 'in December 2028', now).draft;
  assert.strictEqual(b.amount, R(1500000), 'year 2028 must not become ₹2,028');
  assert(b.monthsFromUser); assert.deepStrictEqual(missing(b), []);
});
check('a bare "yes" only confirms if we just asked to add it', () => {
  assert.strictEqual(isConfirm('yes', 'Want me to break that down?'), false);
  assert.strictEqual(isConfirm('yes', 'Looks comfortable. Shall I add it to your dreams?'), true);
  assert.strictEqual(isConfirm('haan add kar do'), true);
  assert.strictEqual(isConfirm('yes add it to my dreams'), true);
  assert.strictEqual(isConfirm("don't add it yet"), false);
});
check('cancel works explicitly, or as a bare "no" to our add question', () => {
  assert.strictEqual(isCancel('not now'), true);
  assert.strictEqual(isCancel('no', 'Shall I add it to your dreams?'), true);
  assert.strictEqual(isCancel('no', 'Do you have a budget in mind?'), false);
  assert.strictEqual(askedToAdd('क्या इसे आपके सपनों में जोड़ दूँ?'), true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
