import { Request, Response, NextFunction } from 'express';

// In-memory sliding window rate limiter. For multi-instance production
// deployments swap the store for Redis — the interface stays the same.
const buckets = new Map<string, number[]>();

export function rateLimit(opts: { windowMs: number; max: number; keyPrefix: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${opts.keyPrefix}:${req.ip}`;
    const now = Date.now();
    const hits = (buckets.get(key) || []).filter((t) => now - t < opts.windowMs);
    if (hits.length >= opts.max) {
      return res.status(429).json({ error: 'rate_limited', message: 'Too many requests. Please try again shortly.' });
    }
    hits.push(now);
    buckets.set(key, hits);
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) {
    const live = v.filter((t) => now - t < 15 * 60 * 1000);
    if (live.length === 0) buckets.delete(k); else buckets.set(k, live);
  }
}, 5 * 60 * 1000).unref();
