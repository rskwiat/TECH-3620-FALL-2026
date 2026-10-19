# TECH-3620 Fall 2026 Habit Tracker Repo

## Requirments

- Node version 22+
- [Expo Go iOS](https://apps.apple.com/us/app/expo-go/id982107779) / [Expo Go Android](https://play.google.com/store/apps/details?id=host.exp.exponent&hl=en-US)

## API Setup

To setup the application you can clone this repo, or follow the commands below in the terminal:


1. Run this command to setup the API Folder and change (cd) into it
```
mkdir api && cd api
```

2. In the API Folder run the express-generator command to boostrap the express framework and basic API.

```
npx express-generator
```
3. Run the following command to install all the dependencies for the app:

```
npm install
```

## Mobile App Setup

In the main directory (my app and api are in the `TECH-3620-FALL-2026` folder).

1. Run this command to install the expo boilerplate and the defaults of the application.


```
npx create-expo-app@latest
```

2. This command start the metro bundler that you can scan to run the application on your device. If you run `expo start --ios`, the command line will ask you to install xcode / andriod studio.

*You need to be in the folder name you provider to the metro bundler to get the app running (mine is called habit-tracker)*

```
npm start
```

### Cloning the repo

Clone the repo with git, go into the api directory and habit-tracker directories and run the command: 

```
npm install
```

This will install the dependenices needed to build the app and run the same commands from above.

---

### API

Our api for tracking habits will be built in Express. The API is **JSON-only** — all routes and error responses return JSON (the default Jade views and static styling were removed).

The API is written in **TypeScript**: source lives in `api/src`, `tsc` compiles it into `api/dist` for production, and `tsx` runs it straight from source for local development.

Data is stored in a SQLite database in the `api/db` folder, accessed through **Prisma ORM v7** (the `better-sqlite3` driver adapter). The Prisma schema lives in `api/prisma/schema.prisma` and the shared client in `api/src/prisma/db.ts`. The auth routes (`/signup`, `/login`, `/profile`) read users from the `User` table, and the habit routes (`/api/habits/...`) read and write the `Habit` and `HabitLog` tables; the test-user fixture now only supplies the seed data.

#### Running the API

Local development (runs `src/server.ts` directly and restarts on changes — no build step):

```
cd api
cp .env.example .env   # then set JWT_SECRET (DATABASE_URL is pre-filled)
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Production (compile with `tsc`, run the emitted JavaScript):

```
npm run build
npm start
```

Other scripts:

| Script                | What it does                                  |
|-----------------------|-----------------------------------------------|
| `npm run dev`         | `tsx watch src/server.ts` — dev server        |
| `npm run build`       | Cleans `dist/` and compiles with `tsc`        |
| `npm start`           | Runs the built server, `node dist/server.js`  |
| `npm run typecheck`   | `tsc --noEmit` — type-check only              |
| `npm run db:generate` | Regenerates the Prisma client (`prisma generate`) |
| `npm run db:migrate`  | Applies migrations / creates new ones (`prisma migrate dev`) — then re-runs `prisma generate` so the client always matches the schema |
| `npm run db:seed`     | Upserts the demo user into SQLite (`tsx prisma/seed.ts`) and seeds the 13 demo habits (with ~6 weeks of completion logs) for every user |
| `npm run db:studio`   | Opens Prisma Studio to browse `api/db/dev.db` |

The server starts on `http://localhost:3000`. Environment variables are loaded from `api/.env` (copy `api/.env.example` and set `JWT_SECRET` if setting up fresh — `DATABASE_URL` points at the SQLite file and defaults to `file:./db/dev.db`).

#### Database (Prisma v7 + SQLite)

- `api/prisma/schema.prisma` — the schema. Models:
  - `User` — mirrors the test-user fixture (`name`, `email`, `home_address`, optional `age`, `createdAt`, `lastUpdated`, `lastLogin`); has `habits` and `loginCodes` relations. There is **no password column** — auth is passwordless (one-time codes).
  - `Habit` — a tracked habit owned by a user: `name`, optional `description` / `color` / `emoji`, `frequency` (`"DAILY"` or `"WEEKLY"` — stored as a validated string because Prisma enums aren't supported on SQLite), `timesPerPeriod` (the goal, e.g. 3× per day), `archived` flag, timestamps, and a `userId` foreign key (cascade delete).
  - `HabitLog` — one completion of a habit: `completedAt`, optional `note`, `habitId` foreign key (cascade delete), indexed on `(habitId, completedAt)`. Multiple logs per day are allowed (for habits with a goal > 1).
  - `LoginCode` — a one-time login code: `userId` foreign key (cascade delete), `codeHash` (SHA-256 — the plain 6-digit code is never stored), `expiresAt`, `attempts`, `createdAt`. A user has at most one active code; requesting a new one replaces the old.
- `api/prisma.config.ts` — Prisma v7 config; the connection URL (`DATABASE_URL`) is read from `api/.env` here instead of from the schema.
- `api/prisma/migrations/` — migration history (commit these).
- `api/prisma/seed.ts` — `npm run db:seed` upserts the demo user from `src/data/test-user.ts` with a **bcrypt**-hashed password (also wired as `migrations.seed` in `prisma.config.ts`, so `npx prisma db seed` works), then seeds the 13 demo habits from `src/data/demo-habits.ts` — daily/weekly frequencies, goals, colors, emojis, one archived habit, plus ~45 days of deterministic completion logs per habit (safe to re-run: habits are matched by name and existing logs are never overwritten).
- `api/src/prisma/db.ts` — exports a single shared `PrismaClient` wired to the `better-sqlite3` driver adapter. Import it anywhere: `import { prisma } from '../prisma/db.js'`.
- `api/src/prisma/generated/` — generated client code (gitignored; re-create with `npm run db:generate` or `npm run db:migrate`). **Regenerate after every schema change** — a stale client still type-checks but fails at runtime, which is why `db:migrate` chains `prisma generate` onto `prisma migrate dev`.
- `api/db/dev.db` — the SQLite database file itself (gitignored).

#### Endpoints

| Method | Path        | Auth   | Description                                     |
|--------|-------------|--------|-------------------------------------------------|
| GET    | `/`         | none   | JSON placeholder                                |
| GET    | `/users`    | none   | JSON placeholder                                |
| GET    | `/health`   | none   | Healthcheck — returns `{ status, uptime, timestamp }` |
| POST   | `/signup`   | none   | Create an account with `{ name, email, age?, home_address? }` → `201` + JWT + user (passwordless — no password) |
| POST   | `/login`    | none   | Request a one-time 6-digit login code with `{ email }` → generic `200`. The code is printed to the **API console** (no email provider in this POC) |
| POST   | `/login/verify` | none | Exchange `{ email, code }` for a JWT → returns JWT + user. Codes are single-use and expire after 10 minutes |
| GET    | `/profile`  | Bearer | Current logged-in user (password-free)          |
| POST   | `/logout`   | Bearer | Revokes the current token                       |
| GET    | `/api/habits` | Bearer | List the current user's habits (oldest first). `?includeArchived=true` includes archived habits |
| POST   | `/api/habits` | Bearer | Create a habit with `{ name, description?, color?, emoji?, frequency?, timesPerPeriod?, archived? }` → `201`. `frequency` must be `DAILY` or `WEEKLY` (default `DAILY`); `timesPerPeriod` must be a positive integer (default `1`) |
| DELETE | `/api/habits/:id` | Bearer | Delete a habit and all of its logs (cascade) |
| GET    | `/api/habits/:id/logs` | Bearer | Raw completion logs, oldest first. Optional `?from=YYYY-MM-DD` / `?to=YYYY-MM-DD` (inclusive) filter by date |
| POST   | `/api/habits/:id/logs` | Bearer | Record a completion with `{ note?, completedAt? }` → `201`. Multiple logs per day are allowed; `completedAt` defaults to now (handy for backfilling) |
| GET    | `/api/habits/:id/history` | Bearer | Aggregated history: `currentStreak`, `longestStreak`, `totalCompletions`, and per-day `{ date, count, goalMet }` entries. `?days=1..365` sets the window (default `30`, ending today) |

**A note on login (passwordless one-time codes):** login is a two-step flow. `POST /login` with an email always returns the same generic `200` message whether or not the account exists (no account enumeration); for a real account it issues a random 6-digit code, stores only its SHA-256 hash in `LoginCode`, and — since this POC has no email provider — **prints the code to the API server console**:

```
[auth] Login code for jane.doe@example.com: 698400 (valid for 10 minutes)
```

Then `POST /login/verify` with `{ email, code }` returns the JWT. Codes expire after **10 minutes**, are **single-use** (cleared on success), and allow at most **5** wrong attempts. Requesting a new code invalidates the previous one.

**A note on habit-route auth:** all `/api/habits` routes respond **`404` (not `401`)** to any unauthenticated request — missing, malformed, expired, or revoked tokens all get `{ "message": "Not found" }`, so the routes appear not to exist. Habit data is always scoped to the logged-in user; another user's habit id also returns `404`.

Streaks and per-day buckets in history use **UTC days**: a day counts toward a streak when its completion count meets the habit's daily goal (`timesPerPeriod` for `DAILY` habits, `1` for `WEEKLY` habits). An unmet "today" doesn't break the current streak.

Example signup (no password):

```
curl -X POST http://localhost:3000/signup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Jane Doe","email":"jane.doe@example.com","age":28}'
```

Example login — request a code, read it from the API console, then verify:

```
# 1. Request a code (check the API server logs for the 6 digits)
curl -X POST http://localhost:3000/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane.doe@example.com"}'

# 2. Exchange the code for a token
curl -X POST http://localhost:3000/login/verify \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane.doe@example.com","code":"698400"}'
```

Use the returned token on protected routes: `Authorization: Bearer <token>`.

Example habit flow (all of these need the Bearer token from signup/login):

```
# Create a habit
curl -X POST http://localhost:3000/api/habits \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Drink water","description":"8 glasses","emoji":"💧","frequency":"DAILY","timesPerPeriod":3}'

# List habits
curl http://localhost:3000/api/habits -H "Authorization: Bearer $TOKEN"

# Log a completion (multiple per day allowed)
curl -X POST http://localhost:3000/api/habits/1/logs \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"note":"glass 1"}'

# Raw logs, filtered to October
curl "http://localhost:3000/api/habits/1/logs?from=2026-10-01&to=2026-10-31" \
  -H "Authorization: Bearer $TOKEN"

# Aggregated history for the last 30 days
curl "http://localhost:3000/api/habits/1/history?days=30" -H "Authorization: Bearer $TOKEN"

# Delete a habit (and its logs)
curl -X DELETE http://localhost:3000/api/habits/1 -H "Authorization: Bearer $TOKEN"
```

#### Current state

- ✅ TypeScript migration — sources in `api/src`, built with `tsc` → `api/dist`, `tsx` for local dev
- ✅ JSON-only API with 404/error handling
- ✅ Healthcheck endpoint
- ✅ JWT auth (HS256, 24h expiry) with signup, passwordless code login, profile, and logout (token revocation)
- ✅ SQLite database via **Prisma v7** (`better-sqlite3` driver adapter) — schema, migrations, and a shared client in `api/src/prisma/db.ts`
- ✅ Database-backed auth — `POST /signup`, `POST /login` (request code), `POST /login/verify`, and `GET /profile` query the `User` table through Prisma; successful logins update `lastLogin`
- ✅ **Passwordless one-time codes** — `LoginCode` rows store a SHA-256 hash (never the code); 6 digits, 10-minute expiry, single-use, 5-attempt limit. No email provider yet, so the code is printed to the API console
- ✅ Seed script (`npm run db:seed`) loads the demo user
- ✅ `Habit` and `HabitLog` tables (migration `add_habits_and_logs`)
- ✅ Habit endpoints — `GET`/`POST` `/api/habits`, `DELETE /api/habits/:id`, `GET`/`POST` `/api/habits/:id/logs`, `GET /api/habits/:id/history` (streaks + per-day counts)
- ✅ Habit routes return `404` (not `401`) for any unauthenticated request, and all queries are scoped to the logged-in user

See `CHANGELOG.md` for a detailed list of changes and `prompts/` for dated session logs.

---

### Mobile Application

Our mobile application is bootstrapped with the default Expo using version 57 of the SDK. This version is important as we will be using the new `expo/ui` to build components for our applications for iOS / Android.