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

Data will be stored in a SQLite database created in the `api/db` folder (not yet implemented — routes currently use a test-user fixture).

#### Running the API

```
cd api
npm install
npm start
```

The server starts on `http://localhost:3000`. JWT secrets are loaded from `api/.env` (copy `api/.env.example` and set `JWT_SECRET` if setting up fresh).

#### Endpoints

| Method | Path        | Auth   | Description                                     |
|--------|-------------|--------|-------------------------------------------------|
| GET    | `/`         | none   | JSON placeholder                                |
| GET    | `/users`    | none   | JSON placeholder                                |
| GET    | `/health`   | none   | Healthcheck — returns `{ status, uptime, timestamp }` |
| POST   | `/login`    | none   | Login with `{ email, password }` → returns JWT + user |
| GET    | `/profile`  | Bearer | Current logged-in user (password-free)          |
| POST   | `/logout`   | Bearer | Revokes the current token                       |

Example login:

```
curl -X POST http://localhost:3000/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane.doe@example.com","password":"hunter2"}'
```

Use the returned token on protected routes: `Authorization: Bearer <token>`.

#### Current state

- ✅ JSON-only API with 404/error handling
- ✅ Healthcheck endpoint
- ✅ JWT auth (HS256, 24h expiry) with login, profile, and logout (token revocation)
- ⏳ SQLite database in `api/db` (planned)
- ⏳ Password hashing with bcrypt (currently plain-text against a test fixture)
- ⏳ Habit CRUD endpoints

See `CHANGELOG.md` for a detailed list of changes and `prompts/` for dated session logs.

---

### Mobile Application

Our mobile application is bootstrapped with the default Expo using version 57 of the SDK. This version is important as we will be using the new `expo/ui` to build components for our applications for iOS / Android.