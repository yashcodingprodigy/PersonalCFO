// Reply in the language the user used.
import assert from 'assert';
import { detectReplyLang } from '../src/services/langDetect';
let passed = 0, failed = 0;
const check = (n: string, f: () => void) => { try { f(); passed++; console.log(`  ✓ ${n}`); } catch (e: any) { failed++; console.log(`  ✗ ${n}\n      ${e.message}`); } };
console.log('\nREPLY LANGUAGE');
check('English question → English even if the app is in Hindi', () => assert.strictEqual(detectReplyLang('How much should I invest every month for a trip to Bali?', 'hi'), 'en'));
check('Devanagari → Hindi', () => assert.strictEqual(detectReplyLang('मुझे बाली जाना है', 'en'), 'hi'));
check('Hinglish → Hindi', () => assert.strictEqual(detectReplyLang('mujhe nayi bike chahiye, kitna bachana padega?', 'en'), 'hi'));
check('English with a stray "main" stays English', () => assert.strictEqual(detectReplyLang('What is the main reason my score dropped?', 'hi'), 'en'));
check('very short / ambiguous → app language', () => { assert.strictEqual(detectReplyLang('SIP?', 'hi'), 'hi'); assert.strictEqual(detectReplyLang('₹5000', 'en'), 'en'); });
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
