import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { ClientService } from '@/services/client.service';
import { updateClientSchema } from '@/schemas/client';
import { DomainError } from '@/lib/errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;

    const includeHistory = request.nextUrl.searchParams.get('history') === 'true';

    const client = includeHistory
      ? await ClientService.getClientWithHistory(id)
      : await ClientService.getClientById(id);

    return NextResponse.json({ success: true, data: client });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in GET /api/clients/[id]:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;

    const body = await request.json();
    const parsed = updateClientSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados inválidos',
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updated = await ClientService.updateClient(id, parsed.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in PUT /api/clients/[id]:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;

    await ClientService.deactivateClient(id);
    return NextResponse.json({ success: true, message: 'Cliente inativado com sucesso' });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in DELETE /api/clients/[id]:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
