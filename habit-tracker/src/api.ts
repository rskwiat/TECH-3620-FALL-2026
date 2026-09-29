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
