import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/jwt';

export async function middleware(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (pathname === '/login') {
    return session ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  }
  if (!session) return NextResponse.redirect(new URL('/login', request.url));
  return NextResponse.next();
}

export const config = { matcher: ['/', '/calendar', '/login'] };
