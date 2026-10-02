
import { SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { getIronSession } from 'iron-session';

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

export async function getSession() {
  return await getIronSession<SessionData>(await cookies(), sessionOptions);
}
