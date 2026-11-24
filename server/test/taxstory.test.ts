// Tax story (D-70) + CA docs (D-71): plain-language tax page maths, ITR-pack zip, CA intent detection.
import assert from 'assert';
import { ProfileData } from '../src/services/score';
import { taxStory, breakEvenExtraDeductions } from '../src/services/taxStory';
import { makeZip, crc32, detectCaIntent, DOC_SOURCES, ITR_PACK_KEYS, computationHtml } from '../src/services/caDocs';
import { ITR_DOCUMENTS } from '../src/services/itr';

let passed = 0, failed = 0;
const check = (n: string, f: () => void) => { try { f(); passed++; console.log(`  ✓ ${n}`); } catch (e: any) { failed++; console.log(`  ✗ ${n}\n      ${e.message}`); } };
const L = 100000_00;
const profile = (gross: number, tax_data: any = {}): ProfileData => ({
  user: { annual_gross_income: gross, monthly_take_home: Math.round(gross / 14), dependents_count: 0, age: 28, employment_type: 'salaried' },
  assets: {}, liabilities: {}, insurance: {}, tax_data, monthlyExpenses: null,
} as ProfileData);

console.log('\nTAX STORY');
check('₹10L earner: no tax, says so plainly', () => {
  const s = taxStory(profile(10 * L));
  assert.strictEqual(s.headline.totalTax, 0);
  assert(['no_tax', 'settled', 'refund'].includes(s.headline.status));
  assert(/no income tax|covers it|refund/i.test(s.headline.sentence));
});
check('₹20L earner: headline, monthly figure and waterfall agree with the full computation', () => {
  const s = taxStory(profile(20 * L));
  const rec = s.regime === 'old' ? s.ca.old : s.ca.new;
  assert.strictEqual(s.headline.totalTax, rec.totalTax);
  assert.strictEqual(s.headline.monthly, Math.round(rec.totalTax / 12));
  const total = s.steps.find((x) => x.key === 'total')!;
  assert.strictEqual(total.amount, rec.totalTax);
  assert(s.steps[0].key === 'earned' && s.steps.at(-1)!.key === 'result');
  assert(s.slabs.length >= 3 && s.slabs.some((b) => b.tax > 0));
});
check('saving = regime gap + deductions effect, never negative', () => {
  const s = taxStory(profile(20 * L));
  assert(s.saving.regime >= 0 && s.saving.deductions >= 0);
  assert.strictEqual(s.saving.total, s.saving.regime + s.saving.deductions);
  assert.strictEqual(s.saving.regime, Math.abs(s.ca.old.totalTax - s.ca.new.totalTax));
});
check('break-even: old regime catches up only after enough extra deductions', () => {
  const s = taxStory(profile(20 * L));
  assert.strictEqual(s.regime, 'new');
  const be = breakEvenExtraDeductions(s.ca.inputs, s.fy);
  assert(be === null || be > 0, 'new regime is cheaper, so break-even needs extra deductions');
  if (be) assert(/would only win/i.test(s.regimeCompare.sentence));
});
check('confidence rises with documents', () => {
  assert.strictEqual(taxStory(profile(12 * L), []).confidence.level, 'estimate');
  assert.strictEqual(taxStory(profile(12 * L), ['payslip']).confidence.level, 'partly_verified');
  assert.strictEqual(taxStory(profile(12 * L), ['form16', 'form26as_ais']).confidence.level, 'verified');
});

console.log('\nCA DOCS');
check('zip writer produces a valid archive (signatures, CRC, entry count)', () => {
  const a = Buffer.from('hello'), b = Buffer.from('world!');
  const z = makeZip([{ name: '00 README.txt', data: a }, { name: '01 Form 16/form16.pdf', data: b }, { name: '01 Form 16/form16.pdf', data: b }]);
  assert.strictEqual(z.readUInt32LE(0), 0x04034b50);
  assert.strictEqual(z.readUInt32LE(14), crc32(a));
  const end = z.length - 22;
  assert.strictEqual(z.readUInt32LE(end), 0x06054b50);
  assert.strictEqual(z.readUInt16LE(end + 10), 3);
  assert(z.includes(Buffer.from('form16 (2).pdf')), 'duplicate names are de-duplicated');
  assert.strictEqual(crc32(Buffer.from('123456789')), 0xcbf43926);
});
check('every ITR checklist item a CA can tick has a document source', () => {
  for (const d of ITR_DOCUMENTS.filter((x) => x.key !== 'bank_for_refund')) assert(DOC_SOURCES.some((s) => s.key === d.key), d.key);
  assert(ITR_PACK_KEYS.includes('tax_computation'));
});
check('computation HTML is printable and escapes text', () => {
  const s = taxStory(profile(20 * L));
  const h = computationHtml(s, 'A <b>');
  assert(h.startsWith('<!doctype html>') && h.includes('Total tax') && h.includes('A &lt;b&gt;'));
});
check('CA intent: requested docs vs full pack vs unrelated', () => {
  assert.strictEqual(detectCaIntent('send my CA the documents he asked for'), 'send_requested');
  assert.strictEqual(detectCaIntent('CA ne jo maanga woh bhej do'), 'send_requested');
  assert.strictEqual(detectCaIntent('send all my ITR documents to my CA'), 'send_pack');
  assert.strictEqual(detectCaIntent('मेरे सीए को सारे डॉक्यूमेंट भेज दो'), 'send_pack');
  assert.strictEqual(detectCaIntent('what is a CA?'), null);
  assert.strictEqual(detectCaIntent('send money to my friend'), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
