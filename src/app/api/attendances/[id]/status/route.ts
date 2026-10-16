import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { AttendanceService } from '@/services/attendance.service';
import { DomainError, ValidationError } from '@/lib/errors';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const { status } = body;

    if (!status) {
      return NextResponse.json({ success: false, error: 'O status é obrigatório' }, { status: 400 });
    }

    let result;
    switch (status) {
      case 'Realizado':
        result = await AttendanceService.completeAttendance(id);
        break;
      case 'Cancelado':
        result = await AttendanceService.cancelAttendance(id);
        break;
      default:
        throw new ValidationError(`Status de atendimento inválido: "${status}"`);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao alterar status do atendimento' }, { status: 500 });
  }
}
