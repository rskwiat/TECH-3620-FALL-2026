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

Data is stored in a SQLite database in the `api/db` folder, accessed through **Prisma ORM v7** (the `better-sqlite3` driver adapter). The Prisma schema lives in `api/prisma/schema.prisma` and the shared client in `api/src/prisma/db.ts`. The auth routes (`/signup`, `/login`, `/profile`) read users from the `User` table; the test-user fixture now only supplies the seed data.

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
| `npm run db:seed`     | Upserts the demo user into SQLite (`tsx prisma/seed.ts`, bcrypt-hashed password) |
| `npm run db:studio`   | Opens Prisma Studio to browse `api/db/dev.db` |

The server starts on `http://localhost:3000`. Environment variables are loaded from `api/.env` (copy `api/.env.example` and set `JWT_SECRET` if setting up fresh — `DATABASE_URL` points at the SQLite file and defaults to `file:./db/dev.db`).

#### Database (Prisma v7 + SQLite)

- `api/prisma/schema.prisma` — the schema; the `User` model mirrors the test-user fixture (`name`, `email`, `password`, `home_address`, optional `age`, `createdAt`, `lastUpdated`, `lastLogin`).
- `api/prisma.config.ts` — Prisma v7 config; the connection URL (`DATABASE_URL`) is read from `api/.env` here instead of from the schema.
- `api/prisma/migrations/` — migration history (commit these).
- `api/prisma/seed.ts` — `npm run db:seed` upserts the demo user from `src/data/test-user.ts` with a **bcrypt**-hashed password (also wired as `migrations.seed` in `prisma.config.ts`, so `npx prisma db seed` works).
- `api/src/prisma/db.ts` — exports a single shared `PrismaClient` wired to the `better-sqlite3` driver adapter. Import it anywhere: `import { prisma } from '../prisma/db.js'`.
- `api/src/prisma/generated/` — generated client code (gitignored; re-create with `npm run db:generate` or `npm run db:migrate`). **Regenerate after every schema change** — a stale client still type-checks but fails at runtime, which is why `db:migrate` chains `prisma generate` onto `prisma migrate dev`.
- `api/db/dev.db` — the SQLite database file itself (gitignored).

#### Endpoints

| Method | Path        | Auth   | Description                                     |
|--------|-------------|--------|-------------------------------------------------|
| GET    | `/`         | none   | JSON placeholder                                |
| GET    | `/users`    | none   | JSON placeholder                                |
| GET    | `/health`   | none   | Healthcheck — returns `{ status, uptime, timestamp }` |
| POST   | `/signup`   | none   | Create an account with `{ name, email, password, age?, home_address? }` → `201` + JWT + user |
| POST   | `/login`    | none   | Login with `{ email, password }` → returns JWT + user |
| GET    | `/profile`  | Bearer | Current logged-in user (password-free)          |
| POST   | `/logout`   | Bearer | Revokes the current token                       |

Example signup:

```
curl -X POST http://localhost:3000/signup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Jane Doe","email":"jane.doe@example.com","password":"hunter2","age":28}'
```

Example login:

```
curl -X POST http://localhost:3000/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane.doe@example.com","password":"hunter2"}'
```

Use the returned token on protected routes: `Authorization: Bearer <token>`.

#### Current state

- ✅ TypeScript migration — sources in `api/src`, built with `tsc` → `api/dist`, `tsx` for local dev
- ✅ JSON-only API with 404/error handling
- ✅ Healthcheck endpoint
- ✅ JWT auth (HS256, 24h expiry) with signup, login, profile, and logout (token revocation)
- ✅ SQLite database via **Prisma v7** (`better-sqlite3` driver adapter) — schema, migrations, and a shared client in `api/src/prisma/db.ts`
- ✅ Database-backed auth — `POST /signup`, `POST /login`, and `GET /profile` query the `User` table through Prisma; logins update `lastLogin`
- ✅ Passwords hashed with **bcrypt** (the `password` column stores a hash, never plain text)
- ✅ Seed script (`npm run db:seed`) loads the demo user
- ⏳ Habit CRUD endpoints

See `CHANGELOG.md` for a detailed list of changes and `prompts/` for dated session logs.

---

### Mobile Application

Our mobile application is bootstrapped with the default Expo using version 57 of the SDK. This version is important as we will be using the new `expo/ui` to build components for our applications for iOS / Android.