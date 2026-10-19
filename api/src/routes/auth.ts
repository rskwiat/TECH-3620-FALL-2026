import crypto from 'node:crypto';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import requireToken, { getJwtSecret } from '../middleware/auth.js';
import { revoke } from '../data/token-denylist.js';
import { toPublicUser } from '../data/public-user.js';
import {
  CODE_LENGTH,
  CODE_TTL_MS,
  MAX_ATTEMPTS,
  generateCode,
  hashCode,
  isExpired,
  verifyCode,
} from '../data/login-codes.js';
import prisma from '../prisma/db.js';
import { Prisma } from '../prisma/generated/client.js';

const router = express.Router();

/** Normalises an email so `Jane@Example.com ` and `jane@example.com` are the same account. */
function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** Signs a 24h HS256 access token for a user (shared by signup and code verification). */
function issueToken(user: { email: string; name: string }): string {
  return jwt.sign(
    { sub: user.email, name: user.name, jti: crypto.randomUUID() },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '24h' }
  );
}

/** True for a unique-constraint violation on `email` (race with a concurrent signup). */
function isDuplicateEmail(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * The generic response returned by `POST /login`. It is identical whether or
 * not the email belongs to an account, so the endpoint can't be used to
 * discover which emails are registered.
 */
const CODE_REQUEST_MESSAGE = 'If that email belongs to an account, a login code has been sent.';

/* POST signup — creates an account and logs the user in. */
router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  const body = req.body ?? {};

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body.email);

  if (!name || !email) {
    res.status(400).json({ message: 'Name and email are required' });
    return;
  }

  if (!email.includes('@')) {
    res.status(400).json({ message: 'Email is not valid' });
    return;
  }

  if (body.home_address !== undefined && body.home_address !== null && typeof body.home_address !== 'string') {
    res.status(400).json({ message: 'Home address must be a string' });
    return;
  }

  // `age` is optional — but when present it must be an integer (or null).
  const rawAge: unknown = body.age;
  let age: number | null = null;
  if (rawAge !== undefined && rawAge !== null) {
    if (typeof rawAge !== 'number' || !Number.isInteger(rawAge)) {
      res.status(400).json({ message: 'Age must be an integer' });
      return;
    }
    age = rawAge;
  }

  try {
    // Friendly check up front; the unique constraint below still guards races.
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ message: 'Email is already registered' });
      return;
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        home_address: body.home_address ?? null,
        age,
        lastLogin: new Date(),
      },
    });

    res.status(201).json({
      token: issueToken(user),
      tokenType: 'Bearer',
      expiresIn: 86400,
      user: toPublicUser(user),
    });
  } catch (error) {
    if (isDuplicateEmail(error)) {
      res.status(409).json({ message: 'Email is already registered' });
      return;
    }
    next(error);
  }
});

/**
 * POST /login — request a one-time login code.
 *
 * Passwordless: the caller sends only their email. For a real account we issue
 * a 6-digit code, store its hash, and (no email provider in this POC) print it
 * to the API console. The response is always the same generic message so the
 * endpoint doesn't reveal which emails exist.
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  const email = normalizeEmail(req.body?.email);

  if (!email) {
    res.status(400).json({ message: 'Email is required' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const code = generateCode();

      // One active code per user: drop any previous codes first.
      await prisma.loginCode.deleteMany({ where: { userId: user.id } });
      await prisma.loginCode.create({
        data: {
          userId: user.id,
          codeHash: hashCode(code),
          expiresAt: new Date(Date.now() + CODE_TTL_MS),
        },
      });

      // No email system in this POC — the code is delivered via the server log.
      console.log(
        `\n[auth] Login code for ${email}: ${code} ` +
          `(valid for ${Math.round(CODE_TTL_MS / 60000)} minutes)\n`
      );
    }

    res.json({ message: CODE_REQUEST_MESSAGE });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /login/verify — exchange a code for a JWT.
 *
 * Every failure (unknown email, no code, expired, too many attempts, wrong
 * code) returns the same `401` so the response can't be probed. A correct code
 * is single-use: all of the user's codes are deleted on success.
 */
router.post('/login/verify', async (req: Request, res: Response, next: NextFunction) => {
  const body = req.body ?? {};
  const email = normalizeEmail(body.email);
  const code = typeof body.code === 'string' ? body.code.trim() : '';

  if (!email || !code) {
    res.status(400).json({ message: 'Email and code are required' });
    return;
  }

  if (!/^\d+$/.test(code) || code.length !== CODE_LENGTH) {
    res.status(400).json({ message: `Code must be ${CODE_LENGTH} digits` });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    const invalid = () => res.status(401).json({ message: 'Invalid or expired code' });

    if (!user) {
      invalid();
      return;
    }

    const record = await prisma.loginCode.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!record || isExpired(record.expiresAt) || record.attempts >= MAX_ATTEMPTS) {
      // Expired or burned-out codes are cleared so they can't linger.
      if (record) {
        await prisma.loginCode.deleteMany({ where: { userId: user.id } });
      }
      invalid();
      return;
    }

    if (!verifyCode(code, record.codeHash)) {
      const attempts = record.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await prisma.loginCode.deleteMany({ where: { userId: user.id } });
      } else {
        await prisma.loginCode.update({ where: { id: record.id }, data: { attempts } });
      }
      invalid();
      return;
    }

    // Success — the code is single-use, so clear it before issuing a token.
    await prisma.loginCode.deleteMany({ where: { userId: user.id } });
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    res.json({
      token: issueToken(user),
      tokenType: 'Bearer',
      expiresIn: 86400,
      user: toPublicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

/* GET profile for the current logged in user. */
router.get('/profile', requireToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = normalizeEmail(req.user?.sub);
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json(toPublicUser(user));
  } catch (error) {
    next(error);
  }
});

/* POST logout, revoking the current token. */
router.post('/logout', requireToken, (req, res) => {
  const exp = req.user?.exp ?? Math.floor(Date.now() / 1000) + 86400;
  if (req.user?.jti) {
    revoke(req.user.jti, exp);
  }
  res.json({ message: 'Logged out' });
});

export default router;
