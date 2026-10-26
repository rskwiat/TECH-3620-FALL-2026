# Final Prompts — TECH-3620 Fall 2026 Habit Tracker

Every working-session prompt for this project, in chronological order. Consolidates the
dated session files in this folder plus the settings/export session that followed.

---

## 2026-09-21 — JSON API foundation

Context: converting the `api/` Express app from the express-generator template to a
JSON-only API, then adding JWT auth and a changelog.

1. **explain this codebase**

2. **in the api folder, lets remove the jade views and styling. return only json.**

3. **lets leave the cookie-parser in for now**

4. **lets build**

5. **lets build a healthcheck endpoint to verify that the server is running**

6. **build it**

7. **In the api folder, lets generate a test user object with the provided fields: name, email, password home_address (optional), age, createdAt, lastUpdated, lastLogin**

8. **A**

9. **build it**

10. **lets implement a user login route for the test-user, should take email and password**

11. **lets setup the JWT for the login for future proofing**

12. **lets add dotenv for the secret**

13. **lets build**

14. **build a /profile endpoint to get the current logged in user**

15. **build**

16. **build logout route to clear jwt**

17. **create a changelog of all the work we did today**

18. **save all the prompts we did in dated file to share**

---

## 2026-09-28 — Prisma persistence and the app auth flow

### Session 1 — API persistence with Prisma

Context: adding Prisma v7 + SQLite, moving auth onto the database with bcrypt, adding
signup, and making `age` optional.

1. **add prisma v7 to the api, use sqlite for the database driver**

2. **migrate the login to use the database and prisma schema**

3. **add a signup route using prisma to create accounts**

4. **make age optional**

5. **save these prompts to the prompts folder as a markdown with todays date**

### Session 2 — habit-tracker auth flow

Context: adding login/signup screens, the session context, storage persistence, and
protected routes to the Expo app (SDK 57).

6. **in the habit-tracker app lets add in user auth flow, login, signup and authenticated homepage. unauth users shold go to login**

7. **ecure storage is unavailable: [Error: Invalid key provided to SecureStore. Keys must not be empty and contain only alphanumeric characters, ".", "-", and "_".]**

8. **save these prompts to the prompts folder as a markdown with todays date**

---

## 2026-10-05 — authenticated tab pages

Context: replacing the starter Home/Explore tabs with Today, Weekly, Stats, and Settings,
moving all account UI to Settings, and giving each tab a templated page.

1. **Build out templated pages for Today, Weekly, Stats and Settings inside of (app), move all user login to settings. All other pages should have default title pages related to their tab name.**

2. **save the prompts to the prompts folder with todays date**

---

## 2026-10-12 — Today screen and habit API

### Session 1 — Today screen: habit list, streaks, and the New Habit modal

Context: building the Today tab against `GET /api/habits`, `GET /api/habits/:id/history`,
and `POST /api/habits`, including the New Habit modal.

1. **In the habit tracker, build out the TodayScreen showing all of todays habits tracked in a flatlist component showing just the title of the habit for now.**

2. **lets add in our streak counter, emoji and last updated to the renderedItem list**

3. **remove the description in the flatlist (<ThemedText themeColor="textSecondary">The habits you're checking off right now.</ThemedText>) add a button thats on the right side of the UI with the label of + New Habit, opens a new habit modal from React Native.**

4. **save the prompts**

### Session 2 — Habit tracker API: tables, endpoints, docs, and seed data

Context: adding the `Habit`/`HabitLog` Prisma models and all `/api/habits` routes, then
documenting and seeding them.

1. **build out the api and endpoint for the habit tracker, we need endpoints for GET habits, POST habits, GET logs, GET History and tables for saving habit data. Before writing anything ask me more questions. These routes should only work for authenticated users all other users will should get a 404**

2. **update the readme with this info**

3. **seed some habit data 10 to 15 habits to our user thats in our database**

4. **save the prompts**

---

## 2026-10-19 — Habit detail screen

### Session 1 — habit detail screen: streaks, best streak, and completed days

Context: making Today rows open a view-only detail route at the root stack level
(`src/app/habit/[id].tsx`) showing current streak, best streak, total completions, and
recent completed days.

1. **when clicking on the renderedItem on the homepage, i want to goto a more detailed screen showing the current streak, best streak and completed habits**
   - Chose **Stats + recent days list** for the completed section.
   - Chose **No, view-only** — no log-completion action.

2. **save this sessions prompts**

### Session 2 — Settings: CSV export and account deletion

Context: adding data controls to the Settings tab plus the API endpoints behind them
(`GET /api/account/export`, `DELETE /api/account`). For the POC, the API also prints the
exported CSV to the server log.

1. **settings page -- add ability to export data as csv and delete account. create new endpoint if needed, for POC log out the export in the api.**

2. **save all prompts in a file called final-prompts in prompts folder**

---

## 2026-10-23 — Log habit completions

Context: wiring the app to the existing `POST /api/habits/:id/logs` endpoint, adding a Today
progress card and **Log completion** button to the habit detail screen, and refreshing the
Today/Weekly/Stats tabs when they regain focus.

1. **currently there is no way to add to your habit logs, when clicking on a habit from the homescreen you should be able to add to your habit data**

2. **save all prompts**

---

## Summary

| Date | Session | Prompts |
|------|---------|---------|
| 2026-09-21 | API foundation | 18 |
| 2026-09-28 | Prisma + auth flow | 8 |
| 2026-10-05 | Authenticated tabs | 2 |
| 2026-10-12 | Today screen + habit API | 8 |
| 2026-10-19 | Habit detail + settings data controls | 4 |
| 2026-10-23 | Habit logging | 2 |
| **Total** | | **42** |
