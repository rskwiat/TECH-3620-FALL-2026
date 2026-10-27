/**
 * Thin client for the Express API in `api/`.
 *
 * The base URL comes from `EXPO_PUBLIC_API_URL` (see `.env`), which defaults to
 * the local dev server. Point it at your machine's LAN address when testing on
 * a physical device, for example `EXPO_PUBLIC_API_URL=http://192.168.1.20:3000`.
 */
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/** The password-free user shape returned by the API (`toPublicUser()`). */
export type User = {
  id: number;
  name: string;
  email: string;
  home_address: string | null;
  age: number | null;
  createdAt: string;
  lastUpdated: string;
  lastLogin: string | null;
};

/** Successful `POST /login` and `POST /signup` responses. */
export type AuthResponse = {
  token: string;
  tokenType: string;
  expiresIn: number;
  user: User;
};

/** Error with the HTTP status attached so screens can react to 401/409/etc. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: Record<string, unknown>;
  token?: string | null;
};

async function request<T>(path: string, { method = 'GET', body, token }: RequestOptions): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Is the API running?');
  }

  const json = (await response.json().catch(() => null)) as { message?: string } | null;

  if (!response.ok) {
    throw new ApiError(response.status, json?.message ?? 'Something went wrong. Please try again.');
  }

  return json as T;
}

/** Email/password login → JWT + user. */
export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/login', { method: 'POST', body: { email, password } });
}

export type SignupInput = {
  name: string;
  email: string;
  password: string;
  age?: number | null;
  home_address?: string | null;
};

/** Creates an account and logs the user in → `201` + JWT + user. */
export function signup(input: SignupInput): Promise<AuthResponse> {
  return request<AuthResponse>('/signup', { method: 'POST', body: input });
}

/** Revokes the current token on the server. */
export function logout(token: string): Promise<{ message: string }> {
  return request<{ message: string }>('/logout', { method: 'POST', token });
}

/** Fetches the logged-in user for a token (`401` when the token expired). */
export function getProfile(token: string): Promise<User> {
  return request<User>('/profile', { token });
}

/** A habit row as returned by `GET /api/habits` (the Prisma `Habit` model). */
export type Habit = {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  color: string | null;
  emoji: string | null;
  /** `'DAILY'` or `'WEEKLY'`. */
  frequency: 'DAILY' | 'WEEKLY';
  /** Completions needed per frequency period (per day for `DAILY` habits). */
  timesPerPeriod: number;
  archived: boolean;
  createdAt: string;
  lastUpdated: string;
};

/**
 * Lists the logged-in user's habits, oldest first. Archived habits are left
 * out unless `includeArchived` is set. Habit routes answer `404` (not `401`)
 * for missing or expired tokens, so a rejected fetch still surfaces a message
 * the screen can show.
 */
export function getHabits(token: string, options?: { includeArchived?: boolean }): Promise<Habit[]> {
  const query = options?.includeArchived ? '?includeArchived=true' : '';
  return request<Habit[]>(`/api/habits${query}`, { token });
}

/**
 * Aggregated history from `GET /api/habits/:id/history` — streaks plus a
 * per-day completion breakdown over the requested window.
 */
export type HabitHistory = {
  habitId: number;
  frequency: 'DAILY' | 'WEEKLY';
  timesPerPeriod: number;
  /** Completions needed on one day for the goal to count as met. */
  goalPerDay: number;
  range: { from: string; to: string };
  totalCompletions: number;
  /** Consecutive goal-met days ending today (an unmet today doesn't break it). */
  currentStreak: number;
  longestStreak: number;
  perDay: { date: string; count: number; goalMet: boolean }[];
};

/**
 * History window the app requests per habit, in days. The API defaults to 30,
 * which would clip any streak that started earlier; the seed generates ~45
 * days of logs, and the API caps the window at 365.
 */
export const HISTORY_WINDOW_DAYS = 60;

/**
 * Fetches one habit's history. `days` picks the window (1–365, default 30) —
 * a longer window is needed before `currentStreak` stops clipping streaks
 * that started before it.
 */
export function getHabitHistory(
  token: string,
  habitId: number,
  options?: { days?: number },
): Promise<HabitHistory> {
  const query = options?.days ? `?days=${options.days}` : '';
  return request<HabitHistory>(`/api/habits/${habitId}/history${query}`, { token });
}

/** Fields accepted by `POST /api/habits` — only `name` is required. */
export type NewHabitInput = {
  name: string;
  description?: string;
  color?: string;
  emoji?: string;
  frequency?: Habit['frequency'];
  timesPerPeriod?: number;
};

/** Creates a habit for the logged-in user → `201` + the created habit row. */
export function createHabit(token: string, input: NewHabitInput): Promise<Habit> {
  return request<Habit>('/api/habits', { method: 'POST', body: input, token });
}

/** A completion log row as returned by `GET /api/habits/:id/logs`. */
export type HabitLog = {
  id: number;
  habitId: number;
  completedAt: string;
  note: string | null;
  createdAt: string;
};

/**
 * Records one completion of a habit → `201` + the created log row. Defaults to
 * "now"; multiple completions per day are allowed, which is how a habit's
 * `timesPerPeriod` goal gets met.
 */
export function logHabitCompletion(
  token: string,
  habitId: number,
  input?: { note?: string; completedAt?: string },
): Promise<HabitLog> {
  return request<HabitLog>(`/api/habits/${habitId}/logs`, {
    method: 'POST',
    body: input ?? {},
    token,
  });
}

/**
 * Deletes a habit → `{ message }`. The habit's logs cascade-delete with it on
 * the server, so this is permanent — worth a confirm before calling.
 */
export function deleteHabit(token: string, habitId: number): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/habits/${habitId}`, { method: 'DELETE', token });
}
