import crypto from 'node:crypto';

/** Number of digits in a login code (`000000`–`999999`). */
export const CODE_LENGTH = 6;

/** How long a freshly issued code stays valid. */
export const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Failed verify attempts allowed before the code is invalidated. */
export const MAX_ATTEMPTS = 5;

/**
 * Generates a zero-padded `CODE_LENGTH`-digit code. Uses `crypto.randomInt`
 * (a CSPRNG) rather than `Math.random`, so codes aren't predictable.
 */
export function generateCode(): string {
  const max = 10 ** CODE_LENGTH;
  return crypto.randomInt(0, max).toString().padStart(CODE_LENGTH, '0');
}

/** Hashes a code for storage — only the hash is persisted, never the code. */
export function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/** Constant-time comparison of a submitted code against a stored hash. */
export function verifyCode(code: string, codeHash: string): boolean {
  const submitted = Buffer.from(hashCode(code));
  const stored = Buffer.from(codeHash);

  // timingSafeEqual throws on length mismatch, so guard first.
  return submitted.length === stored.length && crypto.timingSafeEqual(submitted, stored);
}

/** True when the code has passed its expiry. */
export function isExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() <= Date.now();
}
