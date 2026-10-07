import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { attachmentService } from '@/services/attachment.service';
import { DomainError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isLoggedIn || !session.userId) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const clientId = (formData.get('clientId') as string | null) || undefined;
    const attendanceId = (formData.get('attendanceId') as string | null) || undefined;
    const categoria = (formData.get('categoria') as string | null) || undefined;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Nenhum arquivo enviado.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const attachment = await attachmentService.saveAttachment({
      fileBuffer,
      originalName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      clientId,
      attendanceId,
      categoria,
    });

    return NextResponse.json({ success: true, data: attachment, attachment }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in POST /api/attachments:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao salvar anexo' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isLoggedIn || !session.userId) {
      return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId') || undefined;
    const attendanceId = searchParams.get('attendanceId') || undefined;
    const categoria = searchParams.get('categoria') || undefined;

    const attachments = await attachmentService.listAttachments({
      clientId,
      attendanceId,
      categoria,
    });

    return NextResponse.json({ success: true, data: attachments });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in GET /api/attachments:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao consultar anexos' },
      { status: 500 }
    );
  }
}
