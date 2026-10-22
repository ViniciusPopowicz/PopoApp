// src/app/api/reminders/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { ReminderService } from '@/services/reminder.service';
import { updateReminderStatusSchema } from '@/schemas/reminder';
import { DomainError } from '@/lib/errors';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const parsed = updateReminderStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Status de lembrete inválido', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    // Critical Invariant (V23, AC 68): mutates ONLY Reminder, never mutates payment or installment!
    const reminder = await ReminderService.updateReminderStatus(id, parsed.data.status);
    return NextResponse.json({ success: true, data: reminder });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao alterar status do lembrete' }, { status: 500 });
  }
}
