import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';
import { z } from 'zod';
import { setChallenge } from '@/lib/auth';
import { badRequest, parseBody } from '@/lib/api';
import { userDB } from '@/lib/db';
import { allowRequest } from '@/lib/rate-limit';
import { rpID, rpName } from '@/lib/webauthn-config';

const schema = z.object({
  username: z.string().trim().min(3, 'Username must be 3-32 characters').max(32, 'Username must be 3-32 characters')
    .regex(/^[A-Za-z0-9_.-]+$/, 'Username may only contain letters, numbers, . _ -'),
});

export async function POST(request: NextRequest) {
  if (!allowRequest(request, 'auth')) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const parsed = await parseBody(request, schema);
  if ('error' in parsed) return parsed.error;
  const { username } = parsed.data;
  if (userDB.findByUsername(username)) return badRequest('Username already taken');

  const userHandle = crypto.getRandomValues(new Uint8Array(32));
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: username,
    userID: userHandle,
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
  });
  await setChallenge({ challenge: options.challenge, username, userHandle: isoBase64URL.fromBuffer(userHandle) });
  return NextResponse.json(options);
}
