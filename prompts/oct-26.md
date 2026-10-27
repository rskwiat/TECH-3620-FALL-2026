# Session Prompts — 2026-10-26

All prompts from tonight's working sessions on the TECH-3620 Fall 2026 Habit Tracker
repo, in order. Four implementation sessions (18:02–19:39) plus the wrap-up request.

---

## Session 1 — 28-day calendar, stats calendar, and weekly chart

### Context

Turning the habit detail screen's "Completed days" list into a visual 28-day calendar,
then extracting it into a shared component for the Stats tab and adding a weekly bar
chart to both screens. Per `habit-tracker/AGENTS.md`, the Expo v57.0.0 docs were read
first.

### Prompts

1. **Change the completed days in the habit [id] page to a 28 calendar that changes opacity on its completion rate.**
   *(new `CompletionCalendar`: four Sunday-first weeks ending on the current week's Saturday, each square filled at `count/goalPerDay` opacity, day number contrasting against the blended fill, screen-reader labels like `Oct 26: 7 of 8 completions, goal met`.)*

2. **make the component resuable we will be using it on the stats page, put in the component/ui folder and make the color the primary color of the app not green.**
   *(`src/components/ui/completion-calendar.tsx` — shared props `entries`, `goalPerDay`, and optional `color` defaulting to the theme `primary`; the habit detail screen passes `history.perDay` straight through.)*

3. **lets add this to the stats page**
   *(Stats tab fetches every non-archived habit's 60-day history in parallel and folds the `perDay` rows into one combined date → count series with the habits' goals summed, rendered through the shared calendar.)*

4. **lets build out a weekly calendar component for the stats page and id pages. should show a bar chart of what's been completed.**
   *(new `src/components/ui/weekly-chart.tsx` — seven bars for the week containing today, height `count/goalPerDay` against a dashed goal line; shared `src/utils/dates.ts` (`dateKey`, `addDays`, `weekEnd`, weekday labels) so the calendar and chart agree on the Sunday→Saturday boundary; both the habit detail and Stats screens render a "This week — completions" section.)*

---

## Session 2 — habit log/delete actions and list refresh

### Context

The habit detail page was view-only. Habit fields stay immutable after creation, so the
work became a log action and a delete action, plus fixing the Today list after a delete.

### Prompts

5. **on the habit page theres no way to update the habit, functionality needs to be above the stat grid**
   *(clarified the intent: no editing once created — instead a **Log habit** action above the stat grid.)*

6. **habit page should not edit the habit once they are set we can delete them. the button should log the habit**
   *(`✅ Log habit` above the stat grid calls `POST /api/habits/:id/logs` via `logHabitCompletion()` and bumps `refreshKey` so streaks, calendar, and chart reload; `🗑 Delete habit` at the bottom confirms first (`Alert.alert` on native, `window.confirm` on web) then calls `deleteHabit()` (`DELETE /api/habits/:id`) and pops back to Today. `src/api.ts` gains `HabitLog`, `logHabitCompletion()`, `deleteHabit()`, and `DELETE` support.)*

7. **when we delete a habit the habit list does not update**
   *(Today screen now refetches on focus with `useFocusEffect`, so returning from the detail screen after a delete shows the updated list; `refreshKey` still covers in-place creates.)*

---

## Session 3 — shared header attempt

### Context

Trying a shared header with a title, welcome subtitle, avatar, and a back button on the
habit detail page. The direction changed mid-session and the work was reverted.

### Prompts

8. **lets build a shared header component that shows the page your on a subtitle of welcome with our username and an avatar for all the pages. Should have a back button the the habit id page to replace the big back button on top**

9. **the header should be top of the page, with just the avatar no other buttons**

10. **revert all the changes**

---

## Session 4 — final shared page header

### Context

Starting over on the header from a clean state: one shared component used across all
pages, top-aligned, avatar plus title only, no subtitle.

### Prompts

11. **revert all the header related changes**

12. **build a shared page header component thats used across all the pages, top aligned with an avatar icon. avatar and title text should be aligned, no subtitles.**
    *(final `src/components/page-header.tsx` — circular `primary` avatar with the user's initials, title on the same line, optional trailing `actions` (Today's **+ New Habit**, the detail screen's back button), web top padding; `PageTemplate` renders it above the scroll container and every `(app)` screen uses the template. Habit detail renders `PageHeader` directly with its back action.)*

---

## Wrap-up

13. **save all prompts from all sessions tonight to a file called oct-26 in the prompts folder**
    *(this file)*

---

## Summary

| Session | Focus | Prompts |
|---------|-------|---------|
| 1 | 28-day calendar, Stats calendar, weekly bar chart | 4 |
| 2 | Log/delete habit actions, Today list refresh | 3 |
| 3 | Shared header attempt, reverted | 3 |
| 4 | Final shared page header | 2 |
| Wrap-up | Save tonight's prompts | 1 |
| **Total** | | **13** |
