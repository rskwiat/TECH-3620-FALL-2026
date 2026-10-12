import express from 'express';
import type { NextFunction, Request, Response } from 'express';

import { requireTokenOr404 } from '../middleware/auth.js';
import prisma from '../prisma/db.js';

const router = express.Router();

// Hide every habit route behind auth — unauthenticated callers get 404, not
// 401, so the routes appear not to exist.
router.use(requireTokenOr404);

/** Frequencies a habit may use. Prisma enums aren't supported on SQLite, so this is a string column. */
const FREQUENCIES = ['DAILY', 'WEEKLY'] as const;
type Frequency = (typeof FREQUENCIES)[number];

/** Upper bound on how much history one request may cover. */
const MAX_HISTORY_DAYS = 365;
const DEFAULT_HISTORY_DAYS = 30;

/** The email (`sub`) of the authenticated user, or '' when somehow absent. */
function currentUserEmail(req: Request): string {
  return typeof req.user?.sub === 'string' ? req.user.sub.trim().toLowerCase() : '';
}

/** Today's date in UTC, normalised to midnight — logs are bucketed by UTC day. */
function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** The number of completions needed on a single day for the habit's goal to count as met. */
function dailyGoal(habit: { frequency: string; timesPerPeriod: number }): number {
  return habit.frequency === 'DAILY' ? habit.timesPerPeriod : 1;
}

/**
 * Finds a habit by id that belongs to the authenticated user.
 * Returns the habit, or null when it doesn't exist or belongs to someone else
 * (callers respond 404 either way, so ownership isn't leaked).
 */
async function findOwnHabit(req: Request, habitId: number) {
  const email = currentUserEmail(req);
  if (!email) return null;

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return null;

  return prisma.habit.findFirst({ where: { id: habitId, userId: user.id } });
}

/** Parses a positive integer path param; returns null when malformed. */
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/* GET /api/habits — list the authenticated user's habits. */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = currentUserEmail(req);
    const user = email ? await prisma.user.findUnique({ where: { email }, select: { id: true } }) : null;

    if (!user) {
      res.status(404).json({ message: 'Not found' });
      return;
    }

    const includeArchived = req.query.includeArchived === 'true';

    const habits = await prisma.habit.findMany({
      where: { userId: user.id, ...(includeArchived ? {} : { archived: false }) },
      orderBy: { createdAt: 'asc' },
    });

    res.json(habits);
  } catch (error) {
    next(error);
  }
});

/* POST /api/habits — create a habit for the authenticated user. */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  const body = req.body ?? {};

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    res.status(400).json({ message: 'Name is required' });
    return;
  }

  if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
    res.status(400).json({ message: 'Description must be a string' });
    return;
  }

  if (body.color !== undefined && body.color !== null && typeof body.color !== 'string') {
    res.status(400).json({ message: 'Color must be a string' });
    return;
  }

  if (body.emoji !== undefined && body.emoji !== null && typeof body.emoji !== 'string') {
    res.status(400).json({ message: 'Emoji must be a string' });
    return;
  }

  const frequency = body.frequency ?? 'DAILY';
  if (!FREQUENCIES.includes(frequency)) {
    res.status(400).json({ message: `Frequency must be one of: ${FREQUENCIES.join(', ')}` });
    return;
  }

  const timesPerPeriod = body.timesPerPeriod ?? 1;
  if (!Number.isInteger(timesPerPeriod) || timesPerPeriod < 1) {
    res.status(400).json({ message: 'Times per period must be a positive integer' });
    return;
  }

  if (body.archived !== undefined && typeof body.archived !== 'boolean') {
    res.status(400).json({ message: 'Archived must be a boolean' });
    return;
  }

  try {
    const email = currentUserEmail(req);
    const user = email ? await prisma.user.findUnique({ where: { email }, select: { id: true } }) : null;

    if (!user) {
      res.status(404).json({ message: 'Not found' });
      return;
    }

    const habit = await prisma.habit.create({
      data: {
        userId: user.id,
        name,
        description: body.description?.trim() || null,
        color: body.color ?? null,
        emoji: body.emoji ?? null,
        frequency,
        timesPerPeriod,
        archived: body.archived ?? false,
      },
    });

    res.status(201).json(habit);
  } catch (error) {
    next(error);
  }
});

/* DELETE /api/habits/:id — delete a habit (and its logs, via cascade). */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  try {
    const habit = await findOwnHabit(req, id);
    if (!habit) {
      res.status(404).json({ message: 'Not found' });
      return;
    }

    await prisma.habit.delete({ where: { id: habit.id } });
    res.json({ message: 'Habit deleted' });
  } catch (error) {
    next(error);
  }
});

/* GET /api/habits/:id/logs — raw completion logs, oldest first.
   Optional ?from= and ?to= ISO dates filter by completedAt. */
