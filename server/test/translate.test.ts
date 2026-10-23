// Hindi translation layer — chunking, partial/truncated replies, no-key fallback. Mocked fetch, no DB/network.
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.DATABASE_URL = 'postgres://x:x@127.0.0.1:1/none';
import assert from 'assert';

let passed = 0, failed = 0;
async function check(name: string, fn: () => Promise<void>) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}

(async () => {
  const calls: number[] = [];
  let mode: 'ok' | 'truncated' | 'fail' = 'ok';
  (globalThis as any).fetch = async (_url: string, init: any) => {
    const body = JSON.parse(init.body);
    const input = JSON.parse(body.messages[0].content) as Record<string, string>;
    calls.push(Object.keys(input).length);
    if (mode === 'fail') return { ok: false, status: 500, text: async () => 'boom' };
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(input)) out[k] = `हिं:${v}`;
    let text = JSON.stringify(out);
    if (mode === 'truncated') text = text.slice(0, Math.floor(text.length * 0.6)); // reply cut off mid-way
    return { ok: true, json: async () => ({ content: [{ text }] }) };
  };
  const { translateTexts } = await import('../src/services/translate');

  console.log('\nTRANSLATION LAYER');
  await check('translates a big page in small chunks (≤20 per AI call)', async () => {
    const texts = Array.from({ length: 65 }, (_, i) => `Line number ${i} of the page`);
    const out = await translateTexts(texts, 'hi');
    assert(calls.every((n) => n <= 20), `chunk sizes ${calls}`);
    assert.strictEqual(calls.length, 4);
    assert(out.every((s, i) => s === `हिं:${texts[i]}`), 'all translated');
  });
  await check('keeps surrounding whitespace and caches (no second call)', async () => {
    calls.length = 0;
    const out = await translateTexts(['  Line number 3 of the page  '], 'hi');
    assert.strictEqual(out[0], '  हिं:Line number 3 of the page  ');
    assert.strictEqual(calls.length, 0);
  });
  await check('truncated AI reply still saves the complete pairs', async () => {
    mode = 'truncated'; calls.length = 0;
    const texts = Array.from({ length: 10 }, (_, i) => `Fresh sentence ${i} here`);
    const out = await translateTexts(texts, 'hi');
    const done = out.filter((s) => s.startsWith('हिं:')).length;
    assert(done >= 3 && done < 10, `salvaged ${done}`);
  });
  await check('AI failure → original English, never an error', async () => {
    mode = 'fail';
    const out = await translateTexts(['Totally new text'], 'hi');
    assert.strictEqual(out[0], 'Totally new text');
  });
  await check('numbers/amounts and English mode are untouched', async () => {
    mode = 'ok';
    assert.deepStrictEqual(await translateTexts(['₹7,000', '76'], 'hi'), ['₹7,000', '76']);
    assert.deepStrictEqual(await translateTexts(['Hello there'], 'en'), ['Hello there']);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
