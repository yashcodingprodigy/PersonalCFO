import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthedRequest extends Request {
  userId?: string;
  caId?: string;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorised', message: 'Missing bearer token' });
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as { sub: string; role?: string };
    // CA tokens must not access user routes.
    if (payload.role === 'ca') return res.status(403).json({ error: 'wrong_role', message: 'This is a CA account. Log in as a user.' });
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorised', message: 'Invalid or expired token' });
  }
}

// Guards CA-only routes — requires a token minted for a CA (role: 'ca').
export function requireCa(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorised', message: 'Missing bearer token' });
  }
  try {
    const payload = jwt.verify(header.slice(7), config.jwtSecret) as { sub: string; role?: string };
    if (payload.role !== 'ca') return res.status(403).json({ error: 'wrong_role', message: 'This area is for Chartered Accountants.' });
    req.caId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ error: 'unauthorised', message: 'Invalid or expired token' });
  }
}
