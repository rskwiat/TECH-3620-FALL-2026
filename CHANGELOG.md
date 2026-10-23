# Changelog

All notable changes to this project will be documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- **Weekly tab** — the Weekly screen (`habit-tracker/src/app/(app)/weekly.tsx`) is now a real progress view instead of a placeholder:
  - New `WeeklyCompletionView` (`src/components/weekly-completion-view.tsx`) aggregates every active habit into one Monday–Sunday grid. Each day is tinted by the share of habits complete that day (all/some/none/upcoming), shows `completed/total` and a mini ratio bar, and the card leads with the week's overall percentage plus an `X of Y habit check-ins complete` footer. Daily habits count once their daily goal is met; weekly habits count once they log any completion that day.
  - A `FlatList` of each habit's week: emoji, name, percentage, progress bar, and a `4 of 5 days met · Daily` / `2 of 3 completions · Weekly` line, with a `✓` once the week's goal is met. Rows push `/habit/[id]`.
  - Loads `GET /api/habits` then every habit's 60-day history in parallel, anchored to the newest `perDay` bucket (the API's UTC today) so future days read as upcoming. Uses the same `FlatList`-as-scroll-container and derived loading/error pattern as the Today tab.

- **Weekly habit tracker** — a reusable Monday–Sunday widget (`habit-tracker/src/components/weekly-habit-tracker.tsx`) now sits on the habit detail screen above the 28-day calendar:
  - Seven day columns with weekday initials and day numbers, tinted by completion state (opaque primary = goal met, 50% = partial, 10% = none), while days still to come use the muted `backgroundSelected` fill.
  - Header shows the visible date range and an `X of Y days met` count; a four-item legend covers Complete / Partial / Incomplete / Upcoming.
  - Built from the same `perDay` history as `HabitCalendar` (no extra requests) and anchored to its newest entry, so the week follows the API's UTC "today". `weekStartsOn` (default Monday), `title`, and `showLegend` props keep it reusable on other screens.

- **Today welcome + summary cards** — the Today tab (`habit-tracker/src/app/(app)/index.tsx`) now opens with:
  - A welcome block greeting the signed-in user by first name (`Good morning` / `Good afternoon` / `Good evening`) plus one of 12 habit-themed affirmations, picked at random when the screen mounts.
  - Two side-by-side cards above the list. **Daily progress** shows the percentage of non-archived habits whose goal is met in the API's current (UTC) day, with a themed progress bar and `X of Y habits done`. **Current streak** shows the longest `currentStreak` among those habits, labeled with the habit's emoji and name.
  - Both cards reuse the per-habit `getHabitHistory` calls the rows already make (no extra requests) and show `—` until every lookup settles. The welcome block, section header, cards, and habit rows all live in the `FlatList`'s `ListHeaderComponent`, so they scroll together.

- **Habit detail screen** — tapping a habit row on the Today tab now pushes a new root-level route `/habit/[id]` (`src/app/habit/[id].tsx`) showing that habit's streaks and completion history:
  - Hero card (emoji, name, frequency line like `Daily · 8× per day`, description) plus four stat cards: 🔥 current streak, 🏆 best streak (`longestStreak`), ✅ total completions, and 📅 days goal met within the window.
  - **28-day calendar** (`src/components/habit-calendar.tsx`) — the last 28 `perDay` entries in a four-row, seven-column widget with weekday initials, the visible date range, and a Complete/Partial/Incomplete legend. Each day square is tinted with the theme's primary at full opacity when the goal was met, 50% when the day has completions but falls short of the goal, and 10% when there are none; day numbers use white text on complete days and themed text elsewhere.
  - **Weekly consistency chart** (`src/components/habit-weekly-chart.tsx`) — a bar chart of the last eight Monday–Sunday weeks, each bar showing that week's consistency percentage above it and the week's start date below. Daily habits measure the share of days the daily goal was met; weekly habits measure progress toward `timesPerPeriod` completions per week. A partial week at the start of the history window is dropped, the in-progress current week is drawn faded and counted through today, and the card shows the window average. Bars are grouped for screen readers with a per-week description.
  - Reads `GET /api/habits` (habit row) and `GET /api/habits/:id/history?days=60` in parallel; loading/error/not-found states follow the Today screen's derived-state pattern. View-only for now.
  - Lives at the root stack level (the `(app)` group is a `NativeTabs` navigator where every route is a tab) and is registered in `Stack.Protected guard={!!session}`, so signed-out users are redirected to login.
  - Today rows (`src/app/(app)/index.tsx`) are now `Pressable` with pressed feedback and push the detail route via the typed object href (`{ pathname: '/habit/[id]', params: { id } }`); `STREAK_WINDOW_DAYS` moved from `index.tsx` into `src/api.ts` as the shared `HISTORY_WINDOW_DAYS` (60), since both screens need it.

