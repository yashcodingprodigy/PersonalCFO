// Markets page: personal impact maths, news themes, licensed-source parsing.
import assert from 'assert';
import { buildImpacts, classifyNews, emi, personaliseNews } from '../src/services/marketImpact';
import { parseRss, newsSources } from '../src/adapters/news';
import { MARKET_FACTS } from '../src/services/marketFacts';

let passed = 0, failed = 0;
const check = (n: string, f: () => void) => { try { f(); passed++; console.log(`  ✓ ${n}`); } catch (e: any) { failed++; console.log(`  ✗ ${n}\n      ${e.message}`); } };
const R = (r: number) => r * 100;
const base: any = { user: { annual_gross_income: R(1200000), monthly_take_home: R(85000), dependents_count: 1, age: 28, employment_type: 'salaried' },
  assets: { savings_balance: R(300000), fd_total: R(200000), mutual_funds: { value: R(150000), monthly_sip: R(5000) } },
  liabilities: { home_loans: [{ outstanding: R(4000000), rate: 8.5 }], car_loans: [{ outstanding: R(400000) }] }, insurance: {}, tax_data: {}, monthlyExpenses: R(40000) };

console.log('\nMARKETS');
check('EMI maths matches the standard formula (₹40L, 8.5%, 15y ≈ ₹39,390)', () => {
  const e = emi(R(4000000), 8.5, 180) / 100;
  assert(Math.abs(e - 39390) < 50, `got ${e}`);
});
check('repo +0.25% → home-loan EMI up by a sensible amount (₹500–700/mo on ₹40L)', () => {
  const i = buildImpacts(base, MARKET_FACTS).find((x) => x.id === 'rate-home-emi')!;
  assert(i && i.good === false && i.direction === 'up');
  assert(i.amount! > R(500) && i.amount! < R(700), `got ${i.amount! / 100}`);
});
check('fixed-rate loans flagged as unchanged; FDs earn a bit more', () => {
  const ids = buildImpacts(base, MARKET_FACTS).map((i) => i.id);
  assert(ids.includes('rate-fixed') && ids.includes('rate-fd'));
});
check('no loan but a home dream → shows what a loan for that dream would cost', () => {
  const p = { ...base, liabilities: {} };
  const i = buildImpacts(p, MARKET_FACTS, [{ name: 'Home in Pune', goalType: 'home_purchase', target: R(2000000) }]).find((x) => x.id === 'rate-dream-loan');
  assert(i && /Home in Pune/.test(i.title));
});
check('inflation: idle savings lose buying power; spending + dreams grow', () => {
  const ids = buildImpacts(base, MARKET_FACTS, [{ name: 'Goa', target: R(60000) }]).map((i) => i.id);
  for (const k of ['infl-savings', 'infl-spend', 'infl-dreams']) assert(ids.includes(k), k);
});
check('news themes in English and Hindi', () => {
  assert.strictEqual(classifyNews('RBI keeps repo rate unchanged'), 'rates');
  assert.strictEqual(classifyNews('Retail inflation rises to 5.54% in September'), 'inflation');
  assert.strictEqual(classifyNews('CBDT extends ITR filing deadline'), 'tax');
  assert.strictEqual(classifyNews('बीमा धारकों के लिए नए नियम'), 'insurance');
  assert.strictEqual(classifyNews('PIB Fact Check: fake message about digital arrest'), 'scam');
  assert.strictEqual(classifyNews('Navy ship reaches Japan'), 'other');
});
check('PIB non-money news is dropped; money news gets a personal "why"', () => {
  const cards = personaliseNews([
    { title: 'Navy ship reaches Japan', link: 'https://pib.gov.in/1', source: 'PIB', published: null, provider: 'pib', lang: 'en' },
    { title: 'Retail inflation rises in September', link: 'https://pib.gov.in/2', source: 'PIB', published: null, provider: 'pib', lang: 'en' },
  ], base);
  assert.strictEqual(cards.length, 1); assert(cards[0].forYou && /₹40,000/.test(cards[0].whyItMatters));
});
check('RSS parser reads PIB-style feeds', () => {
  const xml = '<rss><channel><item><title>Govt notifies new PPF rates</title><link>https://pib.gov.in/PressReleaseIframePage.aspx?PRID=1</link></item></channel></rss>';
  const r = parseRss(xml, 'pib', 'PIB, Govt of India', 'en');
  assert.strictEqual(r.length, 1); assert.strictEqual(r[0].title, 'Govt notifies new PPF rates');
});
check('only permitted sources are on by default (PIB yes; RBI/SEBI need permission)', () => {
  const s = Object.fromEntries(newsSources().map((x) => [x.id, x.enabled]));
  assert.strictEqual(s.pib, true); assert.strictEqual(s.rbi, false); assert.strictEqual(s.sebi, false);
});
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
