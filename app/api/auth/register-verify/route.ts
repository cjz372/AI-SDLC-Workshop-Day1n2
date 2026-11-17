import { NextRequest, NextResponse } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { createSession, takeChallenge } from '@/lib/auth';
import { authenticatorDB, userDB } from '@/lib/db';
import { allowRequest } from '@/lib/rate-limit';
import { rpID, rpOrigin } from '@/lib/webauthn-config';

export async function POST(request: NextRequest) {
  if (!allowRequest(request, 'auth')) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const pending = await takeChallenge();
  if (!pending?.username) return NextResponse.json({ error: 'Registration expired, please try again' }, { status: 400 });

  let response: RegistrationResponseJSON;
  try {
    response = (await request.json()).response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  try {
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: 'Registration could not be verified' }, { status: 400 });
    }
    if (userDB.findByUsername(pending.username)) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }
    const { credential } = verification.registrationInfo;
    const user = userDB.create(pending.username);
    authenticatorDB.create({
      user_id: user.id,
      credential_id: credential.id,
      credential_public_key: Buffer.from(credential.publicKey),
      counter: credential.counter ?? 0,
    });
    await createSession({ userId: user.id, username: user.username });
    return NextResponse.json({ success: true, username: user.username });
  } catch (error) {
    console.error('Registration verification failed:', error);
    return NextResponse.json({ error: 'Registration could not be verified' }, { status: 400 });
  }
}
