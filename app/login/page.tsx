'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setError('');
    setBusy(true);
    try {
      await action();
      router.push('/');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const register = () => run(async () => {
    const options = await postJson('/api/auth/register-options', { username });
    const response = await startRegistration({ optionsJSON: options });
    await postJson('/api/auth/register-verify', { response });
  });

  const login = () => run(async () => {
    const options = await postJson('/api/auth/login-options', { username: username || undefined });
    const response = await startAuthentication({ optionsJSON: options });
    await postJson('/api/auth/login-verify', { response });
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="rounded-xl bg-white p-8 shadow-lg dark:bg-gray-800">
        <h1 className="mb-1 text-3xl font-bold">Todo App</h1>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">Passwordless sign-in with passkeys</p>
        <label htmlFor="username" className="mb-1 block text-sm font-medium">Username</label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter a username"
          autoComplete="username webauthn"
          className="mb-4 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
        />
        {error && <p role="alert" data-testid="error-message" className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-3">
          <button onClick={register} disabled={busy || username.trim().length < 3}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            Register
          </button>
          <button onClick={login} disabled={busy}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 disabled:opacity-50">
            Login
          </button>
        </div>
      </div>
    </main>
  );
}
