import { useState } from 'react';
import { auth } from 'void/client';
import type { Props } from './auth.server.ts';

export default function Auth({ serverUser }: Props) {
  const [name, setName] = useState('Comparison user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const session = auth.useSession();
  const user = session.data?.user.name ?? 'signed out';
  const [error, setError] = useState('');

  async function authenticate(operation: 'sign-up' | 'sign-in' | 'sign-out') {
    setError('');
    try {
      if (operation === 'sign-out') {
        const result = await auth.signOut();
        if (result.error) setError(result.error.message ?? 'Sign out failed');
        return;
      }
      const result = operation === 'sign-up'
        ? await auth.signUp.email({ name, email, password })
        : await auth.signIn.email({ email, password });
      if (result.error) setError(result.error.message ?? 'Authentication failed');
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }

  return <section>
    <h1>Local email authentication</h1>
    <label htmlFor="auth-name">Name</label>
    <input id="auth-name" value={name} onChange={(event) => setName(event.target.value)} />
    <label htmlFor="auth-email">Email</label>
    <input id="auth-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
    <label htmlFor="auth-password">Password</label>
    <input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
    <button data-testid="sign-up" onClick={() => authenticate('sign-up')}>Sign up</button>
    <button data-testid="sign-in" onClick={() => authenticate('sign-in')}>Sign in</button>
    <button data-testid="sign-out" onClick={() => authenticate('sign-out')}>Sign out</button>
    <output data-testid="auth-user">{user}</output>
    <output data-testid="server-user">{serverUser}</output>
    <output data-testid="auth-error">{error}</output>
  </section>;
}
