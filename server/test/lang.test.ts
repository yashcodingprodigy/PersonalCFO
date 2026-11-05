// Reply in the language the user used.
import assert from 'assert';
import { detectReplyLang, replyMatches, stickyLang, explicitLang } from '../src/services/langDetect';
let passed = 0, failed = 0;
const check = (n: string, f: () => void) => { try { f(); passed++; console.log(`  ✓ ${n}`); } catch (e: any) { failed++; console.log(`  ✗ ${n}\n      ${e.message}`); } };
console.log('\nREPLY LANGUAGE');
check('English question → English even if the app is in Hindi', () => assert.strictEqual(detectReplyLang('How much should I invest every month for a trip to Bali?', 'hi'), 'en'));
check('Devanagari → Hindi', () => assert.strictEqual(detectReplyLang('मुझे बाली जाना है', 'en'), 'hi'));
check('Hinglish in a Hindi app → Hindi', () => assert.strictEqual(detectReplyLang('mujhe nayi bike chahiye, kitna bachana padega?', 'hi'), 'hi'));
check('English app: plain English → English; spoken/typed Hindi (even in Latin letters) → Hindi (D-58)', () => {
  assert.strictEqual(detectReplyLang('Can I afford it dubai trip?', 'en'), 'en');
  assert.strictEqual(detectReplyLang('what about my car loan?', 'en'), 'en');
  assert.strictEqual(detectReplyLang('mujhe turkey jana hai kitna kharcha hoga', 'en'), 'hi');
  assert.strictEqual(detectReplyLang('कितना पैसा लगेगा', 'en'), 'hi');
});
check('explicit request wins and sticks for the conversation', () => {
  assert.strictEqual(explicitLang('please reply in Hindi'), 'hi');
  assert.strictEqual(explicitLang('hindi mein batao'), 'hi');
  assert.strictEqual(explicitLang('answer in english please'), 'en');
  assert.strictEqual(detectReplyLang('Can you give me the answer in Hindi?', 'en'), 'hi');
  const sticky = stickyLang(['how much for bali?', 'reply in hindi from now']);
  assert.strictEqual(detectReplyLang('Can I afford a car next year?', 'en', sticky), 'hi');
  assert.strictEqual(detectReplyLang('ok now answer in English', 'en', sticky), 'en');
});
check('reply-language check catches a Hindi answer to an English question', () => {
  assert.strictEqual(replyMatches('Dubai trip के बारे में बात करें तो — आपके पास हर महीने ₹7,000 है।', 'en'), false);
  assert.strictEqual(replyMatches('You have ₹7,000 a month free for the Dubai trip.', 'en'), true);
  assert.strictEqual(replyMatches('आपके पास हर महीने ₹7,000 SIP के लिए है।', 'hi'), true);
});
check('English with a stray "main" stays English', () => assert.strictEqual(detectReplyLang('What is the main reason my score dropped?', 'hi'), 'en'));
check('very short / ambiguous → app language', () => { assert.strictEqual(detectReplyLang('SIP?', 'hi'), 'hi'); assert.strictEqual(detectReplyLang('₹5000', 'en'), 'en'); });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
