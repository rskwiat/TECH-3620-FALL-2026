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

/** Successful `POST /login/verify` and `POST /signup` responses. */
export type AuthResponse = {
  token: string;
  tokenType: string;
  expiresIn: number;
  user: User;
};

/** Generic acknowledgement, e.g. a login-code request. */
export type MessageResponse = {
  message: string;
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
  method?: 'GET' | 'POST';
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

/**
 * Requests a one-time login code for an email. The server always returns the
 * same generic message and (in this POC) prints the code to its console —
 * there is no email provider wired up yet.
 */
export function requestLoginCode(email: string): Promise<MessageResponse> {
  return request<MessageResponse>('/login', { method: 'POST', body: { email } });
}

/** Exchanges a 6-digit code for a JWT + user. */
export function verifyLoginCode(email: string, code: string): Promise<AuthResponse> {
  return request<AuthResponse>('/login/verify', { method: 'POST', body: { email, code } });
}

export type SignupInput = {
  name: string;
  email: string;
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
