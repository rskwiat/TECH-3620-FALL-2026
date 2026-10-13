/**
 * Demo habits seeded into SQLite by `prisma/seed.ts` — one set per user in the
 * database, so the habit endpoints have realistic data (streaks, history,
 * archived habits) to render. Safe to re-run: habits are matched by name and
 * their logs are regenerated deterministically.
 */
export interface DemoHabit {
  name: string;
  description: string | null;
  color: string;
  emoji: string;
  frequency: 'DAILY' | 'WEEKLY';
  timesPerPeriod: number;
  archived: boolean;
}

const demoHabits: DemoHabit[] = [
  {
    name: 'Drink Water',
    description: '8 glasses throughout the day',
    color: '#3b82f6',
    emoji: '💧',
    frequency: 'DAILY',
    timesPerPeriod: 8,
    archived: false,
  },
  {
    name: 'Morning Workout',
    description: '30 minute session to start the day',
    color: '#ef4444',
    emoji: '🏋️',
    frequency: 'DAILY',
    timesPerPeriod: 1,
    archived: false,
  },
  {
    name: 'Read 20 Pages',
    description: 'Any book counts',
    color: '#8b5cf6',
    emoji: '📖',
    frequency: 'DAILY',
    timesPerPeriod: 1,
    archived: false,
  },
  {
    name: 'Meditate',
    description: '10 minutes of guided meditation',
    color: '#06b6d4',
    emoji: '🧘',
    frequency: 'DAILY',
    timesPerPeriod: 1,
    archived: false,
  },
  {
    name: 'Walk 10,000 Steps',
    description: '',
    color: '#22c55e',
    emoji: '🚶',
    frequency: 'DAILY',
    timesPerPeriod: 1,
    archived: false,
  },
  {
    name: 'Take Vitamins',
    description: 'Morning and evening dose',
    color: '#f59e0b',
    emoji: '💊',
    frequency: 'DAILY',
    timesPerPeriod: 2,
    archived: false,
  },
  {
    name: 'Practice Guitar',
    description: '20 minutes of scales and songs',
    color: '#ec4899',
    emoji: '🎸',
    frequency: 'DAILY',
    timesPerPeriod: 1,
    archived: false,
  },
  {
    name: 'Journal',
    description: 'Three things I am grateful for',
    color: '#a3e635',
    emoji: '✍️',
    frequency: 'DAILY',
    timesPerPeriod: 1,
    archived: false,
  },
  {
    name: 'Deep Work Block',
    description: 'One 90 minute focus block, no notifications',
    color: '#6366f1',
    emoji: '🎯',
    frequency: 'DAILY',
    timesPerPeriod: 1,
    archived: false,
  },
  {
    name: 'No Social Before 9am',
    description: 'Keep the first hours of the day offline',
    color: '#64748b',
    emoji: '📵',
    frequency: 'DAILY',
    timesPerPeriod: 1,
    archived: true,
  },
  {
    name: 'Call Family',
    description: 'Catch up with a phone call',
    color: '#f97316',
    emoji: '📞',
    frequency: 'WEEKLY',
    timesPerPeriod: 1,
    archived: false,
  },
  {
    name: 'Meal Prep',
    description: 'Plan and prep meals for the week',
    color: '#14b8a6',
    emoji: '🥗',
    frequency: 'WEEKLY',
    timesPerPeriod: 1,
    archived: false,
  },
  {
    name: 'Log Expenses',
    description: 'Review spending from the past week',
    color: '#eab308',
    emoji: '💰',
    frequency: 'WEEKLY',
    timesPerPeriod: 2,
    archived: false,
  },
];

export default demoHabits;
