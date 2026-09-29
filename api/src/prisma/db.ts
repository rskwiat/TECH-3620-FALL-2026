import 'dotenv/config';

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

import { PrismaClient } from './generated/client.js';

/**
 * Prisma v7 requires a driver adapter — there is no built-in engine anymore.
 * For SQLite we use the `better-sqlite3` adapter, pointed at the SQLite file
 * referenced by `DATABASE_URL` in `api/.env`.
 */
const connectionString = process.env.DATABASE_URL ?? 'file:./db/dev.db';
const adapter = new PrismaBetterSqlite3({ url: connectionString });

/** A single PrismaClient is shared across the whole app. */
export const prisma = new PrismaClient({ adapter });

export default prisma;
