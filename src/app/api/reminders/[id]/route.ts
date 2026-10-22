// src/app/api/reminders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { ReminderService } from '@/services/reminder.service';
import { updateReminderSchema } from '@/schemas/reminder';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;

    const reminder = await ReminderService.getReminderById(id);
    return NextResponse.json({ success: true, data: reminder });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao buscar lembrete' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const parsed = updateReminderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados inválidos para atualização', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const reminder = await ReminderService.updateReminder(id, parsed.data);
    return NextResponse.json({ success: true, data: reminder });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao atualizar lembrete' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;

    await ReminderService.deleteReminder(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao excluir lembrete' }, { status: 500 });
  }
}
