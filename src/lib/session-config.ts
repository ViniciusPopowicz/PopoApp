import type { SessionOptions } from 'iron-session';

/**
 * Edge-safe session configuration (no next/headers import) so it can be used
 * from both middleware and route handlers.
 */
export interface SessionData {
  userId: string;
  nickname: string;
  displayName: string;
  isLoggedIn: boolean;
}

const DEV_FALLBACK_SECRET = 'complex_password_at_least_32_characters_long_12345';

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  // Do not run production with the public development secret (see SETUP_GUIDE.md).
  console.warn('[PopoApp] SESSION_SECRET não definido: defina um segredo próprio (mínimo 32 caracteres) em produção.');
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || DEV_FALLBACK_SECRET,
  cookieName: 'popoapp-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
  },
  ttl: 60 * 60 * 24, // 24 hours
};
