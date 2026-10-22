import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { getSession } from '@/lib/session';
import { attachmentService } from '@/services/attachment.service';
import { DomainError } from '@/lib/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession(request);
    if (!session || !session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const attachment = await attachmentService.getAttachmentById(id);

    if (!attachment) {
      return NextResponse.json(
        { success: false, error: 'Anexo não encontrado' },
        { status: 404 }
      );
    }

    const filePath = attachmentService.getAbsoluteFilePath(attachment);
    if (!fsSync.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: 'Arquivo físico não encontrado no servidor' },
        { status: 404 }
      );
    }

    const fileBuffer = await fs.readFile(filePath);

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Length': attachment.tamanhoBytes.toString(),
        'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.nomeOriginal)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in GET /api/attachments/[id]:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao recuperar arquivo' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession(request);
    if (!session || !session.isLoggedIn || !session.userId) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    await attachmentService.deleteAttachment(id);

    return NextResponse.json({
      success: true,
      message: 'Anexo removido com sucesso.',
    });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in DELETE /api/attachments/[id]:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Erro interno ao remover anexo' },
      { status: 500 }
    );
  }
}
