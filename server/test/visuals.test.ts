// Ask PayWatch visual cards (D-55): built from the brain's own numbers, no AI.
import assert from 'assert';
import { buildVisuals, costSplit, savingsPath, findDream, looksLikeDreamTalk } from '../src/services/brain/visuals';
import { tableGuide } from '../src/services/brain/priceGuide';
import { parseAffordIntent } from '../src/services/cfo-ai';

let passed = 0, failed = 0;
const check = (n: string, f: () => void) => { try { f(); passed++; console.log(`  ✓ ${n}`); } catch (e: any) { failed++; console.log(`  ✗ ${n}\n      ${e.message}`); } };
const R = (r: number) => r * 100;
const now = new Date('2026-11-05');
const bali: any = { id: 'g1', name: 'Bali trip', kind: 'experience', priority: 2, virtual: false, months: 12, targetDate: '2027-11', adjustedTarget: R(150000), need: R(12000), allocated: R(12000), currentContribution: 0, status: 'on_track', projectedDate: '2027-10', earmarked: 0, saved: R(10000), levers: [] };
const plan: any = { hasData: true, free: R(30000), items: [{ ...bali, id: 'safety', name: 'Safety net', virtual: true }, bali], joyBudget: 0, unallocated: 0, overcommitted: 0, earmarkedTotal: 0, summary: '' };

console.log('\nVISUALS');
check('finds the dream the user is talking about by name', () => {
  assert.equal(findDream(plan, 'how is my bali plan going?')?.id, 'g1');
  assert.equal(findDream(plan, 'what is my tax regime?'), null);
});
check('Bali question → dream card + cost split + savings path (+ tiers), max 4', () => {
  const v = buildVisuals({ question: 'I want to go to Bali next year', lang: 'en', plan, focusName: 'Bali trip', now });
  const types = v.map((x) => x.type);
  assert(types.includes('dream') && types.includes('breakdown') && types.includes('path'), types.join(','));
  assert(v.length <= 4);
});
check('trip cost split adds up to the total (short-haul shares)', () => {
  const v: any = costSplit('Bali trip', R(150000), tableGuide('bali trip'), 'en');
  const sum = v.parts.reduce((s: number, p: any) => s + p.amount, 0);
  assert(Math.abs(sum - R(150000)) <= R(10), `sum ${sum}`);
  assert(/Flights/.test(v.parts[0].label));
});
check('savings path: starting 6 months later finishes later and never overshoots the target', () => {
  const p: any = savingsPath(bali, 'en', now);
  const [a, b] = p.series;
  assert(a.reach && b.reach && b.reach > a.reach, `${a.reach} vs ${b.reach}`);
  assert(a.points.every((x: any) => x.v <= bali.adjustedTarget));
});
check('Hindi labels when the user speaks Hindi', () => {
  const v: any = buildVisuals({ question: 'बाली जाना है', lang: 'hi', plan, focusName: 'Bali trip', now });
  assert(/आपका प्लान/.test(v.find((x: any) => x.type === 'dream').title));
});
check('ordinary questions don’t trigger visuals; dream talk does', () => {
  assert.equal(looksLikeDreamTalk('which tax regime is better for me?', plan), false);
  assert.equal(looksLikeDreamTalk('how much does a goa trip cost?', null), true);
});

check('afford questions with no price still get priced from PayWatch’s table (every dream fits)', () => {
  const a = parseAffordIntent('can I afford hair transplant in Turkey')!;
  assert(a && a.amount === 0 && a.label === 'a hair transplant', JSON.stringify(a));
  const g = tableGuide('can I afford hair transplant in Turkey')!;
  assert(g.found && g.typical >= R(100000) && g.typical <= R(500000), String(g.typical));
  assert(tableGuide('can i afford lasik')!.found);
  assert.strictEqual(parseAffordIntent('Can I afford it?'), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
