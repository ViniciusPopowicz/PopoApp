import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { AppointmentService } from '@/services/appointment.service';
import { rescheduleAppointmentSchema } from '@/schemas/appointment';
import { DomainError } from '@/lib/errors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const parsed = rescheduleAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados de reagendamento inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const newAppointment = await AppointmentService.rescheduleAppointment(id, parsed.data);
    return NextResponse.json({ success: true, data: newAppointment }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao reagendar agendamento' }, { status: 500 });
  }
}
