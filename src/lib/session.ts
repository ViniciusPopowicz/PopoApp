import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { UnauthorizedError } from '@/lib/errors';
import { NextRequest } from 'next/server';
import { sessionOptions, type SessionData } from '@/lib/session-config';

export { sessionOptions };
export type { SessionData };

export async function getSession(request?: NextRequest) {
  if (request && request.cookies) {
    try {
      return await getIronSession<SessionData>(request.cookies as any, sessionOptions);
    } catch {
      // fallback if request.cookies cannot be parsed directly
    }
  }
  try {
    return await getIronSession<SessionData>(await cookies(), sessionOptions);
  } catch {
    return {
      userId: '',
      nickname: '',
      displayName: '',
      isLoggedIn: false,
    } as any;
  }
}

/**
 * Guard that verifies the active session.
 * Throws UnauthorizedError (401) if not logged in.
 */
export async function requireAuth(request?: NextRequest): Promise<SessionData> {
  const session = await getSession(request);
  if (!session || !session.isLoggedIn || !session.userId) {
    throw new UnauthorizedError('Sessão expirada ou não autenticada');
  }
  return session;
}