- **Habits API** — six authenticated routes under `/api/habits` (`api/src/routes/habits.ts`), all behind a new `requireTokenOr404` middleware:
  - `GET /` (own habits, `?includeArchived=true`), `POST /` (validated create → `201`), `DELETE /:id` (cascade-deletes the habit's logs).
  - `GET /:id/logs` (oldest first, `?from=`/`?to=YYYY-MM-DD` inclusive) and `POST /:id/logs` (multiple completions per day allowed, optional `completedAt` backfill → `201`).
  - `GET /:id/history` — aggregated stats: `currentStreak`, `longestStreak`, `totalCompletions`, and a per-day `{ date, count, goalMet }` breakdown over `?days=1..365` (default 30). Days bucket in UTC; an unmet "today" doesn't break the streak.
  - `Habit` + `HabitLog` models in `api/prisma/schema.prisma` (migration `20261012222751_add_habits_and_logs`; `frequency` is a validated string because Prisma enums aren't supported on SQLite; both foreign keys cascade-delete).
  - `api/src/middleware/auth.ts` refactored around one `checkBearerToken()` helper with two exports: the original `requireToken` (401) and the new `requireTokenOr404` — missing, malformed, expired, and revoked tokens all get `404 {"message":"Not found"}` so the habit routes appear not to exist; another user's habit id is also a 404.
  - Seed data: `api/src/data/demo-habits.ts` (13 habits — 9 daily, 3 weekly, 1 archived) plus `prisma/seed.ts` generating ~45 days of deterministic logs per user (mulberry32 PRNG seeded per user+habit, last 4 days always hit the goal so a current streak exists). Idempotent — habits match by name and a habit that already has logs is skipped, so hand-logged completions are never clobbered.
  - README documents the endpoints, an example curl flow, the Prisma models, and the 404-instead-of-401 auth + UTC streak semantics.

- **Today screen + New Habit modal** — the habit-tracker app's Today tab (`src/app/(app)/index.tsx`):
  - `FlatList` of the signed-in user's non-archived habits (weekly habits belong on the list too — they can be completed any day), each row showing the emoji (fixed-width slot, `·` fallback), title, and a meta line like `🔥 14-day streak · Updated 10/12/2026`. The `FlatList` is the screen's scroll container, since a virtualized list may not be nested inside `PageTemplate`'s plain `ScrollView`.
  - Streaks fill in row by row as each habit's `getHabitHistory` lands (60-day window — the API's 30-day default would clip the seed's longer streaks), so the list never waits on streaks. Loading/error are derived from a state tagged with the session token rather than set in the effect.
  - `src/api.ts` gains `Habit`, `HabitHistory`, `getHabits()`, `getHabitHistory()`, `NewHabitInput`, and `createHabit()`.
  - Header pins the "Today" title next to a **+ New Habit** action that opens `src/components/new-habit-modal.tsx` — a React Native `Modal` bottom sheet (Name required, Emoji, Description, Daily/Weekly toggle, times per day/week) with client validation mirroring the API and `KeyboardAvoidingView`; a successful create bumps a refresh key so habits and streaks reload while the current rows stay on screen.

- **Today / Weekly / Stats / Settings tabs** — replaced the starter's Home/Explore tabs with four real app tabs:
  - `src/components/page-template.tsx` — shared `PageTemplate` shell (title matching the tab label, optional subtitle, placeholder card); Weekly and Stats are one-call templates.
  - `src/components/app-tabs.tsx` (+ `.web.tsx`) — `NativeTabs` triggers labeled Today/Weekly/Stats/Settings with SF Symbols on iOS (`calendar`, `calendar.day.timeline.left`, `chart.bar`, `gearshape`) and Material names on Android (`today`, `view_week`, `bar_chart`, `settings`), plus matching web `TabTrigger`s. `explore.tsx` was deleted, the authenticated home became **Today**, and all account UI (profile fields, session note, sign out) moved to Settings.

- **Habit-tracker auth flow** — the Expo app's client-side auth against the JWT endpoints from above:
  - `src/ctx.tsx` (`SessionProvider` / `useSession()` with `signIn`, `signUp`, `signOut`, `user`, `isLoading`), `src/useStorageState.ts` (SecureStore on native, `localStorage` on web), and the `src/api.ts` fetch client (`login`, `signup`, `logout`, `getProfile`, `ApiError`).
  - Login and signup screens (`src/app/login.tsx`, `src/app/signup.tsx`) built on the shared form-field and button components, with `src/app/_layout.tsx` wrapping the router in `Stack.Protected`: the `(app)` group requires a session, `login`/`signup` are signed-out only, so unauthenticated deep links redirect to `/login` and signing in/out flips the guard automatically. The restored token is re-checked against `GET /profile` once on launch and signed out on `401`/`404`.
  - `EXPO_PUBLIC_API_URL` in `habit-tracker/.env` (gitignored, default `http://localhost:3000`) plus a CORS/OPTIONS middleware in `api/src/app.ts` so the web client can call the API.

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

- **Button sizes** — `habit-tracker/src/components/ui/button.tsx` gains a `size` prop (`small` | `medium` | `large`, default `medium`) so padding and label sizes can scale together:
  - `small` — 14px label, 16px horizontal padding, 8px radius, 44pt minimum touch target; `medium` keeps the previous 16px label / 24px padding / 48pt height; `large` — 18px label, 32px padding, 56pt height.
  - The Today tab's **+ New Habit** button and the habit detail screen's **← Back** button now use `size="small"`, tightening those header rows without shrinking their touch targets. Form submit buttons stay `medium`.

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

### Fixed

- **SecureStore key rejected on every launch** — the session was persisted under the key `habit-tracker/session`, but SecureStore keys may only contain alphanumeric characters plus `.`, `-`, and `_`, so every write failed with `Invalid key provided to SecureStore` and the app started signed out each launch (the invalid key never stored anything, so nothing needed migrating). Renamed to `habit-tracker.session` and wrapped the SecureStore write path in try/catch so a persistence failure logs instead of surfacing as an unhandled rejection.

### Known limitations / TODO

- Token denylist is in-memory only — move it to SQLite along with the rest of the session data.
- No refresh tokens; access-token-only auth.
