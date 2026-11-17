import { NextRequest, NextResponse } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { createSession, takeChallenge } from '@/lib/auth';
import { authenticatorDB, userDB } from '@/lib/db';
import { allowRequest } from '@/lib/rate-limit';
import { rpID, rpOrigin } from '@/lib/webauthn-config';

const fail = (status = 400) => NextResponse.json({ error: 'Authentication failed' }, { status });

export async function POST(request: NextRequest) {
  if (!allowRequest(request, 'auth')) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const pending = await takeChallenge();
  if (!pending) return NextResponse.json({ error: 'Login expired, please try again' }, { status: 400 });

  let response: AuthenticationResponseJSON;
  try {
    response = (await request.json()).response;
  } catch {
    return fail();
  }

  const authenticator = authenticatorDB.findByCredentialId(response?.id);
  if (!authenticator) return fail(401);

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: rpOrigin,
      expectedRPID: rpID,
      credential: {
        id: authenticator.credential_id,
        publicKey: new Uint8Array(authenticator.credential_public_key),
        counter: authenticator.counter ?? 0,
      },
    });
    if (!verification.verified) return fail(401);
    authenticatorDB.updateCounter(authenticator.id, verification.authenticationInfo.newCounter ?? 0);
    const user = userDB.findById(authenticator.user_id);
    if (!user) return fail(401);
    await createSession({ userId: user.id, username: user.username });
    return NextResponse.json({ success: true, username: user.username });
  } catch (error) {
    console.error('Authentication verification failed:', error);
    return fail(401);
  }
}
