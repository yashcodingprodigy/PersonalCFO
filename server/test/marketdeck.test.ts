// Markets "Money Wrapped" deck (D-59): one pamphlet per fact / news / loose impact, for-you first.
import assert from 'assert';
import { buildDeck } from '../src/services/marketDeck';
import { MARKET_FACTS } from '../src/services/marketFacts';
let passed = 0, failed = 0;
const check = (n: string, f: () => void) => { try { f(); passed++; console.log(`  ✓ ${n}`); } catch (e: any) { failed++; console.log(`  ✗ ${n}\n      ${e.message}`); } };
const imp = (id: string, theme: string) => ({ id, theme, title: `T ${id}`, detail: 'd', amount: 100, direction: 'up', good: false, href: '/networth', cta: 'See' });
const deck = buildDeck({
  facts: MARKET_FACTS,
  impacts: [imp('rate-home-emi', 'rates'), imp('rate-fd', 'rates'), imp('infl-spend', 'inflation'), imp('mkt-steady', 'markets')],
  news: [{ title: 'Tax news', link: 'https://pib.gov.in/x', source: 'PIB, Govt of India', published: null, provider: 'pib', lang: 'en', theme: 'tax', themeLabel: 'Tax', forYou: false, whyItMatters: 'w' }],
  themeLabels: { rates: 'Interest rates', inflation: 'Inflation', tax: 'Tax', markets: 'Markets' },
});
console.log('\nMARKET DECK');
check('repo card carries both rate impacts on its back', () => {
  const r = deck.find((c) => c.id === 'fact-repo')!;
  assert.strictEqual(r.impacts.length, 2); assert.strictEqual(r.big, `${MARKET_FACTS[0].value}%`); assert(r.forYou);
});
check('impacts not covered by a fact or news become their own card; news gets a card', () => {
  assert(deck.some((c) => c.id === 'imp-mkt-steady'));
  assert(deck.some((c) => c.kind === 'news' && c.backBody === 'w'));
});
check('for-you cards come first', () => {
  const firstNot = deck.findIndex((c) => !c.forYou);
  assert(firstNot === -1 || deck.slice(firstNot).every((c) => !c.forYou));
});
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
