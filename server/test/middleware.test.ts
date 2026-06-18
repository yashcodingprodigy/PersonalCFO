// Middleware behaviour — rate limiter + auth — with mocked req/res (no DB).
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { rateLimit } from '../src/middleware/rateLimit';
import { requireAuth } from '../src/middleware/auth';
import { config } from '../src/config';

let passed = 0, failed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function res() {
  const r: any = { statusCode: 200, body: null };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: any) => { r.body = b; return r; };
  return r;
}

console.log('\nRATE LIMITER');
check('Allows up to max, blocks the next with 429', () => {
  const limit = rateLimit({ windowMs: 1000, max: 2, keyPrefix: 'test' });
  const req: any = { ip: '9.9.9.9' };
  let nexts = 0; const next = () => nexts++;
  limit(req, res(), next);
  limit(req, res(), next);
  const r3 = res(); limit(req, r3, next);
  assert.strictEqual(nexts, 2);
  assert.strictEqual(r3.statusCode, 429);
  assert.strictEqual(r3.body.error, 'rate_limited');
});
check('Separate IPs have separate buckets', () => {
  const limit = rateLimit({ windowMs: 1000, max: 1, keyPrefix: 'test2' });
  let nexts = 0; const next = () => nexts++;
  limit({ ip: '1.1.1.1' } as any, res(), next);
  limit({ ip: '2.2.2.2' } as any, res(), next);
  assert.strictEqual(nexts, 2);
});

console.log('\nAUTH MIDDLEWARE');
check('Missing header → 401, next not called', () => {
  const r = res(); let called = false;
  requireAuth({ headers: {} } as any, r, () => { called = true; });
  assert.strictEqual(r.statusCode, 401); assert(!called);
});
check('Malformed/garbage token → 401', () => {
  const r = res(); let called = false;
  requireAuth({ headers: { authorization: 'Bearer not-a-jwt' } } as any, r, () => { called = true; });
  assert.strictEqual(r.statusCode, 401); assert(!called);
});
check('Token signed with wrong secret → 401', () => {
  const bad = jwt.sign({ sub: 'u1' }, 'some-other-secret');
  const r = res(); let called = false;
  requireAuth({ headers: { authorization: `Bearer ${bad}` } } as any, r, () => { called = true; });
  assert.strictEqual(r.statusCode, 401); assert(!called);
});
check('Valid JWT → next() called, req.userId set', () => {
  const token = jwt.sign({ sub: 'user-123' }, config.jwtSecret, { expiresIn: '5m' });
  const req: any = { headers: { authorization: `Bearer ${token}` } };
  let called = false;
  requireAuth(req, res(), () => { called = true; });
  assert(called); assert.strictEqual(req.userId, 'user-123');
});
check('Expired token → 401', () => {
  const token = jwt.sign({ sub: 'u1' }, config.jwtSecret, { expiresIn: -10 });
  const r = res(); let called = false;
  requireAuth({ headers: { authorization: `Bearer ${token}` } } as any, r, () => { called = true; });
  assert.strictEqual(r.statusCode, 401); assert(!called);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
