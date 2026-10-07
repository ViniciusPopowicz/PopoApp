import { SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';
import { UnauthorizedError } from '@/lib/errors';
import { NextRequest } from 'next/server';

export interface SessionData {
  userId: string;
  nickname: string;
  displayName: string;
  isLoggedIn: boolean;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_12345',
  cookieName: 'popoapp-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
  ttl: 60 * 60 * 24, // 24 hours
};

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
