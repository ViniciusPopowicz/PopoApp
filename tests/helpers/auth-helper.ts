import { SessionData, sessionOptions } from '@/lib/session';
import { sealData } from 'iron-session';

/**
 * Generates an encrypted iron-session cookie string for testing authenticated HTTP requests.
 */
export async function createMockSessionCookie(userData: Partial<SessionData> = {}): Promise<string> {
  const sessionData: SessionData = {
    userId: userData.userId ?? 'test-user-id-uuid',
    nickname: userData.nickname ?? 'admin',
    displayName: userData.displayName ?? 'Administradora Popó',
    isLoggedIn: userData.isLoggedIn ?? true,
  };

  const sealed = await sealData(sessionData, {
    password: sessionOptions.password,
    ttl: sessionOptions.ttl,
  });

  return `${sessionOptions.cookieName}=${sealed}`;
}

/**
 * Returns HTTP headers containing an authenticated test session cookie.
 */
export async function getAuthHeaders(userData: Partial<SessionData> = {}): Promise<Record<string, string>> {
  const cookie = await createMockSessionCookie(userData);
  return {
    Cookie: cookie,
  };
}
