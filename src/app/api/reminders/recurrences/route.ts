// src/app/api/reminders/recurrences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { ReminderService } from '@/services/reminder.service';
import { createReminderRecurrenceSchema } from '@/schemas/reminder';
import { DomainError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const searchParams = request.nextUrl.searchParams;
    const clientId = searchParams.get('clientId') ?? undefined;
    const appointmentId = searchParams.get('appointmentId') ?? undefined;
    const attendanceId = searchParams.get('attendanceId') ?? undefined;
    const isActiveParam = searchParams.get('isActive');
    const isActive =
      isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined;

    const recurrences = await ReminderService.listRecurrences({
      clientId,
      appointmentId,
      attendanceId,
      isActive,
    });

    return NextResponse.json({ success: true, data: recurrences });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: 'Erro interno ao listar regras de recorrência' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const body = await request.json();

    const parsed = createReminderRecurrenceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados de recorrência inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const referenceDate = body.referenceDate ? new Date(body.referenceDate) : new Date();
    const recurrence = await ReminderService.createRecurrence(parsed.data, referenceDate);

    return NextResponse.json({ success: true, data: recurrence }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: 'Erro interno ao criar regra de recorrência' },
      { status: 500 }
    );
  }
}
