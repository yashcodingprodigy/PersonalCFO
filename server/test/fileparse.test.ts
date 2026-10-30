// Server-side statement parsing for the native apps (CSV path — no heavy libs needed).
import assert from 'assert';
import { parseCsv, parseStatementBuffer, parseHoldingsBuffer, parseCapitalGainsBuffer, parseDate, parseMoney } from '../src/services/fileParse';

let passed = 0, failed = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (e: any) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
(async () => {
  console.log('\nFILE PARSE');
  await check('CSV reader handles quotes, commas and CRLF', () => {
    const rows = parseCsv('a,"b, c","d ""q"""\r\n1,2,3\r\n');
    assert.deepStrictEqual(rows, [['a', 'b, c', 'd "q"'], ['1', '2', '3']]);
  });
  await check('Indian dates + money', () => {
    assert.strictEqual(parseDate('05/04/2026'), '2026-04-05');
    assert.strictEqual(parseMoney('1,20,000.50'), 12000050);
  });
  await check('debit/credit CSV statement → transactions in paise', async () => {
    const csv = 'Date,Narration,Withdrawal Amt,Deposit Amt,Balance\n01/04/2026,SALARY ACME,,"85,000.00","1,00,000"\n03/04/2026,SWIGGY ORDER,450.00,,"99,550"\n';
    const r = await parseStatementBuffer('stmt.csv', Buffer.from(csv));
    assert.strictEqual(r.transactions.length, 2);
    const sal = r.transactions.find((t) => /SALARY/.test(t.description))!;
    assert.strictEqual(sal.direction, 'credit'); assert.strictEqual(sal.amount, 8500000); assert.strictEqual(sal.date, '2026-04-01');
    const sw = r.transactions.find((t) => /SWIGGY/.test(t.description))!;
    assert.strictEqual(sw.direction, 'debit'); assert.strictEqual(sw.amount, 45000);
  });
  await check('unsupported type → friendly warning', async () => {
    const r = await parseStatementBuffer('photo.jpg', Buffer.from('x'));
    assert.strictEqual(r.transactions.length, 0); assert(r.warning);
  });
  await check('holdings CSV with a title row → holdings in paise', async () => {
    const csv = 'Holdings as on 01-04-2026\nInstrument,Qty.,LTP,Cur. val\nNIFTY INDEX FUND,10,250.5,"2,505"\nTotal,,,2505\n';
    const r = await parseHoldingsBuffer('h.csv', Buffer.from(csv));
    assert.strictEqual(r.holdings.length, 1);
    assert.strictEqual(r.holdings[0].value, 250500);
  });
  await check('capital-gains CSV → STCG/LTCG (loss stays negative)', async () => {
    const csv = 'Symbol,Short Term P&L,Long Term P&L\nAAA,1000,-200\nBBB,500.50,300\n';
    const r = await parseCapitalGainsBuffer('pl.csv', Buffer.from(csv));
    assert.strictEqual(r.rows, 2); assert.strictEqual(r.stcg, 150050); assert.strictEqual(r.ltcg, 10000);
  });
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
})();
