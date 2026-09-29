/** Strips the password before a user object is sent to a client. */
export function toPublicUser<T extends { password: string }>(user: T): Omit<T, 'password'> {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}
