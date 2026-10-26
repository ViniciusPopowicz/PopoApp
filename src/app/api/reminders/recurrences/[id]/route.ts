// src/app/api/reminders/recurrences/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { ReminderService } from '@/services/reminder.service';
import { updateReminderRecurrenceSchema } from '@/schemas/reminder';
import { DomainError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const recurrence = await ReminderService.getRecurrenceById(id);
    return NextResponse.json({ success: true, data: recurrence });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: 'Erro interno ao buscar regra de recorrência' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const parsed = updateReminderRecurrenceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos para atualização', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await ReminderService.updateRecurrence(id, parsed.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: 'Erro interno ao atualizar regra de recorrência' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const disabled = await ReminderService.disableRecurrence(id);
    return NextResponse.json({ success: true, data: disabled });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: 'Erro interno ao desativar regra de recorrência' },
      { status: 500 }
    );
  }
}
