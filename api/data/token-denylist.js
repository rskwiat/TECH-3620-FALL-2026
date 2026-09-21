// In-memory denylist of revoked token IDs (jti). Entries are pruned once the
// matching token expires, since an expired token is already invalid anyway.
// NOTE: this only lasts for the current server process — a persistent store
// (e.g. SQLite) is needed once the database lands or we scale past 1 instance.

var revokedTokens = new Map(); // jti -> exp (seconds)

function prune() {
  var now = Math.floor(Date.now() / 1000);
  for (var [jti, exp] of revokedTokens) {
    if (exp < now) {
      revokedTokens.delete(jti);
    }
  }
}

function revoke(jti, exp) {
  prune();
  revokedTokens.set(jti, exp || Math.floor(Date.now() / 1000));
}

function isRevoked(jti) {
  return revokedTokens.has(jti);
}

module.exports = { revoke: revoke, isRevoked: isRevoked };
