/**
 * Strips a `password` field before a user object is sent to a client. Auth is
 * passwordless now, so this is normally a no-op — it stays as a guard so a
 * stray column can never leak through a response.
 */
export function toPublicUser<T extends object>(user: T): Omit<T, 'password'> {
  const { password: _password, ...publicUser } = user as T & { password?: string };
  return publicUser as Omit<T, 'password'>;
}
