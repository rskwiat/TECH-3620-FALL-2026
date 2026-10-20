import express from 'express';
import type { NextFunction, Request, Response } from 'express';

import { revoke } from '../data/token-denylist.js';
import { requireTokenOr404 } from '../middleware/auth.js';
import prisma from '../prisma/db.js';

const router = express.Router();

// Like the habit routes, account routes answer 404 (not 401) when the caller
// isn't authenticated, so they appear not to exist.
router.use(requireTokenOr404);

/** The email (`sub`) of the authenticated user, or '' when somehow absent. */
function currentUserEmail(req: Request): string {
  return typeof req.user?.sub === 'string' ? req.user.sub.trim().toLowerCase() : '';
}

/** Escapes one CSV field, quoting only when it contains a comma, quote or newline. */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Column order for `GET /api/account/export`. */
const CSV_COLUMNS = [
  'habit_id',
  'habit_name',
  'description',
  'emoji',
  'color',
  'frequency',
  'times_per_period',
  'archived',
  'habit_created_at',
  'completed_at',
  'note',
] as const;

/* GET /api/account/export — downloads the user's habits and completion logs as CSV. */
router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = currentUserEmail(req);
    const user = email
      ? await prisma.user.findUnique({
          where: { email },
          include: {
            habits: {
              orderBy: { createdAt: 'asc' },
              include: { logs: { orderBy: { completedAt: 'asc' } } },
            },
          },
        })
      : null;

    if (!user) {
      res.status(404).json({ message: 'Not found' });
      return;
    }

    const rows: unknown[][] = [];

    for (const habit of user.habits) {
      const habitFields = [
        habit.id,
        habit.name,
        habit.description,
        habit.emoji,
        habit.color,
        habit.frequency,
        habit.timesPerPeriod,
        habit.archived,
        habit.createdAt.toISOString(),
      ];

      if (habit.logs.length === 0) {
        rows.push([...habitFields, '', '']);
        continue;
      }

      for (const log of habit.logs) {
        rows.push([...habitFields, log.completedAt.toISOString(), log.note]);
      }
    }

    const csv = [CSV_COLUMNS, ...rows]
      .map((row) => row.map(csvField).join(','))
      .join('\r\n');

    // POC: the export is written to the server log instead of being stored or
    // emailed. Swap this for a file/object store when the export grows up.
    console.log(
      `[account-export] ${user.email}: ${rows.length} row(s)\n${csv}`
    );

    const filename = `habit-tracker-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res
      .type('text/csv')
      .set('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csv);
  } catch (error) {
    next(error);
  }
});

/* DELETE /api/account — permanently deletes the user, their habits, and logs. */
router.delete('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = currentUserEmail(req);
    const user = email ? await prisma.user.findUnique({ where: { email } }) : null;

    if (!user) {
      res.status(404).json({ message: 'Not found' });
      return;
    }

    // Habits and logs go with the user (onDelete: Cascade in the schema).
    await prisma.user.delete({ where: { id: user.id } });

    // The account is gone, but revoke the current token too so it can't be
    // replayed before it expires.
    const exp = req.user?.exp ?? Math.floor(Date.now() / 1000) + 86400;
    if (req.user?.jti) {
      revoke(req.user.jti, exp);
    }

    res.json({ message: 'Account deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