router.get('/:id/logs', async (req: Request, res: Response, next: NextFunction) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  const from = parseDateParam(req.query.from);
  const to = parseDateParam(req.query.to);
  if (req.query.from !== undefined && !from) {
    res.status(400).json({ message: 'from must be an ISO date (YYYY-MM-DD)' });
    return;
  }
  if (req.query.to !== undefined && !to) {
    res.status(400).json({ message: 'to must be an ISO date (YYYY-MM-DD)' });
    return;
  }

  try {
    const habit = await findOwnHabit(req, id);
    if (!habit) {
      res.status(404).json({ message: 'Not found' });
      return;
    }

    const logs = await prisma.habitLog.findMany({
      where: {
        habitId: habit.id,
        ...(from ? { completedAt: { gte: from } } : {}),
        // `to` is inclusive of the whole day, so compare against midnight next day.
        ...(to ? { completedAt: { lt: new Date(to.getTime() + 86_400_000) } } : {}),
      },
      orderBy: { completedAt: 'asc' },
    });

    res.json(logs);
  } catch (error) {
    next(error);
  }
});

/* POST /api/habits/:id/logs — record a completion (multiple per day are allowed). */
router.post('/:id/logs', async (req: Request, res: Response, next: NextFunction) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  const body = req.body ?? {};

  if (body.note !== undefined && body.note !== null && typeof body.note !== 'string') {
    res.status(400).json({ message: 'Note must be a string' });
    return;
  }

  // `completedAt` is optional — defaults to now, but clients may backfill a log.
  let completedAt = new Date();
  if (body.completedAt !== undefined && body.completedAt !== null) {
    completedAt = new Date(body.completedAt);
    if (Number.isNaN(completedAt.getTime())) {
      res.status(400).json({ message: 'completedAt must be a valid ISO date' });
      return;
    }
  }

  try {
    const habit = await findOwnHabit(req, id);
    if (!habit) {
      res.status(404).json({ message: 'Not found' });
      return;
    }

    const log = await prisma.habitLog.create({
      data: {
        habitId: habit.id,
        completedAt,
        note: body.note?.trim() || null,
      },
    });

    res.status(201).json(log);
  } catch (error) {
    next(error);
  }
});

/* GET /api/habits/:id/history — aggregated history: per-day completion counts
   plus current and longest streaks.
   Optional ?days=1..365 selects the window (default 30, ending today). */
router.get('/:id/history', async (req: Request, res: Response, next: NextFunction) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  let days = DEFAULT_HISTORY_DAYS;
  if (req.query.days !== undefined) {
    days = Number(req.query.days);
    if (!Number.isInteger(days) || days < 1 || days > MAX_HISTORY_DAYS) {
      res.status(400).json({ message: `days must be an integer between 1 and ${MAX_HISTORY_DAYS}` });
      return;
    }
  }

  try {
    const habit = await findOwnHabit(req, id);
    if (!habit) {
      res.status(404).json({ message: 'Not found' });
      return;
    }

    const goal = dailyGoal(habit);
    const today = utcDay(new Date());
    // Inclusive window: [start, today].
    const start = new Date(today.getTime() - (days - 1) * 86_400_000);

    const logs = await prisma.habitLog.findMany({
      where: { habitId: habit.id, completedAt: { gte: start } },
      select: { completedAt: true },
    });

    // Bucket logs into per-day counts (UTC days).
    const counts = new Map<string, number>();
    for (const log of logs) {
      const key = utcDay(log.completedAt).toISOString().slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const perDay: { date: string; count: number; goalMet: boolean }[] = [];
    for (let t = start.getTime(); t <= today.getTime(); t += 86_400_000) {
      const date = new Date(t).toISOString().slice(0, 10);
      const count = counts.get(date) ?? 0;
      perDay.push({ date, count, goalMet: count >= goal });
    }

    // Streaks: consecutive days where the goal was met. Today counts only once
    // met — an unmet "today" doesn't break the streak yet.
    let longestStreak = 0;
    let run = 0;
    for (const day of perDay) {
      if (day.goalMet) {
        run += 1;
        longestStreak = Math.max(longestStreak, run);
      } else if (day.date !== today.toISOString().slice(0, 10)) {
        run = 0;
      }
    }

    let currentStreak = 0;
    for (let i = perDay.length - 1; i >= 0; i--) {
      if (perDay[i].goalMet) {
        currentStreak += 1;
      } else if (perDay[i].date === today.toISOString().slice(0, 10)) {
        continue; // today's goal not met yet — doesn't break the streak
      } else {
        break;
      }
    }

    res.json({
      habitId: habit.id,
      frequency: habit.frequency,
      timesPerPeriod: habit.timesPerPeriod,
      goalPerDay: goal,
      range: { from: start.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) },
      totalCompletions: logs.length,
      currentStreak,
      longestStreak,
      perDay,
    });
  } catch (error) {
    next(error);
  }
});

/** Parses a YYYY-MM-DD query value into a UTC Date, or null when malformed. */
function parseDateParam(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = utcDay(new Date(`${value}T00:00:00Z`));
  return Number.isNaN(date.getTime()) ? null : date;
}

export default router;
