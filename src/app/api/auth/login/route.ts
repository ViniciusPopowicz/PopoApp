import { NextRequest, NextResponse } from 'next/server';
import { validateCredentials } from '@/services/auth.service';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/session';
import { cookies } from 'next/headers';
import { loginSchema } from '@/schemas/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 400 });
    }
    const user = await validateCredentials(parsed.data.nickname, parsed.data.password);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuário ou senha inválidos' }, { status: 401 });
    }
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    session.userId = user.userId;
    session.nickname = user.nickname;
    session.displayName = user.displayName;
    session.isLoggedIn = true;
    await session.save();
    return NextResponse.json({ success: true, user: { nickname: user.nickname, displayName: user.displayName } });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
