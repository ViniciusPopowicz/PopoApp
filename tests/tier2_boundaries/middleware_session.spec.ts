import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { createMockSessionCookie } from '../helpers/auth-helper';

function req(path: string, cookie?: string) {
  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    headers: cookie ? { cookie } : {},
  });
}

describe('Security: middleware verifies the sealed session cookie (AC 60, §39)', () => {
  it('redirects unauthenticated page requests to /login', async () => {
    const res = await middleware(req('/clientes'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('returns 401 JSON for unauthenticated API requests', async () => {
    const res = await middleware(req('/api/clients'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('rejects a forged (unsealable) session cookie on pages and APIs', async () => {
    const forged = 'popoapp-session=forged_token_value';
    const page = await middleware(req('/clientes', forged));
    expect(page.status).toBe(307);
    const api = await middleware(req('/api/attachments/abc', forged));
    expect(api.status).toBe(401);
  });

  it('rejects a validly sealed cookie whose session is not logged in', async () => {
    const cookie = await createMockSessionCookie({ isLoggedIn: false });
    const res = await middleware(req('/api/clients', cookie));
    expect(res.status).toBe(401);
  });

  it('allows a validly sealed, logged-in session through', async () => {
    const cookie = await createMockSessionCookie();
    const res = await middleware(req('/clientes', cookie));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('keeps /login and /api/auth public', async () => {
    expect((await middleware(req('/login'))).status).toBe(200);
    expect((await middleware(req('/api/auth/login'))).status).toBe(200);
  });
});
