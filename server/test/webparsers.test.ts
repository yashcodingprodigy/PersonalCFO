// Client-side parsing utilities (pure functions, importable in Node via tsx).
// Covers the fragile date/money/Form-16 extraction used by the wizard & statement scan.
import assert from 'assert';
import { parseDate, parseMoney, parseForm16, parsePayslip } from '../../web/src/lib/statementParse';

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
check('Real Form 16 Part B: §17(1) gross, taxable, tax payable', () => {
  // Flattened the way the PDF reader produces it.
  const text = 'Gross Salary Rs. Rs. (a) Salary as per provisions contained in section 17(1) 1688816.00 (d) Total 1688816.00 ' +
    '(a) Standard deduction under section 16(ia) 75000.00 12. Total taxable income (9-11) 1613816.00 ' +
    '13. Tax on total income 122760.00 16. Health and education cess 4910.00 21. Net tax payable (17-18-19-20) 127670.00';
  const f = parseForm16(text);
  assert.strictEqual(f.grossSalary, 168881600);
  assert.strictEqual(f.standardDeduction, 7500000);
  assert.strictEqual(f.taxableIncome, 161381600);
  assert.strictEqual(f.taxPayable, 12767000);
});
check('Real Form 16 Part A: summary-row TDS total', () => {
  const text = 'Quarter(s) Amount paid/credited Amount of tax deducted Total (Rs.) 1681908.00 127680.00 127680.00';
  const f = parseForm16(text);
  assert.strictEqual(f.tds, 12768000);
});

console.log('\nPAYSLIP EXTRACTION (Indian formats, bare integers)');
check('Govt slip: integer Basic/HRA + decimal totals + "Income Tax" TDS', () => {
  // Mirrors the real MCD salary slip layout (no commas/decimals on line items).
  const text = 'Earnings Deductions Basic Pay 72100 GPF 10000 DA 39655 Income Tax 10000 HRA X 21630 GIS 60 ' +
    'Total Earning Rs. 138965.00 Total Deductions Rs. 20060.00 Net Payable Rs. 118905.00';
  const p = parsePayslip(text);
  assert.strictEqual(p.basic, 7210000);   // ₹72,100
  assert.strictEqual(p.hra, 2163000);     // ₹21,630
  assert.strictEqual(p.gross, 13896500);  // ₹1,38,965
  assert.strictEqual(p.net, 11890500);    // ₹1,18,905
  assert.strictEqual(p.tds, 1000000);     // ₹10,000 ("Income Tax")
});
check('Does not mistake a long account number for money', () => {
  const p = parsePayslip('Bank A/c. No. 916010019131516 Basic 50000');
  assert.strictEqual(p.basic, 5000000);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
