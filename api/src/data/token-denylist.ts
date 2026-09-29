// In-memory denylist of revoked token IDs (jti). Entries are pruned once the
// matching token expires, since an expired token is already invalid anyway.
// NOTE: this only lasts for the current server process — a persistent store
// (e.g. SQLite) is needed once the database lands or we scale past 1 instance.

const revokedTokens = new Map<string, number>(); // jti -> exp (seconds)

function prune(): void {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of revokedTokens) {
    if (exp < now) {
      revokedTokens.delete(jti);
    }
  }
}

export function revoke(jti: string, exp?: number): void {
  prune();
  revokedTokens.set(jti, exp ?? Math.floor(Date.now() / 1000));
}

export function isRevoked(jti: string): boolean {
  return revokedTokens.has(jti);
}
