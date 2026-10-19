import 'dotenv/config';

import prisma from '../src/prisma/db.js';
import testUser from '../src/data/test-user.js';
import demoHabits from '../src/data/demo-habits.js';

/** How far back demo completion logs go. */
const HISTORY_DAYS = 45;
const DAY_MS = 86_400_000;

/**
 * Deterministic PRNG (mulberry32) so re-seeding produces the same logs —
 * seeded per user+habit, keeping streaks reproducible across runs.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable seed from the user id + habit name (String.hashCode-style). */
function seedFor(userId: number, name: string): number {
  let h = userId | 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(h, 31) + name.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/**
 * Builds HISTORY_DAYS of plausible completion logs for one habit:
 * - DAILY habits usually hit their goal, but ~20% of days are partial/missed.
 * - The last 4 days always hit the goal, so a current streak exists.
 * - WEEKLY habits get their `timesPerPeriod` completions spread over each week.
 * Times of day are randomised between 7am and 10pm.
 */
function buildLogs(userId: number, habit: (typeof demoHabits)[number]): Date[] {
  const rand = mulberry32(seedFor(userId, habit.name));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates: Date[] = [];

  for (let back = HISTORY_DAYS - 1; back >= 0; back--) {
    const day = new Date(today.getTime() - back * DAY_MS);

    let completions = 0;
    if (habit.frequency === 'DAILY') {
      const roll = rand();
      if (back <= 3) {
        completions = habit.timesPerPeriod; // keep the current streak alive
      } else if (roll < 0.2) {
        completions = 0; // missed day
      } else if (roll < 0.35) {
        completions = Math.max(1, habit.timesPerPeriod - 1); // partial
      } else {
        completions = habit.timesPerPeriod; // goal met
      }
    } else {
      // WEEKLY: a couple of completions per week, on random days
      completions = rand() < 0.55 ? Math.max(1, Math.round(habit.timesPerPeriod)) : 0;
    }

    for (let i = 0; i < completions; i++) {
      const hour = 7 + Math.floor(rand() * 15); // 7:00 – 21:59
      const minute = Math.floor(rand() * 60);
      const when = new Date(day.getTime() + hour * 3_600_000 + minute * 60_000);
      if (when.getTime() <= Date.now()) {
        dates.push(when);
      }
    }
  }

  return dates;
}

/**
 * Seeds the demo user (`api/src/data/test-user.ts`) into SQLite so the auth
 * routes have a real row to check credentials against. Safe to re-run: the
 * user is upserted by email.
 *
 * Then seeds the demo habits (`api/src/data/demo-habits.ts`) with ~6 weeks of
 * completion logs for every user in the database, so the habit endpoints have
 * realistic data (streaks, history, an archived habit) to render. Safe to
 * re-run: habits are matched by name and existing logs are left alone.
 *
 * Run with `npm run db:seed` (or `npx prisma db seed`).
 */
async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: testUser.email },
    update: {
      name: testUser.name,
      home_address: testUser.home_address,
      age: testUser.age,
    },
    create: {
      email: testUser.email,
      name: testUser.name,
      home_address: testUser.home_address,
      age: testUser.age,
    },
  });

  console.log(`Seeded user ${user.email} (id ${user.id})`);

  const users = await prisma.user.findMany({ select: { id: true, email: true } });

  for (const u of users) {
    let habitCount = 0;
    let logCount = 0;

    for (const demo of demoHabits) {
      const existing = await prisma.habit.findFirst({
        where: { userId: u.id, name: demo.name },
      });

      const habit =
        existing ??
        (await prisma.habit.create({
          data: {
            userId: u.id,
            name: demo.name,
            description: demo.description || null,
            color: demo.color,
            emoji: demo.emoji,
            frequency: demo.frequency,
            timesPerPeriod: demo.timesPerPeriod,
            archived: demo.archived,
          },
        }));
      habitCount += 1;

      // Only generate logs for habits that don't have any — never clobber
      // completions someone logged by hand through the API.
      const alreadyLogged = await prisma.habitLog.findFirst({
        where: { habitId: habit.id },
        select: { id: true },
      });
      if (alreadyLogged) continue;

      const dates = buildLogs(u.id, demo);
      if (dates.length > 0) {
        await prisma.habitLog.createMany({
          data: dates.map((completedAt) => ({ habitId: habit.id, completedAt })),
        });
      }
      logCount += dates.length;
    }

    console.log(`Seeded ${habitCount} habits (${logCount} new logs) for ${u.email}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
