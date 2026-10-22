import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { AppointmentService } from '@/services/appointment.service';
import { updateAppointmentSchema } from '@/schemas/appointment';
import { DomainError } from '@/lib/errors';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const appointment = await AppointmentService.getAppointmentById(id);
    return NextResponse.json({ success: true, data: appointment });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao consultar agendamento' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const parsed = updateAppointmentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados de atualização inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await AppointmentService.updateAppointment(id, parsed.data);
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao atualizar agendamento' }, { status: 500 });
  }
}
