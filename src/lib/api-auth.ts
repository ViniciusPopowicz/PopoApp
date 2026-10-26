import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { DomainError } from '@/lib/errors';
import { ZodError } from 'zod';

export async function requireAuth(request?: NextRequest) {
  const session = await getSession(request);
  if (!session || !session.isLoggedIn || !session.userId) {
    return {
      session: null,
      error: NextResponse.json(
        { success: false, error: 'Sessão expirada ou não autenticada' },
        { status: 401 }
      ),
    };
  }
  return { session, error: null };
}

export function handleApiError(err: unknown) {
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: err.errors[0]?.message || 'Dados inválidos',
        details: err.flatten(),
      },
      { status: 400 }
    );
  }
  if (err instanceof DomainError) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.statusCode }
    );
  }
  console.error('[API Error]', err);
  return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
}
