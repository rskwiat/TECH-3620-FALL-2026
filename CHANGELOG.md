# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Prisma v7 + SQLite** — added `prisma` (v7), `@prisma/client`, and the `better-sqlite3` driver adapter (`@prisma/adapter-better-sqlite3`, `better-sqlite3`, `@types/better-sqlite3`). Prisma v7 requires a driver adapter (no Rust query engine), so the client is instantiated with `PrismaBetterSqlite3({ url: DATABASE_URL })`.
  - `api/prisma/schema.prisma` — `prisma-client` generator (output → `src/prisma/generated`), `sqlite` datasource, and a `User` model mirroring the test-user fixture: `id`, `name`, `email` (unique), `password`, `home_address` (optional), `age`, `createdAt`, `lastUpdated`, `lastLogin`.
  - `api/prisma.config.ts` — v7 config file; the connection URL moved out of the schema and is read from `DATABASE_URL` in `api/.env` (via `import 'dotenv/config'`).
  - `api/src/prisma/db.ts` — exports a single shared `PrismaClient` for the app.
  - `api/prisma/migrations/20260928220345_init` — initial migration; the database lives at `api/db/dev.db`.
  - `.env` / `.env.example` gained `DATABASE_URL=file:./db/dev.db`; `.gitignore` now excludes `/db` and the generated client at `/src/prisma/generated`.
  - New scripts: `npm run db:generate` (`prisma generate`), `npm run db:migrate` (`prisma migrate dev && prisma generate`), `npm run db:seed` (`tsx prisma/seed.ts`), `npm run db:studio` (`prisma studio`).

- **Signup route** — `POST /signup` (`api/src/routes/auth.ts`) creates a `User` row through Prisma and immediately logs the new account in (`201` with `{ token, tokenType, expiresIn, user }`, the same shape as `/login`):
  - Validates `{ name, email, password, age?, home_address? }`: `400` for missing/empty name, email, or password, an email without `@`, a non-string `home_address`, or an `age` that is present but not an integer. `age` is optional (nullable) — omitted or `null` is stored as `NULL`.
  - Emails are normalised with `trim().toLowerCase()` on signup, login, and profile, so `Jane@Example.com` and `jane@example.com` are one account.
  - Duplicate emails return `409 Email is already registered` — checked with `findUnique` before the insert and again by catching Prisma's `P2002` unique-constraint error, so a concurrent signup race can't slip through.
  - Password is stored as a bcrypt hash and `lastLogin` is set at creation (signup issues a token).
  - Shared helpers extracted: `issueToken()` (24h HS256 JWT) is now used by both `/signup` and `/login`, and bcrypt lives in `src/data/passwords.ts` (`hashPassword` / `verifyPassword`, `SALT_ROUNDS = 10`) so the seed and routes can't drift apart.

- **Database-backed auth** — `POST /login` and `GET /profile` now read users from the `User` table through Prisma instead of comparing against the in-memory test-user fixture:
  - `/login` looks up the user by email, verifies the password with `bcrypt.compare`, writes `lastLogin`, and returns the same JWT payload + password-free user as before. Unknown email and wrong password both return `401 Invalid email or password` (no account enumeration). Body fields are validated as non-empty strings (`400` otherwise).
  - `/profile` resolves the account from the token's `sub` claim in the database (`404` when it no longer exists).
  - Passwords are stored as **bcrypt** hashes — added `bcrypt` + `@types/bcrypt`, plus `api/prisma/seed.ts` and `npm run db:seed`, which upserts the demo user from `src/data/test-user.ts` with a hashed password. Also registered as `migrations.seed` in `prisma.config.ts`, so `npx prisma db seed` works.
  - `toPublicUser()` moved out of `src/data/test-user.ts` into the generic `src/data/public-user.ts`, where it strips `password` from any user shape (the fixture is now seed data only).

