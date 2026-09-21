# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Healthcheck endpoint** — `GET /health` returns `{ status, uptime, timestamp }` to verify the server is running (`api/routes/health.js`).
- **Test user fixture** — `api/data/test-user.js` with `name`, `email`, `password`, `home_address` (optional), `age`, `createdAt`, `lastUpdated`, `lastLogin`.
- **Login route** — `POST /login` accepts `email` and `password`, validates against the test-user fixture, and returns a JWT (HS256, 24h expiry) plus the user object with the password stripped (`api/routes/auth.js`).
- **JWT support** — added `jsonwebtoken` with the signing secret stored in `api/.env` (loaded via `dotenv`). `api/.env.example` committed as a placeholder; `.env` added to `.gitignore`. Missing secret falls back to an insecure dev value with a warning.
- **Auth middleware** — `api/middleware/auth.js` `requireToken` verifies `Authorization: Bearer <token>` headers, rejects revoked tokens, and attaches the decoded payload to `req.user`.
- **Profile route** — `GET /profile` (protected) returns the current logged-in user, password-free, resolved from the token's `sub` claim.
- **Logout route** — `POST /logout` (protected) revokes the current token via an in-memory denylist (`api/data/token-denylist.js`), keyed by a unique `jti` claim added to each issued token. Revoked tokens are rejected with `401` on subsequent requests; entries prune themselves as tokens expire.

### Changed

- **API is now JSON-only** — removed the Jade view engine, `api/views/`, and `api/public/` (static styling). All routes and error responses now return JSON:
  - `GET /` → `{ "title": "Express" }`
  - `GET /users` → `{ "message": "respond with a resource" }`
  - 404/error handler → `{ "message", "error" }`
- `app.js` restructured: view/static setup removed, `dotenv` config loaded at startup, `auth` and `health` routers mounted.
- Uninstalled the `jade` dependency (removed 46 packages).

### Known limitations / TODO

- Passwords compared in plain text — hash with bcrypt when DB-backed users arrive.
- Token denylist is in-memory only — moves to SQLite along with the database layer.
- SQLite database (`api/db/`) not yet created; routes still use the test-user fixture.
- `lastLogin` is never updated (no persistence yet).
- No refresh tokens; access-token-only auth.
