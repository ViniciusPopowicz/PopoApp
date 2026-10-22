import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { AppointmentService } from '@/services/appointment.service';
import { DomainError, ValidationError } from '@/lib/errors';
import { PROHIBITED_APPOINTMENT_STATUSES } from '@/types/appointment';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const { status, motivoCancelamento, observacoes } = body;

    if (!status) {
      return NextResponse.json({ success: false, error: 'O status é obrigatório' }, { status: 400 });
    }

    if (PROHIBITED_APPOINTMENT_STATUSES.includes(status as any)) {
      return NextResponse.json(
        { success: false, error: 'Status de agendamento inválido. "Em atendimento" não é permitido.' },
        { status: 400 }
      );
    }

    let result;
    switch (status) {
      case 'Confirmado':
        result = await AppointmentService.confirmAppointment(id);
        break;
      case 'Concluído':
        result = await AppointmentService.completeAppointment(id);
        break;
      case 'Cancelado':
        if (!motivoCancelamento || typeof motivoCancelamento !== 'string' || motivoCancelamento.trim().length < 3) {
          throw new ValidationError('Motivo do cancelamento é obrigatório (mínimo 3 caracteres)');
        }
        result = await AppointmentService.cancelAppointment(id, { motivoCancelamento });
        break;
      case 'Não compareceu':
        result = await AppointmentService.markNoShow(id, { observacoes });
        break;
      default:
        throw new ValidationError(`Transição direta para status "${status}" não suportada`);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao alterar status do agendamento' }, { status: 500 });
  }
}
