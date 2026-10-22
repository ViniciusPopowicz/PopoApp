import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { AppointmentService } from '@/services/appointment.service';
import { cancelAppointmentSchema } from '@/schemas/appointment';
import { DomainError } from '@/lib/errors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const parsed = cancelAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados de cancelamento inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const cancelled = await AppointmentService.cancelAppointment(id, parsed.data);
    return NextResponse.json({ success: true, data: cancelled });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao cancelar agendamento' }, { status: 500 });
  }
}
