import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { attachmentService } from '@/services/attachment.service';
import { DomainError } from '@/lib/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession(request);
    if (!session || !session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const formData = await request.formData();
    const file = (formData.get('file') as File | null) || (formData.get('photo') as File | null);

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Nenhuma foto enviada' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const attachment = await attachmentService.setClientProfilePhoto(
      id,
      fileBuffer,
      file.name,
      file.type,
      file.size
    );

    return NextResponse.json(
      { success: true, data: attachment, attachment },
      { status: 200 }
    );
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in POST /api/clients/[id]/photo:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao atualizar foto de perfil' },
      { status: 500 }
    );
  }
}
