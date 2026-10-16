import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { AttendanceService } from '@/services/attendance.service';
import { updateAttendanceProcedureSchema } from '@/schemas/attendance';
import { DomainError } from '@/lib/errors';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; procId: string }> }
) {
  try {
    await requireAuth(request);
    const { id: attendanceId, procId: attendanceProcedureId } = await params;
    const body = await request.json();

    const parsed = updateAttendanceProcedureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados do procedimento inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = await AttendanceService.updateProcedurePracticedValue(
      attendanceId,
      attendanceProcedureId,
      parsed.data
    );
    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao atualizar procedimento' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; procId: string }> }
) {
  try {
    await requireAuth(request);
    const { id: attendanceId, procId: attendanceProcedureId } = await params;

    const result = await AttendanceService.removeProcedure(attendanceId, attendanceProcedureId);
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao remover procedimento' }, { status: 500 });
  }
}
