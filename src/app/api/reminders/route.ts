// src/app/api/reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { ReminderService } from '@/services/reminder.service';
import { createReminderSchema, reminderQuerySchema } from '@/schemas/reminder';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;

    const rawQuery = {
      status: searchParams.get('status') ?? undefined,
      prioridade: searchParams.get('prioridade') ?? undefined,
      tipo: searchParams.get('tipo') ?? undefined,
      clientId: searchParams.get('clientId') ?? undefined,
      pixInstallmentId: searchParams.get('pixInstallmentId') ?? undefined,
      startDate: searchParams.get('startDate') ?? undefined,
      endDate: searchParams.get('endDate') ?? undefined,
      overdueOnly: searchParams.get('overdueOnly') ?? undefined,
      upcomingDays: searchParams.get('upcomingDays') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      offset: searchParams.get('offset') ?? undefined,
    };

    const parsed = reminderQuerySchema.safeParse(rawQuery);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros de consulta inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const [reminders, stats] = await Promise.all([
      ReminderService.listReminders(parsed.data),
      ReminderService.getReminderStats(),
    ]);

    return NextResponse.json({ success: true, data: reminders, stats });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao listar lembretes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();

    const parsed = createReminderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados do lembrete inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const reminder = await ReminderService.createReminder(parsed.data);
    return NextResponse.json({ success: true, data: reminder }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao criar lembrete' }, { status: 500 });
  }
}
