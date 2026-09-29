import 'dotenv/config';

import prisma from '../src/prisma/db.js';
import { hashPassword } from '../src/data/passwords.js';
import testUser from '../src/data/test-user.js';

/**
 * Seeds the demo user (`api/src/data/test-user.ts`) into SQLite so the auth
 * routes have a real row to check credentials against. Safe to re-run: the
 * user is upserted by email.
 *
 * Run with `npm run db:seed` (or `npx prisma db seed`).
 */
async function main(): Promise<void> {
  const password = await hashPassword(testUser.password);

  const user = await prisma.user.upsert({
    where: { email: testUser.email },
    update: {
      name: testUser.name,
      password,
      home_address: testUser.home_address,
      age: testUser.age,
    },
    create: {
      email: testUser.email,
      name: testUser.name,
      password,
      home_address: testUser.home_address,
      age: testUser.age,
    },
  });

  console.log(`Seeded user ${user.email} (id ${user.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
