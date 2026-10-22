import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/session';
import { AttendanceService } from '@/services/attendance.service';
import { addAttendanceProcedureSchema } from '@/schemas/attendance';
import { DomainError } from '@/lib/errors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request);
    const { id: attendanceId } = await params;
    const body = await request.json();

    const parsed = addAttendanceProcedureSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Dados do procedimento inválidos', issues: parsed.error.format() },
        { status: 400 }
      );
    }

    const procedure = await AttendanceService.addProcedure(attendanceId, parsed.data);
    return NextResponse.json({ success: true, data: procedure }, { status: 201 });
  } catch (error: any) {
    if (error instanceof DomainError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: 'Erro interno ao adicionar procedimento ao atendimento' }, { status: 500 });
  }
}
