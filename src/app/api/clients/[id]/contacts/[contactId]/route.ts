import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { ClientService } from '@/services/client.service';
import { updateEmergencyContactSchema } from '@/schemas/client';
import { DomainError } from '@/lib/errors';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    await requireAuth(request);
    const { id, contactId } = await params;

    const body = await request.json();
    const parsed = updateEmergencyContactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Dados do contato de emergência inválidos',
          fieldErrors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const updated = await ClientService.updateEmergencyContact(id, contactId, parsed.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in PUT /api/clients/[id]/contacts/[contactId]:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    await requireAuth(request);
    const { id, contactId } = await params;

    await ClientService.deleteEmergencyContact(id, contactId);
    return NextResponse.json({ success: true, message: 'Contato de emergência removido com sucesso' });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    console.error('Error in DELETE /api/clients/[id]/contacts/[contactId]:', error);
    return NextResponse.json({ success: false, error: 'Erro interno do servidor' }, { status: 500 });
  }
}
