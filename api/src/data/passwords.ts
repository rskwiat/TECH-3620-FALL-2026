import bcrypt from 'bcrypt';

/** Cost factor for bcrypt — 10 is a sensible default for a dev/demo app. */
export const SALT_ROUNDS = 10;

/** Hashes a plain-text password for storage (never store the plain text). */
export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** Compares a plain-text password against a stored bcrypt hash. */
export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
