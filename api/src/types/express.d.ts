import type { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      /** Decoded JWT payload, attached by the auth middleware once verified. */
      user?: JwtPayload;
      /** Raw bearer token presented on the request. */
      token?: string;
    }
  }
}
