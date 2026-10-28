// Assistant actions — chat/voice can navigate the app and pin a guide. No DB needed for navigation.
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://x:x@127.0.0.1:1/none';
import assert from 'assert';
import { planActions } from '../src/services/assistantActions';

let passed = 0, failed = 0;
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (e: any) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
const R = (r: number) => r * 100;
const p: any = { user: { age: 27, annual_gross_income: R(1200000), monthly_take_home: R(85000), dependents_count: 1, employment_type: 'salaried' },
  assets: { savings_balance: R(200000) }, liabilities: {}, insurance: { health: [{ sum_insured: R(300000) }] }, tax_data: {}, monthlyExpenses: R(40000) };
const paths = async (q: string, l: 'en' | 'hi' = 'en') => (await planActions('u', q, p, l)).actions.map((a: any) => a.path || a.page || a.type);

(async () => {
  console.log('\nASSISTANT ACTIONS');
  await check('"show me relevant insurance" → marketplace on the biggest gap + guide', async () => {
    const r = await planActions('u', 'show me some relevant insurances for me', p, 'en');
    assert.strictEqual((r.actions[0] as any).path, '/insurance/market?category=health');
    const g: any = r.actions.find((a) => a.type === 'guide');
    assert(g && g.doThis.length >= 3 && g.avoid.length >= 2, 'guide has do + avoid');
    assert(/not advice/i.test(g.footnote), 'compliance footnote');
  });
  await check('Hinglish "bike insurance dikhao" → Motor tab', async () => {
    assert.strictEqual((await paths('bike insurance dikhao', 'hi'))[0], '/insurance/market?category=motor');
  });
  await check('Hindi "हेल्थ इंश्योरेंस दिखाओ" → Health tab with Hindi guide', async () => {
    const r = await planActions('u', 'मुझे हेल्थ इंश्योरेंस दिखाओ', p, 'hi');
    const g: any = r.actions.find((a) => a.type === 'guide');
    assert.strictEqual((r.actions[0] as any).path, '/insurance/market?category=health');
    assert(/[ऀ-ॿ]/.test(g.title));
  });
  await check('page navigation: tax / invest / dreams', async () => {
    assert.strictEqual((await paths('open my tax page'))[0], '/tax');
    assert.strictEqual((await paths('take me to investments'))[0], '/invest');
    assert.strictEqual((await paths('go to dreams'))[0], '/goals');
  });
  await check('a plain question does not navigate', async () => {
    assert.deepStrictEqual(await paths('what is my net worth'), []);
  });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
