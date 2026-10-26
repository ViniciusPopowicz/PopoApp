// src/app/api/reminders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { ReminderService } from '@/services/reminder.service';
import {
  createReminderSchema,
  createReminderRecurrenceSchema,
  reminderQuerySchema,
} from '@/schemas/reminder';
import { DomainError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;

    const rawQuery = {
      status: searchParams.get('status') ?? undefined,
      prioridade: searchParams.get('prioridade') ?? undefined,
      tipo: searchParams.get('tipo') ?? undefined,
      clientId: searchParams.get('clientId') ?? undefined,
      appointmentId: searchParams.get('appointmentId') ?? undefined,
      attendanceId: searchParams.get('attendanceId') ?? undefined,
      pixInstallmentId: searchParams.get('pixInstallmentId') ?? undefined,
      recurrenceId: searchParams.get('recurrenceId') ?? undefined,
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

    // Automatically process any due recurring occurrences before listing
    await ReminderService.generateDueOccurrences();

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

    // If recurrence parameters are supplied, create a ReminderRecurrence and generate due occurrences
    if (body.recorrente === true || body.frequencia) {
      const recInput = createReminderRecurrenceSchema.safeParse({
        ...body,
        dataInicio: body.dataInicio ?? body.dataVencimento,
      });
      if (!recInput.success) {
        return NextResponse.json(
          { success: false, error: 'Dados de recorrência inválidos', issues: recInput.error.format() },
          { status: 400 }
        );
      }
      const recurrence = await ReminderService.createRecurrence(recInput.data);
      return NextResponse.json(
        {
          success: true,
          data: recurrence.occurrences?.[0] ?? recurrence,
          recurrence,
        },
        { status: 201 }
      );
    }

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
