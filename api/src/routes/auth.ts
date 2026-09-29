import crypto from 'node:crypto';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import requireToken, { getJwtSecret } from '../middleware/auth.js';
import { revoke } from '../data/token-denylist.js';
import { toPublicUser } from '../data/public-user.js';
import { hashPassword, verifyPassword } from '../data/passwords.js';
import prisma from '../prisma/db.js';
import { Prisma } from '../prisma/generated/client.js';

const router = express.Router();

/** Normalises an email so `Jane@Example.com ` and `jane@example.com` are the same account. */
function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** Signs a 24h HS256 access token for a user (shared by login and signup). */
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

/* POST signup — creates an account and logs the user in. */
router.post('/signup', async (req: Request, res: Response, next: NextFunction) => {
  const body = req.body ?? {};

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';

  if (!name || !email || !password) {
    res.status(400).json({ message: 'Name, email and password are required' });
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
        password: await hashPassword(password),
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

/* POST login. */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  const { password } = req.body ?? {};
  const email = normalizeEmail(req.body?.email);

  if (!email || typeof password !== 'string' || !password) {
    res.status(400).json({ message: 'Email and password are required' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Single "invalid credentials" response whether the email is unknown or
    // the password is wrong — don't leak which accounts exist.
    if (!user || !(await verifyPassword(password, user.password))) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

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
