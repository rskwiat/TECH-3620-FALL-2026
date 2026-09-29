import { use, createContext, useEffect, useRef, type PropsWithChildren } from 'react';

import {
  ApiError,
  getProfile,
  login as requestLogin,
  logout as requestLogout,
  signup as requestSignup,
} from '@/api';
import type { SignupInput, User } from '@/api';
import { useStorageState } from '@/useStorageState';

/** What we persist between launches: the JWT plus the user it belongs to. */
type Session = {
  token: string;
  user: User;
};

type AuthContextValue = {
  /** Raw stored session, `null` when signed out. */
  session: Session | null;
  /** Convenience view of `session.user`. */
  user: User | null;
  /** `true` while the stored session is being restored from disk. */
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignupInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// SecureStore keys allow only alphanumerics plus ".", "-" and "_", so no "/" here.
const STORAGE_KEY = 'habit-tracker.session';

/** Parses what is in storage, tolerating anything that isn't a valid session. */
function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.token === 'string' && parsed.user && typeof parsed.user.email === 'string') {
      return { token: parsed.token, user: parsed.user };
    }
  } catch {
    // Corrupt value — treat the user as signed out.
  }
  return null;
}

/** Use this hook to access the signed-in user and the auth actions. */
export function useSession() {
  const value = use(AuthContext);
  if (!value) {
    throw new Error('useSession must be wrapped in a <SessionProvider />');
  }
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [[isLoading, stored], setStored] = useStorageState(STORAGE_KEY);

  const session = parseSession(stored);
  const persist = (value: Session | null) => setStored(value ? JSON.stringify(value) : null);

  // A restored session may hold a token that has since expired — check it once
  // against the API and sign out if the server rejects it.
  const validatedToken = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading || !session || validatedToken.current === session.token) return;
    validatedToken.current = session.token;

    getProfile(session.token).catch((error: unknown) => {
      if (error instanceof ApiError && (error.status === 401 || error.status === 404)) {
        persist(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, session?.token]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
        signIn: async (email, password) => {
          const result = await requestLogin(email, password);
          persist({ token: result.token, user: result.user });
        },
        signUp: async (input) => {
          const result = await requestSignup(input);
          persist({ token: result.token, user: result.user });
        },
        signOut: async () => {
          // Revoke the token server-side; clearing it locally always succeeds.
          if (session) {
            await requestLogout(session.token).catch(() => undefined);
          }
          persist(null);
        },
      }}>
      {children}
    </AuthContext.Provider>
  );
}
