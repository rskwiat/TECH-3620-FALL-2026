/**
 * Demo credentials used to seed SQLite — see `prisma/seed.ts`.
 * The auth routes no longer read from this fixture; they query the database.
 */
export interface TestUser {
  name: string;
  email: string;
  password: string;
  home_address: string | null;
  age: number;
  createdAt: string;
  lastUpdated: string;
  lastLogin: string | null;
}

const testUser: TestUser = {
  name: 'Jane Doe',
  email: 'jane.doe@example.com',
  password: 'hunter2',
  home_address: null,
  age: 28,
  createdAt: '2026-09-21T22:00:00.000Z',
  lastUpdated: '2026-09-21T22:00:00.000Z',
  lastLogin: null
};

export default testUser;
