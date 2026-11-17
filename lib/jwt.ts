import { SignJWT, jwtVerify } from 'jose';
import type { Session } from '@/lib/db';

export const SESSION_COOKIE = 'session';
export const CHALLENGE_COOKIE = 'webauthn_challenge';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
export const CHALLENGE_MAX_AGE_SECONDS = 5 * 60;

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set to a string of at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

async function sign(payload: Record<string, unknown>, expiresIn: string): Promise<string> {
  return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(expiresIn).sign(secretKey());
}

async function verify<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    return payload as unknown as T;
  } catch {
    return null;
  }
}

export const signSessionToken = (s: Session) => sign({ userId: s.userId, username: s.username }, '7d');

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  const p = await verify<Session>(token);
  return p && typeof p.userId === 'number' && typeof p.username === 'string' ? { userId: p.userId, username: p.username } : null;
}

export interface ChallengePayload { challenge: string; username?: string; userHandle?: string; }
export const signChallengeToken = (c: ChallengePayload) => sign({ ...c }, '5m');
export const verifyChallengeToken = (token: string | undefined) => verify<ChallengePayload>(token);