- **TypeScript tooling** — added `typescript` (v7) and `tsx` as dev dependencies along with `@types/express`, `@types/node`, `@types/jsonwebtoken`, `@types/cookie-parser`, `@types/morgan`, `@types/http-errors`, and `@types/debug`. New scripts: `npm run dev` (local dev via `tsx watch src/server.ts`), `npm run build` (clean + `tsc`), `npm start` (`node dist/server.js`), and `npm run typecheck` (`tsc --noEmit`).
- **Request typing** — `api/src/types/express.d.ts` augments Express's `Request` with `user` (decoded JWT payload) and `token`, so `req.user` is type-checked on protected routes.
- **Healthcheck endpoint** — `GET /health` returns `{ status, uptime, timestamp }` to verify the server is running (`api/routes/health.js`).
- **Test user fixture** — `api/data/test-user.js` with `name`, `email`, `password`, `home_address` (optional), `age`, `createdAt`, `lastUpdated`, `lastLogin`.
- **Login route** — `POST /login` accepts `email` and `password`, validates against the test-user fixture, and returns a JWT (HS256, 24h expiry) plus the user object with the password stripped (`api/routes/auth.js`).
- **JWT support** — added `jsonwebtoken` with the signing secret stored in `api/.env` (loaded via `dotenv`). `api/.env.example` committed as a placeholder; `.env` added to `.gitignore`. Missing secret falls back to an insecure dev value with a warning.
- **Auth middleware** — `api/middleware/auth.js` `requireToken` verifies `Authorization: Bearer <token>` headers, rejects revoked tokens, and attaches the decoded payload to `req.user`.
- **Profile route** — `GET /profile` (protected) returns the current logged-in user, password-free, resolved from the token's `sub` claim.
- **Logout route** — `POST /logout` (protected) revokes the current token via an in-memory denylist (`api/data/token-denylist.js`), keyed by a unique `jti` claim added to each issued token. Revoked tokens are rejected with `401` on subsequent requests; entries prune themselves as tokens expire.

### Changed

- **`age` is optional on `User`** — `api/prisma/schema.prisma` changed `age Int` → `age Int?`, applied by migration `20260928222445_make_age_optional`. `/signup` no longer requires an age: omitted or `null` stores `NULL`, and a value that *is* present must still be an integer (`400 Age must be an integer`).
- **`db:migrate` now regenerates the client** — `prisma migrate dev` created the migration but left the generated client stale, so `prisma.user.create({ age: null })` still failed with `Argument "age" must not be null` even though `tsc` stayed green (`req.body` is `any`, so the bad input type slipped through). `npm run db:migrate` is now `prisma migrate dev && prisma generate`, and the signup handler types the parsed `age` as `unknown` → `number | null` so `tsc` catches this class of bug.
- **Auth routes are async** — `POST /login` and `GET /profile` now perform database queries, so they are `async` handlers wrapped with `try/catch` that forward failures to `next(error)` (Express 4 does not catch rejected promises).
- **Migrated the API to TypeScript** — every CommonJS `.js` source was replaced by an ES-module `.ts` file under `api/src/`: `app.js` → `src/app.ts`, `bin/www` → `src/server.ts`, `routes/*.js` → `src/routes/*.ts`, `middleware/auth.js` → `src/middleware/auth.ts`, and `data/*.js` → `src/data/*.ts`. `tsconfig.json` compiles `src/` → `dist/` with `strict` mode, `module: NodeNext`, and source maps; `"type": "module"` was added to `api/package.json`. Route handlers now `export default` their router, and the duplicated `getJwtSecret()` helper lives in `src/middleware/auth.ts` (shared by the auth routes). Password stripping is centralized in a `toPublicUser()` helper in `src/data/test-user.ts`.
- **API is now JSON-only** — removed the Jade view engine, `api/views/`, and `api/public/` (static styling). All routes and error responses now return JSON:
  - `GET /` → `{ "title": "Express" }`
  - `GET /users` → `{ "message": "respond with a resource" }`
  - 404/error handler → `{ "message", "error" }`
- `app.js` restructured: view/static setup removed, `dotenv` config loaded at startup, `auth` and `health` routers mounted.
- Uninstalled the `jade` dependency (removed 46 packages).

### Known limitations / TODO

- Token denylist is in-memory only — move it to SQLite along with the rest of the session data.
- No refresh tokens; access-token-only auth.
