import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

import { isRevoked } from '../data/token-denylist.js';

export function getJwtSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  console.warn('JWT_SECRET not set, using insecure dev fallback');
  return 'dev-only-insecure-secret';
}

/* Require a valid Bearer token on the request. */
const requireToken: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    res.status(401).json({ message: 'Missing or malformed Authorization header' });
    return;
  }

  try {
    const decoded = jwt.verify(parts[1], getJwtSecret(), { algorithms: ['HS256'] });

    // jsonwebtoken returns a plain string only for tokens signed with a string payload
    if (typeof decoded === 'string') {
      res.status(401).json({ message: 'Invalid or expired token' });
      return;
    }

    if (decoded.jti && isRevoked(decoded.jti)) {
      res.status(401).json({ message: 'Token has been revoked' });
      return;
    }

    req.user = decoded;
    req.token = parts[1];
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export default requireToken;
