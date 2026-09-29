import 'dotenv/config';

import { defineConfig, env } from 'prisma/config';

/**
 * Prisma v7 no longer reads the connection URL from `schema.prisma` — it lives
 * here instead. `dotenv/config` loads `api/.env`, which is where `DATABASE_URL`
 * is defined for both the CLI (`prisma migrate`, `prisma studio`) and the app.
 */
export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    // Seed command used by `prisma db seed` (and after `prisma migrate dev`).
    seed: 'tsx prisma/seed.ts',
  },
});
