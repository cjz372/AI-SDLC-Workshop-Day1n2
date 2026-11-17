import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { z } from 'zod';
import { setChallenge } from '@/lib/auth';
import { parseBody } from '@/lib/api';
import { authenticatorDB, userDB } from '@/lib/db';
import { allowRequest } from '@/lib/rate-limit';
import { rpID } from '@/lib/webauthn-config';

const schema = z.object({ username: z.string().trim().max(32).optional() });

export async function POST(request: NextRequest) {
  if (!allowRequest(request, 'auth')) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const parsed = await parseBody(request, schema);
  if ('error' in parsed) return parsed.error;
  const { username } = parsed.data;

  // With a username: restrict to that user's passkeys. Without: discoverable-credential login.
  let allowCredentials: { id: string }[] | undefined;
  if (username) {
    const user = userDB.findByUsername(username);
    const creds = user ? authenticatorDB.listByUser(user.id) : [];
    if (creds.length === 0) return NextResponse.json({ error: 'No passkey found for that username' }, { status: 404 });
    allowCredentials = creds.map((c) => ({ id: c.credential_id }));
  }
  const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred', allowCredentials });
  await setChallenge({ challenge: options.challenge });
  return NextResponse.json(options);
}
