import { cookies } from 'next/headers';
import type { Session } from '@/lib/db';
import {
  CHALLENGE_COOKIE, CHALLENGE_MAX_AGE_SECONDS, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS,
  signChallengeToken, signSessionToken, verifyChallengeToken, verifySessionToken, type ChallengePayload,
} from '@/lib/jwt';

const cookieBase = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export async function createSession(session: Session): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSessionToken(session), { ...cookieBase, maxAge: SESSION_MAX_AGE_SECONDS });
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', { ...cookieBase, maxAge: 0 });
}

export async function setChallenge(payload: ChallengePayload): Promise<void> {
  const store = await cookies();
  store.set(CHALLENGE_COOKIE, await signChallengeToken(payload), { ...cookieBase, maxAge: CHALLENGE_MAX_AGE_SECONDS });
}

/** Reads and clears the pending WebAuthn challenge (single use). */
export async function takeChallenge(): Promise<ChallengePayload | null> {
  const store = await cookies();
  const payload = await verifyChallengeToken(store.get(CHALLENGE_COOKIE)?.value);
  store.set(CHALLENGE_COOKIE, '', { ...cookieBase, maxAge: 0 });
  return payload;
}
