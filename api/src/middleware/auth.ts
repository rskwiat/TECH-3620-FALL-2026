import type { Request, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';

import { isRevoked } from '../data/token-denylist.js';

export function getJwtSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  console.warn('JWT_SECRET not set, using insecure dev fallback');
  return 'dev-only-insecure-secret';
}

type TokenCheck =
  | { ok: true; payload: jwt.JwtPayload; token: string }
  | { ok: false; reason: string };

/**
 * Verifies the Bearer token on a request. Returns the decoded payload on
 * success, or the reason it was rejected (missing/malformed header, invalid or
 * expired token, revoked `jti`). Shared by the 401 and 404 variants below.
 */
function checkBearerToken(req: Request): TokenCheck {
  const header = req.headers.authorization || '';
  const parts = header.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return { ok: false, reason: 'Missing or malformed Authorization header' };
  }

  try {
    const decoded = jwt.verify(parts[1], getJwtSecret(), { algorithms: ['HS256'] });

    // jsonwebtoken returns a plain string only for tokens signed with a string payload
    if (typeof decoded === 'string') {
      return { ok: false, reason: 'Invalid or expired token' };
    }

    if (decoded.jti && isRevoked(decoded.jti)) {
      return { ok: false, reason: 'Token has been revoked' };
    }

    return { ok: true, payload: decoded, token: parts[1] };
  } catch {
    return { ok: false, reason: 'Invalid or expired token' };
  }
}

/* Require a valid Bearer token on the request (responds 401 when absent/invalid). */
const requireToken: RequestHandler = (req, res, next) => {
  const result = checkBearerToken(req);

  if (!result.ok) {
    res.status(401).json({ message: result.reason });
    return;
  }

  req.user = result.payload;
  req.token = result.token;
  next();
};

/**
 * Require a valid Bearer token, but respond 404 for *any* unauthenticated
 * request — missing, malformed, expired or revoked. This hides the existence
 * of the route from clients that aren't logged in.
 */
export const requireTokenOr404: RequestHandler = (req, res, next) => {
  const result = checkBearerToken(req);

  if (!result.ok) {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  req.user = result.payload;
  req.token = result.token;
  next();
};

export default requireToken;
