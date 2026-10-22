import { NextRequest, NextResponse } from 'next/server';
import { unsealData } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/session-config';

function reject(request: NextRequest, pathname: string) {
  // API routes must return 401 JSON instead of redirecting (AC 60)
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

/**
 * Cryptographically verifies the iron-session cookie. A cookie that merely
 * exists (e.g. forged) is NOT enough: it must unseal with the server secret
 * and carry an active logged-in session.
 */
async function hasValidSession(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get(sessionOptions.cookieName)?.value;
  if (!cookie) return false;
  try {
    const data = await unsealData<Partial<SessionData>>(cookie, {
      password: sessionOptions.password,
      ttl: sessionOptions.ttl,
    });
    return Boolean(data && data.isLoggedIn === true && data.userId);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes and assets
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  if (!(await hasValidSession(request))) {
    return reject(request, pathname);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
