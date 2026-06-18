// Client-side parsing utilities (pure functions, importable in Node via tsx).
// Covers the fragile date/money/Form-16 extraction used by the wizard & statement scan.
import assert from 'assert';
import { parseDate, parseMoney, parseForm16 } from '../../web/src/lib/statementParse';

let passed = 0, failed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}

console.log('\nDATE PARSING (Indian formats)');
check('ISO 2026-01-15', () => assert.strictEqual(parseDate('2026-01-15'), '2026-01-15'));
check('dd/mm/yyyy 15/01/2026', () => assert.strictEqual(parseDate('15/01/2026'), '2026-01-15'));
check('dd-mm-yy 05-03-25', () => assert.strictEqual(parseDate('05-03-25'), '2025-03-05'));
check('dd-MMM-yyyy 15-Jan-2026', () => assert.strictEqual(parseDate('15-Jan-2026'), '2026-01-15'));
check('garbage → empty', () => assert.strictEqual(parseDate('not a date'), ''));

console.log('\nMONEY PARSING (paise)');
check('1,234.56 → 123456 paise', () => assert.strictEqual(parseMoney('1,234.56'), 123456));
check('Indian grouping ₹ 2,00,000 → 20000000', () => assert.strictEqual(parseMoney('₹ 2,00,000'), 20000000));
check('plain 500 → 50000', () => assert.strictEqual(parseMoney('500'), 50000));
check('non-numeric → 0', () => assert.strictEqual(parseMoney('abc'), 0));

console.log('\nFORM 16 EXTRACTION (best-effort)');
check('Reads gross salary and TDS', () => {
  const text = 'Part B Gross Salary 12,00,000.00 Deductions ... Total amount of tax deducted 95,000.00 thereon';
  const { grossSalary, tds } = parseForm16(text);
  assert.strictEqual(grossSalary, 120000000); // ₹12,00,000 in paise
  assert.strictEqual(tds, 9500000);            // ₹95,000 in paise
});
check('Returns nulls when nothing matches', () => {
  const { grossSalary, tds } = parseForm16('this document has no salary figures');
  assert.strictEqual(grossSalary, null);
  assert.strictEqual(tds, null);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
